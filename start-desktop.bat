@echo off
REM Opens EvenUCan in its own desktop window (Electron). Needs "npm install" to have been run once in this folder.
cd /d "%~dp0"
if not exist "node_modules\electron\dist\electron.exe" (
  echo  The desktop window is not installed yet. Run   npm install   in this folder first.
  pause
  exit /b 1
)
start "" "node_modules\electron\dist\electron.exe" .
