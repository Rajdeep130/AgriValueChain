# Data Dictionary — AgriChain 360

_Status: Draft for owner review · 2026-10-11 · Covers Phase 0 (system) and Phase 1 (master data).
Later phases are detailed when each phase starts._

**Type key:** `ID` system-issued key · `FK→tbl` reference to an ACTIVE record in that table ·
`TEXT(a–b)` trimmed text of a to b characters · `ENUM` one value from the listed set · `INT` whole number ·
`NUM(d)` number with up to d decimals · `BOOL` TRUE or FALSE · `DATE` YYYY-MM-DD ·
`TS` UTC timestamp (system) · **Req** Y = required, N = optional, S = set by the system.

**Standard columns** on every master table (not repeated below):
`status` ENUM(ACTIVE, INACTIVE) S · `created_at` TS S · `created_by` email S · `updated_at` TS S ·
`updated_by` email S · `row_version` INT S

**Shared formats**
- **Mobile:** 10 digits, starting with 6–9. Stored without +91, spaces or dashes.
- **Pincode:** 6 digits, not starting with 0.
- **State:** one of the 36 values in the Appendix.
- **GSTIN:** 15 characters matching `^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$`, stored uppercase.
- **Names:** spaces trimmed and repeated spaces collapsed. Duplicate checks ignore case.

---

## Phase 0 — System tables

### tblSequences: ID counters (edited only by the system)
| Field | Type | Req | Rules |
|---|---|---|---|
| sequence_name | TEXT | Y | Unique, e.g. `FARMER` |
| prefix | TEXT | Y | e.g. `F` |
| last_number | INT | S | Increases by 1 under the lock. Never decreases |

### tblUsers
| Field | Type | Req | Rules |
|---|---|---|---|
| user_id | ID (U) | S | |
| email | TEXT | Y | Lowercase. Unique. Must be a Google account |
| display_name | TEXT(2–60) | Y | |
| role | ENUM | Y | ADMIN, PROCUREMENT, QUALITY, WAREHOUSE, PROCESSING, SALES, LOGISTICS, MANAGEMENT, ANALYST |
| *standard columns* | | | |

### tblAuditLog: append-only
| Field | Type | Req | Rules |
|---|---|---|---|
| timestamp | TS | S | |
| user_email | TEXT | S | Verified sign-in email |
| action | ENUM | S | CREATE, UPDATE, DEACTIVATE, REACTIVATE, plus workflow actions in later phases |
| entity | TEXT | S | Table name |
| entity_id | TEXT | S | |
| request_id | TEXT | S | |
| result | ENUM | S | SUCCESS, REJECTED |
| details | TEXT | S | JSON of changed fields `{"field": [old, new]}`. Never contains tokens |

### tblRequestLog: duplicate-submission protection
| Field | Type | Req | Rules |
|---|---|---|---|
| request_id | TEXT | S | Unique. From the browser |
| action | TEXT | S | |
| user_email | TEXT | S | |
| entity_id | TEXT | S | Record created or changed |
| created_at | TS | S | Rows older than 30 days may be archived |

---

## Phase 1 — Master data

### tblUnits: display units (seeded, read-only)
| unit_code | unit_name | kg_per_unit |
|---|---|---|
| G | Gram | 0.001 |
| KG | Kilogram | 1 |
| QTL | Quintal | 100 |
| TONNE | Tonne | 1000 |

### tblCrops
| Field | Type | Req | Rules |
|---|---|---|---|
| crop_id | ID (C) | S | |
| crop_name | TEXT(2–60) | Y | e.g. Wheat |
| variety | TEXT(0–60) | N | e.g. Sharbati. **crop_name + variety must be unique** |
| local_name | TEXT(0–60) | N | e.g. Gehun |
| category | ENUM | Y | GRAIN, PULSE, VEGETABLE, FRUIT, OILSEED, SPICE, DAIRY, OTHER |
| is_perishable | BOOL | Y | Defaults to TRUE for VEGETABLE, FRUIT and DAIRY |
| shelf_life_days | INT(1–3650) | Y if perishable | |
| storage_condition | ENUM | Y | AMBIENT, COOL, COLD, FROZEN. DAIRY defaults to COLD |
| allocation_policy | ENUM | Y | FIFO or FEFO. Defaults to **FEFO if perishable**, otherwise FIFO |
| raw_product_id | FK→tblProducts | S | The crop's RAW product, created automatically |
| *standard columns* | | | |

### tblProducts
| Field | Type | Req | Rules |
|---|---|---|---|
| product_id | ID (PR) | S | |
| product_name | TEXT(2–80) | Y | Unique. RAW products are named after their crop, e.g. "Wheat – Sharbati (Raw)" |
| product_type | ENUM | Y | RAW, FINISHED, BYPRODUCT |
| crop_id | FK→tblCrops | Y if RAW | Source crop. Optional for FINISHED or BYPRODUCT |
| is_perishable · shelf_life_days · storage_condition · allocation_policy | | Y | Same rules as crops. A RAW product copies its crop's values |
| pack_size_kg | NUM(3) > 0 | N | Empty means sold in bulk. e.g. 5 for a 5 kg bag |
| kg_per_litre | NUM(3) 0.5–2 | N | Display conversion for liquids only, e.g. milk 1.03 |
| is_sellable | BOOL | Y | |
| reorder_level_kg | NUM(3) ≥ 0 | N | A low-stock alert fires when available stock falls below it |
| hsn_code | TEXT | N | 4, 6 or 8 digits (reference only) |
| *standard columns* | | | |

### tblFarmers
| Field | Type | Req | Rules |
|---|---|---|---|
| farmer_id | ID (F) | S | |
| full_name | TEXT(2–100) | Y | |
| relative_name | TEXT(0–100) | N | Father's or husband's name, as used locally (S/o, W/o) |
| gender | ENUM | N | FEMALE, MALE, OTHER, UNDISCLOSED |
| mobile | Mobile | Y | See duplicate rules BR-023 and BR-024 |
| alternate_mobile | Mobile | N | |
| village | TEXT(2–60) | Y | |
| tehsil | TEXT(0–60) | N | Tehsil, taluka or block |
| district | TEXT(2–60) | Y | |
| state | ENUM | Y | Appendix |
| pincode | Pincode | Y | |
| land_area_acres | NUM(2) 0–10000 | N | |
| default_collection_centre_id | FK→tblCollectionCentres | N | |
| consent_given | BOOL | Y | **Must be TRUE** to save (data-protection consent) |
| consent_date | DATE | Y | Not in the future |
| remarks | TEXT(0–500) | N | |
| *standard columns* | | | |

### tblFarmerCrops
| Field | Type | Req | Rules |
|---|---|---|---|
| farmer_crop_id | ID (FC) | S | |
| farmer_id | FK→tblFarmers | Y | |
| crop_id | FK→tblCrops | Y | |
| season | ENUM | Y | KHARIF, RABI, ZAID, PERENNIAL, YEAR_ROUND. **farmer + crop + season unique while ACTIVE** |
| area_acres | NUM(2) > 0 | N | Should not exceed the farmer's land area (warning) |
| expected_quantity_kg | NUM(3) ≥ 0 | N | |
| *standard columns* | | | |

### tblWarehouses
| Field | Type | Req | Rules |
|---|---|---|---|
| warehouse_id | ID (WH) | S | |
| warehouse_name | TEXT(2–80) | Y | Unique |
| warehouse_type | ENUM | Y | MAIN, COLD_STORE, COLLECTION_POINT, PROCESSING_UNIT |
| address | TEXT(0–200) | N | |
| district · state · pincode | | Y | |
| capacity_kg | NUM(3) > 0 | Y | |
| manager_user_id | FK→tblUsers | N | |
| *standard columns* | | | |

### tblStorageLocations
| Field | Type | Req | Rules |
|---|---|---|---|
| location_id | ID (SL) | S | |
| warehouse_id | FK→tblWarehouses | Y | |
| location_code | TEXT(1–20) | Y | `A-Z 0-9 -` only, e.g. `A-01`. Unique within its warehouse |
| storage_condition | ENUM | Y | AMBIENT, COOL, COLD, FROZEN |
| capacity_kg | NUM(3) > 0 | Y | Total of ACTIVE locations ≤ the warehouse's capacity |
| *standard columns* | | | |

### tblCollectionCentres
| Field | Type | Req | Rules |
|---|---|---|---|
| collection_centre_id | ID (CC) | S | |
| centre_name | TEXT(2–80) | Y | Unique |
| village_or_town | TEXT(2–60) | Y | |
| district · state · pincode | | Y | |
| linked_warehouse_id | FK→tblWarehouses | Y | Where received stock is stored |
| incharge_user_id | FK→tblUsers | N | |
| mobile | Mobile | N | |
| *standard columns* | | | |

### tblCustomers
| Field | Type | Req | Rules |
|---|---|---|---|
| customer_id | ID (CU) | S | |
| customer_name | TEXT(2–100) | Y | |
| customer_type | ENUM | Y | RETAILER, WHOLESALER, PROCESSOR, EXPORTER, INSTITUTION, INDIVIDUAL |
| contact_person | TEXT(0–100) | N | |
| mobile | Mobile | Y | |
| email | TEXT | N | Valid email format |
| gstin | GSTIN | N | Unique if given. The first 2 digits must match the state code |
| address | TEXT(0–200) | N | |
| district · state · pincode | | Y | |
| payment_terms_days | INT 0–180 | Y | Default 0 (cash) |
| *standard columns* | | | |

### tblTransporters
| Field | Type | Req | Rules |
|---|---|---|---|
| transporter_id | ID (TR) | S | |
| transporter_name | TEXT(2–100) | Y | Unique. Use "Own Fleet" for company vehicles |
| contact_person | TEXT(0–100) | N | |
| mobile | Mobile | Y | |
| gstin | GSTIN | N | |
| *standard columns* | | | |

### tblVehicles
| Field | Type | Req | Rules |
|---|---|---|---|
| vehicle_id | ID (VH) | S | |
| registration_no | TEXT | Y | Stored uppercase without spaces. Normal format `^[A-Z]{2}[0-9]{1,2}[A-Z]{0,3}[0-9]{4}$` (e.g. MH12AB1234) or BH-series `^[0-9]{2}BH[0-9]{4}[A-Z]{1,2}$`. Unique |
| transporter_id | FK→tblTransporters | Y | |
| vehicle_type | ENUM | Y | THREE_WHEELER, PICKUP, TRUCK, TRACTOR_TROLLEY, REEFER_TRUCK, OTHER |
| capacity_kg | NUM(3) > 0 | Y | |
| is_refrigerated | BOOL | Y | TRUE is required for REEFER_TRUCK |
| *standard columns* | | | |

---

## Appendix — State / UT values and GST state codes
| Code | Value | Code | Value | Code | Value |
|---|---|---|---|---|---|
| 35 | ANDAMAN_AND_NICOBAR | 04 | CHANDIGARH | 37 | ANDHRA_PRADESH |
| 12 | ARUNACHAL_PRADESH | 18 | ASSAM | 10 | BIHAR |
| 22 | CHHATTISGARH | 26 | DADRA_NAGAR_HAVELI_DAMAN_DIU | 07 | DELHI |
| 30 | GOA | 24 | GUJARAT | 06 | HARYANA |
| 02 | HIMACHAL_PRADESH | 01 | JAMMU_AND_KASHMIR | 20 | JHARKHAND |
| 29 | KARNATAKA | 32 | KERALA | 38 | LADAKH |
| 31 | LAKSHADWEEP | 23 | MADHYA_PRADESH | 27 | MAHARASHTRA |
| 14 | MANIPUR | 17 | MEGHALAYA | 15 | MIZORAM |
| 13 | NAGALAND | 21 | ODISHA | 34 | PUDUCHERRY |
| 03 | PUNJAB | 08 | RAJASTHAN | 11 | SIKKIM |
| 33 | TAMIL_NADU | 36 | TELANGANA | 16 | TRIPURA |
| 09 | UTTAR_PRADESH | 05 | UTTARAKHAND | 19 | WEST_BENGAL |

_That is 28 states and 8 union territories. The GST codes are used only to cross-check a GSTIN against the state._
