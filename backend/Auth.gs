/**
 * Auth.gs — who is calling, and are they allowed?
 *
 * 1. The browser signs in with Google and receives a signed ID token.
 * 2. The token is sent inside the request body (not a header: Apps Script
 *    cannot accept the CORS preflight that custom headers trigger).
 * 3. We ask Google's tokeninfo endpoint to verify the signature, then check
 *    audience, issuer, expiry and verified email ourselves.
 * 4. The verified email must exist as an ACTIVE user in tblUsers; that row
 *    gives the user's role.
 */

const TOKENINFO_URL = 'https://oauth2.googleapis.com/tokeninfo?id_token=';

/** Returns { email, role, user_id } or throws UNAUTHENTICATED / FORBIDDEN. */
function authenticate_(idToken) {
  const email = verifyGoogleIdToken_(idToken);
  const user = readTable_('tblUsers').find(function (u) {
    return String(u.email).trim().toLowerCase() === email;
  });
  if (!user) {
    throw new AppError('FORBIDDEN', 'Your account is not registered for this application.');
  }
  if (user.status !== 'ACTIVE') {
    throw new AppError('FORBIDDEN', 'Your account is not active.');
  }
  return { email: email, role: user.role, user_id: user.user_id };
}

/** Throws FORBIDDEN unless the user's role is in allowedRoles. */
function authorize_(user, allowedRoles) {
  if (allowedRoles.indexOf(user.role) === -1) {
    throw new AppError('FORBIDDEN', 'You do not have permission to perform this action.');
  }
}

/** Verifies a Google ID token and returns the lower-case email. */
function verifyGoogleIdToken_(idToken) {
  if (typeof idToken !== 'string' || idToken.length < 20 || idToken.length > 4096) {
    throw new AppError('UNAUTHENTICATED', 'Please sign in.');
  }
  const clientId = getRequiredProperty_(CONFIG.PROP_GOOGLE_CLIENT_ID);

  // Cache successful verifications briefly to save URL-fetch quota.
  const cache = CacheService.getScriptCache();
  const cacheKey = 'tok_' + sha256Hex_(idToken);
  const cached = cache.get(cacheKey);
  if (cached) {
    const c = JSON.parse(cached);
    if (c.exp * 1000 > Date.now()) return c.email;
  }

  const resp = UrlFetchApp.fetch(TOKENINFO_URL + encodeURIComponent(idToken), { muteHttpExceptions: true });
  if (resp.getResponseCode() !== 200) {
    throw new AppError('UNAUTHENTICATED', 'Your sign-in is invalid or expired. Please sign in again.');
  }
  const claims = JSON.parse(resp.getContentText());
  const nowSec = Math.floor(Date.now() / 1000);
  const exp = Number(claims.exp);

  const problems = [];
  if (claims.aud !== clientId) problems.push('aud');
  if (CONFIG.GOOGLE_ISSUERS.indexOf(claims.iss) === -1) problems.push('iss');
  if (!(exp > nowSec)) problems.push('exp');
  if (String(claims.email_verified) !== 'true') problems.push('email_verified');
  if (!claims.email) problems.push('email');
  if (problems.length) {
    console.warn('Token rejected: ' + problems.join(','));
    throw new AppError('UNAUTHENTICATED', 'Your sign-in is invalid or expired. Please sign in again.');
  }

  const email = String(claims.email).toLowerCase();
  const ttl = Math.min(exp - nowSec, CONFIG.TOKEN_CACHE_MAX_SECONDS);
  if (ttl > 0) cache.put(cacheKey, JSON.stringify({ email: email, exp: exp }), ttl);
  return email;
}

function sha256Hex_(text) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text, Utilities.Charset.UTF_8);
  return bytes.map(function (b) { return ((b + 256) % 256).toString(16).padStart(2, '0'); }).join('');
}
