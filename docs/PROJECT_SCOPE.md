# Project Scope — AgriChain 360 (Version 1)

_Status: Draft for owner review · 2026-10-11_

## Purpose
A working, traceable agricultural value chain system for a **small Indian agri-business** (or portfolio
demonstration). It follows produce from the farmer through procurement, quality, storage, processing, sales
and delivery, and reports on operations.

## Operating assumptions (approved by owner, 2026-10-11)
| Topic | Decision |
|---|---|
| Country / currency | India, ₹ INR (2 decimal places) |
| Base quantity unit | **Kilogram (kg)** for all stock; screens may show g, quintal (100 kg) or tonne (1000 kg) |
| Crop categories | Grains, pulses, fruits, vegetables, oilseeds, spices, dairy and other |
| Time zone | Asia/Kolkata (IST) for business dates; UTC timestamps for audit |
| Users | Small team (up to ~25 named users), each with one role |
| Data store | Private Google Sheet (see `DECISIONS.md` D-001) |

## In scope for Version 1
1. Master data: crops, products, farmers, farmer–crop mapping, collection centres, warehouses,
   storage locations, customers, transporters, vehicles, units, users
2. Procurement: purchase orders (header + lines) and physical receipts, separately
3. Quality inspection: accepted, rejected and held quantities, grade and parameters
4. Batches (lots) and full upstream/downstream traceability
5. Inventory ledger: receipts, issues, transfers, blocks and releases, adjustments, reservations, FIFO/FEFO
6. Processing: inputs, finished outputs, by-products, losses, yield
7. Wastage with reason codes and approval thresholds
8. Sales orders (header + lines), allocation and reservation
9. Shipments with partial dispatch and delivery, shortage and damage
10. Payables and payment **tracking** (no money transfer)
11. Alerts and approvals
12. Dashboard and reports with documented KPI formulas
13. Excel import (validated) and export; scheduled Excel backups

## Out of scope for Version 1
- Real bank transfers, UPI or payment-gateway integration
- Storing **Aadhaar** numbers (restricted by the Aadhaar Act; not needed for these workflows)
- Live external data (mandi prices, weather, maps), which may come later after verification
- AI features, mobile apps, offline mode, multi-company or multi-currency
- GST invoicing and e-way bills (GSTIN is stored for reference only)
- Count-based items such as eggs (everything is stocked in kg; see Known limitations)

## Personal data
Farmer and customer records contain personal data. India's Digital Personal Data Protection Act 2023 applies.
V1 collects only what the workflows need, and records consent on the farmer record. Access is
role-restricted and exports are permission-controlled. Bank details are deferred to the Payments phase and
will be stored masked.

## Known limitations (accepted)
- Milk and liquids are stocked in kg. A product may define `kg_per_litre` (e.g. 1.03) for display only.
- Google Sheets performance limits the system to small-business volumes (tens of thousands of rows per table).
- Writes are serialized with a lock, so expect 2–10 seconds per save.
