# EUPV2026 分析逻辑目录

本目录记录 EUPV2026 当前前端模块的取数、清洗、计算和呈现规则。代码是执行依据，本文档用于业务核对、交接和后续修改时的影响分析。

## 文档

- [库存分析逻辑](./inventory-analysis-logic.md)：`modules/stock/available-stock-analysis.html`、`modules/stock/available-stock-analysis.js`、`modules/stock/stock-analysis-js.js`、`py/inventory_step1_to_stock.py`
- [日报/销售分析逻辑](./daily-report-analysis-logic.md)：`modules/sales/sales-change-analysis.html`、`modules/sales/sales-change-analysis.js`
- [变更说明](./说明.md)：库存分析 JS 默认引擎、Python 回退、Connector、Product 顺序、零数量 SKU 过滤和验证记录

## 当前关键约定

- 库存分析的 SKU 主数据来自库存模板中的 `SKU` sheet，SKU 按去空格并转大写后匹配。
- `SKU` sheet 的 `Connector`/`CONNECTOR` 值会写入生成的 `stock` sheet，并进入 Product 的检索标签；标签顺序为 `Model | SKU | Connector`。
- 日报/销售分析的原始数据来自 `Order details` sheet，当前页面展示的是总览和地区看板。
- 两个模块都在浏览器端完成读取和计算；库存分析默认使用 SheetJS + ExcelJS，保留 Pyodide + openpyxl 作为 Python Legacy 回退；日报/销售分析使用 SheetJS 读取 Excel、Plotly 绘图。
- 修改库存来源、计算、输出字段或展示逻辑时，同时检查 `stock-analysis-js.js`、`available-stock-analysis.js`、`py/inventory_step1_to_stock.py`，并同步更新 `说明.md` 和 `inventory-analysis-logic.md`。
