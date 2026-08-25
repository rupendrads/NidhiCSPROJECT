@echo off
REM ============================================================================
REM  Portfolio Tracker - launch the app (Windows)
REM  Starts the frontend (port 8000) in a new window and the backend API
REM  (port 5000) in this window. The backend logs in to Zerodha on startup.
REM  Run setup.bat once before using this.
REM ============================================================================
setlocal
cd /d "%~dp0"

if not exist ".venv\Scripts\python.exe" (
  echo [X] No virtual environment found. Run setup.bat first.
  pause
  exit /b 1
)

REM --- frontend static server in its own window (Python stdlib only) ---------
start "Portfolio Frontend :8000" cmd /k "cd /d %~dp0..\frontend && python -m http.server 8000"

echo ============================================================
echo   Backend API :  http://localhost:5000/api
echo   Open in browser:  http://localhost:8000
echo   (Press Ctrl+C here to stop the backend.)
echo ============================================================
echo.

REM --- backend API in this window, using the venv's Python ------------------
".venv\Scripts\python.exe" app.py
