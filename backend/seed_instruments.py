"""
Refresh the NSE equity symbol list from Zerodha into the database.

Run this once a day (or whenever you like). It logs in, downloads every NSE
equity instrument, and stores the ones we need (token, symbol, name) in the
`instruments` table. After this, the "Add stock" dropdown and historical data
use real, current symbols.

Usage:   python seed_instruments.py
"""
import database as db
from market_data import market


def main():
    db.init_db()
    print("Logging in to Zerodha...")
    if not market.connect():
        print(f"Could not connect to Zerodha: {market.last_error}")
        print("Nothing was changed. Fix credentials / internet and try again.")
        return

    print("Downloading NSE equity instruments...")
    instruments = market.fetch_nse_equity()
    if not instruments:
        print(f"No instruments returned: {market.last_error}")
        return

    count = db.replace_instruments(instruments)
    print(f"Stored {count} NSE equity symbols in the database.")
    # Show a few as a sanity check.
    for row in db.get_all_instruments()[:5]:
        print(f"  {row['tradingsymbol']:12} token={row['instrument_token']:>10}  {row['name']}")


if __name__ == "__main__":
    main()
