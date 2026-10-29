# Reproduction and portability

The authoritative runnable implementation is under `assets/original-site`. Serve that directory as an HTTP document root and open `/modules/sales/sales-change-analysis.html`; do not use a `file://` URL. The page reads user-selected Excel files locally in the browser and sends no workbook data to a server. It loads SheetJS and Plotly from jsDelivr, so the preserved UI needs internet access unless those libraries are vendored.

Required input sheets are `Order details` and `Target`. The complete current calculations, filters, field fallbacks, target handling, ASP rules, customer activity, and order-analysis rules are in `calculation-logic.md`. Source code is authoritative for field aliases and presentation details. Run `python scripts/verify_package.py` before redistribution.

No sales workbook or real business data is included.
