# 库存分析逻辑

## 1. 页面和执行链路

入口为 `modules/stock/available-stock-analysis.html`，页面逻辑为 `modules/stock/available-stock-analysis.js`。

库存输出有两套可切换引擎：

1. JavaScript 默认路径：`stock-analysis-js.js` 使用 SheetJS 读取来源文件，使用 ExcelJS 读取 `stock_template.xlsx` 并写出 `stock`、`To be allocated`、`_Transit Source Map`。
2. Python Legacy 回退路径：`py/inventory_step1_to_stock.py` 由 Pyodide 执行，保留原有 openpyxl 流程。

两套路径的输入优先级、日期范围、SKU 映射、来源清洗、计算公式、Product 标签和零数量 SKU 过滤保持一致。JS 路径生成后直接把内存中的可视化数据交给页面；Python 路径则从生成的 `stock` 和 `_Transit Source Map` 读取可视化数据。

Inventory 和 Daily Supply Plan 必须提供；ODP 和 Orderfile Base 可选。上传文件优先，未上传但勾选仓库默认文件时读取 `templates/` 中的对应文件。默认日期范围为 `2026-08-01` 至 `2026-12-31`。

## 2. SKU 主数据和 Connector

### SKU sheet 选择

- 优先查找 `SKU`、`SKU Mapping`、`Legacy Mapping Product`，不区分大小写。
- 没有候选名称时使用模板第一个 sheet。

### SKU 字段

SKU 主键为 `Sku No`，匹配前执行 trim 和 upper；同一 SKU 重复时保留第一条。

必须存在：`Sku No`、`Product Model`、`Category`、`Level2`、`Level3`、`Billable Watts(W)`、`Connector`、`Total PCS per 40HQ Container`。

| 输出字段 | SKU sheet 来源 |
| --- | --- |
| Category | Category |
| Product TCL Report | Level2 |
| Family | Level3 |
| Model | Product Model |
| Connector | Connector / CONNECTOR |
| Bin | Billable Watts(W) |
| MOQ | Total PCS per 40HQ Container |

Connector 会回填到 Inventory 现货行、Daily Supply Plan/ODP 仅在途行、To be allocated 明细和最终 Product 标签。Product 显示顺序固定为：

`Model | SKU | Connector`

未匹配 SKU 的字段写为 `SKU not matched`，工作簿保留该行用于追溯，但可视化读取时跳过。

## 3. 各来源取数和清洗

### 3.1 Inventory

- 读取第一个 sheet，表头为第 1 行。
- 必需字段：`Customer Model`、`Category`、`Available Stock`、`Sales Organization Name`、`Virtual Warehouse Name`、`Brand`。
- 排除 Brand=`Other`、销售组织=`China`、包含 Business Planning Department 的销售组织，以及虚拟仓库名包含 `Arrival Plan` 的行。
- 按 `(Customer Model, Category, Sales Organization Name)` 汇总 `Available Stock`。
- 销售组织映射：Netherlands→NL、France→FR、United Kingdom/UK→UK、Italy→IT、Spain→ES；未识别时取前两位大写。

### 3.2 Daily Supply Plan

- 读取第一个 sheet。
- 必需字段：`In-transit Warehouse(Code)`、`Customer Model`、`Supply Date`、`Available Quantity`。
- 通过仓库编码识别 NL、FR、UK、IT、ES；无法识别的仓库跳过。
- 只保留起止日期内的 Supply Date。
- 按 `(Customer Model, WH, 日期)` 汇总 `Available Quantity`，来源标记为 `INV_DSP`。

### 3.3 ODP

- 读取 `Total Stcok`；不存在时读取 `Total Stock`。
- 必需字段：`New Ark WH`、`New Ark SKU`、`Quantity`、`ETA for New Ark Update`。
- 仓库为空、N/A、NA、None、Null 或无法识别时跳过。
- ETA 为空、无效、1900 年及以前或不在日期范围内时跳过。
- 按 `(New Ark SKU, WH, ETA 日期)` 汇总 `Quantity`，来源标记为 `ODP`。

### 3.4 来源合并

Daily Supply Plan 和 ODP 数量累加到相同的 `(SKU, WH, 日期)`。同一天同时存在两种来源时，来源标记为 `MIXED`；输出单元格使用对应来源颜色，并写入 `_Transit Source Map`。

### 3.5 To be allocated

- Orderfile Base 的表头在第 2 行。
- 只保留 `Allocation Status = to be allocated`。
- 必需字段包括 `Material`、`Ordered Qty`、`CRD`、客户名称、SO、SO Line、Model、Factory。
- Material 为 SKU；Factory 通过仓库编码映射为 WH。
- 按 `(SKU, WH)` 汇总 Ordered Qty 写入 stock 的 `To be allocated`。
- 原始订单明细写入 `To be allocated`，并增加 Connector；`Ordered Qty = 0` 的明细不输出。

## 4. 四来源零数量 SKU 过滤

先在 SKU 级别建立活动集合：

- Inventory 的 Stock 非零；或
- 日期范围内 Daily Supply Plan/ODP 的在途数量非零；或
- To be allocated 的 Ordered Qty 非零。

活动集合之外的 SKU 不写入 `stock`。因此，Inventory、Daily Supply Plan、ODP、To be allocated 四个来源都没有数量的 SKU，在生成的 stock 表、Product 筛选、图表和明细表中都不体现。

如果一个 SKU 在某个来源有数量但某个 WH 行为零，该 SKU 仍保留；过滤是 SKU 级别。若只有 To be allocated 有量，则创建对应 SKU/WH 行。

## 5. stock 输出和公式

每次运行删除并重建 `stock`、`To be allocated`、`_Transit Source Map`。stock 基础列顺序为：

`WH | Category | Product TCL Report | Family | SKU | Model | Connector | Bin | MOQ | To be allocated | Total QTY | Total MW | MW | Stock`

后面追加起止日期内每日列，表头为 `YYYY.M.D`。

每一行：

- `To be allocated` = 同 SKU/WH 的 Ordered Qty 汇总。
- `Transit Total` = 所有日期列在途数量之和。
- `Total QTY = Stock + Transit Total`。
- 仅 PV 产品计算 `MW = Stock × Bin / 1,000,000` 和 `Total MW = Total QTY × Bin / 1,000,000`。
- ESS、HP 产品的 `MW`、`Total MW` 留空，只保留 Quantity。
- To be allocated 不从 Total QTY 或 Total MW 中扣除。

现货列使用 Inventory/Daily Supply 的蓝色标记；日期列按 INV_DSP、ODP、MIXED 使用来源颜色。

## 6. 可视化取数和筛选

可视化对象要求存在 `WH`、`Category`、`Product TCL Report`、`Family`、`SKU`、`Model`、`Connector`、`Stock`、`To be allocated`。格式为三段数字的列识别为日期列。

每行包含 WH、Category、Product TCL Report、Family、SKU、Model、Connector、Bin、Stock、StockMW、StatusQuantity、To be allocated、日期在途数量和日期来源。PV 的 `StockMW = Stock × Bin / 1,000,000`，ESS、HP 的 StockMW 为 0。`StatusQuantity` 仅服务总库存统计，分别保留 Inventory、Daily Supply Plan、ODP 数量。Product 内部键为 `SKU||Model`，显示标签为 `Model | SKU | Connector`。

筛选级联顺序为：`WH → Category → Product TCL Report → Family → Product`。下级选项只从上级当前选择范围重建。

## 7. 图表和明细表

- 总库存概览按当前维度筛选结果统计 Inventory 在库、Daily Supply Plan 在途、ODP 国内未发货三种状态。PV 将三种状态的 Quantity 分别乘以 Bin 后换算为 MW；ESS、HP 保持 Quantity。顶部总数为三种状态之和，三个环形图分别展示各状态的数值和占比。DSP 与 ODP 使用生成库存文件时选择的日期范围；待分配不进入总库存概览。
- `_Transit Source Map` 除来源标签外，分别保存 `Daily Supply Plan Qty` 和 `ODP Qty`，确保同一 SKU/WH/日期同时存在两个来源时仍可准确拆分状态。
- 现货曲线从 Stock 开始，每个日期累加当日及之前的在途数量。
- Daily 直接按日；Weekly 按 ISO 周；Monthly 按月份。
- `total` 展示全部选中产品；`split` 按 Product 分线，最多显示结束值最高的 12 条；`warehouse` 按 WH 分线。
- 另绘制 Inventory/Daily Supply、ODP、Mixed 的累计在途来源线；无数据的来源不显示。
- To be allocated 按 CRD 月份映射为图表标记点。
- 明细按 Product 聚合，列出 In-stock、日期范围内 In-transit、To be allocated、Available Qty 和非零在途日期。
- `Available Qty = In-stock + In-transit(range) - To be allocated`。
- 图表、筛选和明细表都不显示四来源均为零的 SKU。

## 8. 模板兼容性和回退

JS 输出已用当前真实模板和来源文件与 Python Legacy 对比，数量结果一致，并保留主数据 sheet、表格、公式和生成的输出 sheet。ExcelJS 对部分自定义名称、外部链接、批注等历史工作簿元数据的保留能力有限；如果这些元数据影响用户后续 Excel 工作流，页面选择 Python Legacy 生成文件。
