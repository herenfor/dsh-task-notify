# Creates the "DSH" desktop shortcut for the tray icon (called by tray/install.sh).
# The desktop path comes from Windows, so a desktop moved into OneDrive still works.
param([Parameter(Mandatory = $true)][string]$TrayDir)
$ErrorActionPreference = 'Stop'
$desktop = [Environment]::GetFolderPath('Desktop')
$link = (New-Object -ComObject WScript.Shell).CreateShortcut((Join-Path $desktop 'DSH.lnk'))
$link.TargetPath = Join-Path $env:SystemRoot 'System32\wscript.exe'
$link.Arguments = '"' + (Join-Path $TrayDir 'start-dsh-tray.vbs') + '"'
$link.WorkingDirectory = $TrayDir
$link.IconLocation = (Join-Path $TrayDir 'whale.ico') + ',0'
$link.Description = 'DSH'
$link.Save()
Write-Output (Join-Path $desktop 'DSH.lnk')
