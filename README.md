# AgriValueChain

**AgriChain 360** is an agricultural value chain management system. It covers farmer registration, procurement,
quality, batch traceability, inventory, processing, sales, logistics and analytics.

> **Status:** Phase 0, the integration proof of concept. No business modules are built yet.
> See [docs/PROGRESS.md](docs/PROGRESS.md).

## Architecture (Version 1)

| Part | Technology | Folder |
|---|---|---|
| Frontend | HTML, CSS, JavaScript on GitHub Pages | `frontend/` |
| Backend | Google Apps Script web app | `backend/` |
| Live data | Private Google Sheet (one tab per table) | created by `setupPocDatabase()` |
| Excel | Import / export / backup format | planned |

Details: [docs/ARCHITECTURE_FEASIBILITY.md](docs/ARCHITECTURE_FEASIBILITY.md) and
[docs/DECISIONS.md](docs/DECISIONS.md).

## Quick start

- Run automated tests: `npm test` (Node.js 20+; nothing to install)
- Deploy the proof of concept: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)
- Test results: [docs/TESTING.md](docs/TESTING.md)
