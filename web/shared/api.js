// Fetch wrapper for the Echo API (docs/API-CONTRACT.md).
// Adds X-Demo-Key, turns the error envelope into ApiError, and times every call out.

import { getConfig } from "./config.js";

export const TIMEOUTS = Object.freeze({ check: 10000, watch: 4000, default: 10000 });

export class ApiError extends Error {
  constructor({ status = 0, code = "internal", message = "Request failed", retryable = false, requestId = null } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.retryable = retryable;
    this.requestId = requestId;
  }
}

async function request(method, path, { json, form, timeoutMs = TIMEOUTS.default, auth = true } = {}) {
  const { apiBase, demoKey } = getConfig();
  const headers = {};
  if (auth) headers["X-Demo-Key"] = demoKey;
  let body;
  if (json !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(json);
  } else if (form) {
    body = form; // the browser sets the multipart boundary
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let res;
  try {
    res = await fetch(apiBase + path, { method, headers, body, signal: ctrl.signal });
  } catch (err) {
    const timedOut = err && err.name === "AbortError";
    throw new ApiError({
      code: timedOut ? "timeout" : "network",
      message: timedOut ? `No answer within ${Math.round(timeoutMs / 1000)} s` : "Cannot reach the API",
      retryable: true,
    });
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 204) return null;
  let data = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }
  if (!res.ok) {
    const e = (data && data.error) || {};
    throw new ApiError({
      status: res.status,
      code: e.code || (res.status === 401 ? "unauthorized" : "internal"),
      message: e.message || `HTTP ${res.status}`,
      retryable: Boolean(e.retryable),
      requestId: e.request_id ?? null,
    });
  }
  return data;
}

export const api = {
  get: (path, opts) => request("GET", path, opts),
  postJson: (path, body, opts) => request("POST", path, { ...opts, json: body }),
  patchJson: (path, body, opts) => request("PATCH", path, { ...opts, json: body }),
  del: (path, opts) => request("DELETE", path, opts),
  postForm: (path, formData, opts) => request("POST", path, { ...opts, form: formData }),
};

/** A frame request (check or watch) as multipart. */
function frameForm({ frame, stepId, requestId, sessionId, capturedAt }) {
  const fd = new FormData();
  fd.append("frame", frame, "frame.jpg");
  fd.append("step_id", stepId);
  fd.append("request_id", requestId);
  if (sessionId) fd.append("session_id", sessionId);
  if (capturedAt) fd.append("captured_at", capturedAt);
  return fd;
}

export const health = () => api.get("/health", { auth: false, timeoutMs: 5000 });
export const listRecipes = (status) =>
  api.get(status ? `/recipes?status=${encodeURIComponent(status)}` : "/recipes");
export const getRecipe = (id) => api.get(`/recipes/${encodeURIComponent(id)}`);
export const createRecipe = (body) => api.postJson('/recipes', body);
export const processRecipe = (id) => api.postJson(`/recipes/${encodeURIComponent(id)}/process`, {});
export const patchRecipe = (id, body) => api.patchJson(`/recipes/${encodeURIComponent(id)}`, body);
export const publishRecipe = (id) => api.postJson(`/recipes/${encodeURIComponent(id)}/publish`, {});
export const deleteRecipe = (id) => api.del(`/recipes/${encodeURIComponent(id)}`);
export const patchStep = (id, body) => api.patchJson(`/steps/${encodeURIComponent(id)}`, body,
  { timeoutMs: 'timestamp_s' in body ? 90000 : TIMEOUTS.default });

/** Signed upload: deliberately separate from the authenticated API wrapper. */
export function putVideo(uploadUrl, file, onProgress = () => {}, { signal } = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(uploadUrl);
    if (!['http:', 'https:'].includes(url.protocol)) return reject(new ApiError({ message: 'Invalid upload URL' }));
    const xhr = new XMLHttpRequest();
    const abort = () => xhr.abort();
    const finish = (error) => {
      signal?.removeEventListener('abort', abort);
      if (error) reject(error); else resolve();
    };
    xhr.open('PUT', url.href);
    xhr.timeout = 30 * 60 * 1000;
    xhr.setRequestHeader('Content-Type', 'video/mp4');
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round(event.loaded / event.total * 100));
    };
    xhr.onload = () => finish(xhr.status >= 200 && xhr.status < 300 ? null : new ApiError({
      status: xhr.status, message: `Video upload failed (HTTP ${xhr.status}). Retry while the upload link is valid.`, retryable: true,
    }));
    xhr.onerror = () => finish(new ApiError({ code: 'network', message: 'Video upload lost its connection. You can retry.', retryable: true }));
    xhr.ontimeout = () => finish(new ApiError({ code: 'timeout', message: 'Video upload timed out. You can retry.', retryable: true }));
    xhr.onabort = () => finish(new ApiError({ code: 'aborted', message: 'Video upload stopped.' }));
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) return finish(new ApiError({ code: 'aborted', message: 'Video upload stopped.' }));
    xhr.send(file);
  });
}
export const createSession = (recipeId, deviceLabel) =>
  api.postJson("/sessions", { recipe_id: recipeId, client: "web-sim", device_label: deviceLabel });
export const postEvent = (sessionId, kind, { stepId = null, requestId = null, payload = {} } = {}) =>
  api.postJson(`/sessions/${encodeURIComponent(sessionId)}/events`, {
    kind,
    step_id: stepId,
    request_id: requestId,
    payload,
  });
export const check = (args) => api.postForm("/check", frameForm(args), { timeoutMs: TIMEOUTS.check });
export const watch = (args) => api.postForm("/watch", frameForm(args), { timeoutMs: TIMEOUTS.watch });
export const getSession = (id) => api.get(`/sessions/${encodeURIComponent(id)}`);

export function newRequestId() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  // randomUUID needs a secure context; LAN http pages fall back to getRandomValues.
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export const listSessions = () => api.get('/sessions?active=true&limit=5', { timeoutMs: 4000 });
export const getMonitor = (id) => api.get(`/sessions/${encodeURIComponent(id)}/monitor`, { timeoutMs: 2500 });
