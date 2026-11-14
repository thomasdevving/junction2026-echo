import { getConfig, setConfig } from './config.js';

const sessions = new Map();
export function sameOriginApi(base = getConfig().apiBase) {
  try { return new URL(base).origin === globalThis.location?.origin; } catch { return false; }
}
export function browserSessionActive(base = getConfig().apiBase) {
  const state = sessions.get(base);
  return Boolean(state?.authenticated && Date.parse(state.expires_at) > Date.now());
}
export const hasApiAccess = () => Boolean(getConfig().demoKey) || browserSessionActive();
export function forgetBrowserSession(base = getConfig().apiBase) { sessions.delete(base); }

async function sessionRequest(path, { body, base = getConfig().apiBase } = {}) {
  if (!sameOriginApi(base)) throw new Error('Sign in on the website served by this API. Use advanced settings for a separate development server.');
  const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(`${base}/app/auth/${path}`, {
      method: body === undefined ? 'GET' : 'POST', credentials: 'same-origin', cache: 'no-store',
      headers: { 'X-Echo-Browser': '1', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      body: body === undefined ? undefined : JSON.stringify(body), signal: controller.signal,
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const error = new Error(data?.error?.message || `Sign-in request failed (${response.status})`);
      error.status = response.status; throw error;
    }
    if (!data || typeof data.authenticated !== 'boolean') throw new Error('The server returned an invalid sign-in response.');
    sessions.set(base, data);
    return data;
  } finally { clearTimeout(timeout); }
}
export async function refreshBrowserSession() {
  if (!sameOriginApi()) return { supported: false, authenticated: false };
  try { return { ...await sessionRequest('session'), supported: true }; }
  catch (error) {
    forgetBrowserSession();
    if (error.status === 404) return { supported: false, authenticated: false };
    throw error;
  }
}
export async function browserSignIn(code, base = getConfig().apiBase) {
  const result = await sessionRequest('login', { body: { code }, base });
  if (result.authenticated) setConfig({ apiBase: base, demoKey: '' });
  return result;
}
export async function browserSignOut() {
  await sessionRequest('logout', { body: {} });
  forgetBrowserSession(); setConfig({ demoKey: '' });
}
