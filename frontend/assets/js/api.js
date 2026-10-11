/**
 * api.js — the ONLY place the frontend talks to the backend.
 *
 * Always resolves (never throws) to the standard shape:
 *   { success, data, error: { code, message } | null, message }
 * so every screen handles failures the same way.
 */
(function (root) {
  function failure(code, message) {
    return { success: false, data: null, error: { code: code, message: message }, message: message };
  }

  /** Unique ID per submission so a retry or double-click is not saved twice. */
  function newRequestId() {
    if (root.crypto && root.crypto.randomUUID) return 'req-' + root.crypto.randomUUID();
    return 'req-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12);
  }

  /**
   * Sends one action to the backend.
   * Content-Type text/plain keeps this a "simple" CORS request: Apps Script
   * cannot answer the preflight that application/json would trigger.
   */
  async function call(action, payload, options) {
    const opts = options || {};
    const cfg = root.AGRI_CONFIG || {};
    const fetchFn = opts.fetchFn || root.fetch;
    const timeoutMs = opts.timeoutMs || cfg.REQUEST_TIMEOUT_MS || 45000;
    const body = { action: action, payload: payload || {} };
    if (opts.idToken) body.id_token = opts.idToken;
    if (opts.requestId) body.request_id = opts.requestId;

    const controller = new AbortController();
    const timer = setTimeout(function () { controller.abort(); }, timeoutMs);
    let response;
    try {
      response = await fetchFn(cfg.API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(body),
        redirect: 'follow',
        signal: controller.signal
      });
    } catch (err) {
      if (err && err.name === 'AbortError') {
        // A slow write may still finish on the server. Retrying is safe because
        // the same request_id is reused and the backend saves it only once.
        return failure('TIMEOUT', opts.requestId
          ? 'The server took too long to respond. Your change may already be saved. Submit again; it will not be saved twice.'
          : 'The server took too long to respond. Check your connection and try again.');
      }
      return failure('NETWORK_ERROR', 'Could not reach the server. Check your connection and try again.');
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      return failure('HTTP_ERROR', 'The server returned an error (HTTP ' + response.status + ').');
    }
    let result;
    try {
      result = await response.json();
    } catch (err) {
      return failure('BAD_RESPONSE', 'The server sent an unexpected response.');
    }
    if (!result || typeof result.success !== 'boolean') {
      return failure('BAD_RESPONSE', 'The server sent an unexpected response.');
    }
    return result;
  }

  root.AgriApi = { call: call, newRequestId: newRequestId };
})(typeof window !== 'undefined' ? window : globalThis);
