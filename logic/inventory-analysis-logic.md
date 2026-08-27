# 库存分析逻辑

## 1. 执行链路

1. 用户上传或选择仓库默认文件。
2. 浏览器加载 Pyodide、安装 `openpyxl`，读取 `py/inventory_step1_to_stock.py`。
3. 以 `templates/stock_template.xlsx` 为输出模板，调用 Python `run()`。
4. Python 读取 Inventory、Daily Supply Plan，以及可选的 ODP 和 Orderfile Base，重建 `stock`、`To be allocated`、`_Transit Source Map` 三个输出 sheet。
5. 浏览器再次读取生成的 `stock` sheet，构建筛选、图表和明细表，同时提供下载文件。

文件来源规则：Inventory 和 Daily Supply Plan 必须存在；ODP 和 Orderfile Base 可为空。上传文件优先于仓库默认文件；未上传且未勾选默认文件时，必填项报错，可选项跳过。

## 2. SKU 主数据和 Connector 关联

### SKU sheet 选择

- 优先使用显式传入的 sheet 名。
- 否则按 `SKU`、`SKU Mapping`、`Legacy Mapping Product` 的顺序查找，不区分大小写。
- 找不到候选 sheet 时使用工作簿第一个 sheet。

### SKU 匹配

`Sku No`/`SKU no` 是主键，匹配前执行 `trim + upper`。同一 SKU 出现多行时只保留第一行。

SKU sheet 必须包含以下字段：

- `Sku No`
- `Product Model`
- `Category`
- `Level2`
- `Level3`
- `Billable Watts(W)`
- `Connector`
- `Total PCS per 40HQ Container`

每个 SKU 映射为：

| 输出字段 | 来源 |
| --- | --- |
| Category | SKU sheet `Category` |
| Product TCL Report | SKU sheet `Level2` |
| Family | SKU sheet `Level3` |
| Model | SKU sheet `Product Model` |
| Connector | SKU sheet `Connector`/`CONNECTOR` |
| Bin | SKU sheet `Billable Watts(W)` |
| MOQ | SKU sheet `Total PCS per 40HQ Container` |

`Connector` 会随 SKU 映射进入所有来源产生的库存行，包括 Inventory 的现货行、Daily Supply Plan/ODP 的仅在途行，以及对应的最终 Product 展示。未匹配 SKU 的这些映射字段统一写为 `SKU not matched`，该行仍会写入输出工作簿，但不会进入可视化分析数据。

在写出 `stock` 前，按 SKU 检查四个来源的数量：Inventory 的 Stock、Daily Supply Plan 的 Available Quantity、ODP 的 Quantity、Orderfile Base 的 Ordered Qty。四个来源都没有非零数量的 SKU 会被整体跳过，不生成 stock 行；前端读取时也执行同样的 SKU 级防御过滤，因此不会进入可视化数据。任一来源有非零数量则保留该 SKU；如果只有 To be allocated 有量，也会创建对应的 SKU/WH 行。

## 3. 各来源取数和清洗

### 3.1 Inventory

- 读取输入工作簿第一个 sheet，表头取第一行。
- 必需字段：`Customer Model`、`Category`、`Available Stock`、`Sales Organization Name`、`Virtual Warehouse Name`、`Brand`。
- 排除规则：Brand 为 `Other`；销售组织为 `China`；销售组织包含 Business Planning Department；虚拟仓库名包含 `Arrival Plan`。
- 主键为 `(Customer Model, Category, Sales Organization Name)`，对 `Available Stock` 求和。
- 销售组织映射为仓库：Netherlands→NL、France→FR、United Kingdom/UK→UK、Italy→IT、Spain→ES；未识别时取销售组织名称前两位大写。

Inventory 的汇总行初始写入 `Stock`，在途日期列为空；之后再统一补齐分配和计算字段。

### 3.2 Daily Supply Plan

- 读取第一个 sheet。
- 必需字段：`In-transit Warehouse(Code)`、`Customer Model`、`Supply Date`、`Available Quantity`。
- 通过仓库编码识别 NL、FR、UK、IT、ES；无法识别的仓库跳过。
- 只保留用户选择的起止日期，默认范围为 2026-08-01 至 2026-12-31。
- 按 `(Customer Model, WH, 日期)` 汇总 `Available Quantity`。
- 来源标记为 `INV_DSP`，生成的日期单元格使用蓝色标记。

输入中如果存在 `Category`，代码会读取一个临时类别映射，但当前最终输出的类别仍以 SKU 映射为准，该临时类别不参与最终计算。

### 3.3 ODP

- 在 `Total Stcok` 和 `Total Stock` 中择一读取，兼容当前文件中的拼写差异。
- 必需字段：`New Ark WH`、`New Ark SKU`、`Quantity`、`ETA for New Ark Update`。
- 仓库为空、N/A、NA、None、Null 或无法识别时跳过。
- ETA 为空、无效、1900 年及以前，或不在日期范围内时跳过。
- 按 `(New Ark SKU, WH, ETA 日期)` 汇总 `Quantity`。
- 来源标记为 `ODP`，生成的日期单元格使用橙色标记。

如果存在 `Product Type`，代码会读取临时类别映射；最终类别仍以 SKU 映射为准。

### 3.4 来源合并

Daily Supply Plan 和 ODP 的数量会累加到同一个 `(SKU, WH, 日期)`。同一日期同时来自两类来源时，来源标记合并为 `MIXED`，对应单元格使用紫色标记。日期表头的颜色使用该日期所有 SKU/仓库来源的汇总结果。

### 3.5 Orderfile Base

- 读取第一个 sheet，表头固定在第 2 行。
- 只保留 `Allocation Status` 等于 `to be allocated` 的行。
- 必需字段包括 `Material`、`Ordered Qty`、`CRD`、客户名称、SO、SO Line、Model、Factory 等。
- `Material` 作为 SKU，Factory 通过仓库编码映射为 WH。
- 原始明细写入 `To be allocated` sheet，并通过同一 SKU 映射回填 `Connector`；同时按 `(SKU, WH)` 汇总 `Ordered Qty`，用于 stock sheet 的 `To be allocated` 数值。

## 4. stock 输出字段和计算

每次运行会删除并重建 `stock` sheet。基础列顺序为：

`WH`、`Category`、`Product TCL Report`、`Family`、`SKU`、`Model`、`Connector`、`Bin`、`MOQ`、`To be allocated`、`Total QTY`、`Total MW`、`MW`、`Stock`，后面追加日期列。

日期列按起止日期逐日生成，表头格式为 `YYYY.M.D`。

如果在途 SKU/WH 不存在于 Inventory 初始行，会新增一行，并同样通过 SKU sheet 回填 `Connector`、Model、Category、Family、Bin、MOQ。

对每一行计算：

- `To be allocated` = Orderfile Base 中同 `(SKU, WH)` 的 Ordered Qty 汇总。
- `Transit Total`（内部计算值） = 所有日期列在途数量之和。
- `Total QTY` = `Stock + Transit Total`。
- `MW` = `Stock × Bin / 1,000,000`。
- `Total MW` = `Total QTY × Bin / 1,000,000`。

现货列使用蓝色来源标记；日期列根据 `INV_DSP`、`ODP`、`MIXED` 标记颜色。`To be allocated` 不会从 Excel 的 `Total QTY`/`Total MW` 中扣除。

## 5. 可视化取数、筛选和 Product 展示

浏览器读取生成的 `stock` sheet，并要求存在 `WH`、`Category`、`Product TCL Report`、`Family`、`SKU`、`Model`、`Connector`、`Stock`、`To be allocated`。日期格式为三段数字的列被识别为在途日期列。

匹配成功的每一行转换为可视化对象，包含仓库、分类、Family、SKU、Model、Connector、现货、分配量、每日期在途量和来源标记。未匹配 SKU 行被跳过。

### 筛选

筛选层级为：`WH → Category → Product TCL Report → Family → Product`。下级选项根据上级当前选择级联重建。Product 的内部键仍是 `SKU||Model`，显示标签改为：

`Model | SKU | Connector`

如果 Model 或 Connector 为空，则自动省略空片段。这样 Product 下拉框、图表分产品线名称、明细表第一列使用同一套检索信息。

### 图表

- 选择日期范围后，现货曲线从 `Stock` 开始，每个日期累加当日及之前的在途数量。
- `Daily` 直接使用日期；`Weekly` 按 ISO 周聚合；`Monthly` 按月份聚合。
- `total` 显示全部选中产品；`split` 按 Product 分线，最多显示结束值最高的 12 条；`warehouse` 按 WH 分线。
- 另按来源绘制 Inventory/Daily Supply、ODP、Mixed 的累计在途线；无数据的来源线不显示。
- To be allocated 以按 CRD 月份映射的 ECharts 标记点显示在曲线上，当前不会从曲线值中扣除。

### 明细表

明细按 Product 聚合跨仓库数据。列包括 Product、In-stock、日期范围内 In-transit、To be allocated、Available Qty 和有非零在途量的日期列。

- `In-stock` = Product 下所有仓库 Stock 之和。
- `In-transit (range)` = 选择日期范围内在途量之和。
- `To be allocated` = CRD 在选择日期范围内的 Orderfile 明细数量之和。
- `Available Qty` = `In-stock + In-transit (range) - To be allocated`。

表格第一列显示 `Model | SKU | Connector`；日期列颜色继续反映来源。图表和明细表都受同一组筛选及日期范围控制。四个来源均无非零数量的 SKU 不会出现在表格中。
