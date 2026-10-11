# AgriChain 360 — Architecture Feasibility Report

Status: **DRAFT — awaiting owner decision.** Nothing in this report has been implemented or tested yet.
Date: 2026-10-11

---

## 1. Repository inspection (what actually exists)

| Item | Expected (per master prompt) | Found |
|---|---|---|
| Repository | `AgriValueChain-360` (possibly on Codeberg) | `github.com/Rajdeep130/AgriValueChain` (GitHub, no Codeberg remote) |
| Commits | Incremental history | 1 commit: `bd32e7f Initial commit` |
| Branches | — | `main`, `claude/festive-johnson-dt2q30` (identical) |
| README.md | Project overview | 1 line: `# AgriValueChain` |
| .gitignore | Present | **Missing** |
| docs/ARCHITECTURE.md | Present | **Missing** |
| docs/DATABASE.md | Present | **Missing** |
| docs/DATA_DICTIONARY.md | Present | **Missing** |
| docs/BUSINESS_RULES.md (BR-001…BR-169) | Present | **Missing** |
| docs/PROJECT_SCOPE.md | Maybe | **Missing** |
| Frontend / Apps Script / tests / sample data / config | — | **None** |

**Conclusion:** The documentation described in the master prompt is not in this repository. It might be in
another repository (for example, the Codeberg copy) or another folder, or it might never have been committed.
It must be located before the data model is designed, because the prompt requires building on it and not
recreating it.

---

## 2. Answers to the ten feasibility questions

### Q1. Can a GitHub Pages frontend reliably talk to a Google Apps Script web app?
**Yes, but only with a specific pattern, and a proof of concept must confirm it.**
- GitHub Pages serves static files only. It cannot run Apps Script. `google.script.run` (the built-in
  Apps Script bridge) only works inside pages that Apps Script serves itself (HTML Service). It will
  **not** work from GitHub Pages.
- The browser therefore has to call the web app's `/exec` URL with `fetch()`.
- This is known to work only when the web app is deployed as **Execute as: Me** and
  **Who has access: Anyone**, which means anonymous access. With "Anyone with a Google account" or domain-only access, the
  browser is sent to a Google login page that cross-origin `fetch()` cannot follow.
- Because the endpoint is then publicly reachable, **every request must carry a verifiable identity
  token and the backend must reject anything without one** (see Q9).

### Q2. CORS, redirects and deployment settings
- Apps Script answers `/exec` with a **302 redirect** to `script.googleusercontent.com`. `fetch()` follows it
  automatically, and the final response allows cross-origin reads.
- Apps Script **cannot answer CORS "preflight" (OPTIONS) requests**. So requests must be "simple":
  - `POST` with `Content-Type: text/plain` (the JSON goes in the body as text), or `GET`.
  - **No custom headers.** That includes `Authorization`, so the token travels inside the JSON body.
- Every code change requires a **new deployment version**. Editing a `.gs` file locally or in GitHub does
  not update the live backend. A sync tool (`clasp`) plus a manual deploy step is needed and will be
  documented in `docs/DEPLOYMENT.md`.
- Consumer (gmail.com) accounts show a "created by a Google Apps Script user" banner on HTML Service pages.
  GitHub Pages avoids this.

### Q3. Can an Excel workbook be the live database?
**Not reliably for this application.** Excel is a file format, not a multi-user transactional database.
It has no server-side locking that our backend controls, no transactions, no foreign-key enforcement,
and anyone with file access can edit cells directly and bypass every business rule.

### Q4. Excel stored locally
**Not possible.** A deployed web app (GitHub Pages or Apps Script) runs in the browser and on Google's
servers. Neither can read a file on your personal computer. A local workbook would only work for a
single-user desktop tool, which is not the project goal.

### Q5. Excel in OneDrive / SharePoint via Microsoft Graph
Technically possible, but it adds a lot of work:
- Register an app in **Microsoft Entra ID (Azure AD)**.
- Grant permissions: delegated `Files.ReadWrite` (acts as a signed-in user), or application
  `Files.ReadWrite.All` / `Sites.Selected` (SharePoint/OneDrive for Business only, needs admin consent).
- Implement an OAuth 2.0 flow in Apps Script using the community OAuth2 library, and store refresh tokens securely in
  Script Properties.
- Use the Graph **workbook** endpoints (`/workbook/tables/{name}/rows`, workbook sessions).
- **Unverified for your account type:** whether the Graph Excel workbook API supports your specific
  storage location (personal OneDrive or business tenant) must be tested before relying on it.

### Q6. Can Apps Script safely and reliably use that Excel store?
**Not with the reliability this project requires.**
- Every read and write is a remote HTTP call (`UrlFetchApp`) that counts against the daily URL-fetch quota.
- Calls are slow, often hundreds of milliseconds to seconds each, and can be throttled. Multi-table operations like
  "receive goods → create batch → write inventory ledger" become many separate calls with no rollback.
- Apps Script `LockService` can stop two *script* executions from colliding. It cannot stop a person editing the
  workbook in Excel Online or desktop at the same moment.
- Token expiry, consent revocation and Microsoft throttling become new failure modes.

### Q7. Two users updating the same record at the same time
Planned design for the recommended architecture:
1. **`LockService.getScriptLock()`** around every write. Writes run one at a time, and short reads do not need the lock.
2. **ID generation under the lock** from a counter table (`tblSequences`), never "last row + 1".
3. **Optimistic version check:** each record carries `row_version`. An update sent with an old version is
   rejected with `STALE_RECORD`, and the user reloads instead of silently overwriting someone else's work.
4. **Idempotency key:** the frontend sends a unique `request_id` with every write. A repeated submission
   (double-click, network retry) returns the original result instead of creating a duplicate.
5. **Multi-step operations** are validated completely *before* any write and then written in a fixed order.
   A `tblOperationsJournal` entry lets a reconciliation job detect and repair half-finished operations.
   Spreadsheet writes are **not** atomic, and the design does not pretend otherwise.

### Q8. Quotas and limits (Google consumer account; Workspace limits are higher)
Approximate published limits, to be re-checked against Google's current quota page during the proof of concept:

| Limit | Approx. value | Impact |
|---|---|---|
| Script runtime per execution | 6 minutes | Large imports/reports must be chunked |
| Simultaneous executions | ~30 per user/script | Fine for a small team |
| URL Fetch calls/day | ~20,000 | Token verification must be cached |
| Triggers total runtime/day | ~90 minutes | Scheduled jobs must be light |
| Email recipients/day | ~100 | Alerts via email must be limited |
| Google Sheets cells per spreadsheet | 10 million | Ample for V1, and archive old ledger rows later |
| Script lock wait | up to 30 s configurable | Writes serialize, which is acceptable at small scale |

Practical expectation: about 1–3 seconds per request, suitable for a small business or demo. It is not a
high-volume system, and the "future scalability" section of ARCHITECTURE.md will say so.

### Q9. Authentication and authorization
Proposed model (works for both GitHub Pages and HTML Service):
1. User clicks **"Sign in with Google"** (Google Identity Services) on the frontend.
2. Google gives the browser a short-lived, signed **ID token**. The OAuth *client ID* is public. **No
   secret ever goes in frontend code.**
3. Every request body includes the ID token.
4. The backend verifies the token with Google, checking the signature, the `aud` value (our client ID), expiry and
   `email_verified`. It caches the result briefly to save quota.
5. The backend looks up the verified email in `tblUsers` and finds the user's role (ADMIN, PROCUREMENT, …).
   Unknown or inactive users are rejected.
6. Every function checks a server-side **permission matrix** (role × entity × action). Hiding buttons is
   only cosmetic.
- No passwords are stored anywhere.
- Why not `Session.getActiveUser()`: for consumer gmail accounts with "Execute as me" it returns blank. With
  "Execute as user accessing", every user would need edit rights to the spreadsheet, which would
  let them bypass the backend.
- The data spreadsheet is shared with **nobody** except the owner account.

### Q10. Simplest reliable Version 1 architecture
See Section 4.

---

## 3. Options compared

| Criterion | **A. Google-first** (Sheets live, Excel import/export) | **B. Excel-first** (Graph API) | **C. HTML Service only** (A without GitHub Pages) |
|---|---|---|---|
| Keeps Apps Script backend | ✅ | ✅ (with OAuth to Microsoft) | ✅ |
| Excel as data format | ✅ import/export/backup | ✅ live | ✅ import/export/backup |
| Native, fast data access | ✅ `SpreadsheetApp` | ❌ remote HTTP per call | ✅ |
| Server-controlled locking | ✅ | ⚠️ partial only | ✅ |
| Direct-edit bypass risk | Low (sheet not shared) | High (workbook editable in Excel) | Low |
| Extra accounts/registrations | Google OAuth client ID | Google + Microsoft Entra app + OAuth library | Google OAuth client ID |
| Hosting on GitHub Pages | ✅ via `fetch` + text/plain (needs POC) | ✅ same constraints | ❌ hosted on script.google.com |
| Beginner complexity | Medium | **High** | Lowest |
| Recommended | **Yes** | No | Fallback if POC fails |

---

## 4. Recommendation for Version 1

**Option A — Google-first, with GitHub Pages frontend, proven by a proof of concept first.**

```
Browser (GitHub Pages: HTML/CSS/JS)
   │  POST text/plain {action, payload, id_token, request_id}
   ▼
Google Apps Script Web App (doPost router)
   ├─ Auth: verify Google ID token → tblUsers → role
   ├─ Validation + business rules
   ├─ LockService + optimistic versioning + idempotency
   ├─ Audit log
   ▼
Google Sheet "AgriChain360_DB" (one tab per tbl*, shared with no one)
   │
   ├─ Excel (.xlsx) export: on demand + scheduled backups to a private Drive folder
   └─ Excel (.xlsx) import: parsed in the browser → validated by the backend → error report
```

- **Source of truth:** the Google Sheet. Excel files are controlled copies (exports, backups) or
  controlled inputs (imports through validation). They are never a competing editable database.
- Table names stay `tbl*`, so the design maps one-to-one onto Excel tables in exports.
- **Fallback:** if the proof of concept shows GitHub Pages ↔ Apps Script is unreliable, the same frontend code is
  served via Apps Script HTML Service (Option C) with minimal changes.

### Proposed first implementation step (only after approval)
**Step 1 — Integration proof of concept**, covering items 1–7 from master prompt §5.3:
a single HTML page on GitHub Pages and a minimal Apps Script `doPost`. It will cover sign-in, a read, a write under lock,
a rejected unauthenticated call, and a handled network failure. It will produce test evidence before any
business module is built.

---

## 5. Open items requiring the owner

1. **Location of the existing documentation** (ARCHITECTURE, DATABASE, DATA_DICTIONARY, BUSINESS_RULES
   BR-001…BR-169). It is not in this repository.
2. **Approval of Option A** (Google Sheets live store, Excel as import/export/backup format).
3. Later, for the proof of concept: a Google account to own the Apps Script project and Sheet, and permission to
   enable GitHub Pages on this repository.
