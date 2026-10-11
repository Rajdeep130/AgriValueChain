/**
 * Config.gs — central configuration.
 *
 * Values that differ per installation (spreadsheet ID, Google OAuth client ID)
 * live in Script Properties (Apps Script editor → Project Settings → Script
 * Properties), never in source code.
 */

const CONFIG = {
  APP_NAME: 'AgriChain 360',
  API_VERSION: 'poc-1',

  // Script Property names
  PROP_SPREADSHEET_ID: 'SPREADSHEET_ID',
  PROP_GOOGLE_CLIENT_ID: 'GOOGLE_CLIENT_ID',

  // Limits
  MAX_BODY_BYTES: 100000,
  LOCK_WAIT_MS: 10000,
  TOKEN_CACHE_MAX_SECONDS: 600,

  // Accepted issuers of Google ID tokens
  GOOGLE_ISSUERS: ['accounts.google.com', 'https://accounts.google.com'],

  // Table (sheet tab) names and their header rows
  TABLES: {
    tblUsers: ['user_id', 'email', 'display_name', 'role', 'status', 'created_at'],
    tblSequences: ['sequence_name', 'prefix', 'last_number'],
    tblPocNotes: ['note_id', 'text', 'created_by', 'created_at', 'request_id', 'row_version'],
    tblAuditLog: ['timestamp', 'user_email', 'action', 'entity', 'entity_id', 'request_id', 'result']
  }
};

/** Reads a required Script Property or throws a CONFIG_ERROR. */
function getRequiredProperty_(name) {
  const value = PropertiesService.getScriptProperties().getProperty(name);
  if (!value) {
    throw new AppError('CONFIG_ERROR', 'Server is not configured. Contact the administrator.',
      'Missing script property: ' + name);
  }
  return value;
}
