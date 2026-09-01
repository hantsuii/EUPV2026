# ODP 发运与航线分析口径

## 数据范围

- 优先读取 `PV SUPPLY DATA`。
- 补充读取 `H2-2025 PV DATA` 与 `H1-2025 PV DATA`。
- `H1-2026 PV DATA` 是当前主表的历史快照，不重复读取。
- 按 `TCL REFERENCE` 去重，当前主表优先。
- `Quantity <= 0` 的记录不进入分析；Quantity 为空或无效的记录单独提示。

## 航次和 Lead Time

- 航线：标准化后的 `POL -> PORT DESTINATION`。
- Lead Time：`ATA PORT - ATD PORT`，单位为日历天。
- 同一航次按 `POL + 目的港 + ATD + ATA + 船名/航次` 合并；船名缺失时使用 Booking。
- 航线需同时满足累计至少 10 柜、至少 5 个独立航次才展示统计值。
- P90 使用独立航次 Lead Time 的经验最近秩百分位。
- 用户选择的历史区间按 ATD 日期过滤。

## 港口映射

- 先去除多余空格并统一为大写，再查询映射。
- 复合目的港默认取最后一个连字符后的名称。
- `ROTTERDAM-CORK` 映射为 `CORK`。
- 用户维护结果保存在当前浏览器，并可通过 JSON 导出、导入。
- 仓库默认映射维护在 `modules/odp/port-mapping.js`。

## 三个业务时间视角

- 订单月份：从 `TCL REFERENCE` 解析订单年月，按 `订单月 + Model + 标准起始港 + 标准目的港 + SKU` 汇总 MW 和 Containers；总体按 Model 排序，Model 下按标准目的港（POD）、标准起始港（POL）、订单月份、SKU 排序，订单表不展示 Quantity。
- 订单月的列顺序为订单月份、Model、起始港、目的港、SKU、计划提货周、实际开船周、MW、Containers。
- 计划提货周与实际开船周采用两行展示：第一行按顺序列周数，第二行列该周汇总的 Containers；同一组内 `PO FIRM` 的无发运计划柜量追加在计划周之后，不另起数据行；尚未开船时实际开船周留空。
- 计划提货周：优先读取 `STATUS` 中的 `Wxx`；无法读取时使用 `ETD On S/O - 7天`。
- 发货日历月：按 `月份 + Model + 标准目的港 + SKU + 实际/预测` 汇总；有 `ATD PORT` 时标记为实际，没有 ATD 时依次使用 `ETD Update`、`ETD On S/O` 并标记为预测。
- 到货日历月：按 `月份 + Model + 标准目的港 + SKU + 实际/预测` 汇总；优先按 `ATA PORT`，没有 ATA 时按 `ETA Update`，再按 `ETA On S/O`，并区分实际与预测。
- 三个业务视角只使用当前 `PV SUPPLY DATA`，历史工作表只用于航线 P90。
- 三个月度视角均支持独立的开始月份、结束月份和 Excel 式 Model 搜索多选筛选。
- 月度业务表使用 ODP 的 `New Ark SKU` 作为产品维度，并均展示 Model。Model 优先按库存分析 `SKU` 工作表的 `Sku No -> Product Model` 映射，未匹配时使用 ODP Model。
- 月度业务表不展示记录数列；订单页顶部仅保留 Quantity、MW 和 Containers 汇总指标。

## Assumption ATP P90 输出

- 达标航线使用当前日期区间和门槛下计算的 P90；样本不足的原有 Assumption ATP 航线保留现值并在 Comments 标记。
- `in Weeks = CEILING(P90天数 / 7)`，`in Days = in Weeks * 7`，用于保守的整周预测。
- `New Ark WH` 与 `Customs+Leg3` 优先沿用源文件 `Assumption ATP` 中相同港口组合的值。
- 输出列为 Index、PORT OF LOADING、PORT DESTINATION、New Ark WH、in Days、in Weeks、Customs+Leg3、Comments。

## 运营绩效

- 按独立航次统计，避免同船多个 TCL Reference 重复计数。
- 发货准时：`ATD - ETD On S/O <= 0`。
- 发货延迟不超过7天：`ATD - ETD On S/O <= 7`。
- 到港延迟不超过7天：`ATA - ETA On S/O <= 7`。
- 最新 ETA 准确率：`ABS(ATA - ETA Update) <= 7`。
- 展示实际运输周期的中位数和 P90。
