# Save this file as UTF-8 with BOM for Windows PowerShell 5.1.
# Both senders consume the same payload, without BurntToast text bindings.
$contentDocument = New-Object System.Xml.XmlDocument
# The caller sets $notificationKind; unknown or missing kinds read as an ordinary completion.
$notificationTexts = @{
    completed = @('任务已完成', '本轮对话已正常结束。')
    asking = @('等你回答', '本轮已结束，还有问题等你回答。')
    approval = @('需要审批', '有操作在等你批准。')
    question = @('需要你回答', 'AI 向你提了问题。')
}
$notificationText = $notificationTexts['completed']
if ($notificationKind -and $notificationTexts.ContainsKey([string]$notificationKind)) { $notificationText = $notificationTexts[[string]$notificationKind] }
$contentDocument.LoadXml('<toast><visual><binding template="ToastGeneric"><text/><text/></binding></visual><audio src="ms-winsoundevent:Notification.Default"/></toast>')
$textNodes = $contentDocument.SelectNodes('//text')
$textNodes[0].InnerText = $notificationText[0]
$textNodes[1].InnerText = $notificationText[1]
if ($notificationIcon) {
    $image = $contentDocument.CreateElement('image')
    $image.SetAttribute('placement', 'appLogoOverride')
    $image.SetAttribute('src', ([System.Uri]::new($notificationIcon)).AbsoluteUri)
    $null = $contentDocument.SelectSingleNode('//binding').AppendChild($image)
}
$notificationXml = $contentDocument.OuterXml
