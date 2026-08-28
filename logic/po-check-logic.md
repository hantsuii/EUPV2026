# PO 核验模块逻辑说明

对应页面与代码：

- `modules/po-check/po-check.html`
- `modules/po-check/po-check-i18n.js`
- `modules/po-check/po-check.js`

## 1. 输入文件

### 采购单详情

必须包含：

- `purchase order head`
- `purchase order line`

采购单导出文件的表头与数据存在一列错位：代码不依赖表头中的 `Approval Status` 位置，而是从数据中自动识别包含 `Approved` / `Approving` 的实际审核状态列。该列后一列即实际 X 列，用作 TCL Reference。

### EUPV ODP MASTER

必须包含 `PO Check`，使用字段：

- `TCL REFERENCE`
- `New Ark PO Type`
- `New Ark SKU`
- `QUANTITY`
- `SPTN-PVHK New Ark PO#`
- `NewArk ETA PO`
- `ETA for New Ark update`

## 2. 核验范围

采购单中的所有行都进入核验，不再根据 `Status` 或 `Approval Status` 排除。

每一个 PO 都执行以下全部检查：

- 采购类型映射
- `NewArk ETA PO`
- `ETA for New Ark update`
- TCL Reference
- SKU 是否存在
- SKU 汇总数量

## 3. 所有 PO 的统一核验

1. 使用 `Purchase order Number` 匹配 `PO Check` 的 `SPTN-PVHK New Ark PO#`。
2. 比较采购单 `Estimated time of arrival` 与 `NewArk ETA PO`。
3. 比较采购单 `Estimated time of arrival` 与 `ETA for New Ark update`。
4. 核对采购类型映射、TCL Reference、SKU 和数量。
5. 若同一 PO 的非空 `ETA for New Ark update` 只有一个值且与采购单 ETA 不同：
   - 总体结果为 `有差异`；
   - 标记为需要调整 ETA；
   - 页面结果行及下载文件结果行标绿色；
   - 建议 ETA 写入 `PO Check Results`，但不改写 `PO Details` 的原始 ETA。
6. 若同一 PO 出现多个不同的更新 ETA，则标记为 `需复核`，不自动选择 ETA。

## 4. 明细核验

### 采购类型映射

| PO Check: New Ark PO Type | Purchase order head: Purchase Type |
| --- | --- |
| Internal | Internal |
| Offshore | Offshore purchase |
| ongoing B/L change | Internal |

### TCL Reference

分别从以下两列清洗 TCL Reference：

- `Customer Po`
- 实际 Note 后一列，即 X 列

将两列清洗值合并去重后，与同一 PO 的全部 `PO Check.TCL REFERENCE` 组成的集合比较。一个 PO 对应多条 PO Check 时必须完整匹配集合。

### SKU 与数量

1. `purchase order line` 按 `Purchase order Number + Customer Model` 汇总 `Qty`。
2. `PO Check` 按 `SPTN-PVHK New Ark PO# + New Ark SKU` 汇总 `QUANTITY`。
3. 对 SKU 是否存在及汇总数量是否一致逐项核验。

页面和 `PO Check Results` 同时显示同一 PO 在 ODP 中对应的：

- `New Ark SKU`
- `Model`

## 5. 结果排序和颜色

页面与下载文件中的 `PO Check Results` 按以下优先级排序：

1. `需复核`：紫色，置于最上方。
2. 需要调整 ETA 的 `有差异`：绿色。
3. 其他 `有差异`：橙色。
4. `通过`。

## 6. 下载工作簿

第一个 Sheet 固定名为 `PO Details`，并且只使用以下九列及顺序：

| Purchase order Number | Purchase Type | TMS bill Number / voucher bill Number | Customer Po | Category | Estimated time of arrival | Status | Approval Status | Note |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |

约定：

- `Approval Status` 使用自动识别的实际审核状态列。
- `Note` 使用实际 Note 后一列（X 列）的值，即 TCL Reference。
- `Estimated time of arrival` 始终使用原始采购单中的值，不使用建议 ETA 覆盖。
- 所有采购单都保留在 `PO Details`。

其余 Sheet：

- `PO Check Results`：逐 PO 核验结果。
- `SKU Qty Results`：逐 PO + SKU 数量核验结果。
- `Summary`：核验数量、排除数量和类型映射。

## 7. 页面显示与分页

- 表格采用紧凑行高，减少连续记录之间的空白。
- 默认每页显示 50 行，可切换为 25、50 或 100 行。
- 提供上一页、下一页和页码信息，不再一次显示全部记录。
- 结果表增加 `SKU` 和 `Model` 两列。

## 8. 双语

页面支持中文和英文切换。筛选项、状态信息、核验结果、表头、规则说明及下载链接会随语言切换更新。
