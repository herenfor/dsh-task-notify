# Save this file as UTF-8 with BOM for Windows PowerShell 5.1.
# Both senders consume the same payload, without BurntToast text bindings.
$contentDocument = New-Object System.Xml.XmlDocument
$contentDocument.LoadXml('<toast><visual><binding template="ToastGeneric"><text>任务已完成</text><text>本轮对话已正常结束。</text></binding></visual><audio src="ms-winsoundevent:Notification.Default"/></toast>')
if ($notificationIcon) {
    $image = $contentDocument.CreateElement('image')
    $image.SetAttribute('placement', 'appLogoOverride')
    $image.SetAttribute('src', ([System.Uri]::new($notificationIcon)).AbsoluteUri)
    $null = $contentDocument.SelectSingleNode('//binding').AppendChild($image)
}
$notificationXml = $contentDocument.OuterXml
