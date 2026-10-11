/**
 * frontend-api.test.js — tests the browser API client's failure handling.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
require('../frontend/assets/js/api.js'); // attaches AgriApi to globalThis
globalThis.AGRI_CONFIG = { API_URL: 'https://example.invalid/exec', REQUEST_TIMEOUT_MS: 50 };
const { call, newRequestId } = globalThis.AgriApi;

const jsonResponse = (obj, status) => ({ ok: (status || 200) < 400, status: status || 200, json: async () => obj });

test('sends a simple CORS request: POST, text/plain, token and request_id in body', async () => {
  let seen;
  await call('createNote', { text: 'a' }, {
    idToken: 'tok', requestId: 'req-1',
    fetchFn: async (url, init) => { seen = { url, init }; return jsonResponse({ success: true, data: null, error: null, message: 'ok' }); }
  });
  assert.equal(seen.init.method, 'POST');
  assert.deepEqual(Object.keys(seen.init.headers), ['Content-Type']);
  assert.match(seen.init.headers['Content-Type'], /^text\/plain/);
  assert.deepEqual(JSON.parse(seen.init.body), { action: 'createNote', payload: { text: 'a' }, id_token: 'tok', request_id: 'req-1' });
});

test('network failure → NETWORK_ERROR', async () => {
  const r = await call('ping', {}, { fetchFn: async () => { throw new TypeError('Failed to fetch'); } });
  assert.equal(r.success, false);
  assert.equal(r.error.code, 'NETWORK_ERROR');
});

test('slow server → TIMEOUT', async () => {
  const r = await call('ping', {}, {
    fetchFn: (url, init) => new Promise((resolve, reject) => {
      init.signal.addEventListener('abort', () => { const e = new Error('aborted'); e.name = 'AbortError'; reject(e); });
    })
  });
  assert.equal(r.error.code, 'TIMEOUT');
});

test('HTTP error status → HTTP_ERROR', async () => {
  const r = await call('ping', {}, { fetchFn: async () => jsonResponse({}, 500) });
  assert.equal(r.error.code, 'HTTP_ERROR');
});

test('non-JSON (e.g. Google login page) → BAD_RESPONSE, never shown as success', async () => {
  const r = await call('ping', {}, { fetchFn: async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError('Unexpected token <'); } }) });
  assert.equal(r.success, false);
  assert.equal(r.error.code, 'BAD_RESPONSE');
});

test('JSON without success flag → BAD_RESPONSE', async () => {
  const r = await call('ping', {}, { fetchFn: async () => jsonResponse({ hello: 'world' }) });
  assert.equal(r.error.code, 'BAD_RESPONSE');
});

test('backend error is passed through unchanged', async () => {
  const backendErr = { success: false, data: null, error: { code: 'FORBIDDEN', message: 'No' }, message: 'No' };
  assert.deepEqual(await call('x', {}, { fetchFn: async () => jsonResponse(backendErr) }), backendErr);
});

test('request IDs are unique and match the backend format', () => {
  const ids = new Set(Array.from({ length: 1000 }, newRequestId));
  assert.equal(ids.size, 1000);
  for (const id of ids) assert.match(id, /^[A-Za-z][A-Za-z0-9-]{7,63}$/);
});
