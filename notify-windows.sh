#!/usr/bin/env bash
set -u

script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
pwsh_script=$(wslpath -w "$script_dir/notify-windows-pwsh.ps1") || exit 1
legacy_script=$(wslpath -w "$script_dir/notify-windows.ps1") || exit 1

pwsh_command=${DSH_NOTIFY_PWSH:-pwsh.exe}
legacy_command=${DSH_NOTIFY_POWERSHELL:-powershell.exe}

if command -v "$legacy_command" >/dev/null 2>&1; then
  if timeout 8s "$legacy_command" -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$legacy_script"; then
    exit 0
  fi
  printf 'Windows PowerShell notification failed; trying pwsh fallback\n' >&2
fi

if command -v "$pwsh_command" >/dev/null 2>&1; then
  timeout 8s "$pwsh_command" -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$pwsh_script"
  exit $?
fi

printf 'no working Windows PowerShell notification path found\n' >&2
exit 1
