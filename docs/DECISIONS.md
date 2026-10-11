# Decision Log

Each entry records what was decided, why, and what we gave up.

## D-001 — Google Sheets is the live data store; Excel is the import/export/backup format
- **Date:** 2026-10-11 · **Status:** Approved by owner
- **Why:** A deployed web app cannot reach a local Excel file. Excel in OneDrive/SharePoint needs Microsoft
  Graph, a second sign-in system, slow remote calls, no server-controlled locking, and users could edit
  cells directly and bypass business rules. Apps Script works natively and quickly with Google Sheets.
- **Trade-off:** Excel is no longer edited live. It is produced by exports/backups and accepted through
  validated imports. See `ARCHITECTURE_FEASIBILITY.md`.

## D-002 — Frontend on GitHub Pages, calling Apps Script with `fetch`
- **Date:** 2026-10-11 · **Status:** Approved, pending proof-of-concept confirmation
- Requests are `POST` with `Content-Type: text/plain` and no custom headers, because Apps Script cannot
  answer CORS preflight requests. The web app is deployed "Execute as: Me / Access: Anyone".
- **Fallback:** serve the same frontend from Apps Script HTML Service if the POC fails.

## D-003 — Identity via Google Sign-In ID token in the request body
- **Date:** 2026-10-11 · **Status:** Approved, pending POC
- The backend verifies the token with Google and checks audience, issuer, expiry and verified email. It then maps the
  email to an ACTIVE row in `tblUsers` for the role. No passwords are stored. The spreadsheet is shared
  with no one.
- Rejected: `Session.getActiveUser()` (blank for Gmail users when executing as owner), and
  "execute as user accessing" (every user would need direct edit access to the data).

## D-004 — Write safety pattern
- **Date:** 2026-10-11 · **Status:** Implemented in POC
- All writes run inside the script lock. IDs come from `tblSequences` under the lock. Every write carries a
  client `request_id` so a repeated submission is saved once. Validation happens before any write.
  Text starting with `= + - @` is stored as plain text (formula-injection protection).
- `request_id` must start with a letter so Sheets never converts it to a number or date.
- Planned for business modules: `row_version` for stale-update detection and an operations journal for
  multi-step operations. These are not built yet.

## D-005 — GitHub Pages publishes via GitHub Actions from `frontend/`
- **Date:** 2026-10-11 · **Status:** Implemented (not yet enabled)
- Pages' simple branch mode only publishes the repository root or `/docs`, and `/docs` holds documentation.
  The workflow runs the tests first, then publishes `frontend/`.
