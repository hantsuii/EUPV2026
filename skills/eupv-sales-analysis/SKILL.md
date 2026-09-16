---
name: eupv-sales-analysis
description: Browser-based sales analytics dashboard that reads an Excel workbook (Order details + Target sheets), computes revenue, target achievement rates, ASP (Average Selling Price), and product-mix trends across PV/ESS/HP categories. Use this pattern when you need to build a sales KPI dashboard with monthly/quarterly breakdowns, regional rollups, and product hierarchy analysis from order-level data. Platform-agnostic — any language (JS/Python) can reproduce the logic.
---

# Sales Change Analysis — Generic Pattern

## 1. Input Schema

### Order details Sheet (Required)

| Field | Type | Notes |
|---|---|---|
| Month | String/Date | `YYYY-MM` or Excel serial |
| Quartely | String | `Q1`–`Q4` |
| Year | Number | 4-digit year |
| Region | String | Sales region name |
| Country | String | |
| Category | String | `PV`, `ESS`, `HP` |
| Brand | String | |
| Level1 | String | Product hierarchy level 1 |
| Level2 | String | Product hierarchy level 2 |
| Revenue EUR | Number | Negative = returns |
| Order Status2 | String | `invoiced` = confirmed revenue; `confirm` = pending |
| Total MW | Number | PV quantity in MW |
| TCL Report Product | String | Used for ESS qty eligibility |
| Product Mid Category | String | Used for ESS qty eligibility |
| Unit Price * Qty | Number | Used for ESS qty eligibility |
| Ordered Qty | Number | Order quantity |
| Customer Level 6 NAME | String | Customer name (or aliases) |

### Target Sheet (Required)

Same month/region structure, with `Revenue EUR` and `Quantity` targets.

## 2. Region Rollup Map

Both actuals and targets use the same region consolidation:

| Source Region | Rolled-up Region |
|---|---|
| Italy & Adriatics Region | Italy Region |
| Germany & Austria Region | DACH Region |
| Emerging Market | Central and Eastern Europe Region |
| lberia Region | Southern Europe Region |

## 3. Row Normalization

For each Order details row:

1. Parse `Month` → normalize to `YYYY-MM`.
2. Parse `Year` from row or derive from month.
3. Parse `Quarter` from `Quartely` field or derive from month.
4. Map `Region` through rollup map.
5. Determine `category` (PV/ESS/HP) via `Category` field uppercased.
6. Determine `invoiced` / `confirm` from `Order Status2`.
7. Compute derived fields:
   - `pvAmount` = revenue if PV, else 0
   - `essAmount` = revenue if ESS, else 0
   - `pvQty` = Total MW if PV, else 0
   - `essQty` = Ordered Qty if ESS-eligible (see rules), else 0
   - `hpQty` = Ordered Qty if HP, else 0

### ESS Quantity Eligibility

Only count Ordered Qty when ALL of:
- `Category = ESS`
- `Unit Price * Qty` is present and non-zero
- `Product Mid Category = HYBRID INVERTER` OR `TCL Report Product` in {`ENERGY+_KIT GEN1`, `ENERGY+_KIT`, `TCL`}

## 4. KPI Computation

### Revenue Cards
- **Invoiced Revenue** = sum(Revenue EUR) where Order Status2 = "invoiced"
- **Pending Revenue** = sum(Revenue EUR) where Order Status2 = "confirm"
- **Total Revenue** = sum(Revenue EUR) for all rows

### Achievement Rate
```
achievement = actual_sum / target_sum * 100
```
**Rule:** Always aggregate actuals and targets separately first, then divide. Never average per-row achievement rates.

### ASP (Average Selling Price)
- **PV ASP** = PV Revenue EUR / (PV MW × 1,000,000), in €/W
- **ESS ASP** = ESS Revenue EUR / ESS Sets, in €/Set
- PV and ESS ASP charts are shown separately; never mix units.
- ASP charts apply independent cascading filters: Region → Brand → Level1 → Level2.

## 5. Dashboard Layout

### Total Dashboard Tab
- **Row 1:** Full-year core metrics (revenue pair, PV MW pair, ESS Sets pair, BP rate)
- **Row 2:** Future metrics (2027+)
- **Row 3:** H1 metrics
- **Row 4:** Open-quarter progress table (quarter total → 3 months, each row: invoiced/pending/total/BP/inv-rate/total-rate/PV-MW/ESS-Sets)

### Regional Dashboard Tab
- Card per region: total amount, BP amount, BP achievement (invoiced/total), share, PV/ESS metrics.
- "View Details" opens a modal with that region's full Total Dashboard.

### Product Analysis Tab
- Filters: Category, Brand, analysis level (Level1 OR Level2, not both), level values (multi-select).
- Metric selector: Sales Revenue / PV MW / ESS Sets.
- Outputs: period total, leading product, leading product share, latest MoM, monthly stacked trend, product share chart, ranking table.

### Customer Analysis Tab (Optional Extension)
- Region selector → product line → customer search.
- Customer activity: active (ordered in last 3 months), sleeping (4-6 months), risk (>6 months).
- Value segments: high value, frequent, potential, new, maintain.
- Top 10 concentration, customer ranking, product mix.

## 6. Month/Quarter Normalization

```javascript
function normalizeMonth(value) {
  // Accept: "2026-03", "2026.3", "26-03", Excel serial, Date
  // Return: "YYYY-MM"
}
function normalizeQuarter(value, fallbackMonth) {
  // Accept: "Q1".."Q4", derive from month if missing
}
```

## 7. Cascading Filter Pattern

All multi-select filters follow the same cascade rule:

> When an upper-level filter changes, lower-level options are rebuilt from only the rows that match the current upper-level selection. Previous lower-level selections that no longer exist are cleared.

Implementation:
```
WH → Category → Product TCL Report → Family → Product
Region → Brand → Level1 → Level2
```

## 8. Reproduction Checklist

1. [ ] Read Excel with SheetJS (`XLSX.read`, `sheet_to_json`).
2. [ ] Normalize rows: parse month/year/quarter, map regions, determine category/quantity.
3. [ ] Aggregate actuals and targets separately, then compute achievement rates.
4. [ ] Build PV ASP and ESS ASP with independent cascading filters.
5. [ ] Total Dashboard → Regional Dashboard → Product Analysis → Customer Analysis.
6. [ ] Open-quarter detection based on browser's current date.
7. [ ] All text flows through i18n layer (zh/en).
8. [ ] Charts use Plotly.js; tables are server-rendered HTML.

## 9. Boundary Rules

- Profit is never computed.
- Product-Sub/category targets are kept in source data but only aggregated to region level.
- Target region mapping uses the workbook's `Region` field; no secondary Country-to-Region derivation.
- Revenue amounts display in 万€ (10k EUR); ASP displays in €/W or €/Set.