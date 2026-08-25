/* =============================================================================
   Portfolio Tracker  ·  Configuration
   -----------------------------------------------------------------------------
   Single source of truth for market settings, the backend server, and the API
   endpoints. The UI reads everything from window.APP_CONFIG, so wiring the real
   Python (Flask) + SQLite backend later means only flipping useMock to false and
   pointing `server` at the running API — no markup or component changes needed.
   ========================================================================== */
window.APP_CONFIG = {
  /* Which market this instance tracks. Everything is Indian: NSE symbols, INR,
     and Indian digit grouping (lakh / crore) via the en-IN locale. */
  market: {
    exchange: "NSE",
    currency: "INR",
    locale:   "en-IN",
    symbol:   "₹",          // ₹
    riskFreeRate: 6.5            // % — Indian ~10y G-Sec, used for Sharpe on the backend
  },

  /* While true, the app runs entirely on in-memory mock data (see app.js).
     Set to false once the endpoints below are live.
     NOTE: when false, the Flask backend must be running (python app.py). */
  useMock: false,

  /* The backend that will eventually serve real data. */
  server: {
    protocol: "http",
    host:     "localhost",
    port:     5000
  },

  /* Full API base, derived from `server`. */
  get baseUrl() {
    return `${this.server.protocol}://${this.server.host}:${this.server.port}/api`;
  },

  /* REST contract the Flask backend is expected to expose. `:id` / `:ticker`
     are path params filled in at call time. */
  endpoints: {
    holdings:         "/holdings",             // GET all open · POST new
    holdingById:      "/holdings/:id",         // PUT edit · DELETE remove
    sellHolding:      "/holdings/:id/sell",    // POST { quantity, sellPrice } -> books P&L
    quote:            "/quote/:ticker",        // GET last traded price
    portfolioSummary: "/portfolio/summary",    // GET totals + volatility + sharpe
    closedPositions:  "/portfolio/closed",     // GET realised / booked history
    tickers:          "/tickers",              // GET valid NSE symbols for the form
    history:          "/history/:ticker",      // GET daily (1d) close prices — Module 2
    backtest:         "/backtest"              // POST run an SMA-crossover backtest — Module 2
  }
};
