/**
 * Response.gs — one predictable response shape for every API call:
 *   { success, data, error: { code, message } | null, message }
 *
 * Note: Apps Script web apps always return HTTP 200, so the frontend must
 * read `success` and `error.code`, not the HTTP status.
 */

/** An error that is safe to show to the user. `internalDetail` is logged only. */
class AppError extends Error {
  constructor(code, safeMessage, internalDetail) {
    super(safeMessage);
    this.code = code;
    this.safeMessage = safeMessage;
    this.internalDetail = internalDetail || '';
  }
}

function okResponse_(data, message) {
  return { success: true, data: data === undefined ? null : data, error: null, message: message || 'Operation completed' };
}

function errorResponse_(code, message) {
  return { success: false, data: null, error: { code: code, message: message }, message: message };
}

/** Wraps a response object as JSON text output for the web app. */
function toJsonOutput_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
