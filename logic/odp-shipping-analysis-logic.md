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

- 订单月份：从 `TCL REFERENCE` 解析订单年月，按 Model 展示计划提货周、实际提货周、实际发货周和到达周。
- 计划提货周：优先读取 `STATUS` 中的 `Wxx`；无法读取时使用 `ETD On S/O - 7天`。
- 发货日历月：有 `ATD PORT` 时标记为实际；没有 ATD 时依次使用 `ETD Update`、`ETD On S/O` 并标记为预测。
- 到货日历月：优先按 `ATA PORT`；没有 ATA 时按 `ETA Update`，再按 `ETA On S/O`，并区分实际与预测。
- 三个业务视角只使用当前 `PV SUPPLY DATA`，历史工作表只用于航线 P90。
- 三个月度视角均支持独立的开始月份和结束月份筛选。
- Model 优先按 `New Ark SKU` 从库存分析 `SKU` 工作表的 `Sku No -> Product Model` 映射；未匹配时保留 ODP Model。

## Assumption ATP P90 输出

- 仅输出当前日期区间、柜量门槛和航次门槛下达标的航线。
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
