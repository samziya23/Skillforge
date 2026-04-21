@echo off
echo ==========================================
echo  SkillForge AI — Frontend (React + Vite)
echo ==========================================
echo.
echo [Step 1] Moving to frontend folder...
cd /d "%~dp0"

echo [Step 2] Installing npm packages...
call npm install
if %errorlevel% neq 0 (
    echo ERROR: npm install failed. Make sure Node.js is installed.
    echo Download from: https://nodejs.org
    pause
    exit /b 1
)

echo.
echo [Step 3] Starting Vite dev server...
echo    Open: http://localhost:5173
echo.
call npm run dev
pause
