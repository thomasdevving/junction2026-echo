import test from 'node:test';
import assert from 'node:assert/strict';
import { browserSignIn, browserSignOut, browserSessionActive, forgetBrowserSession, refreshBrowserSession, hasApiAccess } from '../shared/browser-session.js';
import { getConfig, setConfig } from '../shared/config.js';
import { listRecipes } from '../shared/api.js';
import { probeConnection } from '../shared/connection.js';

test('browser sign-in uses cookies and never stores a login code or API key', async () => {
  const original = { fetch: globalThis.fetch, location: globalThis.location, localStorage: globalThis.localStorage };
  const values = new Map(), calls = [];
  globalThis.location = { origin: 'https://echo.example', pathname: '/app/sim/' };
  globalThis.localStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
  globalThis.fetch = async (url, options) => {
    calls.push({ url, ...options });
    const data = url.endsWith('/logout') ? { authenticated: false }
      : url.endsWith('/recipes?status=published') ? { recipes: [] }
      : { authenticated: true, expires_at: new Date(Date.now() + 3600000).toISOString(), login_available: true };
    return new Response(JSON.stringify(data));
  };
  try {
    await browserSignIn('private-test-access');
    assert.ok(browserSessionActive()); assert.ok(hasApiAccess()); assert.equal(getConfig().demoKey, '');
    assert.ok(!JSON.stringify([...values]).includes('private-test-access'));
    assert.equal(calls[0].credentials, 'same-origin'); assert.equal(calls[0].headers['X-Echo-Browser'], '1');
    assert.equal(calls[0].headers['X-Demo-Key'], undefined);
    await listRecipes('published');
    assert.equal(calls[1].credentials, 'same-origin'); assert.equal(calls[1].headers['X-Echo-Browser'], '1');
    assert.equal(calls[1].headers['X-Demo-Key'], undefined);
    forgetBrowserSession(); assert.equal(browserSessionActive(), false);
    assert.equal((await refreshBrowserSession()).authenticated, true); assert.ok(hasApiAccess());
    await browserSignOut(); assert.equal(hasApiAccess(), false);
    const count = calls.length;
    await assert.rejects(browserSignIn('private-test-access', 'https://another.example'), /Sign in on the website/);
    assert.equal(calls.length, count);
    setConfig({ apiBase: 'https://another.example', demoKey: 'legacy-test-key' });
    await listRecipes('published');
    assert.equal(calls.at(-1).headers['X-Demo-Key'], 'legacy-test-key');
    assert.equal(calls.at(-1).headers['X-Echo-Browser'], undefined);
  } finally { forgetBrowserSession('https://echo.example'); Object.assign(globalThis, original); }
});

test('connection checks restore a valid cookie session and prompt when signed out', async () => {
  const h = { ai_mode: 'gemini', storage: 'supabase' };
  let reads = 0;
  const options = { demoKey: '', readHealth: async () => h, readRecipes: async () => { reads++; } };
  const good = await probeConnection({ ...options, readSession: async () => ({ supported: true, authenticated: true }) });
  assert.equal(good.state, 'ok'); assert.equal(reads, 1);
  const missing = await probeConnection({ ...options, readSession: async () => ({ supported: true, authenticated: false }) });
  assert.equal(missing.state, 'login_required'); assert.equal(reads, 1);
});
