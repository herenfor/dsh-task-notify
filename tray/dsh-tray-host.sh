#!/usr/bin/env bash
# WSL half of the optional Windows tray icon: start, stop, and report the sign-in URL of `dsh web`.
# It only starts and stops DSH; it never updates it.
#
# Settings live in ~/.config/dsh-tray/env (sourced as bash), for example to drive your own launcher:
#   DSH_TRAY_START='my-launcher --no-open'   # must detach or return once the server is starting
#   DSH_TRAY_STOP='my-launcher stop'
#   DSH_TRAY_LOG="$HOME/.cache/my-launcher.log"   # where the launcher writes "dsh web: <url>"
set -euo pipefail
umask 077

config="${XDG_CONFIG_HOME:-$HOME/.config}/dsh-tray/env"
# shellcheck source=/dev/null
[[ -f "$config" ]] && source "$config"

port="${DSH_TRAY_PORT:-3080}"
state_dir="${XDG_CACHE_HOME:-$HOME/.cache}/dsh-tray"
log="${DSH_TRAY_LOG:-$state_dir/web.log}"
pid_file="$state_dir/web.pid"
mkdir -p "$state_dir"

# The recorded pid counts only while it is still a `dsh ... web` process: pids get reused.
recorded_pid() {
  local pid
  pid="$(cat "$pid_file" 2>/dev/null || true)"
  [[ "$pid" =~ ^[0-9]+$ && -r "/proc/$pid/cmdline" ]] || return 1
  tr '\0' ' ' < "/proc/$pid/cmdline" | grep -qE 'dsh.* web( |$)' || return 1
  printf '%s\n' "$pid"
}

case "${1-}" in
  start)
    if [[ -n "${DSH_TRAY_START-}" ]]; then
      setsid -f bash -c "$DSH_TRAY_START" < /dev/null > /dev/null 2>&1
      exit 0
    fi
    recorded_pid > /dev/null && exit 0
    command -v dsh > /dev/null || { printf 'dsh-tray: dsh is not on PATH\n' >&2; exit 1; }
    : > "$log"
    # A new session keeps the server alive after this short-lived wsl.exe call returns.
    setsid -f bash -c 'echo $$ > "$1"; exec dsh web --no-open --port "$2"' _ "$pid_file" "$port" < /dev/null >> "$log" 2>&1
    ;;
  stop)
    if [[ -n "${DSH_TRAY_STOP-}" ]]; then
      bash -c "$DSH_TRAY_STOP"
      exit $?
    fi
    pid="$(recorded_pid)" || exit 0
    kill -TERM "$pid"
    for _ in $(seq 1 100); do
      recorded_pid > /dev/null || { rm -f "$pid_file"; exit 0; }
      sleep 0.1
    done
    printf 'dsh-tray: dsh web did not stop within 10 seconds\n' >&2
    exit 1
    ;;
  url)
    # The tray reads this from stdout and opens it; it is never written anywhere else.
    grep -oE "^dsh web: http://127[.]0[.]0[.]1:$port/[^[:space:]]*" "$log" 2>/dev/null | tail -n 1 | sed 's/^dsh web: //'
    ;;
  *)
    printf 'usage: %s start|stop|url\n' "$0" >&2
    exit 2
    ;;
esac
