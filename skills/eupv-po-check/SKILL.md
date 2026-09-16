---
name: eupv-po-check
description: Compare a purchase-order export with an EUPV ODP MASTER workbook and produce traceable PO-level and SKU-level checks for PO type, ETA, TCL Reference, warehouse, SKU presence, and quantity. Use when the request mentions EUPV PO Check, purchase order head/line, New Ark PO data, or reproducing the EUPV2026 PO-check module. Platform-agnostic — the business logic can be reproduced in any language.
---

# EUPV PO Check — Generic Pattern

## 1. Input Schema

### Purchase Order Workbook (Required)

Must contain two sheets: `purchase order head` and `purchase order line`.

**purchase order head** required fields:
- `purchase order Number`
- `Purchase Type`
- `TMS bill Number / voucher bill Number`
- `Customer Po`
- `Category`
- `Estimated time of arrival`
- `Status`
- `Approval Status` (auto-detected — see §3)
- `Note` (and the column after Note = X-column = TCL Reference)

**purchase order line** required fields:
- `Purchase order Number`
- `Customer Model` (= SKU)
- `Qty`

### EUPV ODP MASTER Workbook (Required)

Must contain `PO Check` sheet with fields:
- `TCL REFERENCE`
- `New Ark PO Type`
- `New Ark SKU`
- `QUANTITY`
- `SPTN-PVHK New Ark PO#`
- `NewArk ETA PO`
- `ETA for New Ark update`

### Warehouse Mapping (Optional)
Defaults to packaged `logical_warehouse_list.xlsx`; can be overridden.

## 2. Approval Status Auto-Detection

The purchase order export has a known column-offset issue. The `Approval Status` header position is unreliable. Detection logic:

1. Scan all cells in each row for values matching `Approved` or `Approving` (case-insensitive).
2. The column containing these values is the actual Approval Status column.
3. The **next physical column** to the right is the X-column (used as TCL Reference / Note).

This avoids hardcoding column positions.

## 3. Scope Rules

- **All purchase order rows enter validation** — no filtering by Status or Approval Status.
- `Status = In Stock` rows are **hidden from page display** but still validated and appear in download.
- `Approving` POs are kept in all checks; missing `NewArk ETA PO` is marked N/A for that check.

## 4. PO-Level Checks (Per PO)

For each PO, match to `PO Check` by `Purchase order Number ↔ SPTN-PVHK New Ark PO#`:

### 4.1 Purchase Type Mapping
| PO Check: New Ark PO Type | Purchase order head: Purchase Type |
|---|---|
| Internal | Internal |
| Offshore | Offshore purchase |
| ongoing B/L change | Internal |

### 4.2 ETA Checks
- Compare `Estimated time of arrival` (PO) vs `NewArk ETA PO` (PO Check)
- Compare `Estimated time of arrival` (PO) vs `ETA for New Ark update` (PO Check)
- **1-day tolerance:** difference ≤ 1 day = pass

### 4.3 ETA Adjustment Logic
- If a PO has exactly **one unique non-empty** `ETA for New Ark update` AND it differs from PO ETA:
  - Result: `有差异` (Has Difference)
  - Tag: "Needs ETA adjustment"
  - Color: green
  - Proposed ETA written to `PO Check Results` (not to `PO Details` original)
- If a PO has **multiple different** `ETA for New Ark update` values:
  - Result: `需复核` (Needs Review)
  - No auto-selection of ETA

### 4.4 TCL Reference Check
- Clean TCL Reference from two sources: `Customer Po` and X-column.
- Merge + deduplicate.
- Compare against the set of all `PO Check.TCL REFERENCE` for that PO.
- A PO with multiple PO Check rows must fully match the set.

### 4.5 SKU and Quantity Check
1. Aggregate `purchase order line` by `Purchase order Number + Customer Model` → sum `Qty`.
2. Aggregate `PO Check` by `SPTN-PVHK New Ark PO# + New Ark SKU` → sum `QUANTITY`.
3. Verify: each SKU exists in both, and aggregated quantities match.

## 5. Result Sorting Priority

1. `需复核` (Needs Review) — purple, top
2. ETA-adjustment `有差异` (Has Difference) — green
3. Other `有差异` — orange
4. `通过` (Passed)

## 6. Download Workbook Layout

### Sheet 1: `PO Details` (fixed 9 columns, fixed order)
```
Purchase order Number | Purchase Type | TMS bill Number / voucher bill Number |
Customer Po | Category | Estimated time of arrival | Status | Approval Status | Note
```
- All POs retained (including In Stock).
- ETA always uses original PO value (never the proposed ETA).
- Note = X-column value.

### Sheet 2: `PO Check Results`
Per-PO validation results with: PO number, type, ETA comparison, TCL Reference match, overall verdict, proposed ETA, SKU, Model.

### Sheet 3: `SKU Qty Results`
Per-PO + SKU quantity comparison.

### Sheet 4: `Summary`
Counts: total POs, passed, differences, review-required, excluded; type mapping table.

## 7. Page Display
- Compact row height.
- Pagination: 25/50/100 rows per page (default 50).
- Result filter + scope filter.
- `SKU` and `Model` columns added to result table.
- Bilingual labels (zh/en) via shared i18n.

## 8. Reproduction Checklist

1. [ ] Read purchase order head + line sheets.
2. [ ] Auto-detect Approval Status column from cell values.
3. [ ] Identify X-column (next physical column after Approval Status).
4. [ ] Match POs to PO Check by PO number.
5. [ ] Run all 5 checks per PO (type, 2× ETA, TCL Ref, SKU+qty).
6. [ ] Apply 1-day ETA tolerance.
7. [ ] Handle single-update ETA (green adjustment) vs multi-update ETA (purple review).
8. [ ] Sort results by priority.
9. [ ] Output 4-sheet workbook with fixed column orders.
10. [ ] Keep all PO rows (hide In Stock on page, keep in download).
11. [ ] Never overwrite original ETA in PO Details.