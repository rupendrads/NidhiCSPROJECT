# Portfolio Tracker & SMA Backtesting System — Project Report

**OCR A-Level Computer Science (H446) — Component 03: Programming Project**

> **How to use this document.** This is a structured **draft/scaffold** for your NEA write-up. It is organised to match the four assessment objectives and their mark bands (Analysis 10 · Design 15 · Development 25 · Evaluation 20 = 70). It contains the real technical content of the system you built, but the NEA must be **your own work**:
> - Rewrite the prose in **your own voice**.
> - Fill every `✍️ [YOUR INPUT]` box — these need *your* words (e.g. your stakeholder's real answers, your reflections).
> - Insert screenshots at every `📸 [SCREENSHOT]` marker — the mark scheme rewards **annotated evidence**, so add a caption explaining each one.
> - Declare any AI assistance according to your centre's/JCQ policy.
> The examiner's magic word in every top band is **"justified"** — for every choice, say *what* you did **and why**.

---

## Contents
1. [Analysis (AO2.2 — 10 marks)](#1-analysis)
2. [Design (AO3.1 — 15 marks)](#2-design)
3. [Development (AO3.2 — 25 marks)](#3-development)
4. [Evaluation (AO3.3 — 20 marks)](#4-evaluation)
5. [Appendices](#5-appendices)

---

# 1. Analysis
*(AO2.2 — 10 marks. Top band needs: problem described **and justified** as computational; stakeholders described with **why** it suits them; **in-depth** research with justified approaches; essential features explained; limitations justified; requirements (incl. hardware/software) justified; **measurable, justified** success criteria.)*

## 1.1 Problem identification
Private ("retail") investors who hold shares on the Indian **National Stock Exchange (NSE)** face three recurring problems:

1. **Fragmented tracking.** Holdings, average cost, current value and profit/loss are scattered across broker screens and mental arithmetic. There is no single, calm view of *"what do I own and how is it doing?"*
2. **No objective sense of risk.** Investors feel volatility emotionally but rarely quantify it. A single number — **volatility** and a **Sharpe ratio** — would turn a vague anxiety into an objective figure.
3. **Emotional, unsystematic decisions.** Buying and selling on gut feeling leads to overtrading. Investors have no evidence about whether a **systematic rule** (e.g. a moving-average strategy) would actually have beaten simply holding.

The proposed solution is a **Portfolio Tracker with an SMA (Simple Moving Average) backtesting engine** that (a) stores and values a portfolio of NSE shares, (b) computes objective risk metrics, and (c) tests a rule-based trading strategy against a buy-and-hold benchmark on real historical prices.

## 1.2 Why the problem is amenable to a computational solution *(justify — top band)*
The problem is well suited to a computational approach because it exhibits the classic features that make problems solvable by computational methods:

- **Repetitive, well-defined calculation over large data.** Valuing a portfolio, computing daily returns, moving averages, volatility and a backtest means performing the *same* arithmetic across thousands of price points. This is exactly what a computer does faster and more reliably than a human — it removes human calculation error (addressing problem 1).
- **Decomposition.** The problem breaks cleanly into independent sub-problems — tracking, risk analysis, backtesting — each solvable separately (see §2.1). This decomposability is a hallmark of a computational problem.
- **Abstraction.** A real position (a messy history of purchases, dividends, news) can be abstracted to the few attributes that matter for valuation: *ticker, quantity, average cost, date*. Modelling only these is an abstraction that makes the problem tractable.
- **Pattern recognition & algorithmic rules.** The SMA-crossover strategy is a precise, repeatable rule (buy when short average crosses above long average). Rules like this can be expressed as an algorithm and executed identically every time — impossible to do consistently by hand (addressing problem 3).
- **Automation & data volume.** Fetching daily prices for any of ~1,800 NSE stocks and replaying two-plus years of history is only feasible automatically, via an API.
- **Persistence & speed.** A database recalls the portfolio instantly on every run; the calculations complete in well under a second.

Because the task is calculation-heavy, rule-based, decomposable and data-driven, a **computational solution is clearly appropriate** — a manual/spreadsheet approach would be slow, error-prone and could not realistically run a historical backtest.

## 1.3 Stakeholders *(describe + justify suitability — top band)*
**Primary stakeholder — Krish** (real end-user).

| Attribute | Detail |
|-----------|--------|
| Profile | Private investor, ~7 years' experience |
| Portfolio | ~15 holdings, **all NSE (Indian) equities** |
| Broker | Zerodha (tracks via the Kite platform) |
| Devices | Uses a laptop; prefers a simple, clean screen |
| Confidence | Comfortable investor but anxious about volatility; prone to impulsive buying |

**How Krish will use the solution, and why it suits him:**
- He will **add his holdings once** and see them **persist**, so each morning he opens one consolidated view instead of adding figures up manually — this directly answers problem 1 and suits his preference for a *single, simple screen*.
- He will read the **volatility and Sharpe** figures to get an **objective** handle on risk, which is appropriate to his stated anxiety — it replaces feeling with a number.
- He will run the **backtest** to get **evidence** on whether a systematic rule beats his current discretionary style — appropriate because it targets his tendency to overtrade.
- Because he already trades **NSE shares via Zerodha**, sourcing data from the **Zerodha Kite API** fits his existing world exactly (₹, NSE symbols, the same prices he sees in Kite).

> ✍️ **[YOUR INPUT — stakeholder interview].** Insert a short record of a real conversation with your stakeholder: 4–6 questions and *their actual answers* (e.g. "How do you track your portfolio today?", "What worries you most?", "Would a single risk number help?"). Quote them. This is high-value evidence for the top band.

**Secondary stakeholders:** other retail NSE investors with similar needs (the design is general, not hard-coded to Krish's specific shares); and the developer/assessor as a maintenance stakeholder.

## 1.4 Research into existing solutions *(in-depth + justified approaches — top band)*
I researched existing tools to identify features worth adopting and pitfalls to avoid.

| Existing solution | Strengths | Weaknesses for this stakeholder | What I took from it |
|-------------------|-----------|--------------------------------|---------------------|
| **Zerodha Console / Kite** (broker portal) | Accurate live holdings, official data | Cluttered for a nervous user; **no volatility/Sharpe**; **no strategy backtesting** | Adopt: live NSE prices via its API. Avoid: clutter. |
| **Moneycontrol / ET Money portfolios** | Consolidated view, news | Ad-heavy, generic, no rule-based backtesting, weak risk maths | Adopt: consolidated single view. Avoid: noise. |
| **Excel / Google Sheets** | Flexible, familiar | Manual, error-prone, no live data, backtest is painful and non-repeatable | Adopt: the *idea* of transparent formulas. Avoid: manual entry each time (→ use a database). |
| **TradingView** | Powerful charting & backtesting | Complex, subscription, US-centric defaults, overkill for one nervous investor | Adopt: strategy-vs-benchmark chart. Avoid: complexity. |

**Justified approaches based on this research:**
- Use the **Zerodha Kite API** for data (matches the stakeholder; authoritative NSE prices) rather than scraping or manual entry.
- Provide **exactly the risk figures the pro tools omit** (volatility, Sharpe) because that is the stakeholder's core need.
- Keep the interface **deliberately calm and minimal** — the opposite of the cluttered portals — because the stakeholder is anxious and prefers simplicity.
- Include a **clear strategy-vs-buy-and-hold visualisation**, the single most useful idea borrowed from TradingView, but pared down to one strategy (SMA) to stay understandable.

## 1.5 Essential features of the proposed solution *(explain choices — top band)*
1. **Persistent portfolio store** — add/edit/sell/remove holdings that survive restarts *(without this the tool is useless day-to-day)*.
2. **Live valuation** — current value, invested cost, unrealised & booked P&L, % return *(the core "how am I doing?" answer)*.
3. **Risk metrics** — annualised volatility and Sharpe ratio *(the stakeholder's distinguishing need)*.
4. **Visual portfolio insight** — allocation by holding and by sector, return-by-holding *(turns numbers into an at-a-glance picture)*.
5. **SMA-crossover backtesting** vs a buy-and-hold benchmark, with trade log and stats *(the evidence engine — Modules 2 & 3)*.
6. **Robust input validation** *(a nervous, non-technical user must be protected from bad input)*.

## 1.6 Limitations of the proposed solution *(identify + justify — top band)*
These are **deliberate, justified** scope decisions, not oversights:
- **Historical/CSV-plus-API data, not a real-time tick feed.** Backtests use *daily* closing prices. Justified: the stakeholder is a long-term investor, not a day-trader; daily data is sufficient and keeps the system simple and within API limits.
- **A single strategy (SMA crossover).** Justified: it is the clearest, most classic systematic rule; adding many strategies would dilute focus and understandability for a nervous user.
- **Ignores dividends, brokerage and tax; assumes fills at the closing price with no slippage.** Justified: these simplify the model, are standard for an educational backtest, and their omission is small over the horizons considered; they are documented so results are not over-claimed.
- **Single-user, single-machine desktop tool.** Justified: it models one investor (Krish); no multi-user accounts/authentication are needed, which removes significant complexity.

## 1.7 Requirements *(specify + justify, incl. hardware/software — top band)*
**Functional requirements** (what it must do): FR1 add/edit/remove/sell holdings; FR2 persist them; FR3 fetch live LTP; FR4 compute value, P&L, %; FR5 compute volatility & Sharpe; FR6 list NSE symbols for validation; FR7 fetch daily historical prices; FR8 run an SMA backtest with user parameters; FR9 compare against buy-and-hold; FR10 show trade stats (count, win-rate, drawdown); FR11 reject invalid input with clear messages.

**Non-functional requirements:** NFR1 calm, uncluttered, accessible UI; NFR2 Indian conventions (₹, NSE symbols, lakh/crore grouping); NFR3 responses feel instant (<1 s for portfolio load); NFR4 data-light, dependency-light, self-contained; NFR5 secrets kept out of source control.

**Hardware requirements (justified):** any modern laptop/PC (the stakeholder uses a laptop); no GPU or special hardware — the calculations are light; internet connection required (justified: live prices and historical data come from an online API).

**Software requirements (justified):** a modern web browser (to run the plain-HTML front end — no install for the user); **Python 3** with **Flask** (smallest web framework — justified for a one-user tool), **SQLite** (a single-file database, no server to install — justified for one user), the **kiteconnect** and **pyotp** libraries (official Zerodha access + automated 2-factor login); a **Zerodha account with Kite Connect** enabled (justified: it is the stakeholder's own broker and the authoritative NSE data source).

## 1.8 Measurable success criteria *(measurable + justified — top band)*
| # | Success criterion | How it is measured | Why it matters |
|---|-------------------|--------------------|----------------|
| SC1 | Portfolio **persists** across a restart | Add a holding, close, reopen → it is still there | Core usability (FR2) |
| SC2 | Value & return **match a hand calculation** to within ₹0.01 | Compare app figures to a manual calc for a test portfolio | Trust in the numbers (FR4) |
| SC3 | **Volatility & Sharpe** match a spreadsheet to 2 d.p. | Recompute from the same closes in a spreadsheet | The stakeholder's key need (FR5) |
| SC4 | Trades placed on the **exact crossover days** | Trace SMA values around each trade in the log | Backtest correctness (FR8) |
| SC5 | Labelled **equity-vs-benchmark chart** is produced | Visual check + legend/axes present | Evidence is understandable (FR9) |
| SC6 | Correct **trade stats** (count, win-rate, drawdown) | Recompute from the trade log by hand | Module 3 correctness (FR10) |
| SC7 | States whether the strategy **beat buy-and-hold**, with both return figures | Read the verdict + both %s | Answers the stakeholder's core question |
| SC8 | **Invalid input rejected** with a clear message | Try blank/negative/unknown-ticker/future-date inputs | Protects a non-technical user (FR11) |

---

# 2. Design
*(AO3.1 — 15 marks. Top band: decomposition **explained and justified**; structure defined in detail; full, accurate **algorithms** justified as a complete solution; usability features justified; key data structures/classes + validation justified; test data justified for iterative **and** post-development.)*

## 2.1 Decomposition *(explain + justify the breakdown — top band)*
The problem is decomposed top-down into three modules that mirror the analysis, each further broken into sub-problems. This breakdown is justified because each module has a **single responsibility** and a **clear data hand-off** to the next (the trade list Module 2 produces is consumed by Module 3), so each can be built and tested independently — the essence of a computational, iterative approach.

```
Portfolio Tracker & SMA Backtesting System
├── Module 1 — Portfolio Tracking
│   ├── 1.1 Store holdings (add / edit-lot / sell / delete)   → database
│   ├── 1.2 Fetch live prices (LTP)                           → Zerodha
│   ├── 1.3 Compute value, invested, P&L, % return
│   ├── 1.4 Compute risk (volatility, Sharpe)                 → historical
│   ├── 1.5 Visualise (allocation ribbon, sector donut, bars)
│   └── 1.6 Validate all input (client + server)
├── Module 2 — Strategy Backtesting
│   ├── 2.1 Get daily historical prices                       → Zerodha / CSV
│   ├── 2.2 Compute short & long SMAs
│   ├── 2.3 Detect crossovers → simulate trades → equity curve
│   ├── 2.4 Build buy-and-hold benchmark
│   └── 2.5 Visualise strategy vs benchmark + trade markers
└── Module 3 — Trade Analysis
    ├── 3.1 Trade log (from Module 2)
    ├── 3.2 Stats (count, win-rate, avg profit, max drawdown)
    └── 3.3 Verdict: did the strategy beat buy-and-hold?
```

> 📸 **[SCREENSHOT]** Consider redrawing this as a structure/hierarchy chart in a drawing tool and inserting the image, with a caption explaining the hand-offs between modules.

## 2.2 System architecture *(define the structure in detail — top band)*
A **three-tier** structure separates presentation, logic and data. This is justified because it lets the calm browser UI stay simple while all secrets and heavy calculation live safely on the server; the browser never talks to Zerodha directly.

```
┌────────────┐  HTTP + JSON   ┌─────────────┐  Kite Connect API  ┌──────────┐
│  Browser   │ ─────────────► │  Flask API  │ ─────────────────► │ Zerodha  │
│ (HTML/CSS/ │ ◄───────────── │  (Python)   │ ◄───────────────── │  Kite    │
│  JS)       │   JSON reply   └──────┬──────┘   prices/history    └──────────┘
└────────────┘                       │
                                     ▼
                              ┌─────────────┐
                              │   SQLite    │  portfolio.db
                              └─────────────┘
```
**Files (modular structure):** front end — `index.html`, `styles.css`, `app.js` (Module 1), `backtest.js` (Module 2/3 UI), `config.js` (the single place the API contract lives). Back end — `app.py` (routes), `database.py` (SQLite), `market_data.py` (all Zerodha calls), `analysis.py` (risk maths), `backtest.py` (SMA engine), `sectors.py`, `config.py`.

## 2.3 Data structures, storage and validation *(identify + justify + validation — top band)*
**Persistent storage — SQLite** (justified in §1.7). Three tables:

```sql
holdings(         id PK, ticker, quantity, avg_buy_price, purchase_date )
closed_positions( id PK, ticker, quantity, avg_buy_price, sell_price, close_date )
instruments(      instrument_token PK, tradingsymbol, name )   -- the NSE symbol list
```
*Justification of design:* separating **open** from **closed** positions lets booked (realised) P&L be reported independently of unrealised P&L; the `instruments` table is needed because Zerodha's historical API requires a numeric `instrument_token`, not a symbol, and it also backs the "valid NSE symbol" validation (SC8).

**API data contract (JSON)** — the front end and back end agree on camelCase objects, e.g. a holding: `{ id, ticker, quantity, avgBuyPrice, purchaseDate, ltp, sector, name }`. The database uses snake_case; the API layer converts. *Justified:* a fixed contract means the UI and server can be built and tested separately (§2.1).

**Key validation** (applied on **both** client and server — never trust the browser alone):

| Field | Rule | Reason |
|-------|------|--------|
| ticker | non-empty; must exist in `instruments` | rejects typos / unknown stocks (SC8) |
| quantity | integer > 0 | you cannot own fractional/negative shares |
| avg/sell price | number > 0 | a price must be positive |
| purchase date | valid date, not in the future | cannot have bought in the future |
| sell quantity | 1 … quantity held | cannot sell more than you own |
| SMA windows | short ≥ 2, long ≥ 3, **short < long** | a crossover needs a shorter and a longer average |
| capital | number > 0 | a backtest needs positive starting money |

## 2.4 Algorithms *(full, accurate, justified as a complete solution — top band)*
The following algorithms together form a **complete** solution to the problem: they take stored holdings + market data and produce every required output (value, risk, backtest verdict).

**(a) Weighted-average lot merge** — when the user adds more of a stock they already hold, the average cost must be re-derived so SC2 holds:
```
function mergeLot(old, addQty, price, date):
    newQty   = old.qty + addQty
    newAvg   = (old.qty*old.avg + addQty*price) / newQty   # weighted mean
    newDate  = later(old.date, date)
    return (newQty, newAvg, newDate)
```

**(b) Simple Moving Average** (rolling window) — the core of Module 2:
```
function SMA(prices, window):
    for each day i:
        if i >= window-1:  out[i] = mean(prices[i-window+1 .. i])
        else:              out[i] = None          # not enough history yet
    return out
```

**(c) SMA-crossover backtest** — detect crossovers, simulate trades, build the equity curve (SC4, SC7):
```
shortSMA = SMA(closes, shortWindow)
longSMA  = SMA(closes, longWindow)
cash = capital;  shares = 0;  position = 0
for each day i (where both SMAs exist and the previous day's exist):
    crossedUp   = shortSMA[i-1] <= longSMA[i-1]  AND shortSMA[i] > longSMA[i]
    crossedDown = shortSMA[i-1] >= longSMA[i-1]  AND shortSMA[i] < longSMA[i]
    if crossedUp and position == 0:              # BUY at today's close
        shares = floor(cash / close[i]);  cash -= shares*close[i];  position = 1
        record BUY
    else if crossedDown and position == 1:       # SELL at today's close
        profit = (close[i] - buyPrice) * shares
        cash += shares*close[i];  shares = 0;  position = 0
        record SELL(profit)
    equityCurve[i] = cash + shares*close[i]
# Benchmark: buy on day 1, hold to the end
benchShares = floor(capital / close[0])
benchmark[i] = (capital - benchShares*close[0]) + benchShares*close[i]
beat = finalEquity > finalBenchmark                # SC7 verdict
```
*Why this is a complete solution:* it converts the abstract rule into deterministic trades on **exact crossover days** (SC4), values the strategy each day (the equity curve, SC5), and directly answers the stakeholder's question by comparing to buy-and-hold (SC7).

**(d) Risk metrics** (SC3):
```
dailyReturns[i] = (close[i] - close[i-1]) / close[i-1]
annualisedVolatility = stdev(dailyReturns) * sqrt(252) * 100      # 252 trading days
annualReturn        = mean(dailyReturns)  * 252 * 100
Sharpe              = (annualReturn - riskFreeRate) / annualisedVolatility   # rf = 6.5% (India ~10y G-Sec)
```
For a whole portfolio the daily *value* series is built as `Σ (quantity × close)` across holdings on each common trading day, then the same formulas apply.

**(e) Maximum drawdown** (Module 3, SC6):
```
peak = curve[0];  worst = 0
for value in curve:
    peak = max(peak, value)
    worst = max(worst, (peak - value) / peak)
maxDrawdown = worst * 100
```

## 2.5 Usability / interface design *(describe + justify choices — top band)*
The interface uses a deliberate **"calm ledger"** visual language (deep-teal ink, brass-gold accent, warm-mist background) — justified by the stakeholder's anxiety: the tool should feel steady, not alarming.

- **Numbers are the hero:** a large portfolio value with an animated count-up; a **signature allocation ribbon** reads the whole portfolio as one band. *Justified:* gives the "how am I doing?" answer instantly.
- **Indian conventions:** ₹, NSE symbols, lakh/crore grouping via the `en-IN` locale. *Justified by NFR2 and the stakeholder.*
- **Inline validation** on every form field with clear red messages. *Justified by SC8 and a non-technical user.*
- **Progressive disclosure:** the backtest is a **collapsible panel, closed by default** — power features don't clutter the calm daily view but are one click away. Holding rows expand to a read-only detail grid on demand.
- **Accessibility:** `:focus-visible` outlines, `prefers-reduced-motion` support, ARIA labels, semantic tables. *Justified by NFR1.*
- **Empty states** guide a new user ("Add your first NSE position…"). *Justified:* the tool starts empty.

> 📸 **[SCREENSHOT]** Insert your hand-drawn or digital **wireframes** here (before you built it) and, later, screenshots of the finished screens, captioned to point out each usability feature above.

## 2.6 Test strategy & test data *(identify + justify, iterative AND post-development — top band)*
Testing happens **during** development (iterative) and **after** (post-development). Test data is chosen to include **normal, boundary and erroneous** cases — justified because robustness (SC8) is only proved by deliberately hostile input.

| Test data | Type | Used for | Expected |
|-----------|------|----------|----------|
| RELIANCE, qty 10, ₹2450, 2024-03-12 | Normal | add holding (SC1) | saved & valued |
| qty 1 ; qty 0 ; qty −5 | Boundary/Erroneous | quantity validation (SC8) | 1 ok; 0 & −5 rejected |
| ticker "NOTAREAL" | Erroneous | ticker validation (SC8) | rejected, clear message |
| date = tomorrow | Erroneous | date validation (SC8) | rejected |
| sell qty > held | Erroneous | sell validation (SC8) | rejected |
| SMA 20/50 on RELIANCE, 2023–2025 | Normal | backtest (SC4/5/7) | trades + verdict |
| SMA short ≥ long (e.g. 50/20) | Erroneous | backtest validation | rejected |
| Known small price series (hand-computable) | Normal | verify SMA maths (SC4), risk (SC3) | matches hand calc |

> ✍️ **[YOUR INPUT]** Add a couple of rows with *your* chosen values, and note which iterative stage each belongs to.

---

# 3. Development
*(AO3.2 — 25 marks = 15 iterative development + 10 testing-to-inform-development. Top band: evidence of **each stage**, related to the analysis breakdown, **explained and justified**; **prototype** per stage; well-structured, modular, **annotated** code; all names appropriate; validation for **all** key elements; **review at every stage**; testing at each stage with failed tests + **justified** remedial actions.)*

> **How to evidence this section for full marks.** For *each* stage below: (1) state the sub-problem from §2.1 it implements, (2) show an **annotated code snippet**, (3) show a **screenshot of the working prototype**, (4) show a **test** (including at least one that *failed* and how you fixed it), and (5) a one-line **review** ("this works; next I will…"). The structure is provided — you supply the screenshots and your commentary.

## 3.1 Iterative approach *(justify)*
Development was **iterative and modular**: each sub-problem from §2.1 was built as a small prototype, tested, reviewed, then extended. *Justified:* it de-risks the build (a broken stage is caught immediately) and produces the stage-by-stage evidence the mark scheme rewards.

## 3.2 Stage 1 — Persistence without live data (SC1)
**Sub-problem 1.1.** Built `database.py` (SQLite schema + CRUD) and the `/holdings` routes with dummy prices, then pointed the front end at it. Proves the portfolio **persists** before any API complexity is added.

Annotated example (parameterised SQL prevents injection — a named A-Level concept):
```python
def add_holding(ticker, quantity, avg_buy_price, purchase_date):
    conn = get_connection()
    cur = conn.execute(                                  # '?' placeholders = safe
        "INSERT INTO holdings (ticker, quantity, avg_buy_price, purchase_date) "
        "VALUES (?, ?, ?, ?)", (ticker, quantity, avg_buy_price, purchase_date))
    conn.commit();  new_id = cur.lastrowid;  conn.close()
    return get_holding(new_id)
```
> 📸 **[SCREENSHOT]** Add a holding, close everything, reopen → it's still there (SC1). Show the terminal + the browser.

**Review:** persistence works → next, connect real prices.

## 3.3 Stage 2 — Zerodha integration (FR3, FR6, FR7)
**Sub-problems 1.2, 2.1.** `market_data.py` wraps the `Zerodha` class (automated TOTP login, cached daily token). A **real bug found and fixed here** (evidence for the testing mark):

> **Failed test → remedial action (justified).** The supplied helper mapped symbols using `exchange_token`, but Zerodha's historical API needs `instrument_token`; using the wrong id returned **no candles**. *Remedial action:* I bypassed that helper and stored the correct `instrument_token` from `kite.instruments("NSE")`. *Justified:* it is the field the historical endpoint actually requires; after the fix, historical data returned correctly.

> 📸 **[SCREENSHOT]** `python seed_instruments.py` printing the stored symbol count; a `/quote/RELIANCE` response showing a live price.

**Review:** live prices + historical data work → next, risk maths and the summary endpoint.

## 3.4 Stage 3 — Risk metrics (SC3)
**Sub-problem 1.4.** `analysis.py` implements volatility, Sharpe and drawdown from first principles (formulas kept visible on purpose — see §2.4d). `/portfolio/summary` builds a portfolio value series from historical closes and returns volatility + Sharpe + today's change.

> 📸 **[SCREENSHOT]** The stat strip showing a real volatility % and Sharpe. **[TEST]** recompute both from the same closes in a spreadsheet and show they match to 2 d.p. (SC3).

## 3.5 Stage 4 — Module 1 front end
**Sub-problems 1.3, 1.5, 1.6.** `app.js` renders the hero, allocation ribbon, holdings table, sector donut and return bars, with add/sell/add-lot modals and inline validation. A live data layer loads everything from the back end when `useMock:false`.

> 📸 **[SCREENSHOT]** The finished dashboard; the Add form showing a validation error (SC8).

**Review:** Module 1 complete → next, the backtest engine.

## 3.6 Stage 5 — Module 2 backtest engine + UI (SC4, SC5, SC7)
**Sub-problems 2.2–2.5, 3.1–3.3.** `backtest.py` implements the crossover algorithm (§2.4c) with a **CSV fallback** so it runs even with no live API. `backtest.js` adds a collapsible panel: a parameter form, a **hand-built SVG chart** (strategy vs dashed benchmark, break-even line, buy ▲/sell ▼ markers), stat tiles and a trade log.

Annotated example (the crossover test at the heart of SC4):
```python
crossed_up   = short_sma[i-1] <= long_sma[i-1] and short_sma[i] > long_sma[i]  # BUY signal
crossed_down = short_sma[i-1] >= long_sma[i-1] and short_sma[i] < long_sma[i]  # SELL signal
```
> 📸 **[SCREENSHOT]** A completed backtest: verdict banner, comparison bars, chart, trade log. **[TEST]** trace two rows of the trade log against the SMA values to prove trades fall on the **exact crossover day** (SC4).

**Review:** Modules 2 & 3 complete; strategy-vs-benchmark verdict produced (SC7).

## 3.7 Testing to inform development *(each stage; failed tests + justified fixes — top band)*
Maintain this table as you build (one row per test; **keep the failures — they earn marks**):

| Stage | Test | Input | Expected | Actual | Pass? | Remedial action (justified) |
|-------|------|-------|----------|--------|-------|-----------------------------|
| 1 | Add persists | RELIANCE ×10 | row saved | saved | ✓ | — |
| 2 | Historical fetch | RELIANCE token | candles | *empty* | ✗ | used correct `instrument_token` → fixed |
| 3 | Volatility | known closes | = spreadsheet | matches | ✓ | — |
| 4 | Bad ticker | "NOTAREAL" | rejected | rejected | ✓ | — |
| 5 | short ≥ long | 50/20 | rejected | rejected | ✓ | — |
| … | *(your tests)* | | | | | |

> ✍️ **[YOUR INPUT]** Fill in with your own runs and **screenshots** of at least two failures and their fixes.

---

# 4. Evaluation
*(AO3.3 — 20 marks = 5 post-development testing + 15 evaluation. Top band: **annotated** post-dev testing for **function and robustness** + **usability** testing; cross-reference **each** success criterion as met / partially / not met with evidence; how to address partial/unmet; usability justified; maintenance & limitations; how to develop further; a clear, well-reasoned line of argument.)*

## 4.1 Post-development testing *(function, robustness, usability — annotated)*
Run a final round of tests on the finished system and **annotate each screenshot** (say what it proves).

| # | Category | Test | Evidence |
|---|----------|------|----------|
| T1 | Function | Full add → value → sell → closed flow | 📸 [SCREENSHOT] |
| T2 | Function | Backtest verdict + both returns (SC7) | 📸 [SCREENSHOT] |
| T3 | Robustness | Blank / negative / unknown-ticker / future-date | 📸 [SCREENSHOT] each rejected |
| T4 | Robustness | Backend down → clear "can't reach server" message | 📸 [SCREENSHOT] |
| T5 | Usability | Stakeholder completes "add a holding" unaided | ✍️ [YOUR NOTES + their comment] |

## 4.2 Evaluation against the success criteria *(cross-reference each — top band)*
For each criterion state **met / partially met / not met** with the evidence, then how any gap could be closed.

| SC | Outcome | Evidence | If partial/unmet → how to address |
|----|---------|----------|-----------------------------------|
| SC1 Persistence | ✅ Met | SQLite; survives restart (T1) | — |
| SC2 Value/return to ₹0.01 | ✅ Met *(verify)* | ✍️ hand-calc vs app | — |
| SC3 Volatility/Sharpe to 2 d.p. | ✅ Met *(verify)* | ✍️ spreadsheet vs app | — |
| SC4 Trades on exact crossover days | ✅ Met | trade-log trace (§3.6) | — |
| SC5 Labelled equity-vs-benchmark chart | ✅ Met | 📸 chart with legend/axes | — |
| SC6 Correct trade stats | ✅ Met | recompute from log | — |
| SC7 States if it beat buy-and-hold + both %s | ✅ Met | verdict banner | — |
| SC8 Invalid input rejected clearly | ✅ Met | T3 | — |

> ✍️ **[YOUR INPUT]** Replace "(verify)" once you've done the SC2/SC3 hand-checks; if any criterion is only partially met, say honestly why and how you'd fix it — **admitting a partial** and explaining the fix scores better than over-claiming.

## 4.3 Usability evaluation *(justify success/partial/failure)*
Assess each usability feature from §2.5 (calm palette, Indian formatting, inline validation, collapsible backtest, accessibility, empty states): did it work for the stakeholder, and why?
> ✍️ **[YOUR INPUT + stakeholder quote]** e.g. "Krish said the single value 'was the first thing I looked at' — the numbers-as-hero choice succeeded."

## 4.4 Limitations & maintenance issues
- **Symbol list is noisy:** the NSE equity filter also captured bonds/ETFs (~10,000 rows vs ~1,800 real equities) — a maintenance refinement would tighten the filter.
- **Sectors are a lookup table** (Kite provides no sector field) — unknown stocks show "Other"; maintenance = extend the table or add a sector data source.
- **Daily access-token login** must run once a day (Zerodha security) — documented, not a fault.
- **No dividends/brokerage/tax** in returns (justified in §1.6) — a maintainer could add a brokerage model.
- **Single strategy / single user** (justified scope).

## 4.5 Future development *(how to address limitations — top band)*
1. Add more strategies (RSI, EMA, MACD) behind the same clean interface.
2. Model brokerage & slippage for more realistic backtests.
3. Add a proper sector/industry data source for accurate diversification analysis.
4. Cache historical candles in the database so repeat backtests are instant and API-light.
5. Optional multi-portfolio / watchlist support.

## 4.6 Stakeholder feedback & conclusion
> ✍️ **[YOUR INPUT]** Record the stakeholder's final verdict against their original needs (consolidated view? risk number that calms anxiety? evidence on systematic vs holding?). Conclude with a clear, honest judgement of how well the finished system solved the problem set out in §1, and what you learned.

---

# 5. Appendices
- **A. Full source code** — `frontend/` and `backend/` (annotated). *(Attach or reference the repository.)*
- **B. Setup & run guide** — see `backend/RUN.md`.
- **C. Technical design overview** — see `backend/BACKEND_OVERVIEW.md`.
- **D. Original NEA proposal** — `NEA Proposal - Portfolio Tracker (1).pdf`.

> **Reminder:** rewrite in your own words, insert every screenshot and stakeholder quote, keep your *failed* tests visible, and justify every choice. That is what moves each section into the top band.
