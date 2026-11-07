@echo off
REM Thin launcher — real logic lives in start_app.ps1 (separate windows + browser).
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0start_app.ps1"
set "EC=%ERRORLEVEL%"
endlocal & exit /b %EC%
