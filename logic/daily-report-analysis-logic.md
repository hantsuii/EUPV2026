# 日报 / 销售分析逻辑

销售分析页面位于 `modules/sales/sales-change-analysis.html`，浏览器端读取日报工作簿并生成“总计 Dashboard”“各地区看板”和“产品销售分析”。

## 数据源与标准化

- 实际销售读取 `Order details`，月份以 `Month` 为准，不限制历史年份。
- 收入读取 `Revenue EUR`；退货负金额直接参与求和。
- `Order Status2 = invoiced` 为开票收入，`confirm` 为待确认收入；“总计”包含全部行。
- 地区读取 `Order details.Region`。
- Target 读取 `Target` sheet。地区优先读取 `Region`；为兼容旧日报样例，在 `Region` 不存在时回退到 `Country`。Target 中的 `Brand` 列一并读取，用于品牌筛选时联动 Target 金额和数量。
- 实际和 Target 都应用同一套 H1/H2 地区归并：Italy & Adriatics → Italy、Germany & Austria → DACH、Emerging Market → Central and Eastern Europe、lberia → Southern Europe。
- Target 后台同时汇总 `Revenue EUR` 和 `Quantity`。PV Quantity 对应 MW；ESS Quantity 只汇总 `category Sub = Kits` 的行，对应 Sets；当前不输出 country/category/Product-Sub 层级目标。
- 总计 Dashboard 和地区详情弹窗的品牌筛选同时作用于实际销售和 Target：选中品牌后，KPI 卡的目标金额/数量和达成率、季度进度表中的 BP 金额和达成率均按所选品牌的 Target 行重新计算。

## 数量与 ASP

- PV ASP 图在筛选和计算前固定限定 `Category = PV`；PV 数量取 `Total MW`，PV ASP = PV Revenue EUR / (PV MW × 1,000,000)。
- ESS 数量沿用原页面口径：`Unit Price * Qty` 有效，且产品为 Hybrid Inverter、ENERGY+_KIT GEN1、ENERGY+_KIT 或 TCL 时，取 `Ordered Qty`。
- ESS ASP 图在筛选和计算前固定限定 `Category = ESS`；ESS ASP = ESS Revenue EUR / ESS Sets。
- PV 和 ESS ASP 纵向分别展示。每个 ASP 筛选面板下并排放置两张图表：左侧折线图展示 ASP，右侧柱状图展示对应销售数量（PV MW 或 ESS Sets），两图共用 X 轴但各自独立 Y 轴。每张图都可独立按 `Region`、`Brand`、`Level1`、`Level2` 多选筛选；上层筛选变化后，下层选项仅保留当前上层筛选范围内存在的值。
- 总计 Dashboard 和地区详情弹窗各自独立提供一个品牌多选筛选器，筛选后重新计算 KPI、季度进度、月度趋势和 ASP 图。

## BP 与达成率

- 金额达成率 = 汇总后的实际 Revenue EUR / 汇总后的 Target Revenue EUR。
- 数量达成率 = 汇总后的实际数量 / 汇总后的 Target Quantity。
- 先分别汇总实际和目标，再计算达成率，不平均明细达成率。
- 总览金额卡展示金额目标/达成率；PV、ESS 数量卡展示各自数量目标/达成率。
- 地区卡展示地区 BP 金额，以及“开票达成率 / 总计达成率”。
- 地区筛选收入类型只改变当前显示的销售指标；BP 达成率仍固定显示开票和总计两种口径，便于对照。

## 季度进度

- 展示全年四个季度，默认折叠只显示季度合计行（4行），点击展开显示该季度三个自然月的明细。
- 每行包括开票收入、待确认收入、总收入、BP 金额、开票达成率、总计达成率、PV MW 和 ESS Sets。

## 产品销售分析

- 产品筛选包含 Category、Brand，以及一个可选的分析层级（Level1/Size Family 或 Level2/Product Family）和该层级对应的多选值。第一层级列名兼容 `Level1` 或 `Size Family`，第二层级列名兼容 `Level2` 或 `Product Family`；两者是同一分析维度的两种选择，不同时生效。
- 产品趋势图、销售占比和排名均按用户选择的分析层级聚合展示。
- 可选择销售收入、PV MW 或 ESS Sets；数量指标分开显示，避免不同单位相加。
- 可筛选收入类型、Region、开始月份和结束月份。
- 输出区间总计、领先产品、领先产品占比、最近月环比、按月堆叠趋势、产品占比和排名表。
- 排名表同时显示区间值、占比、最近月、上月和环比；收入以万欧元展示。

## 地区详情

- 各地区卡片提供"查看详情"按钮。
- 点击后以弹窗打开该地区的总计 Dashboard；全年 KPI、未来指标、H1、季度进度、月度金额趋势及 PV/ESS ASP 与总计页使用相同的计算方法，并保留 PV/ESS 独立的四级 ASP 筛选。
- 弹窗中额外提供品牌筛选器，筛选后弹窗内所有指标同步更新。
- 弹窗的数据范围固定为所点击地区，Target 也同步切换到该地区。

## 地区看板筛选级联

- 年份选择后，月份选项自动筛减到所选年份包含的月份。
- 季度选择后，月份选项自动筛减到所选季度包含的月份。
- 年份和季度可同时选择，月份取交集。
- 月份选择框高度与其他三个筛选框对齐。

## 展示边界

- Target 地区映射以日报提供的 Region 为准，页面不再按 Country 做二次推导。
- 利润暂不计算。
- Product-Sub/category 目标已保留在源数据中，但当前仅聚合到地区层级及页面总计。
- 总计 Dashboard 品牌筛选器为单选下拉框，位于"2026年总览"标题上方，与下方 PV/ESS ASP 筛选器独立。筛选后全年 KPI、未来指标、H1、季度进度、月度趋势图表同步更新；地区详情弹窗同样在顶部提供品牌单选筛选器。
- 客户分析模块新增品牌筛选条件，位于工具栏第四列，与地区、年份、产品线、搜索并列。筛选后所有客户分析视图同步更新。
- 客户活跃度判断以当前真实时间为基准（非数据最近月份）：最近3个月内有订单=活跃，4–6个月未下单=沉睡，超过6个月未下单=风险。
