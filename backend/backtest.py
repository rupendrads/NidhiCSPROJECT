"""
SMA-crossover backtesting engine (Module 2).

Strategy in one sentence:
  - Short SMA crossing ABOVE the long SMA  -> BUY  (go long, use all cash)
  - Short SMA crossing BELOW the long SMA  -> SELL (go to cash)
We assume we trade at that day's CLOSING price, with no brokerage and no
slippage. These are deliberate, documented simplifications from the proposal.

The engine works on a plain list of (date, close) pairs, so it does not care
whether the prices came from Zerodha or from a CSV file.
"""
import csv
import os
from config import SAMPLE_DIR


def simple_moving_average(values: list[float], window: int) -> list[float | None]:
    """
    Rolling average over `window` days. The first (window-1) entries are None
    because there aren't enough earlier days yet.
    """
    out: list[float | None] = []
    running = 0.0
    for i, v in enumerate(values):
        running += v
        if i >= window:
            running -= values[i - window]
        if i >= window - 1:
            out.append(running / window)
        else:
            out.append(None)
    return out


def run_sma_backtest(prices: list[dict], short_window: int, long_window: int, capital: float) -> dict:
    """
    prices: list of {'date': 'YYYY-MM-DD', 'close': float}, oldest first.
    Returns the equity curve, the buy-and-hold benchmark, the trade list, and a
    plain-English verdict on whether the strategy beat buy-and-hold.
    """
    if short_window >= long_window:
        raise ValueError("Short window must be smaller than the long window.")
    if len(prices) <= long_window:
        raise ValueError("Not enough price history for these SMA windows.")

    dates = [p["date"] for p in prices]
    closes = [float(p["close"]) for p in prices]

    short_sma = simple_moving_average(closes, short_window)
    long_sma = simple_moving_average(closes, long_window)

    cash = float(capital)
    shares = 0
    position = 0                # 0 = in cash, 1 = holding
    trades: list[dict] = []
    equity_curve: list[dict] = []
    buy_price = 0.0             # price we bought the current lot at

    for i in range(len(closes)):
        s, l = short_sma[i], long_sma[i]
        price = closes[i]

        # Only act once both averages exist (need the day before too, to detect a cross).
        if s is not None and l is not None and i > 0 and short_sma[i - 1] is not None and long_sma[i - 1] is not None:
            crossed_up = short_sma[i - 1] <= long_sma[i - 1] and s > l
            crossed_down = short_sma[i - 1] >= long_sma[i - 1] and s < l

            if crossed_up and position == 0:
                shares = int(cash // price)          # buy as many whole shares as cash allows
                if shares > 0:
                    cash -= shares * price
                    buy_price = price
                    position = 1
                    trades.append({"date": dates[i], "action": "BUY", "price": round(price, 2), "shares": shares})

            elif crossed_down and position == 1:
                proceeds = shares * price
                profit = (price - buy_price) * shares
                cash += proceeds
                trades.append({
                    "date": dates[i], "action": "SELL", "price": round(price, 2),
                    "shares": shares, "profit": round(profit, 2),
                })
                shares = 0
                position = 0

        equity_curve.append({"date": dates[i], "value": round(cash + shares * price, 2)})

    # If still holding at the end, value it at the last close (no forced sale).
    final_value = cash + shares * closes[-1]

    # Benchmark: buy on day 1, hold to the end.
    first_price = closes[0]
    bench_shares = int(capital // first_price)
    bench_cash = capital - bench_shares * first_price
    benchmark_curve = [
        {"date": dates[i], "value": round(bench_cash + bench_shares * closes[i], 2)}
        for i in range(len(closes))
    ]
    benchmark_final = bench_cash + bench_shares * closes[-1]

    strat_return = (final_value - capital) / capital * 100
    bench_return = (benchmark_final - capital) / capital * 100
    beat = final_value > benchmark_final

    return {
        "params": {
            "shortWindow": short_window,
            "longWindow": long_window,
            "capital": capital,
            "from": dates[0],
            "to": dates[-1],
        },
        "equityCurve": equity_curve,
        "benchmarkCurve": benchmark_curve,
        "trades": trades,
        "summary": {
            "strategyFinalValue": round(final_value, 2),
            "strategyReturnPct": round(strat_return, 2),
            "benchmarkFinalValue": round(benchmark_final, 2),
            "benchmarkReturnPct": round(bench_return, 2),
            "beatBuyAndHold": beat,
            "verdict": (
                "The SMA strategy BEAT buy-and-hold." if beat
                else "The SMA strategy did NOT beat buy-and-hold."
            ),
        },
    }


def load_prices_from_csv(ticker: str) -> list[dict]:
    """
    Fallback price source: read backend/sample_data/<TICKER>.csv with headers
    'date,close'. Lets the backtest run with no paid API / when markets are shut.
    """
    path = os.path.join(SAMPLE_DIR, f"{ticker.upper()}.csv")
    if not os.path.exists(path):
        return []
    prices = []
    with open(path, newline="") as f:
        for row in csv.DictReader(f):
            prices.append({"date": row["date"], "close": float(row["close"])})
    prices.sort(key=lambda p: p["date"])
    return prices
