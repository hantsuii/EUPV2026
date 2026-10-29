# Reproduction and portability

Serve `assets/original-site` as an HTTP document root and open `/modules/forecast/forecast-analysis.html`. Upload an FCST KPI workbook containing `Data`. The page runs locally and loads SheetJS and Plotly from jsDelivr.

`forecast-core.js` is the deterministic calculation engine and is also loadable through CommonJS. `calculation-logic.md` is the language-neutral specification. The evaluation cutoff depends on the current local month; freeze the `now` argument when reproducing a historic result. No forecast data is included. Run `python scripts/verify_package.py` before redistribution.
