# Project Progress

_Last updated: 2026-10-11_

## Current phase
**Phase 0: Architecture and integration proof of concept**

## Current step
**Step 1: Integration proof of concept.** Code written and locally tested. **Waiting for the owner to
deploy it and run the manual checklist** (`docs/DEPLOYMENT.md`).

## Completed
- [x] Repository inspection (repository was empty apart from a one-line README)
- [x] Architecture feasibility report (`docs/ARCHITECTURE_FEASIBILITY.md`)
- [x] Architecture decision: Option A approved (`docs/DECISIONS.md` D-001)
- [x] POC backend + frontend + 34 automated tests passing

## Blocked / waiting on owner
- [ ] **Existing documentation** (ARCHITECTURE, DATABASE, DATA_DICTIONARY, BUSINESS_RULES BR-001…BR-169)
  is not in this repository. Its location is needed before data-model work (Phase 1).
- [ ] Manual POC deployment and checklist (needs owner's Google account)

## Pending (in order)
1. Confirm POC on real Google services
2. Write `docs/ARCHITECTURE.md` (after locating the existing version, to avoid a duplicate)
3. Reconcile data model and map BR-001…BR-169 to features and tests
4. Phase 1: Master data (Crop, Farmer, …)

## Known limitations of the POC
- Notes table is temporary and will be removed when real modules exist.
- Text that looks like a number in a note may be stored by Sheets as a number. Real modules will set
  plain-text column formats.
- Every backend change needs a manual paste and "New version" deploy (no `clasp` automation yet).
- Sign-in lasts about 1 hour (Google token lifetime). Reloading the page signs you out.
