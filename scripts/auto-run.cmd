@echo off
setlocal
set "APP_DIR=%~dp0.."
set "ELECTRON_RUN_AS_NODE=1"
set "AGE_RUN_MODE=password"
if exist "%APP_DIR%\..\..\AniVault.exe" (
  set "AGE_CONTENT=%APPDATA%\番仓 AniVault\content.json"
  set "AGE_PROGRESS=%APPDATA%\番仓 AniVault\PROGRESS.md"
  set "AGE_BLOCKED=%APPDATA%\番仓 AniVault\BLOCKED.md"
  set "AGE_CSV=%APPDATA%\番仓 AniVault\local\待下载清单.csv"
  "%APP_DIR%\..\..\AniVault.exe" "%APP_DIR%\anime_updater.js" %*
) else (
  "%APP_DIR%\node_modules\electron\dist\electron.exe" "%APP_DIR%\anime_updater.js" %*
)
exit /b %ERRORLEVEL%
