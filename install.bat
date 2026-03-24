@echo off
setlocal

cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
    echo Error: Node.js is required but was not found in PATH.
    exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
    echo Error: npm is required but was not found in PATH.
    exit /b 1
)

echo Installing project dependencies...
call npm install
if errorlevel 1 (
    echo.
    echo Install failed.
    exit /b 1
)

echo Rebuilding native modules for the current Node.js runtime...
call npm rebuild bcrypt better-sqlite3
if errorlevel 1 (
    echo.
    echo Native module rebuild failed.
    exit /b 1
)

if not exist "certs" mkdir certs
if not exist "data" mkdir data

set "missing_certs="
if not exist "certs\\private.key" set "missing_certs=1"
if not exist "certs\\certificate.pem" set "missing_certs=1"
if defined missing_certs (
    echo.
    echo Warning: HTTPS certificate files are missing.
    echo Generate HTTPS certificates with:
    echo openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout certs/private.key -out certs/certificate.pem
)

echo.
echo Install complete.
echo Start the app with: npm start

exit /b 0
