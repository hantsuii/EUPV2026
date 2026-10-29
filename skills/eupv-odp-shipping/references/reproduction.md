# Reproduction and portability

Serve `assets/original-site` as an HTTP document root and open `/modules/odp/odp-shipping-analysis.html`. The page processes the selected ODP workbook locally and loads SheetJS from jsDelivr. `port-mapping.js` contains the default mapping; browser overrides live in local storage and can be imported/exported as JSON.

The optional packaged `stock_template.xlsx` supplies the SKU-to-model mapping when the user does not upload a stock workbook. It contains master data, not an ODP transaction dataset. Current calculations are documented in `calculation-logic.md`, including route thresholds, nearest-rank percentiles, monthly views, P90 output, performance KPIs, and POPV merge checks. Run `python scripts/verify_package.py` before redistribution.
