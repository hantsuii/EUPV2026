---
name: eupv-stock-analysis
description: Available stock analysis module that merges inventory, daily supply plan, ODP transit, and to-be-allocated order data into a unified stock workbook with daily transit columns. Supports dual engines (JavaScript/ExcelJS and Python/openpyxl) with identical output. Use this pattern when you need to combine multiple supply-chain data sources into a single stock visibility workbook with MW conversion, zero-SKU filtering, and interactive visualization. Platform-agnostic logic.
---

# Available Stock Analysis — Generic Pattern

## 1. Input Sources

| Source | Required | Sheet Name | Header Row |
|---|---|---|---|
| Inventory | Yes | First sheet | Row 1 |
| Daily Supply Plan | Yes | First sheet | Row 1 |
| ODP | Optional | `Total Stcok` or `Total Stock` | Row 1 |
| Orderfile Base | Optional | First sheet | Row 2 |
| Stock Template | Yes (template) | Contains `SKU` sheet | Row 1 |

Upload files take priority; if not uploaded and "use default warehouse files" is checked, read from `templates/` directory.

**Default date range:** 2026-08-01 to 2026-12-31 (configurable).

## 2. SKU Master Data

### Sheet Selection
Priority: `SKU` → `SKU Mapping` → `Legacy Mapping Product` (case-insensitive). Fallback: first sheet.

### SKU Fields

| Output Field | Source Field |
|---|---|
| Category | Category |
| Brand | Brand |
| Product TCL Report | Level2 |
| Family | Level3 |
| Model | Product Model |
| Connector | Connector / CONNECTOR |
| Bin | Billable Watts(W) |
| MOQ | Total PCS per 40HQ Container |

**SKU key:** `Sku No`, normalized by trim + uppercase. Duplicates: keep first occurrence.

**Product display label:** `Model | SKU | Connector` (omit empty segments).

Unmatched SKU rows are kept in the workbook (marked `SKU not matched`) but excluded from visualization.

## 3. Source-Specific Extraction

### 3.1 Inventory (Spot Stock)
- Required: `Customer Model`, `Category`, `Available Stock`, `Sales Organization Name`, `Virtual Warehouse Name`, `Brand`
- **Exclude:** Brand=`Other`, Sales Org=`China`, Sales Org contains `Business Planning Department`, Virtual Warehouse contains `Arrival Plan`
- Group by: `(Customer Model, Category, Sales Organization Name)` → sum `Available Stock`
- **Sales org → WH map:** Netherlands→NL, France→FR, United Kingdom/UK→UK, Italy→IT, Spain→ES; unrecognized → first 2 chars uppercased

### 3.2 Daily Supply Plan (In-Transit)
- Required: `In-transit Warehouse(Code)`, `Customer Model`, `Supply Date`, `Available Quantity`
- WH identification via warehouse code (SPNL→NL, SPFR→FR, SPTN→FR, SPUK→UK, SPIT→IT, SPES→ES)
- Only keep Supply Date within configured date range
- Group by: `(Customer Model, WH, date)` → sum `Available Quantity`
- Source tag: `INV_DSP`

### 3.3 ODP (Domestic Unshipped)
- Read `Total Stcok` (fallback: `Total Stock`)
- Required: `New Ark WH`, `New Ark SKU`, `Quantity`, `ETA for New Ark Update`
- Skip: empty/NA/None WH, invalid/empty/1900-or-earlier ETA, ETA outside date range
- Group by: `(New Ark SKU, WH, ETA date)` → sum `Quantity`
- Source tag: `ODP`

### 3.4 To Be Allocated
- From Orderfile Base (header row 2)
- Filter: `Allocation Status = to be allocated`
- Required: `Material`(=SKU), `Ordered Qty`, `CRD`, customer name, SO, SO Line, Model, Factory
- Factory → WH via warehouse code mapping
- Group by: `(SKU, WH)` → sum `Ordered Qty`
- Keep order-level detail with CRD; add Connector from SKU master
- Skip detail rows where `Ordered Qty = 0`

## 4. Source Merging

Daily Supply Plan and ODP quantities accumulate to the same `(SKU, WH, date)` cell:
- If only one source → use that source's color
- If both sources on same day → sum quantities, tag as `MIXED`, use mixed color
- Record source provenance in `_Transit Source Map` sheet

**Color scheme:**
- INV_DSP: light blue (#DDEBFF)
- ODP: light orange (#FFE8CC)
- MIXED: light purple (#EBDCFF)

## 5. Zero-Quantity SKU Filtering

Build an **active SKU set** at SKU level (not row level):

```
activeSKU = set of SKUs where ANY of:
  - Inventory stock sum != 0
  - Date-range DSP/ODP transit sum != 0
  - To-be-allocated ordered qty sum != 0
```

**Rules:**
1. SKUs with zero across ALL four sources → excluded from `stock` sheet, visualization, charts, and detail tables.
2. If a SKU is active but has zero in a specific WH row → that row is kept (filter is SKU-level, not row-level).
3. If only To-be-allocated has quantity → create corresponding SKU/WH row.
4. To-be-allocated detail with `Ordered Qty = 0` → not output.
5. Defense: JS visualization layer re-filters; Python fallback also re-filters.

## 6. Stock Output Workbook

### Sheet: `stock`

Base columns (fixed order):
```
WH | Category | Brand | Product TCL Report | Family | SKU | Model | Connector | Bin | MOQ | To be allocated | Total QTY | Total MW | MW | Stock
```

After base columns: daily transit columns for each date in range, header format `YYYY.M.D`.

### Row Computations

```
To be allocated = sum of Ordered Qty for same SKU/WH
Transit Total = sum of all daily transit columns
Total QTY = Stock + Transit Total
MW = Stock × Bin / 1,000,000          (PV only)
Total MW = Total QTY × Bin / 1,000,000 (PV only)
```

- ESS/HP products: MW and Total MW left blank; only Quantity is relevant.
- To be allocated is NOT subtracted from Total QTY or Total MW.

### Other Sheets
- `To be allocated`: order-level detail with Connector added
- `_Transit Source Map`: provenance for each cell (source tag, DSP qty, ODP qty)
- Template's original master-data sheets are preserved.

## 7. Visualization

### Filter Cascade
```
WH → Category → Product TCL Report → Family → Product
```
Lower-level options rebuild from current upper-level selection only.

### Total Stock Overview
Three donut charts by status:
- **Inventory (in-stock)**: from Inventory source
- **Daily Supply Plan (in-transit)**: from DSP within date range
- **ODP (domestic unshipped)**: from ODP within date range

PV: Quantity × Bin → MW. ESS/HP: Quantity only.
Top total = sum of three statuses. To-be-allocated excluded.

Brand and Family multi-select filters (only PV/ESS with non-zero total).

### Stock Curve Chart
- Starts from Stock value
- Accumulates transit quantities by date (cumulative)
- Modes: Daily / Weekly (ISO week) / Monthly
- Views: `total` (all products) / `split` (per product, top 12 by end value) / `warehouse` (per WH)
- Source lines: Inventory/DSP, ODP, Mixed (cumulative transit)

### Detail Table (per Product)
```
In-stock = Stock value
In-transit(range) = sum of transit within date range
To be allocated = sum of ordered qty
Available Qty = In-stock + In-transit(range) - To be allocated
```

## 8. Dual Engine Architecture

### JavaScript (Default)
- SheetJS (0.18.5) for reading source files
- ExcelJS (4.4.0) for reading template, building output workbook, writing download file
- Visualization data passed directly from memory

### Python Legacy (Fallback)
- Pyodide executes `inventory_step1_to_stock.py`
- Uses openpyxl for all workbook operations
- Visualization data read from generated `stock` and `_Transit Source Map` sheets

**Both engines produce identical numerical output.** JS is preferred for speed; Python fallback preserves Excel metadata (custom names, external links, comments) that ExcelJS cannot fully retain.

## 9. Reproduction Checklist

1. [ ] Define SKU master sheet with required fields and SKU key normalization.
2. [ ] Implement four source extractors (Inventory, DSP, ODP, Orderfile) with their exclusion rules.
3. [ ] Merge DSP + ODP transit by (SKU, WH, date) with source tagging.
4. [ ] Build active SKU set (zero-quantity filter at SKU level).
5. [ ] Generate `stock` sheet with fixed column order + daily transit columns.
6. [ ] Compute Total QTY, MW (PV only), To be allocated.
7. [ ] Generate `To be allocated` detail and `_Transit Source Map` provenance sheets.
8. [ ] Build cascading filter UI: WH → Category → Product TCL Report → Family → Product.
9. [ ] Render stock overview donuts, cumulative stock curve, and detail table.
10. [ ] Provide downloadable workbook and optional Python fallback.