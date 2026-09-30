/* =============================================================================
   Portfolio Tracker · Accounts & login  (Module 1, sub-problem 1.7 / FR12)
   -----------------------------------------------------------------------------
   Owns the full-screen sign-in / create-account screen, the user chip + menu
   in the top bar, and the change-password modal.

   The backend hands out a signed bearer token on login. We keep it in
   localStorage and expose AUTH.headers() so app.js / backtest.js attach it to
   every request. When the token is missing or rejected (401) the screen comes
   back. In mock mode (config.js useMock:true) there is no backend, so the
   screen is skipped entirely.

   Everything app.js needs to know is one custom event:
       document.dispatchEvent(new CustomEvent("auth:signedin"))
   ========================================================================== */
(() => {
  "use strict";
  const CFG = window.APP_CONFIG;
  const $ = (s) => document.querySelector(s);
  const KEY = "pt.token", UKEY = "pt.user";
  const REDUCE = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ------------------------------ token store ------------------------------ */
  const AUTH = {
    token()    { try { return localStorage.getItem(KEY) || ""; } catch (_) { return ""; } },
    user()     { try { return JSON.parse(localStorage.getItem(UKEY) || "null"); } catch (_) { return null; } },
    signedIn() { return CFG.useMock || !!this.token(); },
    headers()  { const t = this.token(); return t ? { Authorization: "Bearer " + t } : {}; },
    save(token, user) { try { localStorage.setItem(KEY, token); localStorage.setItem(UKEY, JSON.stringify(user)); } catch (_) {} },
    clear()    { try { localStorage.removeItem(KEY); localStorage.removeItem(UKEY); } catch (_) {} },
    signOut()  { this.clear(); location.reload(); },
    /* Called by app.js when any request comes back 401. */
    expired()  { this.clear(); lock(); showScreen("login", "Your session has expired — please sign in again."); }
  };
  window.AUTH = AUTH;

  async function post(path, body, withToken) {
    const headers = Object.assign({ "Content-Type": "application/json" }, withToken ? AUTH.headers() : {});
    const res = await fetch(CFG.baseUrl + path, { method: "POST", headers, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || ("Request failed (" + res.status + ")"));
    return data;
  }

  /* ------------------------------ page lock ------------------------------- */
  function lock()   { document.body.classList.add("is-locked"); }
  function unlock() { document.body.classList.remove("is-locked"); document.body.classList.add("is-unlocking");
                      setTimeout(() => document.body.classList.remove("is-unlocking"), 900); }

  /* ------------------------------ the screen ------------------------------ */
  let mode = "login";
  const screen = () => $("#authScreen");

  function showScreen(m, notice) {
    setMode(m || "login");
    const s = screen();
    s.classList.remove("is-leaving");
    s.hidden = false;
    lock();
    setError(notice || "", !!notice);
    setTimeout(() => $("#aUser").focus(), 120);
  }

  function setMode(m) {
    mode = m;
    const isReg = m === "register";
    document.querySelectorAll(".auth__tab").forEach((t) => {
      const on = t.dataset.mode === m;
      t.classList.toggle("is-active", on);
      t.setAttribute("aria-selected", on ? "true" : "false");
    });
    $("#authScreen").dataset.mode = m;                     // moves the tab ink
    $("#authTitle").textContent = isReg ? "Create your account" : "Welcome back";
    $("#authSub").textContent = isReg
      ? "One username, one password — your portfolio stays on this machine."
      : "Sign in to see your portfolio.";
    $("#aConfirmWrap").hidden = !isReg;
    $("#aMeter").hidden = !isReg;
    $("#aPass").setAttribute("autocomplete", isReg ? "new-password" : "current-password");
    $(".auth__submit-label").textContent = isReg ? "Create account" : "Sign in";
    clearErrors();
  }

  function setError(msg, shake) {
    const e = $("#authError");
    e.textContent = msg;
    e.hidden = !msg;
    if (msg && shake && !REDUCE) {
      $(".auth__card").classList.remove("is-shaking");
      void $(".auth__card").offsetWidth;                    // restart the animation
      $(".auth__card").classList.add("is-shaking");
    }
  }
  function clearErrors() {
    setError("");
    document.querySelectorAll("#authForm .err").forEach((n) => (n.textContent = ""));
    document.querySelectorAll("#authForm input").forEach((n) => n.classList.remove("invalid"));
  }
  function fieldError(key, msg) {
    const n = document.querySelector(`#authForm [data-err="${key}"]`);
    if (n) n.textContent = msg;
    const map = { username: "#aUser", password: "#aPass", confirm: "#aConfirm" };
    if (map[key]) $(map[key]).classList.add("invalid");
  }

  /* Client-side rules mirror the server (write-up §2.4): the server is the authority. */
  function validate(username, password, confirm) {
    let ok = true;
    if (!/^[A-Za-z0-9_]{3,30}$/.test(username)) { fieldError("username", "3–30 letters, digits or underscores."); ok = false; }
    if (password.length < 8) { fieldError("password", "At least 8 characters."); ok = false; }
    if (mode === "register" && confirm !== password) { fieldError("confirm", "Passwords don't match."); ok = false; }
    return ok;
  }

  /* Password strength: length + variety. Purely a hint; the server only enforces length. */
  function strength(p) {
    let s = 0;
    if (p.length >= 8) s++;
    if (p.length >= 12) s++;
    if (/[A-Z]/.test(p) && /[a-z]/.test(p)) s++;
    if (/\d/.test(p)) s++;
    if (/[^A-Za-z0-9]/.test(p)) s++;
    return Math.min(4, s);                                   // 0..4
  }
  function paintMeter(meterSel, p) {
    const m = $(meterSel), s = p ? strength(p) : 0;
    m.dataset.level = String(s);
    m.querySelector("span").style.width = (s / 4 * 100) + "%";
    m.querySelector("b").textContent = ["", "Weak", "Fair", "Good", "Strong"][s] || "";
  }

  function busy(btn, on) {
    btn.classList.toggle("is-loading", on);
    btn.disabled = on;
  }

  async function submit(e) {
    e.preventDefault();
    clearErrors();
    const username = $("#aUser").value.trim();
    const password = $("#aPass").value;
    const confirm = $("#aConfirm").value;
    if (!validate(username, password, confirm)) { setError("Please fix the highlighted fields.", true); return; }
    const btn = $("#authSubmit");
    busy(btn, true);
    try {
      const data = await post(mode === "register" ? "/auth/register" : "/auth/login", { username, password });
      AUTH.save(data.token, data.user);
      btn.classList.add("is-done");
      await new Promise((r) => setTimeout(r, REDUCE ? 0 : 650));   // let the tick land
      enter(data.user);
    } catch (err) {
      busy(btn, false);
      const msg = /fetch|network|failed to/i.test(err.message) && !/Wrong|taken|must/i.test(err.message)
        ? "Can't reach the server — is the backend running?  (start.bat)"
        : err.message;
      setError(msg, true);
    }
  }

  /* Leave the screen with a small zoom-out, then reveal the dashboard. */
  function enter(user) {
    paintChip(user);
    const s = screen();
    if (REDUCE) { s.hidden = true; unlock(); }
    else {
      s.classList.add("is-leaving");
      setTimeout(() => { s.hidden = true; s.classList.remove("is-leaving"); unlock(); }, 560);
    }
    $("#aPass").value = ""; $("#aConfirm").value = "";
    $("#authSubmit").classList.remove("is-done", "is-loading"); $("#authSubmit").disabled = false;
    document.dispatchEvent(new CustomEvent("auth:signedin", { detail: user }));
  }

  /* ------------------------------ user chip ------------------------------- */
  function paintChip(user) {
    const wrap = $("#userMenu");
    if (!user) { wrap.hidden = true; return; }
    $("#userName").textContent = user.username;
    $("#userAvatar").textContent = user.username.slice(0, 1).toUpperCase();
    wrap.hidden = false;
  }
  function toggleMenu(open) {
    const dd = $("#userDropdown"), chip = $("#userChip");
    const willOpen = open === undefined ? dd.hidden : open;
    dd.hidden = !willOpen;
    chip.setAttribute("aria-expanded", willOpen ? "true" : "false");
  }

  /* --------------------------- change password ---------------------------- */
  function openPw() {
    toggleMenu(false);
    ["#pCurrent", "#pNew", "#pConfirm"].forEach((s) => { $(s).value = ""; $(s).classList.remove("invalid"); });
    document.querySelectorAll("#pwForm .err").forEach((n) => (n.textContent = ""));
    $("#pwDone").hidden = true; $("#pwForm").hidden = false;
    paintMeter("#pMeter", "");
    $("#pwModal").hidden = false;
    document.body.style.overflow = "hidden";
    setTimeout(() => $("#pCurrent").focus(), 40);
  }
  function closePw() { $("#pwModal").hidden = true; document.body.style.overflow = ""; }

  async function submitPw(e) {
    e.preventDefault();
    const cur = $("#pCurrent").value, nw = $("#pNew").value, cf = $("#pConfirm").value;
    document.querySelectorAll("#pwForm .err").forEach((n) => (n.textContent = ""));
    let ok = true;
    const err = (sel, key, msg) => { $(sel).classList.add("invalid"); document.querySelector(`#pwForm [data-err="${key}"]`).textContent = msg; ok = false; };
    if (!cur) err("#pCurrent", "current", "Enter your current password.");
    if (nw.length < 8) err("#pNew", "new", "At least 8 characters.");
    else if (nw === cur) err("#pNew", "new", "Must be different from the current password.");
    if (cf !== nw) err("#pConfirm", "confirm", "Passwords don't match.");
    if (!ok) return;
    const btn = $("#pwSubmit");
    busy(btn, true);
    try {
      await post("/auth/change-password", { currentPassword: cur, newPassword: nw }, true);
      $("#pwForm").hidden = true; $("#pwDone").hidden = false;
      setTimeout(closePw, REDUCE ? 400 : 1400);
    } catch (e2) {
      err("#pCurrent", "current", e2.message);
    } finally { busy(btn, false); }
  }

  /* --------------------------------- init --------------------------------- */
  async function init() {
    // tabs
    document.querySelectorAll(".auth__tab").forEach((t) => t.addEventListener("click", () => { setMode(t.dataset.mode); $("#aUser").focus(); }));
    $("#authForm").addEventListener("submit", submit);
    $("#aPass").addEventListener("input", () => paintMeter("#aMeter", mode === "register" ? $("#aPass").value : ""));
    $("#aEye").addEventListener("click", () => {
      const p = $("#aPass"), show = p.type === "password";
      p.type = show ? "text" : "password";
      $("#aEye").classList.toggle("is-on", show);
      $("#aEye").setAttribute("aria-label", show ? "Hide password" : "Show password");
    });
    // chip + menu
    $("#userChip").addEventListener("click", () => toggleMenu());
    document.addEventListener("click", (e) => { if (!e.target.closest("#userMenu")) toggleMenu(false); });
    $("#pwBtn").addEventListener("click", openPw);
    $("#signOutBtn").addEventListener("click", () => AUTH.signOut());
    // change-password modal
    $("#pwForm").addEventListener("submit", submitPw);
    $("#pNew").addEventListener("input", () => paintMeter("#pMeter", $("#pNew").value));
    document.querySelectorAll("[data-close-pw]").forEach((n) => n.addEventListener("click", closePw));
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !$("#pwModal").hidden) closePw();
      if (e.key === "Escape") toggleMenu(false);
    });

    // Decide what to show. Mock mode: no accounts, straight to the dashboard.
    if (CFG.useMock) {
      paintChip(null);
      setTimeout(() => document.dispatchEvent(new CustomEvent("auth:signedin")), 0);
      return;
    }
    lock();
    const token = AUTH.token();
    if (!token) { showScreen("login"); return; }
    // We have a token: check it is still good before showing anything.
    try {
      const res = await fetch(CFG.baseUrl + "/auth/me", { headers: AUTH.headers() });
      if (!res.ok) throw new Error("expired");
      const user = await res.json();
      AUTH.save(token, user);
      paintChip(user);
      screen().hidden = true;
      unlock();
      document.dispatchEvent(new CustomEvent("auth:signedin", { detail: user }));
    } catch (_) {
      AUTH.clear();
      showScreen("login");
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
