# 日报 / 销售分析逻辑

销售分析页面位于 `modules/sales/sales-change-analysis.html`，浏览器端读取日报工作簿并生成“总计 Dashboard”“各地区看板”和“产品销售分析”。

## 数据源与标准化

- 实际销售读取 `Order details`，月份以 `Month` 为准，不限制历史年份。
- 收入读取 `Revenue EUR`；退货负金额直接参与求和。
- `Order Status2 = invoiced` 为开票收入，`confirm` 为待确认收入；“总计”包含全部行。
- 地区读取 `Order details.Region`。
- Target 读取 `Target` sheet。地区优先读取 `Region`；为兼容旧日报样例，在 `Region` 不存在时回退到 `Country`。
- 实际和 Target 都应用同一套 H1/H2 地区归并：Italy & Adriatics → Italy、Germany & Austria → DACH、Emerging Market → Central and Eastern Europe、lberia → Southern Europe。
- Target 后台同时汇总 `Revenue EUR` 和 `Quantity`。PV Quantity 对应 MW；ESS Quantity 只汇总 `category Sub = Kits` 的行，对应 Sets；当前不输出 country/category/Product-Sub 层级目标。

## 数量与 ASP

- PV ASP 图在筛选和计算前固定限定 `Category = PV`；PV 数量取 `Total MW`，PV ASP = PV Revenue EUR / (PV MW × 1,000,000)。
- ESS 数量沿用原页面口径：`Unit Price * Qty` 有效，且产品为 Hybrid Inverter、ENERGY+_KIT GEN1、ENERGY+_KIT 或 TCL 时，取 `Ordered Qty`。
- ESS ASP 图在筛选和计算前固定限定 `Category = ESS`；ESS ASP = ESS Revenue EUR / ESS Sets。
- PV 和 ESS ASP 纵向分别展示。每张图都可独立按 `Region`、`Brand`、`Level1`、`Level2` 多选筛选；上层筛选变化后，下层选项仅保留当前上层筛选范围内存在的值。

## BP 与达成率

- 金额达成率 = 汇总后的实际 Revenue EUR / 汇总后的 Target Revenue EUR。
- 数量达成率 = 汇总后的实际数量 / 汇总后的 Target Quantity。
- 先分别汇总实际和目标，再计算达成率，不平均明细达成率。
- 总览金额卡展示金额目标/达成率；PV、ESS 数量卡展示各自数量目标/达成率。
- 地区卡展示地区 BP 金额，以及“开票达成率 / 总计达成率”。
- 地区筛选收入类型只改变当前显示的销售指标；BP 达成率仍固定显示开票和总计两种口径，便于对照。

## 未结束季度

- 按浏览器当前日期识别未结束季度，延续原逻辑展示当前季度及之后季度。
- 每个季度先展示季度合计，再展示该季度三个自然月。
- 每行包括开票收入、待确认收入、总收入、BP 金额、开票达成率、总计达成率、PV MW 和 ESS Sets。

## 产品销售分析

- 产品筛选包含 Category、Brand，以及一个可选的分析层级（Level1 或 Level2）和该层级对应的多选值。Level1、Level2 是同一分析维度的两种选择，不同时生效。
- 产品趋势图、销售占比和排名均按用户选择的分析层级聚合展示。
- 可选择销售收入、PV MW 或 ESS Sets；数量指标分开显示，避免不同单位相加。
- 可筛选收入类型、Region、开始月份和结束月份。
- 输出区间总计、领先产品、领先产品占比、最近月环比、按月堆叠趋势、产品占比和排名表。
- 排名表同时显示区间值、占比、最近月、上月和环比；收入以万欧元展示。

## 地区详情

- 各地区卡片提供“查看详情”按钮。
- 点击后以弹窗打开该地区的总计 Dashboard；全年 KPI、未来指标、H1、未结束季度、月度金额趋势及 PV/ESS ASP 与总计页使用相同的计算方法，并保留 PV/ESS 独立的四级 ASP 筛选。
- 弹窗的数据范围固定为所点击地区，Target 也同步切换到该地区。

## 展示边界

- Target 地区映射以日报提供的 Region 为准，页面不再按 Country 做二次推导。
- 利润暂不计算。
- Product-Sub/category 目标已保留在源数据中，但当前仅聚合到地区层级及页面总计。
