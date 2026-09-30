"""
SQLite database layer for the Portfolio Tracker.

One file (portfolio.db), four tables:
  - users              : login accounts (username + salted password hash)
  - holdings           : each user's open positions  (survives restart -> SC1)
  - closed_positions   : positions the user has sold (booked P&L)
  - instruments        : the full NSE equity symbol list, refreshed from Zerodha

holdings and closed_positions carry a user_id so every user sees only their own
data. Databases created before accounts existed are migrated on start-up
(see _migrate) and their rows are handed to the first account that registers.

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
        CREATE TABLE IF NOT EXISTS users (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            username      TEXT    NOT NULL UNIQUE COLLATE NOCASE,
            password_hash TEXT    NOT NULL,
            created_at    TEXT    NOT NULL
        );

        CREATE TABLE IF NOT EXISTS holdings (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id       INTEGER REFERENCES users(id),
            ticker        TEXT    NOT NULL,
            quantity      INTEGER NOT NULL,
            avg_buy_price REAL    NOT NULL,
            purchase_date TEXT    NOT NULL
        );

        CREATE TABLE IF NOT EXISTS closed_positions (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id       INTEGER REFERENCES users(id),
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
    _migrate(conn)
    conn.close()


def _migrate(conn: sqlite3.Connection) -> None:
    """Add the user_id column to databases created before accounts existed."""
    for table in ("holdings", "closed_positions"):
        cols = [r["name"] for r in conn.execute(f"PRAGMA table_info({table})")]
        if "user_id" not in cols:
            conn.execute(f"ALTER TABLE {table} ADD COLUMN user_id INTEGER REFERENCES users(id)")
    conn.commit()


# ---------------------------------------------------------------------------
# Users
# ---------------------------------------------------------------------------
def get_user_by_username(username: str) -> dict | None:
    conn = get_connection()
    row = conn.execute("SELECT * FROM users WHERE username = ? COLLATE NOCASE", (username,)).fetchone()
    conn.close()
    return dict(row) if row else None


def get_user(user_id: int) -> dict | None:
    conn = get_connection()
    row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    conn.close()
    return dict(row) if row else None


def create_user(username: str, password_hash: str, created_at: str) -> dict:
    """
    Insert a user. If this is the very first account, any holdings / closed
    positions saved before accounts existed (user_id IS NULL) become theirs, so
    nothing is lost when upgrading an existing portfolio.db.
    """
    conn = get_connection()
    first_user = conn.execute("SELECT COUNT(*) FROM users").fetchone()[0] == 0
    cur = conn.execute(
        "INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?)",
        (username, password_hash, created_at),
    )
    new_id = cur.lastrowid
    if first_user:
        conn.execute("UPDATE holdings SET user_id = ? WHERE user_id IS NULL", (new_id,))
        conn.execute("UPDATE closed_positions SET user_id = ? WHERE user_id IS NULL", (new_id,))
    conn.commit()
    conn.close()
    return get_user(new_id)


def update_password(user_id: int, password_hash: str) -> None:
    conn = get_connection()
    conn.execute("UPDATE users SET password_hash = ? WHERE id = ?", (password_hash, user_id))
    conn.commit()
    conn.close()


def users_count() -> int:
    conn = get_connection()
    n = conn.execute("SELECT COUNT(*) FROM users").fetchone()[0]
    conn.close()
    return n


# ---------------------------------------------------------------------------
# Holdings (always scoped to one user)
# ---------------------------------------------------------------------------
def get_holdings(user_id: int) -> list[dict]:
    conn = get_connection()
    rows = conn.execute("SELECT * FROM holdings WHERE user_id = ? ORDER BY id", (user_id,)).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_holding(holding_id: int, user_id: int) -> dict | None:
    """A holding by id - but only if it belongs to this user (no peeking at others)."""
    conn = get_connection()
    row = conn.execute("SELECT * FROM holdings WHERE id = ? AND user_id = ?", (holding_id, user_id)).fetchone()
    conn.close()
    return dict(row) if row else None


def add_holding(user_id: int, ticker: str, quantity: int, avg_buy_price: float, purchase_date: str) -> dict:
    conn = get_connection()
    cur = conn.execute(
        "INSERT INTO holdings (user_id, ticker, quantity, avg_buy_price, purchase_date) VALUES (?, ?, ?, ?, ?)",
        (user_id, ticker, quantity, avg_buy_price, purchase_date),
    )
    conn.commit()
    new_id = cur.lastrowid
    conn.close()
    return get_holding(new_id, user_id)


def update_holding(holding_id: int, user_id: int, quantity: int, avg_buy_price: float, purchase_date: str) -> dict | None:
    conn = get_connection()
    conn.execute(
        "UPDATE holdings SET quantity = ?, avg_buy_price = ?, purchase_date = ? WHERE id = ? AND user_id = ?",
        (quantity, avg_buy_price, purchase_date, holding_id, user_id),
    )
    conn.commit()
    conn.close()
    return get_holding(holding_id, user_id)


def delete_holding(holding_id: int, user_id: int) -> None:
    conn = get_connection()
    conn.execute("DELETE FROM holdings WHERE id = ? AND user_id = ?", (holding_id, user_id))
    conn.commit()
    conn.close()


# ---------------------------------------------------------------------------
# Closed positions
# ---------------------------------------------------------------------------
def get_closed(user_id: int) -> list[dict]:
    conn = get_connection()
    rows = conn.execute(
        "SELECT * FROM closed_positions WHERE user_id = ? ORDER BY close_date DESC, id DESC", (user_id,)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def add_closed(user_id: int, ticker: str, quantity: int, avg_buy_price: float, sell_price: float, close_date: str) -> dict:
    conn = get_connection()
    cur = conn.execute(
        "INSERT INTO closed_positions (user_id, ticker, quantity, avg_buy_price, sell_price, close_date) "
        "VALUES (?, ?, ?, ?, ?, ?)",
        (user_id, ticker, quantity, avg_buy_price, sell_price, close_date),
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
