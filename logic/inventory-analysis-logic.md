# 库存分析逻辑

## 1. 执行范围

库存分析由 `modules/stock/available-stock-analysis.html`、`modules/stock/available-stock-analysis.js` 和 `modules/stock/stock-analysis-js.js` 实现，并保留 `py/inventory_step1_to_stock.py` 作为 Python 备用引擎。

Inventory 和 Daily Supply Plan 是必选来源；ODP 和 Orderfile Base 是可选来源。上传文件优先，未上传但勾选默认文件时读取 `templates/` 中的对应文件。

系统同时生成可用库存和总库存两套数据：

- 可用库存：Inventory 使用 `Available Stock`，Daily Supply Plan 使用 `Available Quantity`。
- 总库存：Inventory 使用 `Actual Stock`，Daily Supply Plan 使用 `Scheduled Quantity`。
- ODP 在网页分析中继续保留，但不写入库存结果 Sheet 的数量和日期列。

## 2. SKU 主数据匹配

SKU 匹配严格按 SKU 值执行 trim + upper：

1. 优先在模板 `SKU` Sheet 匹配；`SKU Mapping` 作为旧名称兼容。
2. SKU Sheet 匹配不到时，再到 `Legacy Mapping Product` 匹配。
3. 同一 Sheet 内同一 SKU 重复时保留第一条。

SKU Sheet 字段映射：

| 输出/可视化字段 | SKU Sheet 字段 |
|---|---|
| Category | Category |
| Brand | Brand |
| Family | Level2 |
| Size | Level3 |
| Model | Product Model |
| Connector | Connector |
| Cable Length | Cable Length |
| Bin | Billable Watts(W) |
| MOQ | Total PCS per 40HQ Container |

Legacy Mapping Product 字段映射：

| 输出/可视化字段 | Legacy 字段 |
|---|---|
| Category | 根据 Family + Brand 推导 PV/ESS/HP |
| Brand | Brand |
| Family | Family |
| Size | Size；没有该列时为空 |
| Model | Anaplan PL6 |
| Bin | Bins |
| MOQ | Container Loading |

如果使用 Legacy Mapping Product 匹配，Connector 和 Cable Length 均为空。如果两个主数据表都匹配不到，记录进入 `Unmatched SKU`，不进入正常库存 Sheet 和网页可视化。

网页 Product 显示名称为：

```text
Model | Connector + Cable Length
```

空字段不显示多余分隔符。`Size` 不写入 Excel 库存 Sheet，只用于网页筛选和可视化数据。

网页筛选级联顺序为：

```text
WH → Category → Family → Size → Product
```

## 3. Inventory 处理

读取第一个 Sheet，表头为第 1 行。SKU 使用 `Customer Model`，Model 和 Category 使用 Inventory 来源字段。

排除以下行：

- Sales Organization = `China`。
- Sales Organization 包含 `Business Planning Department`。
- Physical Warehouse = `SPTN China FTZ(W73)`。
- Virtual Warehouse 以 `FRU`、`HOLD`、`Market Material`、`SCRAP`、`SPEC` 开头。
- Virtual Warehouse = `Natec Sunenergy B.V. Consignment WH`。

库存数量按以下维度汇总：

```text
Sales Organization + Virtual Warehouse + Category + SKU + Product Model
```

销售组织映射：Netherlands→NL、France→FR、United Kingdom/UK→UK、Italy→IT、Spain→ES，无法识别时取前两位大写。

## 4. Daily Supply Plan 处理

读取第一个 Sheet，按 `In-transit Warehouse(Code)` 识别仓库：

```text
SPNL→NL，SPFR→FR，SPTN→FR，SPUK→UK，SPIT→IT，SPES→ES
```

无法识别的仓库跳过，只保留生成日期范围内的 `Supply Date`。

按以下维度汇总：

```text
SKU + WH + Virtual Warehouse + Category + Model + Supply Date
```

来源标记为 `INV_DSP`。DSP 数量进入库存 Excel 的日期列和 `Available QTY` 计算。

## 5. ODP 处理

ODP 继续读取 `PV SUPPLY DATA` 和 `ESS SUPPLY DATA`，并继续执行原有过滤、ETA、港口、Arrival Plan、国内库存和来源追踪逻辑。

ODP 数据继续进入：

- 网页总库存概览。
- 网页库存曲线。
- 网页产品明细。
- `_Transit Source Map`。
- ODP/MIXED 来源标记。

ODP 数据不进入以下库存结果 Sheet 的数量计算：

```text
NL_PV / FR_PV / UK_PV / ES_PV / IT_PV / ESS+HP Stock / Unmatched SKU
```

因此库存结果 Sheet 只使用：

```text
Inventory Stock + Daily Supply Plan Transit
```

`Domestic Stock PV` 和 `Domestic Stock ESS` 保留表头，但不写入 ODP 明细，内容为空。

`ESS+HP Stock` 不导出 Family 为 `AC Charger`、`Cells`、`Marketing` 的库存；这些数据仍可用于网页可视化。

## 6. To be allocated

Orderfile Base 使用第 2 行作为表头，只保留 `Allocation Status = to be allocated`。

按 `SKU + WH` 汇总 `Ordered Qty`，订单明细写入 `To be allocated` Sheet，并增加 Connector、Cable Length。Legacy SKU 的这两个字段为空。数量为 0 的订单不输出。

## 7. 活动 SKU 过滤

SKU 满足以下任一条件即保留：

- Inventory Stock 非零。
- DSP 或 ODP 在途非零。
- ODP Domestic Stock 非零。
- To be allocated 非零。

四类来源完全没有数量的 SKU，不进入网页和结果文件。过滤是 SKU 级别，不是单行级别。

## 8. Excel 库存结果

输出 Sheet 为：

```text
NL_PV
FR_PV
UK_PV
ES_PV
IT_PV
ESS+HP Stock
MW
Domestic Stock PV
Domestic Stock ESS
To be allocated
Unmatched SKU
```

系统内部的 `_Transit Source Map` 仍保留，用于网页恢复 DSP、ODP 和 MIXED 来源。

库存 Sheet 基础列顺序为：

```text
WH
Brand
Family
Bin
Model
SKU
Connector
Cable Length
MOQ
Available QTY
MW
Stock
```

后面追加生成日期范围内的每日 DSP 在途列，表头格式为 `YYYY.M.D`。

其中：

```text
Available QTY = Stock + DSP 日期在途合计
```

`Available QTY` 保留原 `Total QTY` 的计算方法和数值口径。

`MW` 保留原 `Total MW` 的计算方法和数值口径：

```text
PV MW = Available QTY × Bin ÷ 1,000,000
ESS/HP MW = 空白
```

原来的独立现货 MW 列不再输出；网页可视化仍可单独计算 StockMW。To be allocated 不从 Excel 的 `Available QTY` 或 `MW` 中扣除。

## 9. MW 汇总 Sheet

`MW` Sheet 每个国家一行，只汇总 PV：

```text
WH | Stock MW | 有到货的 ISO 周 MW 列 | 有到货的月份 MW 列
```

计算规则：

```text
Stock MW = Inventory Stock × Bin ÷ 1,000,000
到货 MW = DSP 到货数量 × Bin ÷ 1,000,000
```

每日 DSP 到货先按 ISO 周汇总，再按月份汇总。例如 2026-11-24、2026-11-25、2026-11-26 的到货，会合计到 `26-W48`，同时合计到 `2026-11`。ODP 不进入该 Sheet。没有到货的周和月份不生成列。

## 10. 网页可视化

网页数据同时保留 Inventory、DSP、ODP 三种状态：

- Inventory：Inventory 现货。
- Daily Supply Plan：DSP 在途。
- ODP：ODP 到货在途和 Domestic Stock。

网页曲线期初库存仍为：

```text
Stock + Domestic Stock
```

网页明细的可用数量继续按原逻辑计算：

```text
Available Qty = In-stock + 日期范围内在途 - To be allocated
```

总库存口径下仍不扣除待分配。支持 Daily、Weekly、Monthly 三种粒度，以及总计、按产品拆分、按仓库拆分三种曲线模式。ODP、MIXED 来源线继续保留。

## 11. 双引擎

JavaScript 引擎负责默认处理并直接将内存数据交给网页；Python Legacy 引擎生成相同的库存 Sheet，并通过可视化旁路数据恢复 Size、ODP 和来源明细，避免把 Size 或 ODP 数量写入库存 Sheet。
