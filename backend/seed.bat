@echo off
REM ============================================================================
REM  Portfolio Tracker - refresh the NSE symbol list from Zerodha (once a day)
REM ============================================================================
setlocal
cd /d "%~dp0"

if not exist ".venv\Scripts\python.exe" (
  echo [X] No virtual environment found. Run setup.bat first.
  pause
  exit /b 1
)

".venv\Scripts\python.exe" seed_instruments.py
pause
