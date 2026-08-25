"""
Market data wrapper around the existing Zerodha class (../zerodha/Zerodha.py).

Everything the backend needs from Zerodha goes through this ONE file:
  - connect()            : log in (uses the cached daily token if available)
  - get_ltps(symbols)    : latest prices for a list of tickers   -> {ticker: price}
  - get_ltp(symbol)      : latest price for one ticker
  - get_quotes(symbols)  : full quote incl. previous close (for today's change)
  - historical_daily(...) : 1-day candles for backtesting / risk maths
  - fetch_nse_equity()   : the full NSE equity instrument list

If Zerodha is unavailable (not logged in, no internet, library missing), the
methods fail *softly* — they return empty/zero instead of crashing — so the rest
of the app (adding stocks, saving the portfolio) still works. This "degraded
mode" is what lets you demo persistence without any paid API.
"""
import os
import sys
import datetime as dt

from config import ZERODHA_DIR

# Make ../zerodha importable and load the user's Zerodha class.
if ZERODHA_DIR not in sys.path:
    sys.path.insert(0, ZERODHA_DIR)

try:
    from Zerodha import Zerodha
    _ZERODHA_IMPORT_OK = True
except Exception as e:  # library missing, etc.
    _ZERODHA_IMPORT_OK = False
    _IMPORT_ERROR = str(e)


class MarketData:
    def __init__(self):
        self.z = None
        self.connected = False
        self.last_error = None

    # -- connection ---------------------------------------------------------
    def connect(self) -> bool:
        """Log in to Zerodha. Returns True on success, False on any failure."""
        if not _ZERODHA_IMPORT_OK:
            self.last_error = f"Could not import Zerodha: {_IMPORT_ERROR}"
            self.connected = False
            return False
        try:
            self.z = Zerodha()
            # Point the Zerodha class at the config/token files in ../zerodha,
            # no matter what folder we started the server from.
            self.z.config_path = os.path.join(ZERODHA_DIR, "zerodhaConfig.json")
            self.z.token_path = os.path.join(ZERODHA_DIR, "zerodhaAccessToken.json")
            ok = self.z.login()
            self.connected = bool(ok)
            if not ok:
                self.last_error = "Zerodha login returned False (check credentials / TOTP)."
            return self.connected
        except Exception as e:
            self.last_error = f"Zerodha login failed: {e}"
            self.connected = False
            return False

    def _ensure(self) -> bool:
        """Make sure we're logged in before an API call; try once if not."""
        if self.connected and self.z and self.z.kite:
            return True
        return self.connect()

    # -- live prices --------------------------------------------------------
    def get_ltps(self, symbols: list[str]) -> dict[str, float]:
        """Latest traded price for several tickers, e.g. ['RELIANCE','INFY']."""
        if not symbols or not self._ensure():
            return {}
        try:
            keys = [f"NSE:{s.upper()}" for s in symbols]
            resp = self.z.kite.ltp(keys)
            out = {}
            for s in symbols:
                k = f"NSE:{s.upper()}"
                if k in resp:
                    out[s.upper()] = float(resp[k]["last_price"])
            return out
        except Exception as e:
            self.last_error = f"get_ltps failed: {e}"
            return {}

    def get_ltp(self, symbol: str) -> float:
        return self.get_ltps([symbol]).get(symbol.upper(), 0.0)

    def get_quotes(self, symbols: list[str]) -> dict[str, dict]:
        """
        Full quote for each ticker, including previous-day close, so we can work
        out today's change. Returns {ticker: {'last_price':.., 'prev_close':.., 'net_change':..}}.
        """
        if not symbols or not self._ensure():
            return {}
        try:
            keys = [f"NSE:{s.upper()}" for s in symbols]
            resp = self.z.kite.quote(keys)
            out = {}
            for s in symbols:
                k = f"NSE:{s.upper()}"
                if k in resp:
                    q = resp[k]
                    prev_close = q.get("ohlc", {}).get("close", 0.0)
                    last = float(q.get("last_price", 0.0))
                    out[s.upper()] = {
                        "last_price": last,
                        "prev_close": float(prev_close),
                        "net_change": last - float(prev_close),
                    }
            return out
        except Exception as e:
            self.last_error = f"get_quotes failed: {e}"
            return {}

    # -- historical ---------------------------------------------------------
    def historical_daily(self, instrument_token: int, from_date, to_date) -> list[dict]:
        """
        1-day candles between two dates. Accepts date objects or 'YYYY-MM-DD' strings.
        Returns a list of {'date':.., 'open':.., 'high':.., 'low':.., 'close':.., 'volume':..}.
        """
        if not self._ensure():
            return []
        try:
            if isinstance(from_date, str):
                from_date = dt.datetime.strptime(from_date, "%Y-%m-%d").date()
            if isinstance(to_date, str):
                to_date = dt.datetime.strptime(to_date, "%Y-%m-%d").date()
            return self.z.get_historical_data(instrument_token, from_date, to_date, "day")
        except Exception as e:
            self.last_error = f"historical_daily failed: {e}"
            return []

    # -- instruments --------------------------------------------------------
    def fetch_nse_equity(self) -> list[dict]:
        """
        Download every NSE instrument and keep only ordinary equity shares (EQ).
        Returns a trimmed list of {'instrument_token', 'tradingsymbol', 'name'}.
        """
        if not self._ensure():
            return []
        try:
            everything = self.z.kite.instruments("NSE")
            equity = []
            for i in everything:
                if i.get("instrument_type") == "EQ" and i.get("segment") == "NSE":
                    equity.append(
                        {
                            "instrument_token": i["instrument_token"],
                            "tradingsymbol": i["tradingsymbol"],
                            "name": i.get("name", ""),
                        }
                    )
            return equity
        except Exception as e:
            self.last_error = f"fetch_nse_equity failed: {e}"
            return []


# A single shared instance the whole app uses.
market = MarketData()
