# Complete calculation logic

This is the language-neutral specification derived from the EUPV2026 browser module.

## Normalization

- `text(v)`: blank for null; otherwise text trimmed at both ends.
- `normalize(v)`: `text(v)`, collapse whitespace runs to one space, uppercase.
- `unique(values)`: discard blanks and retain the first occurrence of each exact value.
- Numbers: remove commas, convert, use zero when nonnumeric.
- Set equality: equal lengths and every left item occurs on the right; callers sort and deduplicate first.
- Dates: present parseable dates as `YYYY-MM-DD`; ETA passes when dates differ by at most one calendar day.

## Grouping and joins

Group ODP rows by trimmed `SPTN-PVHK New Ark PO#` and purchase lines by trimmed `Purchase order Number`. Process every retained head row independently, so duplicate head rows produce duplicate PO results. Join and SKU keys are trimmed but otherwise case-sensitive.

## PO type

| Normalized ODP type | Expected purchase type |
| --- | --- |
| `INTERNAL` | `Internal` |
| `OFFSHORE` | `Offshore purchase` |
| `ONGOING B/L CHANGE` | `Internal` |
| Other | `需定义映射` |

One distinct expected value requires exact equality with purchase type. Several expected values return `需复核：多种 PO 类型`.

## NewArk ETA PO

Collect distinct nonblank dates. For `APPROVING`, return `不适用`. Otherwise: one value within one day of purchase ETA passes; one mismatch is `NewArk ETA PO 不一致`; several values are `需复核：多条 NewArk ETA PO`; none is `NewArk ETA PO 缺失`.

## ETA for New Ark update

Collect distinct nonblank dates. One update passes only when the total range across nonblank `[purchase ETA, all NewArk ETA PO values, update ETA]` is at most one day; an invalid date fails. A failed single update is `ETA 更新不一致` and becomes the suggested ETA. Several are `需复核：多条 ETA 更新` with no selection. None is `ETA 更新缺失`.

Action is `建议更新 ETA` for one mismatch, `需人工选择 ETA` for several updates, `无需更新 ETA` for a pass, and `需人工核对` otherwise. Never replace purchase ETA in `PO Details`.

## TCL Reference

Build the authoritative ODP set from normalized, distinct, sorted nonblank references. For both `Customer Po` and X column: normalize; replace Chinese/Western commas, enumeration comma, semicolons, pipe, slash, backslash, and line breaks with spaces; include any authoritative reference found as a substring; also extract tokens matching two digits + three letters + three digits + dot-number group(s), or three-to-eight letters + three digits + dot-number group(s). Uppercase, deduplicate, and sort. Union the two purchase sets and require exact equality with the complete ODP set.

## SKU and quantity

Aggregate purchase `Qty` by trimmed `Customer Model`; aggregate ODP `QUANTITY` by trimmed `New Ark SKU`. Iterate the sorted union. Missing purchase SKU is `采购单缺少 SKU`; missing ODP SKU is `PO Check 缺少 SKU`; both present pass when absolute difference is below `0.000001`, otherwise `数量不一致`. PO-level status is `通过` or `SKU/数量有 N 项差异`.

## Warehouse

Resolve each purchase `Storage Space` through the normalized mapping. A nonblank unresolved value becomes `未映射：<original>`. Compare distinct sorted purchase and ODP warehouse sets after normalization. Both must be nonempty, fully mapped, and exactly equal. Unresolved purchase values return `仓库映射缺失`; all other failures return `仓库不一致`.

## Missing PO and overall result

When no ODP rows exist, all six checks are `未在 PO Check 找到` and action is `需人工核对`.

For type, ETA PO, ETA update, reference, SKU/quantity, and warehouse: pass when every result is `通过` or `不适用`; otherwise review when any contains `需复核` or `未在`; otherwise difference. `etaNeedsAdjustment` is true only when ETA update is exactly `ETA 更新不一致` and overall is `有差异`.

Sort by review, ETA-adjustment difference, other difference, then passed; within each class sort PO lexically.

## Web-only behavior

The legacy page hides normalized `IN STOCK` rows but still counts and exports them. Pagination and filters never change calculations or XLSX output.
