@echo off
echo ========================================
echo   HyperUR Telegram Bot - Setup Script
echo ========================================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js chua duoc cai dat!
    echo Vui long tai Node.js tai: https://nodejs.org/
    pause
    exit /b 1
)

echo [OK] Node.js da duoc cai dat
node --version
echo.

REM Check if npm is installed
where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] npm chua duoc cai dat!
    pause
    exit /b 1
)

echo [OK] npm da duoc cai dat
npm --version
echo.

REM Install dependencies
echo ========================================
echo   Dang cai dat dependencies...
echo ========================================
echo.

call npm install

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Cai dat that bai!
    pause
    exit /b 1
)

echo.
echo ========================================
echo   Cai dat thanh cong!
echo ========================================
echo.

REM Check if .env exists
if not exist .env (
    echo [INFO] Dang tao file .env...
    copy .env.example .env
    echo.
    echo [IMPORTANT] Vui long chinh sua file .env:
    echo   1. Them BOT_TOKEN cua ban
    echo   2. Them ADMIN_IDS cua ban
    echo   3. Cap nhat HYPERUR_WEBSITE_URL
    echo.
    echo Sau do chay: npm start
) else (
    echo [OK] File .env da ton tai
    echo.
    echo Ban co the chay bot bang lenh:
    echo   npm start
)

echo.
pause
