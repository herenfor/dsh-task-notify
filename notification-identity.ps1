# Register a dedicated per-user identity without changing PowerShell's identity.
$notificationAppId = 'DeepSeekHarness.TaskNotification'
$notificationAssetDir = Join-Path $env:LOCALAPPDATA 'DeepSeekHarness\TaskNotification'
New-Item -ItemType Directory -Path $notificationAssetDir -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'whale.png') -Destination $notificationAssetDir -Force
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'whale.ico') -Destination $notificationAssetDir -Force
$notificationIcon = Join-Path $notificationAssetDir 'whale.png'
$identityKey = "HKCU:\Software\Classes\AppUserModelId\$notificationAppId"
New-Item -Path $identityKey -Force | Out-Null
New-ItemProperty -Path $identityKey -Name DisplayName -Value 'DeepSeek Harness' -PropertyType String -Force | Out-Null
New-ItemProperty -Path $identityKey -Name IconUri -Value $notificationIcon -PropertyType String -Force | Out-Null
