# Cloudflare Pages 门户站点

这是静态门户，用于统一展示模块入口。

## 本地预览

在本目录下：

```powershell
cd D:\Project\portal-site
python -m http.server 8080
```

浏览器打开：`http://localhost:8080`

## 发布到 Cloudflare Pages

- 连接此仓库
- Build command: 留空（或 `echo ok`）
- Build output directory: `/`

## 配置模块

编辑 `modules.json`：
- 修改模块 `url` 到真实页面地址
- 新增模块时按相同结构追加对象

## 留言与反馈

主页反馈表单提交到 Cloudflare Pages Function：`/api/feedback`。

在 Cloudflare Pages 的 Settings → Environment variables 中配置以下任一种接收方式：

### 邮件（Resend）

- `RESEND_API_KEY`：Resend API Key（必需）
- `FEEDBACK_TO_EMAIL`：接收邮箱；未配置时默认使用 `nan02020@qq.com`
- `FEEDBACK_FROM_EMAIL`：发件地址；可选，正式环境建议使用已验证域名

### Webhook

- `FEEDBACK_WEBHOOK_URL`：Teams、Slack 或其他接受 `{ "text": "..." }` JSON 的 Webhook 地址

Webhook 优先于邮件。若服务端尚未配置，主页会提供发送到管理员邮箱的邮件链接作为回退。

## 可用库存分析模块

新增页面：`available-stock-analysis.html`

功能：
- 上传必填文件：`Inventory Step1`、`Stock 模板`
- 上传可选文件：`DailySupplyPlan`、`EUPV ODP MASTER`、`Orderfile_Base_Realtime`
- 浏览器端默认运行 JavaScript 库存分析引擎；保留 `py/inventory_step1_to_stock.py` 作为 Python Legacy 回退
- 输出并下载 `stock_output_YYYYMMDD.xlsx`

### 自动保存 GitHub 历史

库存分析生成文件后，会自动将 `Stock_YYYYMMDD.xlsx` 上传到仓库的 `Stcok History` 目录；同一天重复生成会更新当天文件。页面中的仓库已预填为 `hantsuii/EUPV2026`，首次使用时填写 GitHub Token 并点击“保存配置”。Token 需要目标仓库的 Contents 读写权限（Fine-grained token 只需授予该仓库）。未填写 Token 时仍可正常下载本地文件。

仓库内附带：
- 处理代码：`py/inventory_step1_to_stock.py`
- 模板文件：`templates/stock_template.xlsx`
- 生成的 `stock` sheet 会从 `SKU` sheet 回填 `Connector`，Product 检索标签显示 `Model | SKU | Connector`
- Inventory、Daily Supply Plan、ODP、To be allocated 四个来源均无数量的 SKU，不进入生成的 `stock` 和页面展示
- 取数、计算和呈现规则汇总：`logic/`；引擎、回退、过滤和验证记录见 `logic/说明.md`

## ODP 发运与航线分析模块

新增页面：`modules/odp/odp-shipping-analysis.html`

- 合并当前 PV、H2-2025 与 H1-2025 历史数据，并按 TCL Reference 去重
- 自动排除 Quantity 小于等于 0 的记录
- 按 ATD 日期范围统计 POL 到目的港的实际航程
- 航线默认需累计至少 10 柜且至少 5 个独立航次
- 展示订单月、发货月、到货月产品汇总，以及航线最小、平均、最大航程与经验 P90
- 三个月度分析支持月份范围筛选，发货月与到货月区分实际和预测
- 可使用库存 SKU 工作簿统一映射 Product Model
- 可下载与 Assumption ATP 列结构兼容的 P90 预测表
- 提供航次级准时发货、到港延误、ETA 准确率和运输周期绩效
- 提供可维护的港口标准名称映射，并支持 JSON 导入、导出
