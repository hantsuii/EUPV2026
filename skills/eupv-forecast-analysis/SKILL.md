---
name: eupv-forecast-analysis
description: Forecast accuracy analysis module that compares monthly sales forecasts (M+1, M+3, M+6, and cumulative windows) against completed-month actuals. Computes WAPE, bias, hit rate, and compares MW vs MW Weighted bases. Use this pattern when you need to evaluate forecast precision across horizons, categories, and regions from a single FCST KPI workbook. Platform-agnostic logic.
---

# Sales Forecast Accuracy — Generic Pattern

## 1. Input Schema

### Data Sheet (Required)

A single `Data` worksheet with these columns (aliases supported):

| Field | Aliases | Type | Notes |
|---|---|---|---|
| Series | — | String | `Actuals` or forecast version month `YYYY-MM` |
| Month | Date | — | Target month being forecasted |
| Category | — | String | `PV`, `ESS`, `HP` (uppercased) |
| Sales Region | SalesRegion | String | |
| Country | — | String | |
| MW | — | Number | Megawatt value |
| MW Weighted | MWWeighted | Number | Weighted MW value |

## 2. Horizon Definitions

| Horizon ID | Start | End | Kind | Official Basis |
|---|---|---|---|---|
| M1 | 1 | 1 | point | MW |
| M3 | 3 | 3 | point | MW Weighted |
| M6 | 6 | 6 | point | MW Weighted |
| M1_3 | 1 | 3 | window | MW |
| M1_6 | 1 | 6 | window | MW Weighted |

**Point horizons** evaluate a single target month offset from the Series month.
**Window horizons** sum across the range of months.

`officialBasis` determines which value column to use for official metrics. Users can override to `mw` or `weighted`.

## 3. Row Normalization

```
For each source row:
  seriesText = cleanText(Series)
  isActual = /actuals?/i.test(seriesText)
  series = isActual ? "Actuals" : normalizeMonth(Series)
  month = normalizeMonth(Month or Date)
  category = cleanText(Category).toUpperCase()
  region = cleanText(Sales Region)
  mw = toNumber(MW)
  weighted = toNumber(MW Weighted) || mw (if missing)

Invalid if: missing series, month, category, region, mw, or (non-actual && missing weighted)
```

### Month Normalization

Accepts: `YYYY-MM`, `YYYY.MM`, `YY-MM`, `YYM(M)`, Excel serial dates, Date objects.
Output: `YYYY-MM` string.

### Month Index

```
monthIndex("2026-03") = 2026 * 12 + 3 - 1 = 24314
addMonths("2026-03", 3) = "2026-06"
```

## 4. Actual vs Forecast Separation

### Actuals
- Only **completed months** (month < current month) are included.
- Aggregated by month: sum MW across all actual rows for that month.

### Forecasts
- Keyed by `series|month` (e.g., `"2025-09|2026-03"` = September 2025 forecast for March 2026).
- Aggregated: sum MW and sum MW Weighted separately.
- Track `hasMw` and `hasWeighted` flags.

## 5. Sample Construction

For a given horizon (e.g., M3) and basis (e.g., weighted):

```
For each forecast series S:
  targetMonths = [addMonths(S, horizon.start-1), ..., addMonths(S, horizon.end-1)]
  
  Skip if ANY targetMonth is not a completed month (notComplete++)
  
  actualValue = sum of actuals for all targetMonths
  forecastValue = sum of forecast[S|month][basis] for all targetMonths
  
  Skip if any actual missing (missingActual++)
  Skip if any forecast missing or basis field missing (missingForecast++)
  
  error = forecastValue - actualValue
  APE = |actual| == 0 ? null : |error| / |actual|
  direction = error > 0 ? "over" : error < 0 ? "under" : "exact"
  
  sample = { series, periodStart, periodEnd, actual, forecast, error, ape, direction, basis }
```

## 6. Summary Metrics

```
WAPE = sum(|error_i|) / sum(|actual_i|)          // Weighted Absolute Percentage Error
Accuracy = max(0, 1 - WAPE)
Bias = sum(error_i) / sum(|actual_i|)             // Signed bias
Hit Rate = count(|APE_i| <= threshold) / count(APE_i != null)   // Default threshold = 0.2 (±20%)
Variance = sum(forecast) - sum(actual)
```

## 7. Multi-Dimensional Analysis

### By Category
```
categories = ["PV", "ESS", "HP"].filter(c => rows.some(r => r.category === c))
For each category: analyze(rows, { ...options, category, region: "__ALL__" })
```

### By Region
```
regions = unique regions in scoped rows (matching category)
For each region: analyze(rows, { ...options, region })
Filter out regions with 0 samples
```

## 8. Data Quality Checks

| Check | Description |
|---|---|
| Invalid rows | Missing required fields (series, month, category, region, mw, weighted) |
| Negative horizon rows | Forecast where target month < series month |
| Incomplete actuals | Actual rows for months that haven't ended yet |
| Duplicate groups | Same Series + Country + Region + Category + Month appears multiple times |
| Complete through | Last fully-completed actual month |

**Duplicate rule:** Duplicates are summed, not removed. The quality report flags them but does not deduplicate.

## 9. MW vs MW Weighted Comparison

Run the same samples with `basis = "mw"` and `basis = "weighted"`, then compare WAPE values side-by-side. Lower WAPE = better predictive basis.

## 10. Output Structure

### Category Overview Table
| Category | Samples | Actual (MW) | Forecast (MW) | Variance | WAPE | Accuracy | Bias | Hit Rate |

### Region Comparison Table
| Region | Samples | WAPE | Accuracy | Bias | Hit Rate |

### Detail Table
| Series | Target Period | Actual | Forecast | Error | APE | Direction |

### Trend Chart
- X-axis: actual sales month
- Y-axis: WAPE accuracy
- Multiple curves per horizon/series
- Region filter and start-month filter

## 11. Reproduction Checklist

1. [ ] Read `Data` sheet from FCST KPI workbook.
2. [ ] Normalize rows with alias-based field detection.
3. [ ] Separate Actuals (completed months only) from Forecasts (keyed by series|month).
4. [ ] For each horizon, build samples by pairing forecast series with target months.
5. [ ] Compute WAPE, Accuracy, Bias, Hit Rate at summary level.
6. [ ] Provide category-level and region-level breakdowns.
7. [ ] Run MW vs Weighted comparison.
8. [ ] Generate data quality report (invalid, negative, incomplete, duplicates).
9. [ ] Export detail samples as CSV.
10. [ ] Only evaluate completed months — never include current or future months as actuals.