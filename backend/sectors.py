"""
Sector lookup for NSE stocks.

Zerodha's instrument list does NOT include a company's sector, but the frontend
groups holdings by sector (the donut chart). So we keep a small lookup table for
the common large-caps and fall back to "Other" for anything not listed.

This is a documented limitation: sectors are only known for the stocks below.
Add more lines here whenever you want another stock classified.
"""

SECTORS = {
    "RELIANCE": "Energy",      "ONGC": "Energy",        "NTPC": "Energy",
    "POWERGRID": "Energy",     "COALINDIA": "Energy",   "BPCL": "Energy",
    "IOC": "Energy",           "GAIL": "Energy",        "ADANIGREEN": "Energy",

    "TCS": "IT",               "INFY": "IT",            "WIPRO": "IT",
    "HCLTECH": "IT",           "TECHM": "IT",           "LTIM": "IT",

    "HDFCBANK": "Banking",     "ICICIBANK": "Banking",  "SBIN": "Banking",
    "KOTAKBANK": "Banking",    "AXISBANK": "Banking",   "INDUSINDBK": "Banking",
    "BAJFINANCE": "Banking",   "BAJAJFINSV": "Banking", "SBILIFE": "Banking",
    "HDFCLIFE": "Banking",

    "BHARTIARTL": "Telecom",   "IDEA": "Telecom",

    "ITC": "FMCG",             "HINDUNILVR": "FMCG",    "NESTLEIND": "FMCG",
    "BRITANNIA": "FMCG",       "TATACONSUM": "FMCG",    "DABUR": "FMCG",
    "ASIANPAINT": "FMCG",

    "LT": "Infra",             "ADANIPORTS": "Infra",   "ULTRACEMCO": "Infra",
    "GRASIM": "Infra",         "SHREECEM": "Infra",

    "SUNPHARMA": "Pharma",     "CIPLA": "Pharma",       "DRREDDY": "Pharma",
    "DIVISLAB": "Pharma",      "APOLLOHOSP": "Pharma",

    "TATAMOTORS": "Auto",      "MARUTI": "Auto",        "M&M": "Auto",
    "BAJAJ-AUTO": "Auto",      "EICHERMOT": "Auto",     "HEROMOTOCO": "Auto",

    "TITAN": "Consumer",       "TRENT": "Consumer",     "DMART": "Consumer",

    "TATASTEEL": "Metals",     "JSWSTEEL": "Metals",    "HINDALCO": "Metals",
    "VEDL": "Metals",

    "HDFCAMC": "Financials",   "JIOFIN": "Financials",  "PFC": "Financials",
}


def sector_of(ticker: str) -> str:
    """Return the sector for a ticker, or 'Other' if we don't know it."""
    return SECTORS.get(ticker.upper(), "Other")
