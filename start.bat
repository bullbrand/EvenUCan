@echo off
setlocal enabledelayedexpansion
title EvenUCan Launcher
color 0A

cd /d "%~dp0"

echo.
echo  =========================================
echo   EvenUCan - Start Here
echo  =========================================
echo.
echo  Checking your computer has everything needed...
echo.

set INSTALLED_SOMETHING=0
set PYTHON_EXE=
set SERVER_STARTED=0

REM ============================================================
REM  STEP 1 - Find Python
REM ============================================================
echo  [1/4] Looking for Python...

where python >nul 2>&1
if %errorlevel%==0 (
  set PYTHON_EXE=python
  goto :python_found
)
where python3 >nul 2>&1
if %errorlevel%==0 (
  set PYTHON_EXE=python3
  goto :python_found
)

for /d %%i in ("%LOCALAPPDATA%\Programs\Python\Python3*") do (
  if exist "%%i\python.exe" set PYTHON_EXE=%%i\python.exe
)
if defined PYTHON_EXE goto :python_found

for /d %%i in ("C:\Python3*") do (
  if exist "%%i\python.exe" set PYTHON_EXE=%%i\python.exe
)
if defined PYTHON_EXE goto :python_found

echo.
echo  Python is not installed. EvenUCan needs it to run a local web server.
echo  Downloading Python installer now...
echo.
curl -L -o "%TEMP%\python_installer.exe" "https://www.python.org/ftp/python/3.12.7/python-3.12.7-amd64.exe"
if %errorlevel% neq 0 (
  echo.
  echo  Could not download Python automatically.
  echo  Please go to https://www.python.org and download Python 3.
  echo  During install, tick "Add Python to PATH".
  echo  Then run this file again.
  echo.
  pause
  exit /b 1
)
echo  Installing Python (this takes about a minute)...
"%TEMP%\python_installer.exe" /quiet InstallAllUsers=0 PrependPath=1 Include_test=0
if %errorlevel% neq 0 (
  echo  Automatic install failed. Please install Python manually from https://www.python.org
  echo  Tick "Add Python to PATH" during install, then run this file again.
  pause
  exit /b 1
)
set PYTHON_EXE=python
set INSTALLED_SOMETHING=1
echo  Python installed successfully.
goto :python_found

:python_found
echo     OK - Python found.

REM ============================================================
REM  STEP 2 - Local AI engine (built in, no Ollama needed)
REM ============================================================
echo  [2/4] Checking the built-in local AI engine...
if not exist "%~dp0engine\llama-server.exe" (
  echo     Local AI engine not found in the engine folder. Local AI will not be available.
) else (
  echo     OK - Local AI engine found.
)

REM ============================================================
REM  STEP 3 - Start services
REM ============================================================
echo  [3/4] Starting services...


REM ============================================================
REM  STEP 4 - Start web server and open EvenUCan
REM ============================================================
echo  [4/4] Starting EvenUCan web server...

REM Kill anything already on port 8080
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":8080 "') do (
  taskkill /f /pid %%a >nul 2>&1
)
timeout /t 1 /nobreak >nul

start "" /b "%PYTHON_EXE%" server.py
timeout /t 2 /nobreak >nul

echo     Server started on http://localhost:8080
echo.

REM Open EvenUCan in Borderless Desktop App Window (--app= mode)
set BROWSER_EXE=
if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" set BROWSER_EXE="%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if not defined BROWSER_EXE if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" set BROWSER_EXE="%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
if not defined BROWSER_EXE if exist "%LOCALAPPDATA%\Microsoft\Edge\Application\msedge.exe" set BROWSER_EXE="%LOCALAPPDATA%\Microsoft\Edge\Application\msedge.exe"
if not defined BROWSER_EXE if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" set BROWSER_EXE="%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not defined BROWSER_EXE if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" set BROWSER_EXE="%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not defined BROWSER_EXE if exist "%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe" set BROWSER_EXE="%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"

if defined BROWSER_EXE (
  start "" %BROWSER_EXE% --app="http://localhost:8080/EvenUCan.html" --start-maximized --window-position=0,0 --window-size=1920,1080
) else (
  start "" "http://localhost:8080/EvenUCan.html"
)

echo  =========================================
echo.
if %INSTALLED_SOMETHING%==1 (
  echo  Setup complete! EvenUCan is now opening in your browser.
) else (
  echo  EvenUCan is opening in your browser.
)
echo.
echo  IMPORTANT: Keep this window open while using EvenUCan.
echo  Closing it will stop the server.
echo.
echo  To stop: close this window or press Ctrl+C
echo  =========================================
echo.

:loop
timeout /t 60 /nobreak >nul
goto :loop
