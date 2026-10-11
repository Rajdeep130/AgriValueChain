# Testing

## How to run the automated tests

Requires Node.js 20 or newer. No packages to install.

```
npm test
```

The backend tests load the **real** `backend/*.gs` files into a simulated Apps Script environment
(`tests/gas-mocks.js`) with an in-memory spreadsheet, lock, cache and a fake Google token checker.
They prove our *logic*. They do **not** prove that the real Google services behave the same way.
That needs the manual checklist in `docs/DEPLOYMENT.md`.

## Results log

### 2026-10-11 — Step 1: integration proof of concept (automated)

**34 / 34 passed.**

| Area | Tests | What is proven |
|---|---|---|
| Setup | 1 | Creates 4 tables, sequences and owner ADMIN. Re-running creates no duplicates |
| Request handling | 4 | Bad JSON, empty body, missing action, non-object payload, unknown action, oversized body are rejected. `doGet` health check works |
| Authentication | 10 | No token, forged token, wrong audience, wrong issuer, expired, unverified email are rejected. Unregistered and inactive users are FORBIDDEN. Email matched case-insensitively. Token verification is cached |
| Authorization | 1 | Non-ADMIN cannot write, and nothing is written to data or audit tables |
| Write path | 6 | Sequential IDs (NOTE000001…), row and audit entry written, duplicate submission (same `request_id`) saves once, validation incl. 200/201-character boundary, formula-injection protection, busy lock → nothing written |
| Read path | 1 | Notes returned without internal fields |
| Failure handling | 3 | Missing configuration → safe `CONFIG_ERROR` (detail only in server log). Unexpected crash → `INTERNAL_ERROR` with no stack trace. Every response has the standard shape |
| Frontend API client | 8 | Sends a CORS-"simple" request (POST, text/plain, no custom headers). Network error, timeout, HTTP error, non-JSON reply and malformed JSON are never shown as success. Request IDs are unique and valid |

**Bug found and fixed by these tests:** the action name `toString` was treated as a route
(JavaScript built-in property), causing an `INTERNAL_ERROR` instead of `UNKNOWN_ACTION`. The router now
accepts only routes it explicitly defines.

**Browser smoke test** (headless Chromium, phone width 390 px, run by Claude, not committed):
page loads with no JavaScript errors, Ping without a backend shows `NETWORK_ERROR`, empty note shows
`VALIDATION_ERROR`, no horizontal scrolling.

### NOT yet verified (needs the owner's Google account)

- Real Apps Script deployment, real Google Sheet writes and real `LockService`
- Real Google ID-token verification via `oauth2.googleapis.com/tokeninfo`
- Real CORS and redirect behaviour between GitHub Pages and the `/exec` URL
- GitHub Pages publishing workflow
- Behaviour with two people saving at the same moment

Record the manual checklist results here when done.
