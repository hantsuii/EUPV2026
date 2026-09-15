# Source, provenance, and portability

- `scripts/po_check.py`: portable command-line reproduction and canonical automation entry point.
- `assets/logical_warehouse_list.xlsx`: warehouse mapping used by the source module.
- `assets/original-site/`: preserved browser implementation and local dependencies.
- `tests/test_po_check.py`: synthetic behavior tests with no real business data.

No purchase-order export, ODP MASTER data, generated result, Git history, token, or credential is included.

Serve `assets/original-site` as the HTTP root and open `/modules/po-check/po-check.html`. The browser UI loads SheetJS and ExcelJS from jsDelivr and requires network access; the Python implementation does not use a CDN.

Use Python 3.10+ and `openpyxl>=3.1,<4`. Inputs and outputs are `.xlsx` or `.xlsm`; legacy binary `.xls` is unsupported. The CLI is OS-neutral.

The Python implementation deliberately preserves physical-row filtering, content-based Approval Status detection, X-column adjacency, exact PO/SKU joins, one-day ETA tolerance, missing-PO escalation, and unchanged original ETA output. JSON and explicit nonzero failures are portability additions that do not alter calculations.
