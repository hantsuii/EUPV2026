# Forecast accuracy calculation logic

## Input normalization

Read `Data`. Resolve aliases case-insensitively: `Month|Date`, `Sales Region|SalesRegion`, and `MW Weighted|MWWeighted`. `Series` is `Actuals` when it matches `actual` or `actuals` ignoring case; otherwise normalize it to `YYYY-MM`. Normalize target month to `YYYY-MM`, category to uppercase, and numbers after removing commas. A row is invalid when Series, target month, category, region, or MW is missing; forecast rows also require MW Weighted. Actual rows may fall back from missing weighted to MW because weighted is not used for actuals.

Supported horizons are M+1 (month 1, official MW), M+3 (month 3, official weighted), M+6 (month 6, official weighted), M+1–M+3 (sum months 1–3, official MW), and M+1–M+6 (sum months 1–6, official weighted). Offset 1 is the Series month itself (`start - 1` in code).

Only months strictly before the current month are complete. For reproducible historical runs, inject/freeze the same `now` date.

## Sample construction

Within category and region scope, aggregate actual MW by target month. Aggregate forecast MW and weighted MW by `Series + target month`. For every distinct Series, build the horizon's target-month set. Exclude the sample when any month is incomplete, any actual aggregate is missing, or the selected forecast basis is missing. Missing is different from numeric zero.

For each retained sample:

- `error = forecast - actual`
- `APE = abs(error) / abs(actual)`; null when actual is zero
- direction is over, under, or exact
- cumulative horizons sum forecast and actual over the entire window

## Summary metrics

- `WAPE = sum(abs(error)) / sum(abs(actual))`
- `Accuracy = max(0, 1 - WAPE)`
- `Bias = sum(error) / sum(abs(actual))`
- `Hit rate = count(APE <= 20%) / count(non-null APE)`
- variance is total forecast minus total actual

Do not average row-level accuracy or APE to produce WAPE.

## Region contribution diagnosis

Build one common all-region sample universe, then calculate each region on those same samples. A missing regional forecast is treated as zero so every region reconciles to the headline and forecast coverage gaps remain visible. Track actual months, covered actual months, missing forecast months, actual share, forecast share, and absolute-error contribution.

`regional WAPE = sum(regional absolute error) / abs(total regional actual)`.

`cancellation rate = max(0, 1 - headline absolute error / sum(regional absolute error))`; it measures errors offsetting across regions.

## Quality checks

Flag but do not remove duplicates grouped by Series, Country, Region, Category, and Month. Also report invalid rows, forecast targets earlier than Series, actual rows in incomplete months, duplicate extra rows, and the latest completed actual month. Compare MW and MW Weighted by rerunning identical sample construction with each basis.

## Output

Render category overview, KPI cards, horizon/accuracy trends, MW-versus-weighted comparison, region diagnosis, detail samples, and quality summary. CSV export uses the current analysis filters and includes Series, target period, actual, forecast, error, APE, direction, and basis.
