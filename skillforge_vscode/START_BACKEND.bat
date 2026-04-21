@echo off
echo ==========================================
echo  SkillForge AI — Backend (FastAPI + Groq)
echo ==========================================
echo.
echo [Step 1] Moving to project folder...
cd /d "%~dp0"

echo [Step 2] Installing Python dependencies...
pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo ERROR: pip install failed. Make sure Python is installed.
    pause
    exit /b 1
)

echo.
echo [Step 3] Starting backend server...
echo    URL:    http://localhost:8000
echo    Docs:   http://localhost:8000/docs
echo    Health: http://localhost:8000/health
echo.
uvicorn main:app --reload --host 0.0.0.0 --port 8000
pause
