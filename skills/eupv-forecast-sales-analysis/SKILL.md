---
name: eupv-forecast-sales-analysis
description: Compare PV Country FCST with European invoiced and confirmed sales by month, region, stage, and normalized product group; calculate historical accuracy, sales velocity, product mix, and a bias-adjusted demand reference. Use for the EUPV forecast-versus-actual module or when reproducing its Country FCST and EU DG sales methodology. Do not apply its PV product grouping to unrelated catalogs without explicit mapping review.
---

# EUPV Forecast vs Actual Sales

Use the packaged deterministic browser core instead of recreating product grouping or demand formulas ad hoc.

## Inputs

- Country FCST workbook with `Conso`.
- EU DG sales workbook with `Order details`.

Read [references/calculation-logic.md](references/calculation-logic.md) before analysis or implementation. It defines PV scope, European exclusions, Stage normalization, product grouping, forward order comparison, accuracy, velocity, and demand-reference fallbacks. Read [references/reproduction.md](references/reproduction.md) for runtime and portability.

## Required behavior

- Restrict both sources to PV and restrict actuals to FCST-recognized product groups.
- Keep zero-forecast products in the forecast product universe.
- Use only invoiced sales for historical actuals; show confirm separately for future orders.
- Freeze the supplied forecast values for completed-month backtesting.
- Calculate WAPE from aggregate absolute error, not average row APE.
- Include zero-sales months in 1/3/6-month velocity windows.
- Apply the documented bias clamp, confidence factor, weighted recent actual baseline, and fallback hierarchy exactly.

The exact implementation is under `assets/original-site/`. Serve it over HTTP and upload both workbooks. No business data is packaged. Run `python scripts/verify_package.py` after any change.
