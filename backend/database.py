"""
SQLite database layer for the Portfolio Tracker.

One file (portfolio.db), three tables:
  - holdings           : the user's open positions  (survives restart -> SC1)
  - closed_positions   : positions the user has sold (booked P&L)
  - instruments        : the full NSE equity symbol list, refreshed from Zerodha

Every query uses '?' placeholders (parameterised SQL) so user input can never be
injected into a query. The database uses snake_case column names; the API layer
(app.py) converts these to the camelCase the frontend expects.
"""
import sqlite3
from config import DB_PATH


def get_connection() -> sqlite3.Connection:
    """Open a connection. row_factory=Row lets us read columns by name."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    """Create the tables if they do not already exist. Safe to call every start."""
    conn = get_connection()
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS holdings (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            ticker        TEXT    NOT NULL,
            quantity      INTEGER NOT NULL,
            avg_buy_price REAL    NOT NULL,
            purchase_date TEXT    NOT NULL
        );

        CREATE TABLE IF NOT EXISTS closed_positions (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            ticker        TEXT    NOT NULL,
            quantity      INTEGER NOT NULL,
            avg_buy_price REAL    NOT NULL,
            sell_price    REAL    NOT NULL,
            close_date    TEXT    NOT NULL
        );

        CREATE TABLE IF NOT EXISTS instruments (
            instrument_token INTEGER PRIMARY KEY,
            tradingsymbol    TEXT    NOT NULL,
            name             TEXT
        );
        """
    )
    conn.commit()
    conn.close()


# ---------------------------------------------------------------------------
# Holdings
# ---------------------------------------------------------------------------
def get_holdings() -> list[dict]:
    conn = get_connection()
    rows = conn.execute("SELECT * FROM holdings ORDER BY id").fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_holding(holding_id: int) -> dict | None:
    conn = get_connection()
    row = conn.execute("SELECT * FROM holdings WHERE id = ?", (holding_id,)).fetchone()
    conn.close()
    return dict(row) if row else None


def add_holding(ticker: str, quantity: int, avg_buy_price: float, purchase_date: str) -> dict:
    conn = get_connection()
    cur = conn.execute(
        "INSERT INTO holdings (ticker, quantity, avg_buy_price, purchase_date) VALUES (?, ?, ?, ?)",
        (ticker, quantity, avg_buy_price, purchase_date),
    )
    conn.commit()
    new_id = cur.lastrowid
    conn.close()
    return get_holding(new_id)


def update_holding(holding_id: int, quantity: int, avg_buy_price: float, purchase_date: str) -> dict | None:
    conn = get_connection()
    conn.execute(
        "UPDATE holdings SET quantity = ?, avg_buy_price = ?, purchase_date = ? WHERE id = ?",
        (quantity, avg_buy_price, purchase_date, holding_id),
    )
    conn.commit()
    conn.close()
    return get_holding(holding_id)


def delete_holding(holding_id: int) -> None:
    conn = get_connection()
    conn.execute("DELETE FROM holdings WHERE id = ?", (holding_id,))
    conn.commit()
    conn.close()


# ---------------------------------------------------------------------------
# Closed positions
# ---------------------------------------------------------------------------
def get_closed() -> list[dict]:
    conn = get_connection()
    rows = conn.execute("SELECT * FROM closed_positions ORDER BY close_date DESC, id DESC").fetchall()
    conn.close()
    return [dict(r) for r in rows]


def add_closed(ticker: str, quantity: int, avg_buy_price: float, sell_price: float, close_date: str) -> dict:
    conn = get_connection()
    cur = conn.execute(
        "INSERT INTO closed_positions (ticker, quantity, avg_buy_price, sell_price, close_date) "
        "VALUES (?, ?, ?, ?, ?)",
        (ticker, quantity, avg_buy_price, sell_price, close_date),
    )
    conn.commit()
    row = conn.execute("SELECT * FROM closed_positions WHERE id = ?", (cur.lastrowid,)).fetchone()
    conn.close()
    return dict(row)


# ---------------------------------------------------------------------------
# Instruments (the NSE symbol list)
# ---------------------------------------------------------------------------
def replace_instruments(instruments: list[dict]) -> int:
    """
    Wipe and refill the instruments table.
    Each item must have: instrument_token, tradingsymbol, name.
    Returns how many were stored.
    """
    conn = get_connection()
    conn.execute("DELETE FROM instruments")
    conn.executemany(
        "INSERT OR REPLACE INTO instruments (instrument_token, tradingsymbol, name) VALUES (?, ?, ?)",
        [(i["instrument_token"], i["tradingsymbol"], i.get("name", "")) for i in instruments],
    )
    conn.commit()
    count = conn.execute("SELECT COUNT(*) FROM instruments").fetchone()[0]
    conn.close()
    return count


def get_all_instruments() -> list[dict]:
    conn = get_connection()
    rows = conn.execute("SELECT * FROM instruments ORDER BY tradingsymbol").fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_instrument_token(ticker: str) -> int | None:
    conn = get_connection()
    row = conn.execute(
        "SELECT instrument_token FROM instruments WHERE tradingsymbol = ?", (ticker.upper(),)
    ).fetchone()
    conn.close()
    return row["instrument_token"] if row else None


def instrument_exists(ticker: str) -> bool:
    conn = get_connection()
    row = conn.execute(
        "SELECT 1 FROM instruments WHERE tradingsymbol = ?", (ticker.upper(),)
    ).fetchone()
    conn.close()
    return row is not None


def instruments_count() -> int:
    conn = get_connection()
    n = conn.execute("SELECT COUNT(*) FROM instruments").fetchone()[0]
    conn.close()
    return n
