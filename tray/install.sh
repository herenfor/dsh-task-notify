#!/usr/bin/env bash
# Installs the optional Windows tray icon. Run inside WSL:
#   bash tray/install.sh [--port 3080] [--desktop|--no-desktop] [--autostart|--no-autostart]
# Copies the Windows half to %USERPROFILE%\DshTray and records which WSL distro, port and
# host script it drives. In a terminal it asks whether to add a desktop shortcut (default yes)
# and a Startup entry that only shows the icon at sign-in (default no); the flags skip the questions.
# Files go through /mnt/c so they land on the real disk, whatever process runs this script.
set -euo pipefail

here=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
port=3080
desktop=ask
autostart=ask
while [[ $# -gt 0 ]]; do
  case "$1" in
    --port) port=${2:?--port needs a number}; shift 2 ;;
    --desktop) desktop=1; shift ;;
    --no-desktop) desktop=0; shift ;;
    --autostart) autostart=1; shift ;;
    --no-autostart) autostart=0; shift ;;
    *) printf 'usage: %s [--port N] [--desktop|--no-desktop] [--autostart|--no-autostart]\n' "$0" >&2; exit 2 ;;
  esac
done
[[ "$port" =~ ^[0-9]+$ ]] || { printf 'dsh-tray: --port must be a number\n' >&2; exit 2; }
[[ -n "${WSL_DISTRO_NAME-}" ]] || { printf 'dsh-tray: run this inside WSL\n' >&2; exit 1; }

windows_env() {
  (cd /mnt/c && cmd.exe /d /c "echo %$1%" 2>/dev/null) | tr -d '\r'
}
# Ask only in a terminal; without one, fall back to the default.
ask() {
  local answer default=$2
  if [[ ! -t 0 ]]; then [[ "$default" == y ]]; return; fi
  read -r -p "$1 " answer || answer=
  answer=${answer:-$default}
  [[ "$answer" == [yY]* ]]
}
json_string() {
  local value=${1//\\/\\\\}
  printf '"%s"' "${value//\"/\\\"}"
}

target="$(wslpath "$(windows_env USERPROFILE)")/DshTray"
mkdir -p "$target"
cp "$here/dsh-tray.ps1" "$here/start-dsh-tray.vbs" "$here/../whale.ico" "$target/"
cat > "$target/dsh-tray.json" <<JSON
{
  "distro": $(json_string "$WSL_DISTRO_NAME"),
  "port": $port,
  "host": $(json_string "$here/dsh-tray-host.sh")
}
JSON
launcher="$(wslpath -w "$target/start-dsh-tray.vbs")"
printf 'Installed: %s\n' "$launcher"

if [[ "$desktop" == ask ]]; then
  ask 'Create a desktop shortcut? / 在桌面创建快捷方式？[Y/n]' y && desktop=1 || desktop=0
fi
if [[ "$desktop" == 1 ]]; then
  # The tray itself is installed already; a failed shortcut is only reported.
  if shortcut="$(powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$(wslpath -w "$here/create-shortcut.ps1")" "$(wslpath -w "$target")" | tr -d '\r')"; then
    printf 'Desktop shortcut: %s\n' "$shortcut"
  else
    printf 'dsh-tray: could not create the desktop shortcut; start %s instead\n' "$launcher" >&2
  fi
fi

if [[ "$autostart" == ask ]]; then
  ask 'Show the tray icon at sign-in? / 开机时显示托盘图标？[y/N]' n && autostart=1 || autostart=0
fi
if [[ "$autostart" == 1 ]]; then
  startup="$(wslpath "$(windows_env APPDATA)")/Microsoft/Windows/Start Menu/Programs/Startup"
  printf 'CreateObject("WScript.Shell").Run "wscript.exe ""%s"" quiet", 0, False\r\n' "$launcher" > "$startup/DSH tray.vbs"
  printf 'Autostart: %s\n' "$(wslpath -w "$startup/DSH tray.vbs")"
fi
