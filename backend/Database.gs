/**
 * Database.gs — the only file that talks to the Google Sheet.
 *
 * Each table is one sheet tab. Row 1 holds the column headers; every later
 * row is one record. Records are read and written by header name, never by
 * fixed column position, so adding a column does not break existing code.
 */

function getSpreadsheet_() {
  return SpreadsheetApp.openById(getRequiredProperty_(CONFIG.PROP_SPREADSHEET_ID));
}

function getSheet_(tableName) {
  const sheet = getSpreadsheet_().getSheetByName(tableName);
  if (!sheet) {
    throw new AppError('CONFIG_ERROR', 'Server is not configured. Contact the administrator.',
      'Missing table: ' + tableName);
  }
  return sheet;
}

/** Returns all records of a table as an array of plain objects. */
function readTable_(tableName) {
  const values = getSheet_(tableName).getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0];
  return values.slice(1).map(function (row) {
    const record = {};
    headers.forEach(function (h, i) { record[h] = row[i]; });
    return record;
  });
}

/** Appends one record (object keyed by header name) to a table. */
function appendRecord_(tableName, record) {
  const sheet = getSheet_(tableName);
  const headers = sheet.getDataRange().getValues()[0];
  const row = headers.map(function (h) {
    return record[h] === undefined ? '' : sanitizeCell_(record[h]);
  });
  sheet.appendRow(row);
}

/**
 * Prevents "formula injection": text starting with = + - @ would be
 * executed by the spreadsheet as a formula. A leading apostrophe forces
 * the spreadsheet to store it as plain text.
 */
function sanitizeCell_(value) {
  if (typeof value === 'string' && /^[=+\-@]/.test(value)) return "'" + value;
  return value;
}

/**
 * Runs `fn` while holding the script-wide lock, so only one write runs at a
 * time. Returns fn's result. Throws LOCK_TIMEOUT if the lock is busy too long.
 */
function withLock_(fn) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(CONFIG.LOCK_WAIT_MS)) {
    throw new AppError('LOCK_TIMEOUT', 'The system is busy. Please try again in a moment.');
  }
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

/**
 * Issues the next ID for a sequence, e.g. NOTE000001. MUST be called inside
 * withLock_ so two users can never receive the same number.
 */
function nextId_(sequenceName) {
  const sheet = getSheet_('tblSequences');
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const nameCol = headers.indexOf('sequence_name');
  const prefixCol = headers.indexOf('prefix');
  const lastCol = headers.indexOf('last_number');
  for (let r = 1; r < values.length; r++) {
    if (values[r][nameCol] === sequenceName) {
      const next = Number(values[r][lastCol] || 0) + 1;
      sheet.getRange(r + 1, lastCol + 1).setValue(next); // sheet rows/cols are 1-based
      return values[r][prefixCol] + String(next).padStart(6, '0');
    }
  }
  throw new AppError('CONFIG_ERROR', 'Server is not configured. Contact the administrator.',
    'Missing sequence: ' + sequenceName);
}

/** Writes one audit-log entry. Call inside withLock_ for write operations. */
function writeAudit_(userEmail, action, entity, entityId, requestId, result) {
  appendRecord_('tblAuditLog', {
    timestamp: new Date().toISOString(),
    user_email: userEmail,
    action: action,
    entity: entity,
    entity_id: entityId || '',
    request_id: requestId || '',
    result: result
  });
}
