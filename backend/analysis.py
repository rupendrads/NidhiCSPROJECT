"""
Risk and performance maths (Module 1 SC3 + Module 3).

Kept as plain, well-commented Python so the formulas are easy to explain in the
write-up. Nothing here is hidden inside a library call.
"""
import math
import statistics
from config import RISK_FREE_RATE, TRADING_DAYS


def daily_returns(closes: list[float]) -> list[float]:
    """
    Turn a list of daily closing prices into daily returns.
    return = (today - yesterday) / yesterday
    """
    rets = []
    for i in range(1, len(closes)):
        prev = closes[i - 1]
        if prev:
            rets.append((closes[i] - prev) / prev)
    return rets


def annualised_volatility(returns: list[float]) -> float:
    """
    Volatility = standard deviation of daily returns, scaled to a year.
    Annualising multiplies by sqrt(252) because variance grows with time.
    Returned as a percentage (e.g. 16.8 means 16.8%).
    """
    if len(returns) < 2:
        return 0.0
    daily_sd = statistics.stdev(returns)          # sample standard deviation
    return daily_sd * math.sqrt(TRADING_DAYS) * 100


def sharpe_ratio(returns: list[float]) -> float:
    """
    Sharpe = (annual return - risk-free rate) / annual volatility.
    Higher is better: more reward per unit of risk.
    """
    if len(returns) < 2:
        return 0.0
    mean_daily = statistics.mean(returns)
    annual_return = mean_daily * TRADING_DAYS * 100        # % per year
    ann_vol = annualised_volatility(returns)               # % per year
    if ann_vol == 0:
        return 0.0
    return (annual_return - RISK_FREE_RATE) / ann_vol


def max_drawdown(equity_curve: list[float]) -> float:
    """
    The biggest peak-to-trough fall in an equity curve, as a positive %.
    Used for Module 3.
    """
    if not equity_curve:
        return 0.0
    peak = equity_curve[0]
    worst = 0.0
    for value in equity_curve:
        if value > peak:
            peak = value
        if peak:
            drop = (peak - value) / peak
            worst = max(worst, drop)
    return worst * 100


def portfolio_risk(value_series: list[float]) -> dict:
    """
    Given a day-by-day portfolio VALUE series, return volatility + Sharpe.
    Both to be shown to 2 dp (SC3).
    """
    rets = daily_returns(value_series)
    return {
        "annualisedVolatility": round(annualised_volatility(rets), 2),
        "sharpeRatio": round(sharpe_ratio(rets), 2),
    }


def trade_stats(trades: list[dict]) -> dict:
    """
    Summary stats from a list of completed round-trip trades (Module 3).
    Each trade is expected to have a 'profit' number (currency).
    """
    completed = [t for t in trades if t.get("action") == "SELL" and "profit" in t]
    if not completed:
        return {"tradeCount": 0, "winRate": 0.0, "avgProfit": 0.0}
    wins = [t for t in completed if t["profit"] > 0]
    total_profit = sum(t["profit"] for t in completed)
    return {
        "tradeCount": len(completed),
        "winRate": round(len(wins) / len(completed) * 100, 2),
        "avgProfit": round(total_profit / len(completed), 2),
    }
