# Business Rules — AgriChain 360

_Started fresh on 2026-10-11 (owner decision). Rules are numbered permanently. A retired rule keeps its
number and is marked RETIRED._

**Status values:** `PLANNED` = agreed but not built · `POC` = proven in the proof of concept, to be
extended to all tables · `IMPLEMENTED` = built **and** covered by a passing test (named in the Test column).
A rule is never marked IMPLEMENTED just because it is written here.

**Enforcement:** every rule is enforced by the **backend**. The frontend may repeat a check for
convenience, but it never replaces the backend check.

---

## A. System-wide rules (BR-001 – BR-015)

| ID | Rule | Status | Test |
|---|---|---|---|
| BR-001 | Every write request is fully validated by the backend before anything is written. | POC | backend.test.js "validation" |
| BR-002 | Every protected action requires a verified Google sign-in belonging to an ACTIVE user in `tblUsers`. | POC | backend.test.js "Authentication" |
| BR-003 | Permission is checked on the server against the role matrix (section H) for every action. | POC | backend.test.js "Authorization" |
| BR-004 | Record IDs are issued from `tblSequences` under the write lock. They are never reused or derived from row numbers. | POC | "IDs are sequential and unique" |
| BR-005 | Every write carries a `request_id`. A repeated `request_id` returns the original result and writes nothing new. | POC | "repeated submission…" + live test 4b |
| BR-006 | An update must include the record's current `row_version`. If it is out of date, the update is rejected with `STALE_RECORD`. | PLANNED | |
| BR-007 | Records are never physically deleted. Master data is deactivated, and transactions are cancelled or reversed. | PLANNED | |
| BR-008 | Every successful create, update, deactivate or reactivate writes one audit row containing the changed fields (old → new). | POC | live test 4c |
| BR-009 | A write refused for permission reasons (`FORBIDDEN`) is recorded in the audit log with result REJECTED. | PLANNED | |
| BR-010 | Text beginning with `= + - @` is stored as plain text, never as a spreadsheet formula. | POC | "formula injection" |
| BR-011 | Quantities are stored in kg (≥ 0 unless a rule allows otherwise, up to 3 decimals). Money is in ₹ INR, rounded to 2 decimals. | PLANNED | |
| BR-012 | Error messages shown to users never contain stack traces, configuration names or internal data. | POC | "INTERNAL_ERROR without stack trace" |
| BR-013 | An INACTIVE master record cannot be selected for any new transaction, but it stays visible in history and reports. | PLANNED | |
| BR-014 | Reactivating a record re-runs its uniqueness checks. If an ACTIVE duplicate now exists, reactivation is refused. | PLANNED | |
| BR-015 | At least one ACTIVE ADMIN must always exist. An admin cannot deactivate or demote themselves. | PLANNED | |

## B. Users (BR-016 – BR-018)

| ID | Rule | Status | Test |
|---|---|---|---|
| BR-016 | A user's email is stored lowercase and is unique. | PLANNED | |
| BR-017 | Only ADMIN can create users, change roles, or deactivate and reactivate users. | PLANNED | |
| BR-018 | A role change takes effect on the user's next request. Roles are read fresh every time and never cached. | POC | (role read per request) |

## C. Crops and products (BR-019 – BR-022)

| ID | Rule | Status | Test |
|---|---|---|---|
| BR-019 | `crop_name` + `variety` is unique, ignoring case and extra spaces, across ACTIVE and INACTIVE crops. To reuse an inactive crop, reactivate it instead of creating a new one. | PLANNED | |
| BR-020 | A perishable crop or product must have `shelf_life_days` and must use the **FEFO** allocation policy. | PLANNED | |
| BR-021 | Creating a crop automatically creates exactly one RAW product, in the same locked operation. Deactivating or reactivating a crop does the same to its RAW product. | PLANNED | |
| BR-022 | Product names are unique. RAW products cannot be created or deleted by hand. FINISHED and BYPRODUCT products are created by ADMIN. | PLANNED | |

## D. Farmers and farmer–crop mapping (BR-023 – BR-029)

| ID | Rule | Status | Test |
|---|---|---|---|
| BR-023 | **Duplicate farmer, blocked:** an ACTIVE farmer with the same full name (ignoring case and spaces) **and** the same mobile already exists. | PLANNED | |
| BR-024 | **Possible duplicate, warned:** an ACTIVE farmer has the same mobile but a different name (families often share one phone). The save goes ahead only if the user confirms. | PLANNED | |
| BR-025 | A farmer cannot be saved without `consent_given = TRUE` and a `consent_date` that is not in the future. | PLANNED | |
| BR-026 | Mobile, pincode and state must match the formats in the data dictionary. | PLANNED | |
| BR-027 | A farmer's default collection centre, if given, must be ACTIVE. | PLANNED | |
| BR-028 | A farmer–crop mapping needs an ACTIVE farmer and an ACTIVE crop. Farmer + crop + season is unique among ACTIVE mappings. | PLANNED | |
| BR-029 | If a mapping's `area_acres` is larger than the farmer's `land_area_acres`, the user is warned and must confirm. | PLANNED | |

## E. Locations: warehouses, storage locations, collection centres (BR-030 – BR-035)

| ID | Rule | Status | Test |
|---|---|---|---|
| BR-030 | Warehouse names are unique. | PLANNED | |
| BR-031 | A storage location code is unique within its warehouse. The total capacity of ACTIVE locations cannot exceed the warehouse's capacity. | PLANNED | |
| BR-032 | A warehouse or location's capacity cannot be reduced below the stock it currently holds. *(Enforced from Phase 5.)* | PLANNED | |
| BR-033 | A warehouse or location that holds stock cannot be deactivated. *(Enforced from Phase 5.)* | PLANNED | |
| BR-034 | A warehouse cannot be deactivated while an ACTIVE collection centre is linked to it. | PLANNED | |
| BR-035 | Collection centre names are unique. A centre's linked warehouse must be ACTIVE. | PLANNED | |

## F. Customers, transporters, vehicles (BR-036 – BR-041)

| ID | Rule | Status | Test |
|---|---|---|---|
| BR-036 | A customer's GSTIN, if given, is unique and its first two digits match the customer's state code. | PLANNED | |
| BR-037 | Duplicate customer, blocked: an ACTIVE customer with the same name (ignoring case and spaces) and the same mobile already exists. | PLANNED | |
| BR-038 | `payment_terms_days` is between 0 and 180. | PLANNED | |
| BR-039 | Transporter names are unique. A transporter with ACTIVE vehicles cannot be deactivated. | PLANNED | |
| BR-040 | Vehicle registration numbers are stored uppercase without spaces, must match an Indian format, and are unique. | PLANNED | |
| BR-041 | A REEFER_TRUCK must be marked refrigerated. A vehicle's transporter must be ACTIVE. | PLANNED | |

## G. Units and data exchange (BR-042 – BR-043)

| ID | Rule | Status | Test |
|---|---|---|---|
| BR-042 | Display units (g, quintal, tonne) are converted to kg before saving. Only kg is stored. | PLANNED | |
| BR-043 | A master-data import is validated in full first. If **any** row has an error, **no** rows are written, and an error report lists every problem by row number. | PLANNED | |

---

## H. Role permissions — Phase 1 master data

**R** = read · **C** = create · **U** = update · **D** = deactivate/reactivate · **R\*** = read with mobile and
email masked (e.g. `98xxxxxx21`) · blank = no access

| Data | ADMIN | PROCUREMENT | QUALITY | WAREHOUSE | PROCESSING | SALES | LOGISTICS | MANAGEMENT | ANALYST |
|---|---|---|---|---|---|---|---|---|---|
| Users | RCUD | | | | | | | | |
| Crops, Products, Units | RCUD | R | R | R | R | R | R | R | R |
| Farmers, Farmer–crops | RCUD | RCUD | R | | | | | R | R\* |
| Collection centres | RCUD | R | R | R | | | | R | R |
| Warehouses | RCUD | R | R | R | R | R | R | R | R |
| Storage locations | RCUD | R | R | RCU | R | R | R | R | R |
| Customers | RCUD | | | | | RCUD | R | R | R\* |
| Transporters, Vehicles | RCUD | | | R | | R | RCUD | R | R |

Every signed-in ACTIVE user can call `whoami`. Export permissions are defined with the export feature.
