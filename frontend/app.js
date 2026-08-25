/* =============================================================================
   Portfolio Tracker · Module 1 (Portfolio Tracking)
   Plain HTML + CSS + vanilla JS. All data is MOCK for now; every read/write is
   marked so the Flask + SQLite backend (see config.js) can be wired in place.
   ========================================================================== */
(function () {
  "use strict";

  const CFG = window.APP_CONFIG;
  const LOCALE = CFG.market.locale;      // en-IN → lakh/crore grouping
  const SYM = CFG.market.symbol;         // ₹
  const MINUS = "−";                // proper minus glyph

  /* ---- series colours (mirror the CSS jewel palette) ---- */
  const SERIES = ["#0E3A34","#2F7D5B","#B8873B","#7C6BA0","#3E6E8E",
                  "#B4553F","#5C8A72","#9A7B4F","#4A6C6F","#8E5D6B"];
  const C_GAIN = "#2F7D5B", C_LOSS = "#B4553F";

  /* =========================================================================
     MOCK DATA — real NSE large-caps. Replace with:
       GET  CFG.endpoints.holdings          → state.holdings
       GET  CFG.endpoints.closedPositions   → state.closed
       GET  CFG.endpoints.portfolioSummary  → state.summary (volatility, sharpe)
       GET  CFG.endpoints.tickers           → NSE_UNIVERSE
     ========================================================================= */
  let NSE_UNIVERSE = {
    RELIANCE:{ name:"Reliance Industries", sector:"Energy",   ltp:2872.40 },
    TCS:     { name:"Tata Consultancy",    sector:"IT",       ltp:3910.25 },
    INFY:    { name:"Infosys",             sector:"IT",       ltp:1585.60 },
    HDFCBANK:{ name:"HDFC Bank",           sector:"Banking",  ltp:1678.90 },
    ICICIBANK:{name:"ICICI Bank",          sector:"Banking",  ltp:1244.30 },
    BHARTIARTL:{name:"Bharti Airtel",      sector:"Telecom",  ltp:1489.75 },
    ITC:     { name:"ITC",                 sector:"FMCG",     ltp:462.15  },
    LT:      { name:"Larsen & Toubro",     sector:"Infra",    ltp:3585.00 },
    SUNPHARMA:{name:"Sun Pharma",          sector:"Pharma",   ltp:1712.80 },
    TATAMOTORS:{name:"Tata Motors",        sector:"Auto",     ltp:685.40  },
    HINDUNILVR:{name:"Hindustan Unilever", sector:"FMCG",     ltp:2418.00 },
    SBIN:    { name:"State Bank of India", sector:"Banking",  ltp:842.60  },
    BAJFINANCE:{name:"Bajaj Finance",      sector:"Banking",  ltp:7120.00 },
    MARUTI:  { name:"Maruti Suzuki",       sector:"Auto",     ltp:12480.0 },
    ASIANPAINT:{name:"Asian Paints",       sector:"FMCG",     ltp:2890.00 },
    WIPRO:   { name:"Wipro",               sector:"IT",       ltp:452.30  },
    TITAN:   { name:"Titan Company",       sector:"Consumer", ltp:3640.00 },
    NTPC:    { name:"NTPC",                sector:"Energy",   ltp:378.50  }
  };

  const state = {
    // ---- MOCK: GET CFG.endpoints.holdings ----
    holdings: [
      { id:1,  ticker:"RELIANCE",   quantity:120, avgBuyPrice:2450.00, purchaseDate:"2024-03-12" },
      { id:2,  ticker:"TCS",        quantity:60,  avgBuyPrice:3550.00, purchaseDate:"2024-05-20" },
      { id:3,  ticker:"INFY",       quantity:150, avgBuyPrice:1420.00, purchaseDate:"2024-02-15" },
      { id:4,  ticker:"HDFCBANK",   quantity:200, avgBuyPrice:1510.00, purchaseDate:"2023-11-08" },
      { id:5,  ticker:"ICICIBANK",  quantity:180, avgBuyPrice:980.00,  purchaseDate:"2024-01-22" },
      { id:6,  ticker:"BHARTIARTL", quantity:140, avgBuyPrice:1120.00, purchaseDate:"2024-06-01" },
      { id:7,  ticker:"ITC",        quantity:300, avgBuyPrice:415.00,  purchaseDate:"2024-04-08" },
      { id:8,  ticker:"LT",         quantity:40,  avgBuyPrice:3200.00, purchaseDate:"2024-07-11" },
      { id:9,  ticker:"SUNPHARMA",  quantity:90,  avgBuyPrice:1350.00, purchaseDate:"2024-08-19" },
      { id:10, ticker:"TATAMOTORS", quantity:160, avgBuyPrice:720.00,  purchaseDate:"2024-09-05" }
    ],
    // ---- MOCK: GET CFG.endpoints.closedPositions ----
    closed: [
      { id:51, ticker:"WIPRO",      quantity:100, avgBuyPrice:385.00,  sellPrice:452.00,   closeDate:"2025-02-14" },
      { id:52, ticker:"MARUTI",     quantity:10,  avgBuyPrice:9800.00, sellPrice:11250.00, closeDate:"2024-12-03" },
      { id:53, ticker:"ASIANPAINT", quantity:30,  avgBuyPrice:3200.00, sellPrice:2890.00,  closeDate:"2025-01-27" }
    ],
    // ---- MOCK: GET CFG.endpoints.portfolioSummary (display-only until backend computes) ----
    summary: { annualisedVolatility:16.8, sharpeRatio:1.42, dayChange:24830, dayChangePct:1.18 },
    // 30-session portfolio value trend for the hero sparkline (mock)
    trend: [1842,1836,1851,1863,1858,1871,1889,1877,1894,1902,1888,1915,1931,1922,1948,
            1959,1944,1972,1988,1979,2004,2021,2013,2038,2052,2041,2069,2088,2079,2131].map(v=>v*1000),
    ui: { modal:{ open:false, mode:"add", id:null, old:null, errors:{} },
          sell:{ open:false, id:null, ticker:"", maxQty:0, avgBuyPrice:0, errors:{} },
          expanded:new Set() }
  };

  let _id = 100;
  const nextId = () => ++_id;

  /* ---- quote lookup (mocks GET CFG.endpoints.quote) ---- */
  const quote = (tk) => (NSE_UNIVERSE[tk] ? NSE_UNIVERSE[tk].ltp : 0);
  const sectorOf = (tk) => (NSE_UNIVERSE[tk] ? NSE_UNIVERSE[tk].sector : "Other");
  const nameOf = (tk) => (NSE_UNIVERSE[tk] ? NSE_UNIVERSE[tk].name : tk);

  /* =========================================================================
     BACKEND API  (used only when CFG.useMock === false)
     Talks to the Flask server described in config.js. Every method returns a
     Promise. On any failure the UI shows a clear message instead of breaking.
     ========================================================================= */
  const API = {
    ep: CFG.endpoints,
    async _fetch(path, opts) {
      const res = await fetch(CFG.baseUrl + path,
        Object.assign({ headers: { "Content-Type": "application/json" } }, opts));
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || ("Request failed (" + res.status + ")"));
      return body;
    },
    getHoldings()        { return this._fetch(this.ep.holdings); },
    getClosed()          { return this._fetch(this.ep.closedPositions); },
    getSummary()         { return this._fetch(this.ep.portfolioSummary); },
    getTickers()         { return this._fetch(this.ep.tickers); },
    addHolding(p)        { return this._fetch(this.ep.holdings, { method:"POST", body:JSON.stringify(p) }); },
    updateHolding(id, p) { return this._fetch(this.ep.holdingById.replace(":id", id), { method:"PUT", body:JSON.stringify(p) }); },
    deleteHolding(id)    { return this._fetch(this.ep.holdingById.replace(":id", id), { method:"DELETE" }); },
    sellHolding(id, p)   { return this._fetch(this.ep.sellHolding.replace(":id", id), { method:"POST", body:JSON.stringify(p) }); }
  };

  /* Load everything from the backend into `state` + `NSE_UNIVERSE`, then render.
     In mock mode the data is already in `state`, so we just render. */
  async function loadData() {
    if (CFG.useMock) { render(); return; }
    try {
      const [tickers, holdings, closed, summary] = await Promise.all([
        API.getTickers(), API.getHoldings(), API.getClosed(), API.getSummary()
      ]);
      // Rebuild the stock universe (name + sector) from the backend, then layer
      // the live traded prices from the holdings on top.
      NSE_UNIVERSE = {};
      tickers.forEach((t) => { NSE_UNIVERSE[t.ticker] = { name:t.name, sector:t.sector, ltp:0 }; });
      holdings.forEach((h) => { NSE_UNIVERSE[h.ticker] = { name:h.name || h.ticker, sector:h.sector || "Other", ltp:h.ltp }; });

      state.holdings = holdings.map((h) => ({
        id:h.id, ticker:h.ticker, quantity:h.quantity, avgBuyPrice:h.avgBuyPrice, purchaseDate:h.purchaseDate
      }));
      state.closed = closed.map((c) => ({
        id:c.id, ticker:c.ticker, quantity:c.quantity, avgBuyPrice:c.avgBuyPrice, sellPrice:c.sellPrice, closeDate:c.closeDate
      }));
      state.summary = {
        annualisedVolatility: summary.annualisedVolatility,
        sharpeRatio: summary.sharpeRatio,
        dayChange: summary.dayChange,
        dayChangePct: summary.dayChangePct
      };
      fillTickerOptions();
      render();
    } catch (e) {
      console.error(e);
      alert("Could not reach the backend server.\n\n" + e.message +
            "\n\nIs it running?  (python app.py)\nOr set useMock:true in config.js to use demo data.");
    }
  }

  /* =========================== formatters =========================== */
  const nf2 = new Intl.NumberFormat(LOCALE, { minimumFractionDigits:2, maximumFractionDigits:2 });
  const nf0 = new Intl.NumberFormat(LOCALE, { maximumFractionDigits:0 });
  const money  = (n) => SYM + nf2.format(n);
  const money0 = (n) => SYM + nf0.format(Math.round(n));
  const signedMoney = (n) => (n < 0 ? MINUS : "+") + SYM + nf2.format(Math.abs(n));
  const signedMoney0 = (n) => (n < 0 ? MINUS : "+") + SYM + nf0.format(Math.round(Math.abs(n)));
  const signedPct = (n) => (n < 0 ? MINUS : "+") + Math.abs(n).toFixed(2) + "%";
  const dir = (n) => (n < 0 ? "down" : "up");
  const fmtDate = (iso) => {
    const d = new Date(iso + "T00:00:00");
    if (isNaN(d)) return iso;
    return d.toLocaleDateString(LOCALE, { day:"2-digit", month:"short", year:"numeric" });
  };

  /* =========================== computed =========================== */
  function computed() {
    let mv = 0, inv = 0;
    const rows = state.holdings.map((h) => {
      const ltp = quote(h.ticker);
      const invested = h.quantity * h.avgBuyPrice;
      const marketValue = h.quantity * ltp;
      const pnl = marketValue - invested;
      const pct = invested ? (pnl / invested) * 100 : 0;
      mv += marketValue; inv += invested;
      return { ...h, ltp, sector:sectorOf(h.ticker), invested, marketValue, pnl, pct };
    }).sort((a, b) => b.marketValue - a.marketValue);

    const booked = state.closed.reduce((s, c) => s + (c.sellPrice - c.avgBuyPrice) * c.quantity, 0);

    // sector aggregation
    const secMap = {};
    rows.forEach((r) => { secMap[r.sector] = (secMap[r.sector] || 0) + r.marketValue; });
    const sectors = Object.entries(secMap)
      .map(([sector, value]) => ({ sector, value, pct: mv ? (value / mv) * 100 : 0 }))
      .sort((a, b) => b.value - a.value);

    return {
      rows, sectors,
      totalMarketValue: mv, totalInvested: inv,
      totalPnl: mv - inv, totalPnlPct: inv ? ((mv - inv) / inv) * 100 : 0,
      totalBooked: booked
    };
  }

  /* =========================== small DOM helper =========================== */
  const el = (tag, cls, html) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  };
  const $ = (sel) => document.querySelector(sel);

  /* =========================== market ticker (mock indices) =========================== */
  function renderMarket() {
    const indices = [
      { name:"NIFTY 50",  val:24218.60, chg:0.74 },
      { name:"SENSEX",    val:79486.30, chg:0.61 },
      { name:"BANKNIFTY", val:52140.15, chg:-0.22 }
    ];
    $("#marketTicker").innerHTML = indices.map((i) => {
      const d = dir(i.chg);
      return `<div class="mi">
        <span class="mi__name">${i.name}</span>
        <span class="mi__val tnum">${nf2.format(i.val)}<small class="${d}" style="color:${i.chg<0?C_LOSS:C_GAIN}">${signedPct(i.chg)}</small></span>
      </div>`;
    }).join("");
    $("#heroMarket").textContent = CFG.market.exchange + " · " + CFG.market.currency;
    $("#footMock").textContent = CFG.useMock ? "Mock data · backend not connected" : "Live";
  }

  /* =========================== hero =========================== */
  let _heroAnimated = false;
  function renderHero(c) {
    const s = state.summary;
    const day = $("#heroDay");
    day.className = "chip chip--" + dir(s.dayChange);
    const arrow = s.dayChange < 0
      ? '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 7l10 10M17 7v10H7"/></svg>'
      : '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7M7 7h10v10"/></svg>';
    day.innerHTML = arrow + signedMoney0(s.dayChange) + " · " + signedPct(s.dayChangePct) + " today";

    $("#heroTotal").innerHTML =
      `Invested <b>${money0(c.totalInvested)}</b> · Overall <b class="${dir(c.totalPnl)}" style="color:${c.totalPnl<0?C_LOSS:C_GAIN}">${signedMoney0(c.totalPnl)} (${signedPct(c.totalPnlPct)})</b>`;

    animateValue($("#heroValue"), c.totalMarketValue);
    renderSpark();
  }

  function animateValue(node, target) {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || _heroAnimated) { node.textContent = nf0.format(Math.round(target)); _heroAnimated = true; return; }
    _heroAnimated = true;
    const dur = 1100, t0 = performance.now();
    const step = (t) => {
      const p = Math.min(1, (t - t0) / dur);
      const e = 1 - Math.pow(1 - p, 3); // easeOutCubic
      node.textContent = nf0.format(Math.round(target * e));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function renderSpark() {
    const data = state.trend, w = 320, h = 82, pad = 4;
    const min = Math.min(...data), max = Math.max(...data), span = max - min || 1;
    const x = (i) => pad + (i / (data.length - 1)) * (w - pad * 2);
    const y = (v) => pad + (1 - (v - min) / span) * (h - pad * 2);
    const pts = data.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`);
    const line = "M" + pts.join(" L");
    const area = line + ` L${x(data.length-1).toFixed(1)},${h} L${x(0).toFixed(1)},${h} Z`;
    const lastUp = data[data.length-1] >= data[0];
    const col = lastUp ? C_GAIN : C_LOSS;
    $("#spark").innerHTML = `
      <svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
        <defs>
          <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="${col}" stop-opacity=".18"/>
            <stop offset="1" stop-color="${col}" stop-opacity="0"/>
          </linearGradient>
        </defs>
        <path d="${area}" fill="url(#sparkFill)"/>
        <path d="${line}" fill="none" stroke="${col}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
        <circle cx="${x(data.length-1).toFixed(1)}" cy="${y(data[data.length-1]).toFixed(1)}" r="3" fill="${col}"/>
      </svg>`;
  }

  /* =========================== stat strip =========================== */
  function renderStrip(c) {
    const s = state.summary;
    const stats = [
      { label:"Invested",      value:money0(c.totalInvested), sub:"Cost basis" },
      { label:"Unrealised P&L", value:signedMoney0(c.totalPnl), sub:signedPct(c.totalPnlPct)+" overall", tone:dir(c.totalPnl), toneSub:true },
      { label:"Booked P&L",    value:signedMoney0(c.totalBooked), sub:state.closed.length+" closed", tone:dir(c.totalBooked) },
      { label:"Volatility",    value:s.annualisedVolatility.toFixed(1)+"%", sub:"Annualised" },
      { label:"Sharpe ratio",  value:s.sharpeRatio.toFixed(2), sub:"Risk-adjusted" }
    ];
    $("#statStrip").innerHTML = stats.map((st) => `
      <div class="stat">
        <div class="stat__label">${st.label}</div>
        <div class="stat__value ${st.tone||""}">${st.value}</div>
        <div class="stat__sub ${st.toneSub ? (st.tone||"") : ""}">${st.sub}</div>
      </div>`).join("");
  }

  /* =========================== allocation ribbon (signature) =========================== */
  function renderRibbon(c) {
    const total = c.totalMarketValue || 1;
    $("#ribbonTotal").innerHTML = "Total <b>" + money0(total) + "</b>";
    $("#ribbon").innerHTML = c.rows.map((r, i) => {
      const pct = (r.marketValue / total) * 100;
      const col = SERIES[i % SERIES.length];
      return `<div class="ribbon__seg" style="flex:0 0 ${pct}%; background:${col}">
        <span class="tip"><b>${r.ticker}</b> · ${money0(r.marketValue)} · ${pct.toFixed(1)}%</span>
      </div>`;
    }).join("");
    $("#ribbonLegend").innerHTML = c.rows.map((r, i) => {
      const pct = (r.marketValue / total) * 100;
      return `<div class="rl">
        <span class="rl__dot" style="background:${SERIES[i % SERIES.length]}"></span>
        <span class="rl__t">${r.ticker}</span>
        <span class="rl__p tnum">${pct.toFixed(1)}%</span>
      </div>`;
    }).join("");
  }

  /* =========================== holdings table =========================== */
  function renderHoldings(c) {
    const body = $("#holdingsBody");
    const empty = $("#holdingsEmpty");
    const table = $("#holdingsTable");
    $("#holdCount").textContent = c.rows.length
      ? c.rows.length + (c.rows.length === 1 ? " position" : " positions") + " · NSE"
      : "No open positions";

    if (!c.rows.length) { table.style.display = "none"; empty.hidden = false; return; }
    table.style.display = ""; empty.hidden = true;

    body.innerHTML = c.rows.map((r, i) => {
      const col = SERIES[i % SERIES.length];
      const d = dir(r.pnl);
      const open = state.ui.expanded.has(r.id);
      const mainRow = `<tr>
        <td class="cell-stock">
          <div class="stock">
            <button class="chev ${open ? "is-open" : ""}" data-expand="${r.id}" aria-expanded="${open}" aria-label="Details for ${r.ticker}">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg>
            </button>
            <span class="stock__tk" style="background:${col}"></span>
            <span class="stock__meta">
              <span class="stock__sym">${r.ticker}</span>
              <span class="stock__sec">${r.sector} · ${fmtDate(r.purchaseDate)}</span>
            </span>
          </div>
        </td>
        <td class="tnum">${r.quantity}</td>
        <td class="tnum muted-cell">${money(r.avgBuyPrice)}</td>
        <td class="tnum">${money(r.ltp)}</td>
        <td class="tnum muted-cell">${money0(r.invested)}</td>
        <td class="tnum" style="font-weight:500">${money0(r.marketValue)}</td>
        <td class="tnum pl ${d}">${signedMoney0(r.pnl)}</td>
        <td><span class="pill ${d} tnum">${signedPct(r.pct)}</span></td>
        <td class="cell-actions">
          <span class="row-actions">
            <button class="icon-btn" data-addlot="${r.id}" title="Add to ${r.ticker}" aria-label="Add to ${r.ticker}">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>
            </button>
            <button class="icon-btn is-sell" data-sell="${r.id}" title="Sell ${r.ticker}" aria-label="Sell ${r.ticker}">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7M7 7h10v10"/></svg>
            </button>
            <button class="icon-btn is-del" data-del="${r.id}" title="Remove ${r.ticker}" aria-label="Remove ${r.ticker}">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg>
            </button>
          </span>
        </td>
      </tr>`;

      if (!open) return mainRow;

      const detail = `<tr class="detail-row"><td colspan="9">
        <div class="detail">
          <div class="detail__item"><span class="detail__k">Stock</span><span class="detail__v">${r.ticker} — ${nameOf(r.ticker)}</span></div>
          <div class="detail__item"><span class="detail__k">Sector</span><span class="detail__v">${r.sector}</span></div>
          <div class="detail__item"><span class="detail__k">Last purchase</span><span class="detail__v">${fmtDate(r.purchaseDate)}</span></div>
          <div class="detail__item"><span class="detail__k">Quantity</span><span class="detail__v">${r.quantity} shares</span></div>
          <div class="detail__item"><span class="detail__k">Avg cost</span><span class="detail__v">${money(r.avgBuyPrice)}</span></div>
          <div class="detail__item"><span class="detail__k">Invested</span><span class="detail__v">${money(r.invested)}</span></div>
          <div class="detail__item"><span class="detail__k">Last traded price</span><span class="detail__v">${money(r.ltp)}</span></div>
          <div class="detail__item"><span class="detail__k">Market value</span><span class="detail__v">${money(r.marketValue)}</span></div>
          <div class="detail__item"><span class="detail__k">Unrealised P&amp;L</span><span class="detail__v ${d}">${signedMoney(r.pnl)}</span></div>
          <div class="detail__item"><span class="detail__k">Return</span><span class="detail__v ${d}">${signedPct(r.pct)}</span></div>
        </div>
      </td></tr>`;
      return mainRow + detail;
    }).join("");
  }

  /* =========================== sector donut =========================== */
  function renderDonut(c) {
    const total = c.totalMarketValue || 1;
    const R = 62, CX = 75, CY = 75, SW = 22, CIRC = 2 * Math.PI * R;
    let offset = 0;
    const segs = c.sectors.map((s, i) => {
      const frac = s.value / total;
      const len = frac * CIRC;
      const seg = `<circle cx="${CX}" cy="${CY}" r="${R}" fill="none"
        stroke="${SERIES[i % SERIES.length]}" stroke-width="${SW}"
        stroke-dasharray="${len.toFixed(2)} ${(CIRC - len).toFixed(2)}"
        stroke-dashoffset="${(-offset).toFixed(2)}" stroke-linecap="butt"/>`;
      offset += len;
      return seg;
    }).join("");

    $("#donut").innerHTML = `
      <svg viewBox="0 0 150 150">
        <circle cx="${CX}" cy="${CY}" r="${R}" fill="none" stroke="var(--mist-2)" stroke-width="${SW}"/>
        ${segs}
      </svg>
      <div class="donut__center">
        <b>${c.sectors.length}</b><span>sectors</span>
      </div>`;

    $("#donutLegend").innerHTML = c.sectors.map((s, i) => `
      <li>
        <span class="dl__dot" style="background:${SERIES[i % SERIES.length]}"></span>
        <span class="dl__name">${s.sector}</span>
        <span class="dl__pct">${s.pct.toFixed(1)}%</span>
      </li>`).join("");
  }

  /* =========================== return-by-holding diverging bars =========================== */
  function renderReturns(c) {
    const maxAbs = Math.max(1, ...c.rows.map((r) => Math.abs(r.pct)));
    $("#returns").innerHTML = c.rows.map((r) => {
      const half = (Math.abs(r.pct) / maxAbs) * 50; // % of track from centre
      const up = r.pct >= 0;
      const fill = up
        ? `left:50%; width:${half}%; background:${C_GAIN}`
        : `right:50%; width:${half}%; background:${C_LOSS}`;
      return `<div class="ret">
        <span class="ret__sym">${r.ticker}</span>
        <span class="ret__track"><span class="ret__mid"></span><span class="ret__fill" style="${fill}"></span></span>
        <span class="ret__val ${dir(r.pct)}">${signedPct(r.pct)}</span>
      </div>`;
    }).join("");
  }

  /* =========================== closed positions =========================== */
  function renderClosed(c) {
    const body = $("#closedBody");
    const empty = $("#closedEmpty");
    const table = $("#closedTable");
    if (!state.closed.length) { table.style.display = "none"; empty.hidden = false; $("#closedTotal").textContent = ""; return; }
    table.style.display = ""; empty.hidden = true;

    body.innerHTML = state.closed.map((x) => {
      const pnl = (x.sellPrice - x.avgBuyPrice) * x.quantity;
      const d = dir(pnl);
      return `<tr>
        <td class="cell-stock">
          <div class="stock">
            <span class="stock__meta">
              <span class="stock__sym">${x.ticker}</span>
              <span class="stock__sec">${nameOf(x.ticker)}</span>
            </span>
          </div>
        </td>
        <td class="tnum">${x.quantity}</td>
        <td class="tnum muted-cell">${money(x.avgBuyPrice)}</td>
        <td class="tnum">${money(x.sellPrice)}</td>
        <td class="tnum pl ${d}">${signedMoney0(pnl)}</td>
        <td class="tnum muted-cell" style="text-align:right">${fmtDate(x.closeDate)}</td>
      </tr>`;
    }).join("") + `<tr class="closed-foot">
        <td class="cell-stock" colspan="4" style="text-align:right; font-family:var(--mono); font-size:10px; letter-spacing:.08em; text-transform:uppercase; color:var(--muted)">Total booked</td>
        <td class="tnum" style="color:${c.totalBooked<0?C_LOSS:C_GAIN}">${signedMoney0(c.totalBooked)}</td>
        <td></td>
      </tr>`;
    $("#closedTotal").innerHTML = "Realised <b style='color:" + (c.totalBooked<0?C_LOSS:C_GAIN) + "'>" + signedMoney0(c.totalBooked) + "</b>";
  }

  /* =========================== master render =========================== */
  function render() {
    const c = computed();
    renderHero(c);
    renderStrip(c);
    renderRibbon(c);
    renderHoldings(c);
    renderDonut(c);
    renderReturns(c);
    renderClosed(c);
  }

  /* =========================================================================
     ADD / EDIT MODAL
     ========================================================================= */
  const today = () => new Date().toISOString().slice(0, 10);

  // Autocomplete for the Add form: nothing is listed until the user types; then we
  // show only the symbols that START WITH what they typed (max 10), not the whole
  // universe. `_tickerSorted` is a cached, sorted key list rebuilt when data reloads.
  let _tickerSorted = null;
  function tickerList() {
    if (!_tickerSorted) _tickerSorted = Object.keys(NSE_UNIVERSE).sort();
    return _tickerSorted;
  }
  function fillTickerOptions() {
    _tickerSorted = null;                 // invalidate cache (NSE_UNIVERSE may have changed)
    const dl = $("#fTickerList");
    if (dl) dl.innerHTML = "";            // start empty — no giant list on open
  }
  function updateTickerSuggestions() {
    const dl = $("#fTickerList");
    if (!dl) return;
    const q = $("#fTicker").value.trim().toUpperCase();
    if (!q) { dl.innerHTML = ""; return; }
    const matches = [];
    for (const tk of tickerList()) {
      if (tk.startsWith(q)) { matches.push(tk); if (matches.length >= 10) break; }
    }
    dl.innerHTML = matches.map((tk) => `<option value="${tk}">${NSE_UNIVERSE[tk].name}</option>`).join("");
  }

  function toggleExpand(id) {
    const set = state.ui.expanded;
    if (set.has(id)) set.delete(id); else set.add(id);
    render();
  }

  function openAdd() {
    state.ui.modal = { open:true, mode:"add", id:null, old:null, errors:{} };
    $("#formTitle").textContent = "Add holding";
    $("#formSub").textContent = "Record a new NSE position in your portfolio.";
    $("#formSubmit").textContent = "Add holding";
    $("#lblQty").textContent = "Quantity";
    $("#lblAvg").textContent = "Avg cost (₹)";
    $("#lblDate").textContent = "Purchase date";
    $("#formPreview").hidden = true;
    $("#fTicker").value = ""; $("#fTicker").disabled = false;
    $("#fQty").value = ""; $("#fAvg").value = ""; $("#fDate").value = today();
    clearErrors($("#holdingForm"));
    showModal("#formModal", "#fTicker");
  }

  // "Edit" now means: add another lot to an existing position. Quantity, price and
  // date are for the NEW purchase; the app re-derives average cost, total quantity
  // and the latest date on submit.
  function openAddLot(id) {
    const h = state.holdings.find((x) => x.id === id);
    if (!h) return;
    state.ui.modal = { open:true, mode:"addlot", id, old:{ quantity:h.quantity, avgBuyPrice:h.avgBuyPrice, purchaseDate:h.purchaseDate }, errors:{} };
    $("#formTitle").textContent = "Add to " + h.ticker;
    $("#formSub").textContent = `You hold ${h.quantity} at avg ${money(h.avgBuyPrice)}. Enter the new lot — the average updates automatically.`;
    $("#formSubmit").textContent = "Add to position";
    $("#lblQty").textContent = "Quantity to add";
    $("#lblAvg").textContent = "Buy price (₹)";
    $("#lblDate").textContent = "Purchase date";
    $("#fTicker").value = h.ticker; $("#fTicker").disabled = true; // ticker fixed
    $("#fQty").value = ""; $("#fAvg").value = ""; $("#fDate").value = today();
    clearErrors($("#holdingForm"));
    updateFormPreview();
    showModal("#formModal", "#fQty");
  }

  // Live preview of the resulting position while adding a lot.
  function updateFormPreview() {
    const m = state.ui.modal, node = $("#formPreview");
    if (!m || m.mode !== "addlot" || !m.old) { node.hidden = true; return; }
    const addQty = Number($("#fQty").value), price = Number($("#fAvg").value), date = $("#fDate").value;
    const valid = Number.isInteger(addQty) && addQty > 0 && Number.isFinite(price) && price > 0;
    if (!valid) {
      node.hidden = false;
      node.innerHTML = "Enter a quantity and price to see the new average.";
      return;
    }
    const merged = mergeLot(m.old, addQty, price, date);
    node.hidden = false;
    node.innerHTML = `New position — <b>${merged.quantity}</b> shares at avg <b>${money(merged.avgBuyPrice)}</b> · dated <b>${fmtDate(merged.purchaseDate)}</b>`;
  }

  // Weighted-average merge of an existing position with a new lot.
  function mergeLot(old, addQty, price, date) {
    const quantity = old.quantity + addQty;
    const avgBuyPrice = (old.quantity * old.avgBuyPrice + addQty * price) / quantity;
    const latest = (date && new Date(date) > new Date(old.purchaseDate)) ? date : old.purchaseDate;
    return { quantity, avgBuyPrice, purchaseDate: latest };
  }

  function validateHolding() {
    const errs = {};
    const tk = $("#fTicker").value.trim().toUpperCase();
    const qtyRaw = $("#fQty").value, avgRaw = $("#fAvg").value, date = $("#fDate").value;
    if (!tk) errs.ticker = "Choose a stock.";
    else if (!NSE_UNIVERSE[tk]) errs.ticker = "Pick a valid NSE symbol from the list.";
    const qty = Number(qtyRaw);
    if (qtyRaw === "" || !Number.isInteger(qty) || qty <= 0) errs.quantity = "Whole number greater than 0.";
    const avg = Number(avgRaw);
    if (avgRaw === "" || isNaN(avg) || avg <= 0) errs.avgBuyPrice = "Price must be greater than 0.";
    if (!date || isNaN(new Date(date).getTime())) errs.purchaseDate = "Enter a valid date.";
    else if (new Date(date) > new Date()) errs.purchaseDate = "Date can't be in the future.";
    return errs;
  }

  async function submitHolding(e) {
    e.preventDefault();
    const errs = validateHolding();
    paintErrors($("#holdingForm"), errs, { ticker:"#fTicker", quantity:"#fQty", avgBuyPrice:"#fAvg", purchaseDate:"#fDate" });
    if (Object.keys(errs).length) return;

    const tk = $("#fTicker").value.trim().toUpperCase(), qty = parseInt($("#fQty").value, 10), avg = Number($("#fAvg").value), date = $("#fDate").value;
    const m = state.ui.modal;

    // ---- LIVE: talk to the backend, then reload from it ----
    if (!CFG.useMock) {
      try {
        if (m.mode === "add") {
          await API.addHolding({ ticker:tk, quantity:qty, avgBuyPrice:avg, purchaseDate:date });
        } else {
          const h = state.holdings.find((x) => x.id === m.id);
          const merged = mergeLot({ quantity:h.quantity, avgBuyPrice:h.avgBuyPrice, purchaseDate:h.purchaseDate }, qty, avg, date);
          await API.updateHolding(m.id, { quantity:merged.quantity, avgBuyPrice:merged.avgBuyPrice, purchaseDate:merged.purchaseDate });
        }
        hideModal("#formModal");
        await loadData();
      } catch (err) { alert(err.message); }
      return;
    }

    // ---- MOCK path ----
    if (m.mode === "add") {
      state.holdings.push({ id:nextId(), ticker:tk, quantity:qty, avgBuyPrice:avg, purchaseDate:date });
    } else {
      // Add a lot: re-derive avg cost, total quantity and latest date.
      const h = state.holdings.find((x) => x.id === m.id);
      if (h) {
        const merged = mergeLot({ quantity:h.quantity, avgBuyPrice:h.avgBuyPrice, purchaseDate:h.purchaseDate }, qty, avg, date);
        h.quantity = merged.quantity; h.avgBuyPrice = merged.avgBuyPrice; h.purchaseDate = merged.purchaseDate;
      }
    }
    hideModal("#formModal");
    render();
  }

  async function deleteHolding(id) {
    const h = state.holdings.find((x) => x.id === id);
    if (!h) return;
    if (!window.confirm(`Remove ${h.ticker} from your portfolio? This corrects an entry — it does not book a sale.`)) return;

    if (!CFG.useMock) {
      try { await API.deleteHolding(id); await loadData(); }
      catch (err) { alert(err.message); }
      return;
    }
    // ---- MOCK ----
    state.holdings = state.holdings.filter((x) => x.id !== id);
    render();
  }

  /* =========================================================================
     SELL MODAL
     ========================================================================= */
  function openSell(id) {
    const h = state.holdings.find((x) => x.id === id);
    if (!h) return;
    state.ui.sell = { open:true, id, ticker:h.ticker, maxQty:h.quantity, avgBuyPrice:h.avgBuyPrice, errors:{} };
    $("#sellTitle").textContent = "Sell " + h.ticker;
    $("#sellSub").innerHTML = `You hold <b>${h.quantity}</b> at avg ${money(h.avgBuyPrice)}. Booking moves them to closed positions.`;
    $("#sQty").value = h.quantity; $("#sQty").max = h.quantity;
    $("#sPrice").value = quote(h.ticker).toFixed(2);
    clearErrors($("#sellForm"));
    updateSellPreview();
    showModal("#sellModal", "#sQty");
  }

  function updateSellPreview() {
    const s = state.ui.sell;
    const qty = Number($("#sQty").value), price = Number($("#sPrice").value);
    const node = $("#sellPreview");
    const valid = Number.isFinite(qty) && Number.isFinite(price) && qty > 0 && price > 0;
    if (!valid) { node.textContent = "—"; node.className = "tnum"; return; }
    const pnl = (price - s.avgBuyPrice) * qty;
    node.textContent = signedMoney(pnl);
    node.className = "tnum " + dir(pnl);
  }

  function validateSell() {
    const s = state.ui.sell, errs = {};
    const qtyRaw = $("#sQty").value, priceRaw = $("#sPrice").value;
    const qty = Number(qtyRaw);
    if (qtyRaw === "" || !Number.isInteger(qty) || qty <= 0) errs.sQty = "Whole number greater than 0.";
    else if (qty > s.maxQty) errs.sQty = "You only hold " + s.maxQty + ".";
    const price = Number(priceRaw);
    if (priceRaw === "" || isNaN(price) || price <= 0) errs.sPrice = "Price must be greater than 0.";
    return errs;
  }

  async function submitSell(e) {
    e.preventDefault();
    const errs = validateSell();
    paintErrors($("#sellForm"), errs, { sQty:"#sQty", sPrice:"#sPrice" });
    if (Object.keys(errs).length) return;

    const s = state.ui.sell, qty = parseInt($("#sQty").value, 10), price = Number($("#sPrice").value);

    if (!CFG.useMock) {
      try { await API.sellHolding(s.id, { quantity:qty, sellPrice:price }); hideModal("#sellModal"); await loadData(); }
      catch (err) { alert(err.message); }
      return;
    }
    // ---- MOCK ----
    const h = state.holdings.find((x) => x.id === s.id);
    if (h) {
      h.quantity -= qty;
      state.closed.unshift({ id:nextId(), ticker:s.ticker, quantity:qty, avgBuyPrice:s.avgBuyPrice, sellPrice:price, closeDate:today() });
      if (h.quantity <= 0) state.holdings = state.holdings.filter((x) => x.id !== s.id);
    }
    hideModal("#sellModal");
    render();
  }

  /* =========================== error helpers =========================== */
  function clearErrors(form) {
    form.querySelectorAll(".err").forEach((n) => (n.textContent = ""));
    form.querySelectorAll("input,select").forEach((n) => n.classList.remove("invalid"));
  }
  function paintErrors(form, errs, map) {
    clearErrors(form);
    for (const key in errs) {
      const msg = errs[key];
      const errNode = form.querySelector(`[data-err="${key}"]`);
      if (errNode) errNode.textContent = msg;
      if (map[key]) { const inp = $(map[key]); if (inp) inp.classList.add("invalid"); }
    }
  }

  /* =========================== modal open/close plumbing =========================== */
  let _lastFocus = null;
  function showModal(sel, focusSel) {
    _lastFocus = document.activeElement;
    $(sel).hidden = false;
    document.body.style.overflow = "hidden";
    const f = focusSel && $(focusSel);
    if (f) setTimeout(() => f.focus(), 40);
  }
  function hideModal(sel) {
    $(sel).hidden = true;
    document.body.style.overflow = "";
    if (state.ui.modal) state.ui.modal.open = false;
    if (state.ui.sell) state.ui.sell.open = false;
    if (_lastFocus && _lastFocus.focus) _lastFocus.focus();
  }

  /* =========================== wire up =========================== */
  function init() {
    fillTickerOptions();
    renderMarket();

    $("#addBtn").addEventListener("click", openAdd);
    $("#addBtnEmpty").addEventListener("click", openAdd);

    // event delegation for row actions
    $("#holdingsBody").addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      if (b.dataset.expand) toggleExpand(Number(b.dataset.expand));
      else if (b.dataset.addlot) openAddLot(Number(b.dataset.addlot));
      else if (b.dataset.sell) openSell(Number(b.dataset.sell));
      else if (b.dataset.del) deleteHolding(Number(b.dataset.del));
    });

    // form modal
    $("#holdingForm").addEventListener("submit", submitHolding);
    $("#fTicker").addEventListener("input", updateTickerSuggestions);
    ["#fQty", "#fAvg", "#fDate"].forEach((s) => $(s).addEventListener("input", updateFormPreview));
    document.querySelectorAll("[data-close]").forEach((n) => n.addEventListener("click", () => hideModal("#formModal")));
    // sell modal
    $("#sellForm").addEventListener("submit", submitSell);
    document.querySelectorAll("[data-close-sell]").forEach((n) => n.addEventListener("click", () => hideModal("#sellModal")));
    $("#sQty").addEventListener("input", updateSellPreview);
    $("#sPrice").addEventListener("input", updateSellPreview);

    // esc to close
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      if (!$("#formModal").hidden) hideModal("#formModal");
      if (!$("#sellModal").hidden) hideModal("#sellModal");
    });

    // Load data (mock: already in `state`; live: fetched from the backend) and render.
    loadData();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
