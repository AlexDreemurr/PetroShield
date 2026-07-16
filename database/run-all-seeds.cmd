@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0run-all-seeds.ps1"
set EXIT_CODE=%ERRORLEVEL%
echo.
if not "%EXIT_CODE%"=="0" (
  echo Seed failed with exit code %EXIT_CODE%.
) else (
  echo Seed completed successfully.
)
pause
exit /b %EXIT_CODE%
