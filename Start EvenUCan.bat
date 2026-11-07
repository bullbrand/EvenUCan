@echo off
title EvenUCan Launcher

:: Check Python is available
python --version >nul 2>&1
if errorlevel 1 (
    echo Python is not installed or not in your PATH.
    echo.
    echo Please install Python from https://www.python.org/downloads/
    echo Make sure to tick "Add Python to PATH" during install.
    pause
    exit /b
)

:: Find the folder this bat file lives in
cd /d "%~dp0"

:: Check if something is already serving on 8080
netstat -ano | find "0.0.0.0:8080" >nul 2>&1
if not errorlevel 1 (
    echo Port 8080 is already in use - opening EvenUCan anyway...
    start "" "http://localhost:8080/EvenUCan.html"
    exit /b
)

echo Starting EvenUCan...
echo.
echo Keep this window open while you use EvenUCan.
echo Close it when you are done.
echo.

:: Start server in background, open browser after short delay
start /b python -m http.server 8080
timeout /t 1 /nobreak >nul
start "" "http://localhost:8080/EvenUCan.html"

:: Keep window open (shows "keep this window open" message)
echo EvenUCan is running at http://localhost:8080/EvenUCan.html
echo.
pause
