@echo off
setlocal
cd /d "%~dp0"
if not exist "node_modules\electron\dist\electron.exe" (
  echo Dayflow dependencies are missing. Run npm ci in this folder first.
  pause
  exit /b 1
)
start "" "node_modules\electron\dist\electron.exe" "."
