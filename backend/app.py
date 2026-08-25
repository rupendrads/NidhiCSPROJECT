"""
Portfolio Tracker backend — Flask API.

This is the "front door". The browser frontend talks ONLY to these routes; the
routes talk to the database (database.py) and to Zerodha (market_data.py).

The routes deliberately match the contract already declared in the frontend's
config.js, so switching the frontend to live data is just `useMock: false`.

Run it with:   python app.py
"""
import datetime as dt

from flask import Flask, jsonify, request
from flask_cors import CORS

import database as db
from market_data import market
from sectors import sector_of
import analysis
import backtest
from config import HOST, PORT, RISK_FREE_RATE, TRADING_DAYS

app = Flask(__name__)
CORS(app)  # let the browser (opened from a file / different port) call us

# Small in-memory cache of historical closes so /portfolio/summary is not slow.
_history_cache: dict = {}


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------
def _today() -> str:
    return dt.date.today().strftime("%Y-%m-%d")


def _fmt_date(d) -> str:
    """Zerodha gives datetime objects; CSV gives strings. Normalise to YYYY-MM-DD."""
    if isinstance(d, (dt.datetime, dt.date)):
        return d.strftime("%Y-%m-%d")
    return str(d)[:10]


def _name_of(ticker: str) -> str:
    token_row = db.get_all_instruments()  # cheap-ish; used rarely
    for r in token_row:
        if r["tradingsymbol"] == ticker:
            return r["name"] or ticker
    return ticker


def _holding_json(row: dict, ltp: float, name: str) -> dict:
    """Turn a DB holding row (snake_case) into the camelCase the frontend wants."""
    return {
        "id": row["id"],
        "ticker": row["ticker"],
        "quantity": row["quantity"],
        "avgBuyPrice": row["avg_buy_price"],
        "purchaseDate": row["purchase_date"],
        "ltp": round(ltp, 2),
        "sector": sector_of(row["ticker"]),
        "name": name,
    }


def _closed_json(row: dict) -> dict:
    return {
        "id": row["id"],
        "ticker": row["ticker"],
        "quantity": row["quantity"],
        "avgBuyPrice": row["avg_buy_price"],
        "sellPrice": row["sell_price"],
        "closeDate": row["close_date"],
    }


def _prices_for_tickers(tickers: list[str]) -> dict[str, float]:
    """Live LTP for each ticker; empty dict if Zerodha is unavailable."""
    return market.get_ltps(list(set(tickers))) if tickers else {}


def _daily_closes(ticker: str, days: int = 400) -> dict[str, float]:
    """{date: close} for the last `days` calendar days, cached per run."""
    if ticker in _history_cache:
        return _history_cache[ticker]
    token = db.get_instrument_token(ticker)
    if not token:
        return {}
    to_d = dt.date.today()
    from_d = to_d - dt.timedelta(days=days)
    candles = market.historical_daily(token, from_d, to_d)
    closes = {_fmt_date(c["date"]): float(c["close"]) for c in candles}
    _history_cache[ticker] = closes
    return closes


# ---------------------------------------------------------------------------
# status / health
# ---------------------------------------------------------------------------
@app.get("/api/status")
def status():
    return jsonify({
        "connected": market.connected,
        "instruments": db.instruments_count(),
        "lastError": market.last_error,
    })


# ---------------------------------------------------------------------------
# Holdings
# ---------------------------------------------------------------------------
@app.get("/api/holdings")
def get_holdings():
    rows = db.get_holdings()
    prices = _prices_for_tickers([r["ticker"] for r in rows])
    instruments = {i["tradingsymbol"]: i["name"] for i in db.get_all_instruments()}
    out = []
    for r in rows:
        # Fall back to the average buy price if we have no live quote, so the
        # portfolio still shows a sensible value in degraded mode.
        ltp = prices.get(r["ticker"], r["avg_buy_price"])
        out.append(_holding_json(r, ltp, instruments.get(r["ticker"], r["ticker"])))
    return jsonify(out)


@app.post("/api/holdings")
def add_holding():
    data = request.get_json(silent=True) or {}
    ticker = str(data.get("ticker", "")).upper().strip()
    quantity = data.get("quantity")
    avg = data.get("avgBuyPrice")
    date = str(data.get("purchaseDate", "")).strip()

    err = _validate_holding(ticker, quantity, avg, date)
    if err:
        return jsonify({"error": err}), 400

    row = db.add_holding(ticker, int(quantity), float(avg), date)
    ltp = _prices_for_tickers([ticker]).get(ticker, float(avg))
    return jsonify(_holding_json(row, ltp, _name_of(ticker))), 201


@app.put("/api/holdings/<int:holding_id>")
def edit_holding(holding_id):
    existing = db.get_holding(holding_id)
    if not existing:
        return jsonify({"error": "Holding not found."}), 404
    data = request.get_json(silent=True) or {}
    quantity = data.get("quantity")
    avg = data.get("avgBuyPrice")
    date = str(data.get("purchaseDate", "")).strip()

    err = _validate_holding(existing["ticker"], quantity, avg, date, check_ticker=False)
    if err:
        return jsonify({"error": err}), 400

    row = db.update_holding(holding_id, int(quantity), float(avg), date)
    ltp = _prices_for_tickers([row["ticker"]]).get(row["ticker"], float(avg))
    return jsonify(_holding_json(row, ltp, _name_of(row["ticker"])))


@app.delete("/api/holdings/<int:holding_id>")
def remove_holding(holding_id):
    if not db.get_holding(holding_id):
        return jsonify({"error": "Holding not found."}), 404
    db.delete_holding(holding_id)
    return jsonify({"ok": True})


@app.post("/api/holdings/<int:holding_id>/sell")
def sell_holding(holding_id):
    holding = db.get_holding(holding_id)
    if not holding:
        return jsonify({"error": "Holding not found."}), 404

    data = request.get_json(silent=True) or {}
    quantity = data.get("quantity")
    sell_price = data.get("sellPrice")

    # validation (SC8)
    if not isinstance(quantity, int) or quantity <= 0:
        return jsonify({"error": "Quantity must be a whole number greater than 0."}), 400
    if quantity > holding["quantity"]:
        return jsonify({"error": f"You only hold {holding['quantity']} shares."}), 400
    try:
        sell_price = float(sell_price)
    except (TypeError, ValueError):
        sell_price = 0
    if sell_price <= 0:
        return jsonify({"error": "Sell price must be greater than 0."}), 400

    # book the sale
    closed = db.add_closed(holding["ticker"], quantity, holding["avg_buy_price"], sell_price, _today())

    # reduce or remove the open position
    remaining = holding["quantity"] - quantity
    if remaining <= 0:
        db.delete_holding(holding_id)
        updated = None
    else:
        updated = db.update_holding(holding_id, remaining, holding["avg_buy_price"], holding["purchase_date"])

    return jsonify({"closed": _closed_json(closed),
                    "holding": None if updated is None else _holding_json(updated, holding["avg_buy_price"], _name_of(holding["ticker"]))})


def _validate_holding(ticker, quantity, avg, date, check_ticker=True) -> str | None:
    """Server-side validation (never trust the browser alone). Returns an error string or None."""
    if check_ticker:
        if not ticker:
            return "Please choose a stock."
        # Only enforce the symbol list if it has been seeded.
        if db.instruments_count() > 0 and not db.instrument_exists(ticker):
            return f"'{ticker}' is not a valid NSE stock."
    if not isinstance(quantity, int) or quantity <= 0:
        return "Quantity must be a whole number greater than 0."
    try:
        if float(avg) <= 0:
            return "Buy price must be greater than 0."
    except (TypeError, ValueError):
        return "Buy price must be a number."
    try:
        d = dt.datetime.strptime(date, "%Y-%m-%d").date()
    except (TypeError, ValueError):
        return "Enter a valid purchase date."
    if d > dt.date.today():
        return "Purchase date can't be in the future."
    return None


# ---------------------------------------------------------------------------
# Quotes
# ---------------------------------------------------------------------------
@app.get("/api/quote/<ticker>")
def get_quote(ticker):
    ltp = market.get_ltp(ticker)
    return jsonify({"ticker": ticker.upper(), "ltp": round(ltp, 2)})


# ---------------------------------------------------------------------------
# Portfolio summary (totals + volatility + Sharpe + today's change)
# ---------------------------------------------------------------------------
@app.get("/api/portfolio/summary")
def portfolio_summary():
    rows = db.get_holdings()
    if not rows:
        return jsonify({"annualisedVolatility": 0, "sharpeRatio": 0,
                        "dayChange": 0, "dayChangePct": 0,
                        "totalMarketValue": 0, "totalInvested": 0})

    tickers = [r["ticker"] for r in rows]
    prices = _prices_for_tickers(tickers)
    quotes = market.get_quotes(tickers)  # for today's change (previous close)

    total_mv = total_inv = day_change = prev_value = 0.0
    for r in rows:
        ltp = prices.get(r["ticker"], r["avg_buy_price"])
        total_mv += r["quantity"] * ltp
        total_inv += r["quantity"] * r["avg_buy_price"]
        q = quotes.get(r["ticker"])
        if q:
            day_change += r["quantity"] * q["net_change"]
            prev_value += r["quantity"] * q["prev_close"]

    day_pct = (day_change / prev_value * 100) if prev_value else 0.0

    # Volatility + Sharpe from a real historical portfolio value series (needs Zerodha).
    risk = {"annualisedVolatility": 0, "sharpeRatio": 0}
    closes_by_ticker = {r["ticker"]: _daily_closes(r["ticker"]) for r in rows}
    if all(closes_by_ticker.values()):
        common_dates = set.intersection(*[set(c.keys()) for c in closes_by_ticker.values()])
        if len(common_dates) > 2:
            value_series = []
            for d in sorted(common_dates):
                value_series.append(sum(r["quantity"] * closes_by_ticker[r["ticker"]][d] for r in rows))
            risk = analysis.portfolio_risk(value_series)

    return jsonify({
        "annualisedVolatility": risk["annualisedVolatility"],
        "sharpeRatio": risk["sharpeRatio"],
        "dayChange": round(day_change, 2),
        "dayChangePct": round(day_pct, 2),
        "totalMarketValue": round(total_mv, 2),
        "totalInvested": round(total_inv, 2),
    })


@app.get("/api/portfolio/closed")
def portfolio_closed():
    return jsonify([_closed_json(r) for r in db.get_closed()])


# ---------------------------------------------------------------------------
# Tickers (for the "Add stock" dropdown)
# ---------------------------------------------------------------------------
@app.get("/api/tickers")
def get_tickers():
    instruments = db.get_all_instruments()
    if instruments:
        return jsonify([
            {"ticker": i["tradingsymbol"], "name": i["name"] or i["tradingsymbol"],
             "sector": sector_of(i["tradingsymbol"])}
            for i in instruments
        ])
    # Fallback list so the form works even before instruments are seeded.
    from sectors import SECTORS
    return jsonify([{"ticker": t, "name": t, "sector": s} for t, s in sorted(SECTORS.items())])


# ---------------------------------------------------------------------------
# Historical daily prices  (Module 2 data)
# ---------------------------------------------------------------------------
@app.get("/api/history/<ticker>")
def get_history(ticker):
    ticker = ticker.upper()
    from_d = request.args.get("from")
    to_d = request.args.get("to")
    prices, source = _load_prices(ticker, from_d, to_d)
    if not prices:
        return jsonify({"error": f"No price data available for {ticker}."}), 404
    return jsonify({"ticker": ticker, "source": source,
                    "candles": [{"date": p["date"], "close": p["close"]} for p in prices]})


# ---------------------------------------------------------------------------
# Backtest (Module 2)
# ---------------------------------------------------------------------------
@app.post("/api/backtest")
def run_backtest():
    data = request.get_json(silent=True) or {}
    ticker = str(data.get("ticker", "")).upper().strip()
    try:
        short_w = int(data.get("shortWindow", 20))
        long_w = int(data.get("longWindow", 50))
        capital = float(data.get("capital", 100000))
    except (TypeError, ValueError):
        return jsonify({"error": "shortWindow, longWindow and capital must be numbers."}), 400
    from_d = data.get("from")
    to_d = data.get("to")

    if not ticker:
        return jsonify({"error": "Please choose a stock to backtest."}), 400
    if short_w <= 0 or long_w <= 0 or short_w >= long_w:
        return jsonify({"error": "Short window must be a positive number smaller than the long window."}), 400
    if capital <= 0:
        return jsonify({"error": "Starting capital must be greater than 0."}), 400

    prices, source = _load_prices(ticker, from_d, to_d)
    if not prices:
        return jsonify({"error": f"No price data available for {ticker} (try seeding instruments / logging in, or add a CSV)."}), 404

    try:
        result = backtest.run_sma_backtest(prices, short_w, long_w, capital)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    # Add Module 3 stats.
    result["stats"] = analysis.trade_stats(result["trades"])
    result["stats"]["maxDrawdownPct"] = round(
        analysis.max_drawdown([p["value"] for p in result["equityCurve"]]), 2
    )
    result["source"] = source
    return jsonify(result)


def _load_prices(ticker: str, from_d: str | None, to_d: str | None):
    """
    Get daily (date, close) prices for a ticker.
    Prefer Zerodha; fall back to a CSV in sample_data/. Returns (prices, source).
    """
    token = db.get_instrument_token(ticker)
    if token:
        to_date = to_d or dt.date.today().strftime("%Y-%m-%d")
        from_date = from_d or (dt.date.today() - dt.timedelta(days=400)).strftime("%Y-%m-%d")
        candles = market.historical_daily(token, from_date, to_date)
        if candles:
            prices = [{"date": _fmt_date(c["date"]), "close": float(c["close"])} for c in candles]
            return prices, "zerodha"
    # CSV fallback
    csv_prices = backtest.load_prices_from_csv(ticker)
    if csv_prices:
        if from_d:
            csv_prices = [p for p in csv_prices if p["date"] >= from_d]
        if to_d:
            csv_prices = [p for p in csv_prices if p["date"] <= to_d]
        return csv_prices, "csv"
    return [], "none"


# ---------------------------------------------------------------------------
# startup
# ---------------------------------------------------------------------------
def startup():
    db.init_db()
    print("Database ready at portfolio.db")
    if market.connect():
        print("Connected to Zerodha.")
    else:
        print(f"Running WITHOUT live Zerodha data ({market.last_error}).")
        print("The portfolio still works; prices fall back to your average cost.")


if __name__ == "__main__":
    startup()
    print(f"Starting API on http://{HOST}:{PORT}/api")
    app.run(host=HOST, port=PORT, debug=True, use_reloader=False)
