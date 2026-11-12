@echo off
setlocal enabledelayedexpansion
title EvenUCan Setup and Launcher
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
  echo  Could not download Python automatically.
  echo  Please go to https://www.python.org and download Python 3.
  echo  During install, tick "Add Python to PATH".
  echo  Then run this file again.
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

echo  [2/4] Looking for Ollama (local AI - optional)...

set OLLAMA_FOUND=0
where ollama >nul 2>&1
if %errorlevel%==0 set OLLAMA_FOUND=1
if exist "%LOCALAPPDATA%\Programs\Ollama\ollama.exe" set OLLAMA_FOUND=1

if %OLLAMA_FOUND%==1 (
  echo     OK - Ollama found. Local AI will be available.
  goto :ollama_done
)

echo.
echo  Ollama is not installed.
echo  Without it, EvenUCan still works with free cloud AI keys (Google Gemini etc).
echo  You can install Ollama later from https://ollama.com
echo.
choice /c YN /m "  Install Ollama now (recommended, about 1 GB download)? [Y/N]"
if %errorlevel%==1 (
  echo  Downloading Ollama...
  curl -L -o "%TEMP%\OllamaSetup.exe" "https://ollama.com/download/OllamaSetup.exe"
  if %errorlevel%==0 (
    echo  Installing Ollama...
    "%TEMP%\OllamaSetup.exe" /silent
    timeout /t 5 /nobreak >nul
    set OLLAMA_FOUND=1
    set INSTALLED_SOMETHING=1
    echo     Ollama installed.
  ) else (
    echo     Could not download Ollama. You can install it later from https://ollama.com
  )
) else (
  echo     Skipped. You can install Ollama later from https://ollama.com
)

:ollama_done

echo  [3/4] Starting services...

if %OLLAMA_FOUND%==1 (
  tasklist /fi "imagename eq ollama.exe" 2>nul | find /i "ollama.exe" >nul
  if %errorlevel%==0 (
    echo     Ollama is already running.
  ) else (
    echo     Starting Ollama...
    start "" /b ollama serve
    timeout /t 3 /nobreak >nul
    echo     Ollama started.
  )
)

echo  [4/4] Starting EvenUCan web server...

for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":8080 "') do (
  taskkill /f /pid %%a >nul 2>&1
)
timeout /t 1 /nobreak >nul

cd /d "%~dp0app"

start "" /b "%PYTHON_EXE%" -m http.server 8080
timeout /t 2 /nobreak >nul

echo     Server started on http://localhost:8080
echo.

start "" "http://localhost:8080/EvenUCan.html"

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