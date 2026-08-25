@echo off
REM ============================================================================
REM  Portfolio Tracker - one-time setup on a new PC (Windows)
REM  Creates a virtual environment with uv and installs the Python libraries.
REM  Run this ONCE. Afterwards use start.bat to launch the app.
REM ============================================================================
setlocal
cd /d "%~dp0"

REM --- check uv is installed -------------------------------------------------
where uv >nul 2>nul
if errorlevel 1 (
  echo [X] 'uv' is not installed or not on PATH.
  echo     Install it, then run this script again:
  echo         powershell -c "irm https://astral.sh/uv/install.ps1 ^| iex"
  echo     or  pip install uv
  echo.
  pause
  exit /b 1
)

REM --- create the virtual environment (.venv) -------------------------------
if exist ".venv\Scripts\python.exe" (
  echo == Reusing existing virtual environment (.venv) ==
) else (
  echo == Creating virtual environment (.venv) with uv ==
  uv venv
  if errorlevel 1 ( echo [X] "uv venv" failed. & pause & exit /b 1 )
)

REM --- install the requirements into that venv ------------------------------
echo.
echo == Installing requirements.txt ==
uv pip install -r requirements.txt
if errorlevel 1 ( echo [X] install failed. & pause & exit /b 1 )

echo.
echo == Setup complete. ==
echo Next steps:
echo   1) start.bat   - launch the backend + frontend
echo   2) seed.bat    - refresh the NSE symbol list (once a day)
echo.
pause
