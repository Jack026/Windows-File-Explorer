@echo off
echo ========================================================
echo  Unblocking Windows File Explorer from SmartScreen
echo ========================================================
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-ChildItem -Path '%~dp0' -Filter '*.exe' | Unblock-File; Write-Host 'All executables in this directory unblocked successfully!'"
echo Done! You can now run the application without restriction.
pause
