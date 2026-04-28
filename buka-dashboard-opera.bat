@echo off
setlocal
cd /d "%~dp0"

set "URL=http://localhost:5173"

if not exist "node_modules" (
  echo Menginstall dependency dashboard...
  call npm install
)

echo Menyalakan server lokal di %URL%
start "Om Botak Dashboard Server" cmd /k "cd /d ""%~dp0"" && npm run dev -- --host 127.0.0.1 --port 5173 --strictPort"
timeout /t 3 /nobreak >nul

set "OPERA1=%LOCALAPPDATA%\Programs\Opera\opera.exe"
set "OPERA2=%ProgramFiles%\Opera\opera.exe"
set "OPERA3=%ProgramFiles(x86)%\Opera\opera.exe"

if exist "%OPERA1%" (
  start "" "%OPERA1%" "%URL%"
  exit /b
)

if exist "%OPERA2%" (
  start "" "%OPERA2%" "%URL%"
  exit /b
)

if exist "%OPERA3%" (
  start "" "%OPERA3%" "%URL%"
  exit /b
)

start "" "%URL%"
