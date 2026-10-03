$ErrorActionPreference = 'Stop'

Import-Module BurntToast -RequiredVersion 1.1.0 -ErrorAction Stop
. (Join-Path $PSScriptRoot 'notification-identity.ps1')
. (Join-Path $PSScriptRoot 'notification-content.ps1')
# BurntToast supplies WinRT types for pwsh; use the shared XML directly to avoid
# its template-binding placeholders, and explicitly select the DSH identity.
$xml = [Windows.Data.Xml.Dom.XmlDocument]::new()
$xml.LoadXml($notificationXml)
$toast = [Windows.UI.Notifications.ToastNotification]::new($xml)
[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier($notificationAppId).Show($toast)
Write-Output "Toast submitted from pwsh. AppID: $notificationAppId"
