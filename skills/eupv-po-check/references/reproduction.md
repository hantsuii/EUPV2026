# Reproduction and portability

Use `scripts/po_check.py` for a portable deterministic run, or serve `assets/original-site` and open `/modules/po-check/po-check.html` for the preserved browser UI. The CLI supports `.xlsx`/`.xlsm`, optional JSON output, and Chinese/English XLSX labels. Install `requirements.txt` when `openpyxl` is unavailable.

The packaged logical-warehouse workbook is required master data. No purchase-order or ODP transaction data is included. `calculation-logic.md` is the normalized specification; `source-business-logic.md` preserves the repository's original business document. Run both `python scripts/verify_package.py` and `python -m unittest discover -s tests -v` after changes.
