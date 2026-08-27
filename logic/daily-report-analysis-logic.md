# 日报 / 销售分析逻辑

当前 EUPV2026 中与日报分析对应的页面是 `Sales Change Analysis (Web)`，代码文件为 `modules/sales/sales-change-analysis.js`。页面实际展示“总计 Dashboard”和“各地区看板”；门户描述中的 A/B/C/D/E 不是当前页面代码中的实际输出。

## 1. 取数链路

1. 用户选择上传本地工作簿，或选择仓库路径并通过 `fetch` 读取。
2. 只读取名为 `Order details` 的 sheet；找不到时报错。
3. 使用 SheetJS `sheet_to_json` 转换为对象数组，空单元格使用 `null`。
4. `normalizeRows()` 对每行做日期、状态、分类和指标标准化。
5. 只保留年份不小于 2026，且同时有有效季度和月份的行。
6. 所有 KPI、季度表、月度图和地区卡片都从标准化后的 `allRows` 重新聚合。

## 2. 行级标准化

### 时间

- `Month` 支持 Excel 日期、`YYYY-MM`、`YYYY/MM`、`YYYY.MM`、两位年份月份和可被 JavaScript Date 解析的文本，统一为 `YYYY-MM`。
- `year` 优先取原始 `year` 的整数；无有效 year 时从 Month 的前四位推导。
- `Quartely` 从文本中读取 Q1-Q4；缺失或无法识别时按月份计算：`Q = floor((month - 1) / 3) + 1`。
- 无有效 year、quarter 或 month 的行被过滤。

### 状态、金额、类别

- `Order Status2` 转小写后，等于 `invoiced` 的行标记为开票，等于 `confirm` 的行标记为待确认。
- `Revenue EUR` 转为数值，不能转换或为空按 0。
- `Unit Price * Qty` 用于判断 ESS 数量资格：字段必须非空且数值不为 0。
- `Category`、`TCL Report Product`、`Product Mid Category` 去空格并转大写。
- PV 行：`category === PV`，金额记入 `pvAmount`，数量取 `Total MW` 记入 `pvQty`。
- ESS 行：`category === ESS`。只有同时满足 Unit Price * Qty 有效，且 Product Mid Category 为 `HYBRID INVERTER`，或 TCL Report Product 为 `ENERGY+_KIT GEN1`、`ENERGY+_KIT`、`TCL` 时，`Ordered Qty` 才计入 `essQty`。
- HP 当前只保留 `isHP` 标志，没有进入现有 KPI 或图表聚合。
- 地区优先使用 `RegionStd`，否则使用 `Region`，两者都空时为 `Unknown`。

标准化后的核心字段为：年份、季度、月份、地区、收入、开票/待确认标志、PV/ESS/HP 标志、PV/ESS 金额和 PV/ESS 数量。

## 3. 聚合基础

每个聚合对象包含：`revenue`、`pvAmount`、`essAmount`、`pvQty`、`essQty`。`addAgg()` 对五个字段逐项求和。

金额展示单位为万欧元：原始 EUR 除以 10,000 后四舍五入为整数；数量默认四舍五入为整数。ASP 不做整数化，PV 保留 3 位小数。

## 4. 总计 Dashboard

### 全年核心指标

- 仅取 `year === 2026`。
- 分别聚合开票行、待确认行和全部 2026 行。
- 展示：开票/待确认收入、PV 销量 MW、ESS 销量 Sets。
- BP/达成率目前显示为空字符串，代码未读取 BP 目标数据。

### 未来销售指标

- 取 `year > 2026` 的全部行。
- 展示未来收入、PV MW、ESS Sets。

### H1 销售数据

- 取 `month <= 2026-06` 且状态为开票的行。
- 展示 H1 开票收入、PV MW、ESS Sets。
- H1 达成率目前为空字符串。

### 未结束季度进度

- 根据浏览器当前月份计算当前季度，只展示 `Q >= 当前季度` 的 2026 季度。
- 每季度同时计算全部行和开票行。
- 表格字段：季度、全部金额、开票金额、PV MW、ESS Sets、达成率。
- 达成率目前为空字符串。

### 月度图表

- 固定生成 2026-01 至 2026-12 共 12 个月份，没有数据的月份补零。
- 销售金额图：折线为总收入/10,000，PV 和 ESS 柱状值分别为分类金额/10,000。
- PV ASP：`PV 金额 / (PV MW × 1,000,000)`，单位 €/W；PV 数量为 0 时显示空值。
- ESS ASP：`ESS 金额 / ESS Sets`，单位 €/Set；ESS 数量为 0 时显示空值。
- Plotly 使用响应式布局，隐藏 mode bar；中文/英文切换会重建标题、标签和图表。

## 5. 各地区看板

### 筛选

用户可多选收入类型、年份、季度、月份：

- 收入类型为总计、未选择或包含 `total` 时不按状态过滤。
- 选择开票和/或待确认时，保留满足任一选择状态的行。
- 年份、季度、月份使用 OR 匹配所选值；每个维度之间使用 AND。

地区在统计前按以下规则合并：

| 原始地区 | 统计地区 |
| --- | --- |
| Italy & Adriatics Region | Italy Region |
| Germany & Austria Region | DACH Region |
| Emerging Market | Central and Eastern Europe Region |
| lberia Region | Southern Europe Region |
| 其他 | 原值 |

地区卡片按总收入降序排列。卡片计算：

- 总金额 = 地区收入聚合值。
- 总金额占比 = 地区收入 / 当前筛选结果总收入 × 100%。
- PV 金额、PV 数量、PV ASP = `PV 金额 / (PV MW × 1,000,000)`。
- ESS 金额、ESS 数量、ESS ASP = `ESS 金额 / ESS Sets`。
- 只有 PV 金额大于 0 时展示 PV 明细，只有 ESS 金额大于 0 时展示 ESS 明细。
- BP 达成率和同比目前显示为空值，未接入 BP 或历史同期数据。

无数据时展示“当前筛选下无地区数据”。所有文本标签、状态和图表标题由 `I18N` 的中英文词典提供。

## 6. 当前边界

- 页面只接受 `Order details` sheet，不会自动选择其他 sheet。
- 页面未对收入、数量和日期范围做业务口径校验，无法转换的数值按 0 或空值处理。
- `selectIncomeRows()` 是保留的辅助函数，当前总览和地区看板使用显式状态过滤。
- BP、达成率、同比没有输入字段或计算来源，因此只呈现占位空值。
