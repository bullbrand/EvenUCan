@echo off
cd /d "%~dp0\CP210x"
echo ============================================================
echo   Installing Silicon Labs CP2102 USB Driver for ESP32...
echo ============================================================
echo.
echo If Windows prompts you "Do you want to allow this app to make changes?", click YES.
echo.
start "" "%~dp0CP210x\pololu-cp2102-setup-x64.exe"
echo.
echo Once the installer finishes, return to EvenUCan and click "Refresh Ports".
echo.
pause
