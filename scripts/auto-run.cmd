@echo off
setlocal
set "APP_DIR=%~dp0.."
set "ELECTRON_RUN_AS_NODE=1"
set "AGE_RUN_MODE=password"
"%APP_DIR%\node_modules\electron\dist\electron.exe" "%APP_DIR%\anime_updater.js" %*
exit /b %ERRORLEVEL%
