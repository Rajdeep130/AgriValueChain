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

### 2026-10-11 — Step 1: live tests on real Google services (owner, in browser)

Frontend: https://rajdeep130.github.io/AgriValueChain/ · Backend: Apps Script web app "POC v1"

| # | Test | Result |
|---|---|---|
| 1 | Ping from GitHub Pages to Apps Script (cross-origin POST, text/plain, redirect) | ✅ `pong` with server time |
| 2 | Protected call without sign-in | ✅ `UNAUTHENTICATED` |
| 3 | Google sign-in → backend verifies token → role from `tblUsers` | ✅ `ADMIN`, `U000001` |
| 4 | Write note | ✅ `NOTE000001` written to `tblPocNotes`. The **first attempt timed out in the browser after 20 s but had saved on the server** |
| 4b | Re-submit after timeout (same `request_id`) | ✅ still exactly **one** row (duplicate protection works) |

**Problem found:** a 20-second browser timeout is too short for a first write after a quiet period.
**Fix:** timeout raised to 45 s, and a timed-out write now tells the user a retry is safe (test added: 35/35 pass).

**Setup issue found:** the Client *secret* was first entered as `GOOGLE_CLIENT_ID`, so every sign-in was
rejected (`UNAUTHENTICATED`). Fixed by entering the Client ID. DEPLOYMENT.md Part C warns about this.

### NOT yet verified (needs the owner's Google account)

- Read notes, audit-log row, validation, network-failure and FORBIDDEN (non-ADMIN) checks on live services
- GitHub Pages publishing workflow
- Behaviour with two people saving at the same moment

Record the manual checklist results here when done.
