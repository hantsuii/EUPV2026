---
name: eupv-odp-shipping
description: ODP shipping analysis module that evaluates voyage lead times (P70/P85/P90), route performance, three business time perspectives (order/departure/arrival month), operational KPIs, and POPV merge detection from PV SUPPLY DATA workbooks. Use this pattern when you need to analyze shipping lane reliability, compute percentile lead times, or detect mergeable shipment records. Platform-agnostic logic.
---

# ODP Shipping Analysis — Generic Pattern

## 1. Input Schema

### Primary Sheet: `PV SUPPLY DATA`

Key fields (alias-based detection):

| Field | Aliases | Notes |
|---|---|---|
| TCL REFERENCE | TCL REFERENCE NO. | Order ID, encodes order month |
| POL | PORT OF LOADING | Loading port |
| PORT DESTINATION | | Discharge port |
| New Ark SKU | | Product SKU |
| Model | | Product model |
| Quantity | QTY | Must be > 0 to enter analysis |
| ATD PORT | | Actual Time of Departure |
| ATA PORT | | Actual Time of Arrival |
| ETD On S/O | | Scheduled ETD |
| ETA On S/O | | Scheduled ETA |
| ETD Update | | Updated ETD |
| ETA Update | | Updated ETA |
| STATUS | | Contains planned pickup week (Wxx) |
| Booking | | Booking reference |
| MBL/HBL# | | Bill of lading |
| POPV | | Merge group ID (fallback: SPTN-PVHK New Ark PO#) |
| B/L Consignee | | Consignee |
| New Ark WH | | Warehouse code |
| Assumption ATP | | Existing assumptions |

### Secondary Sheets (Historical)
- `H2-2025 PV DATA` and `H1-2025 PV DATA` — used only for route P90 percentile calculation.
- `H1-2026 PV DATA` — historical snapshot, not re-read.

### Stock Template (Optional)
- `SKU` sheet from stock template provides `Sku No → Product Model` mapping for Model display in monthly views.

## 2. Data Deduplication

- Deduplicate by `TCL REFERENCE` across sheets; current main sheet (`PV SUPPLY DATA`) takes priority.
- `Quantity <= 0` → excluded from analysis.
- Quantity empty/invalid → counted separately and reported.

## 3. Port Mapping

### Normalization
1. Trim whitespace and uppercase.
2. Look up in mapping table.
3. Compound destinations: take text after last hyphen (e.g., `ROTTERDAM-CORK` → `CORK`).

### Default Mapping
Maintained as a static list with fields: `{ type: "POL"|"DEST", raw, standard, country, note }`.

### User Overrides
- Stored in `localStorage` as JSON.
- Export/import as JSON file.
- User mappings override defaults.

## 4. Voyage and Lead Time

### Voyage Definition
- Route = standardized `POL → PORT DESTINATION`
- Lead Time = `ATA PORT - ATD PORT` (calendar days)
- Merge same voyage by: `POL + destination port + ATD + ATA + vessel/voyage` (vessel missing → use Booking)

### Statistical Requirements
- A route shows statistics only when: cumulative ≥ 10 containers AND ≥ 5 independent voyages
- **P90**: empirical nearest-rank percentile of individual voyage lead times
- Other percentiles (P70, P85) follow same method

### User Date Range
- Filter by ATD date
- Port filters (POL/POD) only affect page tables and charts, NOT the Assumption ATP export

## 5. Three Business Time Perspectives

### 5.1 Order Month
- Parsed from `TCL REFERENCE` (e.g., `25SEP...` → `2025-09`)
- If year prefix missing: infer from anchor date (pickup/ETD/ATD/ETA)
- Group by: `orderMonth + Model + standardPOL + standardPOD + SKU`
- Output: orderMonth, Model, POL, POD, SKU, planned pickup week, actual departure week, MW, Containers
- Weeks shown in two rows: week numbers / container counts per week

### 5.2 Departure Month (Shipping Calendar Month)
- Group by: `month + Model + standardPOD + SKU + actual/forecast`
- Actual if `ATD PORT` exists; forecast if `ETD Update` or `ETD On S/O` exists

### 5.3 Arrival Month
- Group by: `month + Model + standardPOD + SKU + actual/forecast`
- Priority: `ATA PORT` → `ETA Update` → `ETA On S/O`
- Mark actual vs forecast

**All three views use only `PV SUPPLY DATA`** (historical sheets only for P90).
Each view supports independent start-month, end-month, and Model search multi-select filters.

## 6. Assumption ATP P90 Output

For routes meeting the threshold:

| Column | Source/Logic |
|---|---|
| Index | Sequential |
| PORT OF LOADING | Standard POL |
| PORT DESTINATION | Standard POD |
| New Ark WH | From existing Assumption ATP for same port pair |
| in Days | `CEILING(P90_days / 7) * 7` (conservative whole-week) |
| in Weeks | `CEILING(P90_days / 7)` |
| Customs+Leg3 | From existing Assumption ATP |
| Comments | "Sample insufficient" if below threshold |

## 7. Operational Performance KPIs

Counted per **independent voyage** (not per TCL reference — avoids double counting same vessel):

| KPI | Formula |
|---|---|
| On-time departure | `ATD - ETD On S/O <= 0` |
| Departure delay ≤ 7d | `ATD - ETD On S/O <= 7` |
| Arrival delay ≤ 7d | `ATA - ETA On S/O <= 7` |
| Latest ETA accuracy | `ABS(ATA - ETA Update) <= 7` |
| Transit median | median(voyage lead times) |
| Transit P90 | percentile(voyage lead times, 0.9) |

## 8. POPV Merge Check

### Detection
1. Filter rows where `POPV` is empty AND `MBL/HBL#` has a value.
2. Group by `MBL/HBL#` — keep groups with ≥ 2 rows.

### Comparison Fields
`New Ark SKU`, `Model`, `B/L Consignee`, `POL`, `PORT DESTINATION`

### Display Fields
All comparison fields + `TCL REFERENCE` + `QUANTITY` (shown but not compared).

### Verdict
- All fields match → "Can be merged" + show combined quantity.
- Any field differs → "Please verify" + list specific differing fields.

Source row numbers are shown for traceback.

## 9. Week Computation

### Planned Pickup Week
1. Parse `Wxx` from STATUS field.
2. Fallback: `isoWeek(ETD On S/O - 7 days)`.
3. Year resolution: pick year whose Monday of that week is closest to anchor date.

### Actual Departure Week
- `isoWeek(ATD PORT)` if available.

### ISO Week Algorithm
```
d = date + 4 - (day_of_week || 7)  // Thursday of this week
year = d.year
week_1_monday = Jan 4 of year - (day_of_week(Jan 4) - 1)
week_number = floor((d - week_1_monday) / 7) + 1
```

## 10. Reproduction Checklist

1. [ ] Read `PV SUPPLY DATA` + historical sheets; deduplicate by TCL REFERENCE.
2. [ ] Normalize port names via mapping table + user overrides.
3. [ ] Build voyages (merge by POL+POD+ATD+ATA+vessel/booking).
4. [ ] Compute lead times; apply route thresholds (≥10 containers, ≥5 voyages).
5. [ ] Compute P70/P85/P90 via empirical nearest-rank percentile.
6. [ ] Generate three monthly views (order/departure/arrival) with actual/forecast split.
7. [ ] Output Assumption ATP with conservative whole-week days.
8. [ ] Compute operational KPIs per independent voyage.
9. [ ] Detect POPV merge candidates (empty POPV + duplicate B/L, compare 5 fields).
10. [ ] Support port mapping export/import and localStorage persistence.