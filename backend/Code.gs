/**
 * Code.gs — web app entry points and request router.
 *
 * Every request is a POST whose body is JSON text:
 *   { "action": "...", "payload": {...}, "id_token": "...", "request_id": "..." }
 * sent with Content-Type text/plain so the browser does not need a CORS
 * preflight (which Apps Script cannot answer).
 */

/**
 * The list of allowed actions. Anything not listed here is rejected.
 *   auth:  true  → a valid sign-in is required
 *   roles: null  → any ACTIVE user; otherwise only the listed roles
 */
const ROUTES = {
  ping:       { auth: false, roles: null,      handler: function () { return pocPing_(); } },
  whoami:     { auth: true,  roles: null,      handler: function (req, user) { return pocWhoAmI_(user); } },
  listNotes:  { auth: true,  roles: null,      handler: function (req, user) { return pocListNotes_(); } },
  createNote: { auth: true,  roles: ['ADMIN'], handler: function (req, user) { return pocCreateNote_(req, user); } }
};

/** GET is only a health check, so opening the URL in a browser shows something useful. */
function doGet() {
  return toJsonOutput_(okResponse_({ app: CONFIG.APP_NAME, api: CONFIG.API_VERSION }, 'Backend is running'));
}

function doPost(e) {
  return toJsonOutput_(handleRequest_(e));
}

/** All the logic, separated from doPost so it can be tested. Never throws. */
function handleRequest_(e) {
  try {
    const req = parseRequest_(e);
    // hasOwnProperty: built-in names like "toString" must not count as routes.
    if (!Object.prototype.hasOwnProperty.call(ROUTES, req.action)) {
      throw new AppError('UNKNOWN_ACTION', 'Unknown action.');
    }
    const route = ROUTES[req.action];

    let user = null;
    if (route.auth) {
      user = authenticate_(req.id_token);
      if (route.roles) authorize_(user, route.roles);
    }
    return route.handler(req, user);
  } catch (err) {
    if (err instanceof AppError) {
      if (err.internalDetail) console.error(err.code + ': ' + err.internalDetail);
      return errorResponse_(err.code, err.safeMessage);
    }
    // Unexpected bug: log full detail on the server, show nothing sensitive to the user.
    console.error('INTERNAL_ERROR: ' + (err && err.stack ? err.stack : err));
    return errorResponse_('INTERNAL_ERROR', 'Something went wrong. Please try again or contact the administrator.');
  }
}

function parseRequest_(e) {
  const body = e && e.postData && e.postData.contents;
  if (!body) throw new AppError('BAD_REQUEST', 'Empty request.');
  if (body.length > CONFIG.MAX_BODY_BYTES) throw new AppError('BAD_REQUEST', 'Request is too large.');
  let req;
  try {
    req = JSON.parse(body);
  } catch (parseErr) {
    throw new AppError('BAD_REQUEST', 'Request is not valid JSON.');
  }
  if (!req || typeof req !== 'object' || Array.isArray(req) || typeof req.action !== 'string') {
    throw new AppError('BAD_REQUEST', 'Request must include an action.');
  }
  if (req.payload !== undefined && (typeof req.payload !== 'object' || req.payload === null || Array.isArray(req.payload))) {
    throw new AppError('BAD_REQUEST', 'Payload must be an object.');
  }
  req.payload = req.payload || {};
  return req;
}
