' Starts the DSH tray icon without a console window. Pass "quiet" to only show the icon.
Set shell = CreateObject("WScript.Shell")
dir = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
extra = ""
If WScript.Arguments.Count > 0 Then
  If LCase(WScript.Arguments(0)) = "quiet" Then extra = " -Quiet"
End If
shell.Run "powershell.exe -NoProfile -STA -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & dir & "\dsh-tray.ps1""" & extra, 0, False
