@echo off
cd /d "%~dp0"
if exist admin-password.txt (
    set /p ADMIN_BOOTSTRAP_PASSWORD=<admin-password.txt
)
if exist google-client-id.txt (
    set /p GOOGLE_CLIENT_ID=<google-client-id.txt
)
echo ========================================
echo           EduTools Server
echo ========================================
echo.
if defined ADMIN_BOOTSTRAP_PASSWORD (
    echo Admin bootstrap password loaded.
) else (
    echo Admin bootstrap password not provided. Existing admin accounts will remain unchanged.
)
if defined GOOGLE_CLIENT_ID (
    echo Google SSO client ID loaded.
) else (
    echo Google SSO disabled. Add your client ID to google-client-id.txt to enable it.
)
echo Starting Node.js server...
node server.mjs
pause
