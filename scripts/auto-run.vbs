Option Explicit

Dim shell, fso, appDir, electronPath, updaterPath, command, exitCode
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

appDir = fso.GetParentFolderName(fso.GetParentFolderName(WScript.ScriptFullName))
electronPath = fso.BuildPath(appDir, "node_modules\electron\dist\electron.exe")
updaterPath = fso.BuildPath(appDir, "anime_updater.js")

shell.Environment("Process")("ELECTRON_RUN_AS_NODE") = "1"
shell.Environment("Process")("AGE_RUN_MODE") = "password"

command = """" & electronPath & """ """ & updaterPath & """"
exitCode = shell.Run(command, 0, True)
WScript.Quit exitCode
