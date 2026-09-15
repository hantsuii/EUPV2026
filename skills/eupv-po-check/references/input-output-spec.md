# Input and output specification

## Purchase-order workbook

Sheet names are exact.

### `purchase order head`

Required named columns:

| Column | Use |
| --- | --- |
| `Purchase order Number` | PO join key |
| `Purchase Type` | Compared with mapped ODP type |
| `TMS bill Number / voucher bill Number` | Preserved in `PO Details` |
| `Customer Po` | First TCL Reference source |
| `Category` | Preserved in `PO Details` |
| `Estimated time of arrival` | Baseline ETA |
| `Status` | Preserved; `In Stock` is only hidden by the legacy web view |

The historical export has a header/data offset. Do not trust the physical `Approval Status` header. Scan data columns and select the column containing the most normalized values equal to `APPROVED` or `APPROVING`. The next physical column is the X-column TCL Reference source. If no such value exists, reproduce the source fallback: use the `Note` header position, otherwise the column immediately after the `Approval Status` header. Fail if none can be identified.

Like the source JavaScript, the deterministic implementation keeps head data rows only when their second physical cell is non-empty.

### `purchase order line`

Required columns: `Purchase order Number`, `Customer Model` (treated as SKU), `Qty`, and `Storage Space`. Rows with an empty first physical cell are ignored. SKU is trimmed and otherwise case-sensitive. Quantity commas are removed; blank or nonnumeric values become zero.

## EUPV ODP MASTER workbook

Sheet `PO Check` requires `TCL REFERENCE`, `New Ark PO Type`, `New Ark WH`, `New Ark SKU`, `Model`, `QUANTITY`, `SPTN-PVHK New Ark PO#`, `NewArk ETA PO`, and `ETA for New Ark update`. Rows with an empty first physical cell are ignored. PO numbers are trimmed and matched exactly.

## Warehouse mapping workbook

Sheet `Sheet1` must contain `Virtual warehouse name` and `Virtual warehouse code`. Names and codes are normalized by trimming, collapsing whitespace, and uppercasing. Either resolves to the canonical warehouse name.

## XLSX output

Sheet order: `PO Details`, `PO Check Results`, `SKU Qty Results`, `Summary`.

`PO Details` columns are `Purchase order Number`, `Purchase Type`, `TMS bill Number / voucher bill Number`, `Customer Po`, `Category`, `Estimated time of arrival`, `Status`, detected `Approval Status`, and the adjacent X-column value labeled `Note`.

PO results use purple for review, green for an ETA-adjustment difference, orange for other differences, and no fill for passed. The original ETA cell is highlighted green when adjustment is suggested, but its value stays unchanged.

Optional JSON contains `summary`, `results`, `skuResults`, and `poOutputRows`. JSON retains stable internal Chinese result tokens; `--language` only changes XLSX presentation labels.
