@echo off
echo ========================================================
echo  Trusting Windows File Explorer Publisher (Jack026)
echo ========================================================
certutil -user -addstore "TrustedPublisher" "%~dp0certificate.cer"
echo.
echo Certificate added to your Trusted Publishers store!
echo You can now launch the application seamlessly.
pause
