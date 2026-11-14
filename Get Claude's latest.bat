@echo off
cd /d "%~dp0"
echo.
echo Getting the latest EvenUCan work from Claude...
echo.
git checkout -- app/EvenUCan.html
git pull origin worktree-curated-parts
if errorlevel 1 (
  echo.
  echo Something went wrong. Copy the words above and show them to Claude.
  pause
  exit /b 1
)
echo.
echo Building the app...
node build.js
if errorlevel 1 (
  echo.
  echo The build did not work. Copy the words above and show them to Claude.
  pause
  exit /b 1
)
echo.
echo All done. Now start EvenUCan as usual with Start EvenUCan.bat
echo When you are happy with it, run your usual push script to send it to GitHub.
echo.
pause
