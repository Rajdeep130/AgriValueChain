# Project Progress

_Last updated: 2026-10-11_

## Current phase
**Phase 1: Master data (design)**

## Current step
**Step 2: Data model design.** `PROJECT_SCOPE.md`, `DATABASE.md`, `DATA_DICTIONARY.md` (Phase 0–1) and
`BUSINESS_RULES.md` (BR-001–BR-043) are drafted. **Waiting for owner review.**

## Completed
- [x] Repository inspection (repository was empty apart from a one-line README)
- [x] Architecture feasibility report (`docs/ARCHITECTURE_FEASIBILITY.md`)
- [x] Architecture decision: Option A approved (`docs/DECISIONS.md` D-001)
- [x] POC backend + frontend + automated tests passing (35)
- [x] POC verified live: GitHub Pages ↔ Apps Script, Google sign-in, role check, write, duplicate protection, audit log
- [x] Owner decisions: start fresh; India/INR; kg; all crop categories

## Blocked / waiting on owner
- [ ] Review of the data model design (Step 2)
- [ ] Merge PR #3 (timeout fix + design docs)
- [ ] Delete the exposed OAuth client secret in Google Cloud

## Pending (in order)
1. Step 3: shared backend building blocks (generic create/update/deactivate, row_version, request log, permission matrix)
2. Step 4: Crop + Product master (first real module, end-to-end with tests)
3. Then Farmer → Farmer–crop → Warehouse → Storage location → Collection centre → Customer → Transporter → Vehicle
4. Write `docs/ARCHITECTURE.md` and `docs/SECURITY.md`

## Known limitations of the POC
- Notes table is temporary and will be removed when real modules exist.
- Text that looks like a number in a note may be stored by Sheets as a number. Real modules will set
  plain-text column formats.
- Every backend change needs a manual paste and "New version" deploy (no `clasp` automation yet).
- Sign-in lasts about 1 hour (Google token lifetime). Reloading the page signs you out.
