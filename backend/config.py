"""
Configuration + file paths for the Portfolio Tracker backend.

Everything is worked out relative to THIS file, so the backend runs no matter
which folder you start it from.
"""
import os

# ---- folders --------------------------------------------------------------
BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))          # ...\NidhiCSPROJECT\backend
PROJECT_DIR = os.path.dirname(BACKEND_DIR)                        # ...\NidhiCSPROJECT
ZERODHA_DIR = os.path.join(PROJECT_DIR, "zerodha")               # ...\NidhiCSPROJECT\zerodha
SAMPLE_DIR  = os.path.join(BACKEND_DIR, "sample_data")           # CSV fallback prices

# ---- files ----------------------------------------------------------------
DB_PATH = os.path.join(BACKEND_DIR, "portfolio.db")              # the SQLite database

# ---- market settings (mirror the frontend config.js) ----------------------
EXCHANGE = "NSE"
CURRENCY = "INR"
RISK_FREE_RATE = 6.5        # % per year, Indian ~10y G-Sec, used for the Sharpe ratio
TRADING_DAYS = 252          # trading days in a year, used to annualise volatility/return

# ---- server ---------------------------------------------------------------
HOST = "localhost"
PORT = 5000
