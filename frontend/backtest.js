/* =============================================================================
   Portfolio Tracker · Module 2 (Strategy Backtesting)
   Self-contained. Collapsed by default — opens on click. Talks to the backend
   POST /api/backtest and draws the equity-curve-vs-buy-and-hold report.
   Needs the backend running (the SMA maths lives on the server).
   ========================================================================== */
(function () {
  "use strict";

  const CFG = window.APP_CONFIG;
  if (!CFG) return;

  const LOCALE = CFG.market.locale, SYM = CFG.market.symbol;
  const MINUS = "−";

  /* palette (mirrors styles.css) */
  const C_GAIN = "#2F7D5B", C_LOSS = "#B4553F", C_GOLD = "#B8873B", C_MUTED = "#8A938E";

  /* formatters */
  const nf0 = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 });
  const nf2 = new Intl.NumberFormat(LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const money0 = (n) => SYM + nf0.format(Math.round(n));
  const money2 = (n) => SYM + nf2.format(n);
  const signedPct = (n) => (n < 0 ? MINUS : "+") + Math.abs(n).toFixed(2) + "%";
  const $ = (s) => document.querySelector(s);

  const fmtShort = (iso) => {
    const d = new Date(iso + "T00:00:00");
    return isNaN(d) ? iso : d.toLocaleDateString(LOCALE, { month: "short", year: "2-digit" });
  };
  const fmtFull = (iso) => {
    const d = new Date(iso + "T00:00:00");
    return isNaN(d) ? iso : d.toLocaleDateString(LOCALE, { day: "2-digit", month: "short", year: "numeric" });
  };
  function durationLabel(from, to) {
    const a = new Date(from + "T00:00:00"), b = new Date(to + "T00:00:00");
    if (isNaN(a) || isNaN(b)) return "";
    let months = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
    if (months < 1) return "under a month";
    const y = Math.floor(months / 12), m = months % 12;
    return [y ? y + "y" : "", m ? m + "m" : ""].filter(Boolean).join(" ");
  }

  let tickersLoaded = false;

  /* ---------------------------------------------------------------- init --- */
  function init() {
    const to = new Date(), from = new Date();
    from.setFullYear(from.getFullYear() - 2);
    $("#btTo").value = to.toISOString().slice(0, 10);
    $("#btFrom").value = from.toISOString().slice(0, 10);
    $("#btTicker").value = "RELIANCE";

    $("#btToggle").addEventListener("click", toggle);
    $("#btForm").addEventListener("submit", onSubmit);
    $("#btPresets").addEventListener("click", onPreset);
  }

  /* --------------------------------------------------------- open / close -- */
  function toggle() {
    const body = $("#btBody"), btn = $("#btToggle");
    const willOpen = body.hidden;
    body.hidden = !willOpen;
    btn.setAttribute("aria-expanded", String(willOpen));
    $("#btToggleHint").textContent = willOpen ? "Close" : "Open";
    if (willOpen && !tickersLoaded) {
      tickersLoaded = true;
      populateTickers();
      if (CFG.useMock) {
        showNote("Backtesting needs the live backend. Start it (python app.py) and set useMock:false in config.js.", false);
      }
    }
  }

  function onPreset(e) {
    const b = e.target.closest("[data-preset]");
    if (!b) return;
    const [s, l] = b.dataset.preset.split(",");
    $("#btShort").value = s;
    $("#btLong").value = l;
  }

  /* Suggestions for the datalist. The backend validates the full list; these
     are just quick-pick large-caps, replaced by the real list when live. */
  async function populateTickers() {
    let list = ["RELIANCE","TCS","INFY","HDFCBANK","ICICIBANK","SBIN","BHARTIARTL","ITC","LT",
                "SUNPHARMA","TATAMOTORS","MARUTI","AXISBANK","KOTAKBANK","HINDUNILVR","BAJFINANCE",
                "WIPRO","HCLTECH","TITAN","NTPC","ASIANPAINT","ULTRACEMCO","POWERGRID","ONGC",
                "COALINDIA","TATASTEEL","JSWSTEEL"];
    if (!CFG.useMock) {
      try {
        const res = await fetch(CFG.baseUrl + CFG.endpoints.tickers);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length) list = data.map((t) => t.ticker);
        }
      } catch (_) { /* keep the fallback list */ }
    }
    $("#btTickerList").innerHTML = list.slice(0, 4000).map((t) => `<option value="${t}">`).join("");
  }

  /* ------------------------------------------------------------ validate --- */
  function validate() {
    const errs = {};
    const ticker = $("#btTicker").value.trim().toUpperCase();
    const short = parseInt($("#btShort").value, 10);
    const long = parseInt($("#btLong").value, 10);
    const capital = Number($("#btCapital").value);
    const from = $("#btFrom").value, to = $("#btTo").value;

    if (!ticker) errs.ticker = "Enter a stock symbol.";
    else if (from && to && from > to) errs.ticker = "‘From’ date is after ‘To’.";
    if (!Number.isInteger(short) || short < 2) errs.short = "Min 2 days.";
    if (!Number.isInteger(long) || long < 3) errs.long = "Min 3 days.";
    if (Number.isInteger(short) && Number.isInteger(long) && short >= long) errs.long = "Must exceed short.";
    if (!Number.isFinite(capital) || capital <= 0) errs.capital = "Must be > 0.";

    const payload = { ticker, shortWindow: short, longWindow: long, capital };
    if (from) payload.from = from;
    if (to) payload.to = to;
    return { errs, payload };
  }

  function paintErrors(errs) {
    document.querySelectorAll("#btForm .err").forEach((n) => (n.textContent = ""));
    document.querySelectorAll("#btForm input").forEach((n) => n.classList.remove("invalid"));
    const map = { ticker: "#btTicker", short: "#btShort", long: "#btLong", capital: "#btCapital" };
    for (const k in errs) {
      const e = document.querySelector(`#btForm [data-err="${k}"]`);
      if (e) e.textContent = errs[k];
      const inp = map[k] && $(map[k]);
      if (inp) inp.classList.add("invalid");
    }
  }

  /* -------------------------------------------------------------- submit --- */
  async function onSubmit(e) {
    e.preventDefault();
    const { errs, payload } = validate();
    paintErrors(errs);
    if (Object.keys(errs).length) return;

    setLoading(true);
    hideNote();
    try {
      const res = await fetch(CFG.baseUrl + CFG.endpoints.backtest, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || ("Request failed (" + res.status + ")"));
      renderResults(data, payload.ticker);
    } catch (err) {
      $("#btResults").hidden = true;
      $("#btEmpty").hidden = false;
      showNote(
        /Failed to fetch|NetworkError/i.test(err.message)
          ? "Could not reach the backend. Is it running? (python app.py)"
          : err.message,
        true
      );
    } finally {
      setLoading(false);
    }
  }

  function setLoading(on) {
    const b = $("#btRun");
    b.disabled = on;
    b.textContent = on ? "Running…" : "Run backtest";
  }

  /* ------------------------------------------------------------- results --- */
  function renderResults(data, ticker) {
    const s = data.summary, st = data.stats, p = data.params;
    const win = s.beatBuyAndHold;

    // params recap chips
    $("#btRecap").innerHTML = [
      `<span class="bt-recap__chip"><b>${ticker}</b></span>`,
      `<span class="bt-recap__chip">SMA <b>${p.shortWindow}</b> / <b>${p.longWindow}</b></span>`,
      `<span class="bt-recap__chip">${fmtFull(p.from)} → ${fmtFull(p.to)}</span>`,
      `<span class="bt-recap__chip">Start <b>${money0(p.capital)}</b></span>`,
      `<span class="bt-recap__chip">Data · <b>${data.source === "csv" ? "CSV" : "Zerodha"}</b></span>`
    ].join("");

    // verdict banner
    const v = $("#btVerdict");
    v.className = "bt-verdict " + (win ? "win" : "lose");
    const ic = win
      ? '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>'
      : '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>';
    v.innerHTML = `<span class="bt-verdict__ic">${ic}</span>
      <span class="bt-verdict__txt">
        <b>${win ? "The SMA strategy beat buy-and-hold" : "The SMA strategy trailed buy-and-hold"}</b>
        <span>${signedPct(s.strategyReturnPct)} vs ${signedPct(s.benchmarkReturnPct)} · over ${durationLabel(p.from, p.to)}</span>
      </span>`;

    // head-to-head comparison bars (scaled by final value)
    const maxFinal = Math.max(s.strategyFinalValue, s.benchmarkFinalValue) || 1;
    const cmpBar = (name, col, ret, final) => {
      const w = Math.max(5, (final / maxFinal) * 100);
      return `<div class="bt-cmp">
        <div class="bt-cmp__top">
          <span class="bt-cmp__name"><span class="bt-cmp__dot" style="background:${col}"></span>${name}</span>
          <span class="bt-cmp__ret ${ret < 0 ? "down" : "up"}">${signedPct(ret)}</span>
        </div>
        <div class="bt-cmp__track"><div class="bt-cmp__fill" style="width:${w.toFixed(1)}%;background:${col}"></div></div>
        <div class="bt-cmp__foot">Ends at ${money0(final)} from ${money0(p.capital)}</div>
      </div>`;
    };
    $("#btCompare").innerHTML =
      cmpBar("SMA strategy", C_GOLD, s.strategyReturnPct, s.strategyFinalValue) +
      cmpBar("Buy &amp; hold", C_MUTED, s.benchmarkReturnPct, s.benchmarkFinalValue);

    // stat tiles
    const tiles = [
      { label: "Trades", value: String(st.tradeCount), sub: "completed round-trips" },
      { label: "Win rate", value: st.winRate.toFixed(0) + "%", sub: "of closed trades" },
      { label: "Avg profit / trade", value: (st.avgProfit < 0 ? MINUS : "+") + money0(Math.abs(st.avgProfit)), tone: st.avgProfit < 0 ? "down" : "up", sub: "per round-trip" },
      { label: "Max drawdown", value: st.maxDrawdownPct.toFixed(1) + "%", tone: "down", sub: "largest peak-to-trough dip" }
    ];
    $("#btStats").innerHTML = tiles.map((t) => `
      <div class="bt-stat">
        <div class="bt-stat__label">${t.label}</div>
        <div class="bt-stat__value ${t.tone || ""}">${t.value}</div>
        <div class="bt-stat__sub">${t.sub}</div>
      </div>`).join("");

    drawChart(data.equityCurve, data.benchmarkCurve, data.trades, p.capital);
    renderTrades(data.trades, st.tradeCount);

    $("#btEmpty").hidden = true;
    $("#btResults").hidden = false;
  }

  /* ---- equity curve vs benchmark, hand-built SVG (matches the app style) --- */
  function drawChart(strat, bench, trades, capital) {
    const W = 820, H = 330, padL = 68, padR = 18, padT = 16, padB = 36;
    const n = strat.length;
    const sv = strat.map((p) => p.value), bv = bench.map((p) => p.value);
    const dates = strat.map((p) => p.date);

    let min = Math.min(...sv, ...bv, capital), max = Math.max(...sv, ...bv, capital);
    const span = (max - min) || 1;
    min -= span * 0.06; max += span * 0.06;

    const X = (i) => padL + (n <= 1 ? 0 : (i / (n - 1)) * (W - padL - padR));
    const Y = (val) => padT + (1 - (val - min) / (max - min)) * (H - padT - padB);
    const bottom = H - padB;
    const line = (vals) => "M" + vals.map((val, i) => `${X(i).toFixed(1)},${Y(val).toFixed(1)}`).join(" L");
    const area = (vals) => line(vals) + ` L${X(n - 1).toFixed(1)},${bottom} L${X(0).toFixed(1)},${bottom} Z`;

    // horizontal gridlines + y labels
    const steps = 4, grid = [], ylabels = [];
    for (let g = 0; g <= steps; g++) {
      const val = min + (max - min) * (g / steps), y = Y(val);
      grid.push(`<line x1="${padL}" y1="${y.toFixed(1)}" x2="${W - padR}" y2="${y.toFixed(1)}" stroke="var(--line)" stroke-width="1"/>`);
      ylabels.push(`<text x="${padL - 10}" y="${(y + 3).toFixed(1)}" text-anchor="end" class="bt-axis">${money0(val)}</text>`);
    }

    // break-even line at starting capital
    const yCap = Y(capital);
    const breakeven = `<line x1="${padL}" y1="${yCap.toFixed(1)}" x2="${W - padR}" y2="${yCap.toFixed(1)}" stroke="${C_MUTED}" stroke-width="1" stroke-dasharray="2 3" opacity=".7"/>
      <text x="${W - padR}" y="${(yCap - 5).toFixed(1)}" text-anchor="end" class="bt-note-txt">start ${money0(capital)}</text>`;

    // x date labels (4 across)
    const idxs = n > 1 ? [0, Math.round((n - 1) / 3), Math.round((2 * (n - 1)) / 3), n - 1] : [0];
    const anchors = ["start", "middle", "middle", "end"];
    const xlabels = idxs.map((i, k) => `<text x="${X(i).toFixed(1)}" y="${H - 12}" text-anchor="${anchors[k] || "middle"}" class="bt-axis">${fmtShort(dates[i])}</text>`).join("");

    // trade markers on the strategy line
    const idxOf = {};
    dates.forEach((d, i) => { if (!(d in idxOf)) idxOf[d] = i; });
    const markers = trades.map((t) => {
      const i = idxOf[t.date];
      if (i == null) return "";
      const x = X(i), y = Y(sv[i]), up = t.action === "BUY", col = up ? C_GAIN : C_LOSS;
      const pts = up
        ? `${x},${(y - 11).toFixed(1)} ${(x - 5).toFixed(1)},${(y - 2).toFixed(1)} ${(x + 5).toFixed(1)},${(y - 2).toFixed(1)}`
        : `${x},${(y + 11).toFixed(1)} ${(x - 5).toFixed(1)},${(y + 2).toFixed(1)} ${(x + 5).toFixed(1)},${(y + 2).toFixed(1)}`;
      return `<polygon points="${pts}" fill="${col}"><title>${t.action} ${money2(t.price)} · ${fmtFull(t.date)}</title></polygon>`;
    }).join("");

    // end-point dot on the strategy line
    const endDot = n > 1
      ? `<circle cx="${X(n - 1).toFixed(1)}" cy="${Y(sv[n - 1]).toFixed(1)}" r="3.4" fill="${C_GOLD}" stroke="var(--surface)" stroke-width="1.5"/>`
      : "";

    $("#btChart").innerHTML = `
      <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Strategy equity curve versus buy and hold">
        <defs>
          <linearGradient id="btFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="${C_GOLD}" stop-opacity=".16"/>
            <stop offset="1" stop-color="${C_GOLD}" stop-opacity="0"/>
          </linearGradient>
        </defs>
        ${grid.join("")}
        ${breakeven}
        <path d="${area(sv)}" fill="url(#btFill)"/>
        <path d="${line(bv)}" fill="none" stroke="${C_MUTED}" stroke-width="1.6" stroke-dasharray="4 4" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
        <path d="${line(sv)}" fill="none" stroke="${C_GOLD}" stroke-width="2.2" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
        ${markers}
        ${endDot}
        ${ylabels.join("")}
        ${xlabels}
      </svg>`;

    $("#btLegend").innerHTML = `
      <span class="bt-lg"><span class="bt-lg__ln" style="background:${C_GOLD}"></span>SMA strategy</span>
      <span class="bt-lg"><span class="bt-lg__ln" style="height:0;border-top:2px dashed ${C_MUTED}"></span>Buy &amp; hold</span>
      <span class="bt-lg"><svg width="12" height="12" viewBox="0 0 12 12"><polygon points="6,1 11,10 1,10" fill="${C_GAIN}"/></svg>Buy</span>
      <span class="bt-lg"><svg width="12" height="12" viewBox="0 0 12 12"><polygon points="6,11 1,2 11,2" fill="${C_LOSS}"/></svg>Sell</span>`;
  }

  function renderTrades(trades, tradeCount) {
    $("#btTradesCount").textContent = trades.length
      ? `${trades.length} orders · ${tradeCount} completed round-trips`
      : "";
    const body = $("#btTradesBody");
    if (!trades.length) {
      body.innerHTML = `<tr><td class="cell-stock" colspan="5" style="text-align:center; color:var(--muted); padding:22px">No SMA crossovers in this period — the strategy never traded. Try a wider date range or shorter SMA windows.</td></tr>`;
      return;
    }
    body.innerHTML = trades.map((t) => {
      const isSell = t.action === "SELL";
      let profit = "—";
      if (isSell && typeof t.profit === "number") {
        const cls = t.profit < 0 ? "down" : "up";
        profit = `<span class="pl ${cls}">${t.profit < 0 ? MINUS : "+"}${money0(Math.abs(t.profit))}</span>`;
      }
      return `<tr>
        <td class="cell-stock">${fmtFull(t.date)}</td>
        <td><span class="pill ${isSell ? "down" : "up"}">${t.action}</span></td>
        <td class="tnum">${money2(t.price)}</td>
        <td class="tnum">${t.shares}</td>
        <td class="tnum">${profit}</td>
      </tr>`;
    }).join("");
  }

  /* --------------------------------------------------------------- notes --- */
  function showNote(msg, isError) {
    const n = $("#btNote");
    n.textContent = msg;
    n.className = "bt-note" + (isError ? " is-error" : "");
    n.hidden = false;
  }
  function hideNote() { $("#btNote").hidden = true; }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
