@echo off
rem Starts BlueK offline: local web server + browser. No internet required.
rem Usage: start.bat [port]   (default 8901)
setlocal
cd /d "%~dp0"
set "PORT=%~1"
if "%PORT%"=="" set "PORT=8901"

start "" cmd /c "timeout /t 2 >nul & start "" http://127.0.0.1:%PORT%/"

where node >nul 2>nul
if %ERRORLEVEL%==0 (
  echo BlueK startet mit Node.js ...
  node "%~dp0server.mjs" %PORT%
  goto :ende
)

where py >nul 2>nul
if %ERRORLEVEL%==0 (
  echo BlueK startet mit Python ...
  py -3 -m http.server %PORT% --bind 127.0.0.1 --directory "%~dp0app"
  goto :ende
)

where python >nul 2>nul
if %ERRORLEVEL%==0 (
  echo BlueK startet mit Python ...
  python -m http.server %PORT% --bind 127.0.0.1 --directory "%~dp0app"
  goto :ende
)

echo BlueK startet mit Windows-PowerShell ...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1" -Port %PORT% -Root "%~dp0app"

:ende
echo.
echo BlueK wurde beendet.
pause
