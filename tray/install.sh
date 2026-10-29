#!/usr/bin/env bash
# Installs the optional Windows tray icon. Run inside WSL:
#   bash tray/install.sh [--port 3080] [--autostart]
# Copies the Windows half to %USERPROFILE%\DshTray and records which WSL distro, port and
# host script it drives. --autostart adds a Startup entry that only shows the icon at sign-in.
# Files go through /mnt/c so they land on the real disk, whatever process runs this script.
set -euo pipefail

here=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
port=3080
autostart=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --port) port=${2:?--port needs a number}; shift 2 ;;
    --autostart) autostart=1; shift ;;
    *) printf 'usage: %s [--port N] [--autostart]\n' "$0" >&2; exit 2 ;;
  esac
done
[[ "$port" =~ ^[0-9]+$ ]] || { printf 'dsh-tray: --port must be a number\n' >&2; exit 2; }
[[ -n "${WSL_DISTRO_NAME-}" ]] || { printf 'dsh-tray: run this inside WSL\n' >&2; exit 1; }

windows_env() {
  (cd /mnt/c && cmd.exe /d /c "echo %$1%" 2>/dev/null) | tr -d '\r'
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

if [[ "$autostart" == 1 ]]; then
  startup="$(wslpath "$(windows_env APPDATA)")/Microsoft/Windows/Start Menu/Programs/Startup"
  printf 'CreateObject("WScript.Shell").Run "wscript.exe ""%s"" quiet", 0, False\r\n' "$launcher" > "$startup/DSH tray.vbs"
  printf 'Autostart: %s\n' "$(wslpath -w "$startup/DSH tray.vbs")"
fi
