@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0open_workspace_app.ps1"
if errorlevel 1 (
  echo.
  echo Startup failed. See the error above.
  pause
  exit /b 1
)
echo.
pause
exit /b 0
