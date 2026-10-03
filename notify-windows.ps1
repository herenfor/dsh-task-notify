$ErrorActionPreference = 'Stop'

# Run with Windows PowerShell 5.1. PowerShell 7 does not expose these WinRT
# notification types without an additional Windows SDK projection or module.
. (Join-Path $PSScriptRoot 'notification-identity.ps1')

[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] > $null
[Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] > $null
. (Join-Path $PSScriptRoot 'notification-content.ps1')
$xml = New-Object Windows.Data.Xml.Dom.XmlDocument
$xml.LoadXml($notificationXml)
$toast = [Windows.UI.Notifications.ToastNotification]::new($xml)
$notifier = [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier($notificationAppId)
$notifier.Show($toast)

Write-Output "Toast submitted from Windows PowerShell with default notification sound. AppID: $notificationAppId"
