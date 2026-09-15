---
name: eupv-po-check
description: Compare a purchase-order export with an EUPV ODP MASTER workbook and produce traceable PO-level and SKU-level checks for PO type, ETA, TCL Reference, warehouse, SKU presence, and quantity. Use when the request mentions EUPV PO Check, purchase order head/line, New Ark PO data, or reproducing the EUPV2026 PO-check module. Do not use for unrelated purchase-order reconciliation formats without first mapping their columns to this schema.
---

# EUPV PO Check

Run the packaged deterministic implementation instead of recreating the business logic ad hoc.

## Required inputs

- Purchase-order workbook containing `purchase order head` and `purchase order line`.
- EUPV ODP MASTER workbook containing `PO Check`.
- Warehouse mapping defaults to `assets/logical_warehouse_list.xlsx`; accept another mapping workbook only when the user supplies one.

Before running unfamiliar files, read [references/input-output-spec.md](references/input-output-spec.md). For questions about results, exceptions, or parity with the source module, read [references/calculation-logic.md](references/calculation-logic.md).

## Run

From this skill directory:

```text
python scripts/po_check.py --purchase <purchase.xlsx> --odp <odp.xlsx> --output <result.xlsx> --json-output <result.json>
```

On Windows, use `py` when `python` is only the Microsoft Store alias. Install `requirements.txt` into an isolated environment if `openpyxl` is unavailable.

Use `--language en` for English result labels; the default is Chinese. Use `--warehouse <mapping.xlsx>` only to override the packaged mapping.

## Required behavior

- Preserve all purchase-order head rows in `PO Details`, including `Status = In Stock`.
- Never overwrite the original purchase ETA in `PO Details`; put a proposed ETA only in `PO Check Results`.
- Treat a one-day ETA difference as passing.
- Detect the actual Approval Status column from `Approved` / `Approving` cell values; use its next physical column as X-column TCL Reference.
- Keep `Approving` POs in every check, but mark missing `NewArk ETA PO` as not applicable for that check.
- Sort PO results: review required, ETA-adjustment difference, other difference, passed.
- Report missing POs as review-required, not as ordinary differences.

Do not silently rename sheets, guess missing required columns, alter type mappings, or omit failed rows. If the input schema differs, report the missing fields and ask for a mapping.

## Outputs and verification

The XLSX must contain `PO Details`, `PO Check Results`, `SKU Qty Results`, and `Summary`. If JSON is requested, it must contain the same PO/SKU results plus summary counts.

After changes to the implementation, run:

```text
python -m unittest discover -s tests -v
```

The original browser implementation is retained under `assets/original-site/` for provenance and UI reproduction. Serve that directory over HTTP; do not open the HTML directly from disk. See [references/source-and-portability.md](references/source-and-portability.md).
