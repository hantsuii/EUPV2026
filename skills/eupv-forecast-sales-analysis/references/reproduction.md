# Reproduction and portability

Serve `assets/original-site` as an HTTP document root and open `/modules/forecast-sales/forecast-sales-analysis.html`. Upload a Country FCST workbook containing `Conso` and a sales workbook containing `Order details`. The page runs locally in the browser and loads SheetJS and Plotly from jsDelivr.

`forecast-sales-core.js` is the deterministic calculation engine and supports CommonJS loading for independent tests. The complete business rules are in `calculation-logic.md`. No forecast or sales data is included. Run `python scripts/verify_package.py` before redistribution.
