# Reproduction and portability

Serve `assets/original-site` as an HTTP document root and open `/modules/stock/available-stock-analysis.html`. The browser UI needs SheetJS, ExcelJS, ECharts, and—only for the legacy engine—Pyodide from their configured CDNs. The default JavaScript engine and the packaged Python fallback are both preserved.

`assets/original-site/templates/stock_template.xlsx` is a structural/master-data template, not a generated result. Real Inventory, Daily Supply Plan, ODP, Orderfile, GitHub history, and credentials are deliberately excluded. Supply those files by upload. The complete current dual-stock-mode logic is in `calculation-logic.md`.

GitHub upload/history functions are optional external mutations; never use them without an explicit repository and user authorization. Run `python scripts/verify_package.py` before redistribution.
