// Page chrome shared by every web tool: the settings dialog (gear) and the
// footer status strip that always shows what this page is talking to.

import { getConfig, setConfig, CONFIG_EVENT, DEFAULTS } from "./config.js";
import { probeConnection } from './connection.js';
import { mountSetup } from './setup.js';
import { sameOriginApi, refreshBrowserSession, browserSignIn, browserSignOut } from './browser-session.js';
import { icon } from "./icons.js";

const POLL_MS = 10000;

function settingsDialog() {
  const dlg = document.createElement("dialog");
  dlg.className = "settings-dialog";
  dlg.setAttribute("aria-labelledby", "settings-title");
  dlg.innerHTML = `
    <form method="dialog" novalidate>
      <header>
        <h2 id="settings-title">Connect to Echo</h2>
        <button class="btn btn-icon btn-ghost" value="cancel" formnovalidate aria-label="Close settings">${icon("close")}</button>
      </header>
      <section class="browser-login" id="browser-login">
        <p class="hint">Sign in to access lessons and cooking sessions.</p>
        <label class="field" for="browser-login-code">Demo login code<input class="input" id="browser-login-code" name="accessCode" type="password" autocomplete="current-password" maxlength="128"></label>
        <div class="browser-login-actions"><button class="btn btn-light" type="button" id="browser-sign-in">Sign in</button><button class="btn" type="button" id="browser-sign-out" hidden>Sign out</button></div>
        <p class="hint" id="browser-login-message" role="status"></p>
      </section>
      <details class="advanced-connection" id="advanced-connection"><summary>Advanced connection settings</summary>
      <div class="field">
        <label for="set-base">API base URL</label>
        <input class="input" id="set-base" name="apiBase" type="url" inputmode="url" autocomplete="off" spellcheck="false" placeholder="http://localhost:8000">
        <span class="hint">Leave empty for the default: this page's origin under /app/, otherwise http://localhost:8000.</span>
      </div>
      <div class="field">
        <label for="set-key">Demo key</label>
        <input class="input" id="set-key" name="demoKey" type="password" autocomplete="off" spellcheck="false">
        <span class="hint">Use the same private demo key as Echo on iPhone (Railway variable: DEMO_API_KEY), not your Gemini API key. Stored in this browser only.</span>
      </div>
      <div class="settings-row">
        <div class="field">
          <label for="set-threshold">Watch threshold</label>
          <input class="input" id="set-threshold" name="watchThreshold" type="number" min="0" max="1" step="0.05" placeholder="${DEFAULTS.watchThreshold}">
        </div>
        <div class="field">
          <label for="set-interval">Watch interval (ms)</label>
          <input class="input" id="set-interval" name="watchIntervalMs" type="number" min="500" max="30000" step="100" placeholder="${DEFAULTS.watchIntervalMs}">
        </div>
      </div>
      </details>
      <div class="settings-actions">
        <button class="btn btn-ghost" value="cancel" formnovalidate>Cancel</button>
        <button class="btn btn-primary" value="save">Save settings</button>
      </div>
    </form>`;
  document.body.append(dlg);

  const f = dlg.querySelector("form");
  const field = name => f.elements.namedItem(name);
  const loginMessage = dlg.querySelector('#browser-login-message');
  let loginBusy = false, opening = 0;
  function loginState(state) {
    dlg.querySelector('#browser-sign-out').hidden = !state.authenticated;
    field('accessCode').disabled = Boolean(state.authenticated);
    dlg.querySelector('#browser-sign-in').hidden = Boolean(state.authenticated);
    loginMessage.textContent = state.authenticated ? 'Signed in. This session expires automatically after a few hours.' : state.login_available === false ? 'Browser login needs WEB_LOGIN_CODE in the Railway service variables. The API key is never exposed.' : 'Use the shared demo login code from the team.';
  }
  dlg.querySelector('#browser-sign-in').addEventListener('click', async () => {
    const code = field('accessCode').value;
    if (loginBusy || !code) { if (!code) loginMessage.textContent = 'Enter the demo login code.'; return; }
    loginBusy = true; const version = opening;
    dlg.querySelector('#browser-sign-in').disabled = true;
    loginMessage.textContent = 'Signing in…';
    try {
      const base = field('apiBase').value.trim().replace(/\/+$/, '') || getConfig().apiBase;
      await browserSignIn(code, base);
      if (version !== opening) return;
      field('accessCode').value = ''; dlg.returnValue = ''; dlg.close();
    } catch (error) { if (version === opening) loginMessage.textContent = error.message || 'Could not sign in.'; }
    finally { loginBusy = false; dlg.querySelector('#browser-sign-in').disabled = false; }
  });
  dlg.querySelector('#browser-sign-out').addEventListener('click', async () => {
    if (loginBusy) return;
    loginBusy = true;
    try { await browserSignOut(); field('accessCode').value = ''; dlg.returnValue = ''; dlg.close(); }
    catch (error) { loginMessage.textContent = error.message; }
    finally { loginBusy = false; }
  });
  field('accessCode').addEventListener('keydown', event => {
    if (event.key === 'Enter') { event.preventDefault(); dlg.querySelector('#browser-sign-in').click(); }
  });
  dlg.addEventListener("close", () => {
    opening++; field('accessCode').value = '';
    if (dlg.returnValue !== "save") return;
    setConfig({
      apiBase: field("apiBase").value,
      demoKey: field("demoKey").value,
      watchThreshold: field("watchThreshold").value,
      watchIntervalMs: field("watchIntervalMs").value,
    });
  });

  return {
    open() {
      const c = getConfig();
      let storedBase = "";
      try {
        storedBase = localStorage.getItem("gc.apiBase") || "";
      } catch {}
      field("apiBase").value = storedBase;
      field("apiBase").placeholder = c.apiBase;
      field("demoKey").value = c.demoKey;
      field("watchThreshold").value = c.watchThreshold === DEFAULTS.watchThreshold ? "" : c.watchThreshold;
      field("watchIntervalMs").value = c.watchIntervalMs === DEFAULTS.watchIntervalMs ? "" : c.watchIntervalMs;
      const login = sameOriginApi();
      dlg.querySelector('#browser-login').hidden = !login;
      dlg.querySelector('#advanced-connection').open = !login;
      field('accessCode').value = ''; loginState({ authenticated: false });
      dlg.returnValue = "";
      dlg.showModal();
      (login ? field('accessCode') : c.demoKey ? field("apiBase") : field("demoKey")).focus();
      const version = ++opening;
      if (login) refreshBrowserSession().then(state => { if (version === opening) loginState(state); }).catch(error => { if (version === opening) loginMessage.textContent = error.message; });
    },
    get isOpen() {
      return dlg.open;
    },
  };
}

function statusStrip(openSettings, shouldPoll, requiresKey) {
  const strip = document.createElement("footer");
  strip.className = "status-strip";
  strip.setAttribute("aria-live", "polite");
  document.body.append(strip);

  let last = { state: "checking" };
  let generation = 0;

  function draw(s) {
    last = s;
    const { apiBase } = getConfig();
    strip.dataset.state = ['key_required', 'login_required'].includes(s.state) && s.h?.ai_mode === 'fake' ? 'fake' : s.state;
    const base = `<span class="status-item">API <b>${apiBase}</b></span>`;
    let html;
    switch (s.state) {
      case "checking":
        html = `<span class="status-flag">Connecting</span>${base}`;
        break;
      case "down":
        html = `<span class="status-flag">${icon("warn", { size: 18 })}API unreachable</span>${base}<span class="status-item">${s.detail}</span>`;
        break;
      case "unauthorized":
        html = `<span class="status-flag">${icon("warn", { size: 18 })}Key rejected</span>${base}<span class="status-item">ai_mode <b>${s.h.ai_mode}</b></span><span class="status-item">storage <b>${s.h.storage}</b></span>`;
        break;
      case "key_required":
        html = `<span class="status-flag">${s.h.ai_mode === 'fake' ? 'Fake AI · ' : ''}Connect this browser</span>${base}<span class="status-item">Enter the team’s demo key in Settings.</span><span class="status-item">ai_mode <b>${s.h.ai_mode}</b></span><span class="status-item">storage <b>${s.h.storage}</b></span>`;
        break;
      case "login_required":
        html = `<span class="status-flag">${s.h.ai_mode === 'fake' ? 'Fake AI · ' : ''}Sign in</span>${base}<span class="status-item">Use the demo login code to open lessons and sessions.</span><span class="status-item">ai_mode <b>${s.h.ai_mode}</b></span><span class="status-item">storage <b>${s.h.storage}</b></span>`;
        break;
      default: {
        const fake = s.h.ai_mode === "fake";
        html = `${fake ? `<span class="status-flag">${icon("warn", { size: 18 })}Fake AI</span>` : `<span class="status-flag">${requiresKey ? 'Live' : 'Service online'}</span>`}${base}<span class="status-item">ai_mode <b>${s.h.ai_mode}</b></span><span class="status-item">storage <b>${s.h.storage}</b></span><span class="status-item">contract <b>${s.h.contract_version}</b></span>`;
      }
    }
    const needsKey = ['key_required', 'unauthorized', 'down'].includes(s.state);
    strip.innerHTML = `${html}<button type="button" class="status-action">${s.state === 'login_required' ? 'Sign in' : needsKey ? "Open settings" : "Settings"}</button>`;
    strip.querySelector(".status-action").addEventListener("click", openSettings);
    document.dispatchEvent(new CustomEvent("echo:status", { detail: s }));
  }

  async function poll() {
    if (!shouldPoll()) return;
    const version = ++generation;
    const result = await probeConnection({ requiresKey });
    if (version === generation) draw(result);
  }

  draw(last);
  poll();
  let timer = setInterval(poll, POLL_MS);
  addEventListener(CONFIG_EVENT, () => {
    generation++;
    draw({ state: "checking" });
    clearInterval(timer);
    poll();
    timer = setInterval(poll, POLL_MS);
  });
  return {
    get state() {
      return last;
    },
    refresh: poll,
  };
}

/** Wire the gear button (any element with [data-open-settings]) and the footer strip. */
export function mountChrome({ shouldPoll = () => true, requiresKey = true } = {}) {
  const settings = settingsDialog();
  mountSetup({ openSettings: () => settings.open() });
  document.querySelectorAll("[data-open-settings]").forEach((b) => b.addEventListener("click", () => settings.open()));
  const status = statusStrip(() => settings.open(), shouldPoll, requiresKey);
  return { settings, status };
}
