Option Explicit

Dim shell, fso, appDir, portableRoot, dataDir, electronPath, updaterPath, command, exitCode
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

appDir = fso.GetParentFolderName(fso.GetParentFolderName(WScript.ScriptFullName))
electronPath = fso.BuildPath(appDir, "node_modules\electron\dist\electron.exe")
updaterPath = fso.BuildPath(appDir, "anime_updater.js")

portableRoot = fso.GetParentFolderName(fso.GetParentFolderName(appDir))
If fso.FileExists(fso.BuildPath(portableRoot, "AniVault.exe")) Then
  electronPath = fso.BuildPath(portableRoot, "AniVault.exe")
  updaterPath = fso.BuildPath(appDir, "anime_updater.js")
  dataDir = shell.ExpandEnvironmentStrings("%APPDATA%") & "\番仓 AniVault"
  shell.Environment("Process")("AGE_CONTENT") = fso.BuildPath(dataDir, "content.json")
  shell.Environment("Process")("AGE_PROGRESS") = fso.BuildPath(dataDir, "PROGRESS.md")
  shell.Environment("Process")("AGE_BLOCKED") = fso.BuildPath(dataDir, "BLOCKED.md")
  shell.Environment("Process")("AGE_CSV") = fso.BuildPath(dataDir, "local\待下载清单.csv")
End If

shell.Environment("Process")("ELECTRON_RUN_AS_NODE") = "1"
shell.Environment("Process")("AGE_RUN_MODE") = "password"

command = """" & electronPath & """ """ & updaterPath & """"
exitCode = shell.Run(command, 0, True)
WScript.Quit exitCode
