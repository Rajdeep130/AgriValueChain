/**
 * Poc.gs — proof-of-concept actions and one-time database setup.
 *
 * The "notes" table exists only to prove read, write, locking, ID
 * generation, idempotency and audit logging end-to-end. It will be removed
 * once real business modules use the same building blocks.
 */

// Must start with a letter so the spreadsheet never converts it to a number or date.
const REQUEST_ID_PATTERN = /^[A-Za-z][A-Za-z0-9-]{7,63}$/;
const NOTE_MAX_LENGTH = 200;

function pocPing_() {
  return okResponse_({ app: CONFIG.APP_NAME, api: CONFIG.API_VERSION, server_time: new Date().toISOString() }, 'pong');
}

function pocWhoAmI_(user) {
  return okResponse_({ email: user.email, role: user.role, user_id: user.user_id }, 'Signed in');
}

function pocListNotes_() {
  const notes = readTable_('tblPocNotes').map(function (n) {
    return { note_id: n.note_id, text: n.text, created_by: n.created_by, created_at: n.created_at };
  });
  return okResponse_(notes, notes.length + ' note(s)');
}

function pocCreateNote_(req, user) {
  // 1. Validate everything BEFORE taking the lock or writing anything.
  const requestId = req.request_id;
  if (typeof requestId !== 'string' || !REQUEST_ID_PATTERN.test(requestId)) {
    throw new AppError('VALIDATION_ERROR', 'A valid request_id is required.');
  }
  const text = typeof req.payload.text === 'string' ? req.payload.text.trim() : '';
  if (!text) throw new AppError('VALIDATION_ERROR', 'Note text is required.');
  if (text.length > NOTE_MAX_LENGTH) {
    throw new AppError('VALIDATION_ERROR', 'Note text must be at most ' + NOTE_MAX_LENGTH + ' characters.');
  }

  // 2. Write under the lock: one writer at a time.
  return withLock_(function () {
    // Idempotency: a repeated submission returns the original record.
    const existing = readTable_('tblPocNotes').find(function (n) { return String(n.request_id) === requestId; });
    if (existing) {
      return okResponse_({ note_id: existing.note_id, duplicate: true }, 'Already saved');
    }

    const noteId = nextId_('NOTE');
    appendRecord_('tblPocNotes', {
      note_id: noteId,
      text: text,
      created_by: user.email,
      created_at: new Date().toISOString(),
      request_id: requestId,
      row_version: 1
    });
    writeAudit_(user.email, 'CREATE', 'tblPocNotes', noteId, requestId, 'SUCCESS');
    return okResponse_({ note_id: noteId, duplicate: false }, 'Note saved');
  });
}

/**
 * ONE-TIME SETUP — run manually from the Apps Script editor (select
 * `setupPocDatabase` and click Run). Safe to run again: it only adds
 * what is missing.
 *  - Creates the private spreadsheet "AgriChain360_DB_POC" if not configured
 *  - Creates each table tab with its header row
 *  - Seeds the NOTE sequence
 *  - Registers you (the script owner) as an ACTIVE ADMIN user
 */
function setupPocDatabase() {
  const props = PropertiesService.getScriptProperties();
  let ssId = props.getProperty(CONFIG.PROP_SPREADSHEET_ID);
  const ss = ssId ? SpreadsheetApp.openById(ssId) : SpreadsheetApp.create('AgriChain360_DB_POC');
  if (!ssId) {
    ssId = ss.getId();
    props.setProperty(CONFIG.PROP_SPREADSHEET_ID, ssId);
  }

  Object.keys(CONFIG.TABLES).forEach(function (name) {
    if (!ss.getSheetByName(name)) {
      const headers = CONFIG.TABLES[name];
      const sheet = ss.insertSheet(name);
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.setFrozenRows(1);
    }
  });
  const defaultSheet = ss.getSheetByName('Sheet1');
  if (defaultSheet && ss.getSheets().length > 1) ss.deleteSheet(defaultSheet);

  if (!readTable_('tblSequences').some(function (s) { return s.sequence_name === 'NOTE'; })) {
    appendRecord_('tblSequences', { sequence_name: 'NOTE', prefix: 'NOTE', last_number: 0 });
  }
  if (!readTable_('tblSequences').some(function (s) { return s.sequence_name === 'USER'; })) {
    appendRecord_('tblSequences', { sequence_name: 'USER', prefix: 'U', last_number: 0 });
  }

  const ownerEmail = Session.getEffectiveUser().getEmail().toLowerCase();
  if (!readTable_('tblUsers').some(function (u) { return String(u.email).toLowerCase() === ownerEmail; })) {
    appendRecord_('tblUsers', {
      user_id: nextId_('USER'),
      email: ownerEmail,
      display_name: 'Owner',
      role: 'ADMIN',
      status: 'ACTIVE',
      created_at: new Date().toISOString()
    });
  }

  console.log('Setup complete. Spreadsheet: ' + ss.getUrl());
  return ss.getUrl();
}
