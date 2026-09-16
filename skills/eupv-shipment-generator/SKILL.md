---
name: eupv-shipment-generator
description: Shipment Details generator that reads a Shipment Details Excel file and a PICKUP folder, expands rows by Pcs, matches shipment records to PICKUP records via a 4-key join, and writes a Processed_TCL sheet back to the workbook. Use this pattern when you need to merge shipping documents with pickup/delivery data and produce an expanded, matched output sheet. Platform-agnostic logic; originally implemented in Python with openpyxl.
---

# Shipment Details Generator — Generic Pattern

## 1. Inputs

| Input | Type | Script Parameter |
|---|---|---|
| Shipment Details file | `.xlsx` | `shipment_file` |
| PICKUP folder | Directory path | `pickup_folder` |
| Output sheet name | String (default: `Processed_TCL`) | `sheet_name` |

## 2. Column Detection (Alias Mapping)

Both Shipment Details and PICKUP files use alias-based column detection — column names are not fixed; the system tries multiple known names.

### Shipment Details Column Aliases

| Logical Field | Known Aliases |
|---|---|
| TCL REF | `TCL REFERENCE NO.`, `TCL REF`, `TCL REF NO` |
| B/L | `B/L no.`, `B/L No`, `BL No`, `B/L` |
| SKU | `Item no`, `SKU`, `New Ark SKU` |
| Product Name | `Product name`, `Product`, `Product Name` |
| Container | `Container no`, `Container No`, `Container` |
| Quantity | `Quantity`, `Qty` |
| Pallets | `Pallets`, `Pallet` |
| Pcs | `Pcs`, `PCS` |
| Pick Up Date | `Pick Up Date`, `Pickup Date` |
| Departure port | `Departure port`, `POL` |
| Final Destination | `Final Destination`, `PORT DESTINATION` |
| ETD date | `ETD date`, `ETD` |
| ETA date | `ETA date`, `ETA` |

### PICKUP Header Row Detection
PICKUP files may have headers on row 6, 5, 7, or other. The system tries each candidate header row until expected columns are found.

## 3. Processing Logic

### Step 1: Read and Detect Columns
- Shipment Details: header from row 1.
- PICKUP files: auto-detect header row (try 6 → 5 → 7 → ...).

### Step 2: Expand Shipment Rows by Pcs
- If `Pcs` is a positive integer N → split into N rows, each with Pcs=1.
- Original Pcs value preserved in `Container Nos` column.
- Split sequence number written to `??` column.

### Step 3: Match with PICKUP (4-Key Join)

**Join keys:**
1. TCL REF (normalized)
2. B/L (normalized)
3. SKU (normalized)
4. Product Name (normalized)

**Match rules:**
- Each PICKUP record is used **at most once** (consumed on match).
- On successful match, backfill: `Container no`, `Quantity`, `Pallets` from PICKUP record.
- Shipment rows may remain unmatched (no backfill).

### Step 4: Write Back to Workbook
- Delete existing sheet with the same output name (if any).
- Create new sheet with output layout.
- Auto-format: borders, centering, auto-fit column width.
- Write back to the **original Shipment Details file** (in-place update).

## 4. Output Field Layout

| # | Column | Source |
|---|---|---|
| 1 | TCL REFERENCE NO. | Shipment Details |
| 2 | Pick Up Date | Shipment Details |
| 3 | Item no | Shipment Details |
| 4 | Product name | Shipment Details |
| 5 | Departure port | Shipment Details |
| 6 | Final Destination | Shipment Details |
| 7 | B/L no. | Shipment Details |
| 8 | Container no | PICKUP (matched) |
| 9 | ETD date | Shipment Details |
| 10 | ETA date | Shipment Details |
| 11 | Quantity | PICKUP (matched) |
| 12 | Pallets | PICKUP (matched) |
| 13 | Container Nos | Shipment Pcs (original value) |
| 14 | ?? | Split sequence (1..N) |

## 5. Normalization Rules

- Text comparison: ignore leading/trailing spaces only (case-sensitive, content-sensitive).
- TCL REF: trim spaces.
- B/L: trim spaces.
- SKU: trim + uppercase.
- Product Name: trim spaces.

## 6. Formatting Rules

- Header row: bold, centered, with bottom border.
- Data cells: centered, with thin borders.
- Column width: auto-fit based on max content length.
- Date format: `YYYY-MM-DD`.

## 7. Reproduction Checklist

1. [ ] Read Shipment Details workbook (header row 1).
2. [ ] Read all PICKUP files in folder (auto-detect header row per file).
3. [ ] Normalize column names via alias mapping.
4. [ ] Expand rows where Pcs > 1 into individual rows.
5. [ ] Build PICKUP lookup index by 4-key composite.
6. [ ] For each expanded shipment row, attempt match; consume PICKUP record on match.
7. [ ] Backfill Container no / Quantity / Pallets on match.
8. [ ] Write output sheet with 14-column layout.
9. [ ] Apply Excel formatting (borders, centering, auto-width).
10. [ ] Save back to original file (in-place).