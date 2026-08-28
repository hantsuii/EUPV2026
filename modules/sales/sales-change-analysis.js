const TARGET_YEAR = 2026;
const APP_LANG_KEY = "app_lang";
const byId = (id) => document.getElementById(id);
const statusEl = byId("status"), fileEl = byId("salesFile"), runBtn = byId("runBtn");
const uploadRow = byId("uploadRow"), repoRow = byId("repoRow"), repoSalesPathEl = byId("repoSalesPath");
const langZhBtn = byId("langZh"), langEnBtn = byId("langEn");
const incomeTypeSel = byId("incomeTypeSel"), yearSel = byId("yearSel"), quarterSel = byId("quarterSel"), monthSel = byId("monthSel");
const pvAspFilters = { region: byId("pvAspRegionSel"), brand: byId("pvAspBrandSel"), level1: byId("pvAspLevel1Sel"), level2: byId("pvAspLevel2Sel") };
const essAspFilters = { region: byId("essAspRegionSel"), brand: byId("essAspBrandSel"), level1: byId("essAspLevel1Sel"), level2: byId("essAspLevel2Sel") };
const detailPvAspFilters = { region: byId("detailPvAspRegionSel"), brand: byId("detailPvAspBrandSel"), level1: byId("detailPvAspLevel1Sel"), level2: byId("detailPvAspLevel2Sel") };
const detailEssAspFilters = { region: byId("detailEssAspRegionSel"), brand: byId("detailEssAspBrandSel"), level1: byId("detailEssAspLevel1Sel"), level2: byId("detailEssAspLevel2Sel") };
const regionDetailModal = byId("regionDetailModal"), regionDetailClose = byId("regionDetailClose"), regionDetailTitle = byId("regionDetailTitle");
const productHierarchyFilters = { category: byId("productCategorySel"), brand: byId("productBrandSel"), level1: byId("productLevel1Sel"), level2: byId("productLevel2Sel") };
const productMetricSel = byId("productMetricSel"), productIncomeSel = byId("productIncomeSel");
const productRegionSel = byId("productRegionSel"), productStartMonthSel = byId("productStartMonthSel"), productEndMonthSel = byId("productEndMonthSel");
let currentLang = ["zh", "en"].includes(localStorage.getItem(APP_LANG_KEY)) ? localStorage.getItem(APP_LANG_KEY) : "zh";
let allRows = [], allTargets = [], activeDetailRegion = null;
let lastStatus = { key: "statusInit", vars: {} };

const REGION_ROLLUP_MAP = {
  "Italy & Adriatics Region": "Italy Region",
  "Germany & Austria Region": "DACH Region",
  "Emerging Market": "Central and Eastern Europe Region",
  "lberia Region": "Southern Europe Region",
};
function mapRegionForStats(region) {
  const raw = String(region || "Unknown").trim() || "Unknown";
  return REGION_ROLLUP_MAP[raw] || raw;
}

const I18N = {
  zh: {
    pageTitle: "销售分析看板（PV / ESS）", pageSubtitle: "展示销售、目标达成、ASP 与产品结构趋势。", backHome: "← 返回主页",
    sourceLabel: "Sales 工作簿来源", sourceUpload: "上传本地文件", sourceRepo: "使用仓库文件", uploadLabel: "上传 Sales 工作簿 (.xlsx)", repoPathLabel: "仓库文件路径", repoPathTip: "例如：../../templates/sales_workbook.xlsx", runBtn: "运行分析", statusInit: "请选择文件来源并点击运行。", category: "类别", brand: "品牌", level1: "一级分类", level2: "二级分类", close: "关闭",
    tabTotal: "总计 Dashboard", tabRegion: "各地区看板", tabProduct: "产品销售分析", overviewTitle: "2026年总览", row1Title: "全年核心指标", futureTitle: "未来销售指标（2027+）", row2Title: "H1 销售数据", row3Title: "未结束季度进度",
    filterIncome: "收入类型", filterYear: "年份", filterQuarter: "季度", filterMonth: "月份", filterRegion: "地区", incomeTotal: "总计", incomeInvoiced: "开票收入", incomeConfirm: "待确认收入", all: "全部",
    statusReadRepo: "读取仓库文件：{path}", statusReadUpload: "读取上传文件：{name}", statusNoPath: "请输入仓库文件路径。", statusNoFile: "请先上传销售工作簿文件。", statusNoRows: "Order details 中没有可用的 Month / Quartely 数据。", statusDone: "完成：销售 {allRows} 行，Target {targetRows} 行。", statusFail: "失败：{msg}", statusNoRegion: "当前筛选下无地区数据。", ordersMissing: "工作簿中未找到“Order details”工作表。", targetMissing: "工作簿中未找到“Target”工作表。", repoMissing: "未找到仓库文件：{path}（HTTP {status}）",
    kpiRevenuePair: "开票收入 / 待确认收入(万€)", kpiPvQtyPair: "组件销量MW（开票/待确认）", kpiEssQtyPair: "储能销量Sets（开票/待确认）", kpiBpRate: "BP金额 / 总计达成率", kpiTargetDetail: "目标 {target} / 总计达成 {rate}", kpiFutureRevenue: "未来销售收入(万€)", kpiFuturePvQty: "未来组件销量(MW)", kpiFutureEssQty: "未来储能销量(Sets)", kpiH1Revenue: "H1 开票金额(万€)", kpiH1PvQty: "H1 开票组件销量(MW)", kpiH1EssQty: "H1 开票储能销量(Sets)", kpiH1Rate: "H1 开票达成率",
    qPeriod: "季度 / 月份", qInvoicedAmount: "开票收入(万€)", qConfirmAmount: "待确认收入(万€)", qAllAmount: "总收入(万€)", qTargetAmount: "BP金额(万€)", qInvRate: "开票达成率", qAllRate: "总计达成率", qPvQty: "组件销量(MW)", qEssQty: "储能销量(Sets)",
    chartAmountTitle: "2026 月度销售金额变化（折线=总金额，柱=组件/ESS）", chartAmountY: "金额(万€)", chartTotalAmount: "总金额(万€)", chartPvAmount: "组件金额(万€)", chartEssAmount: "ESS金额(万€)", pvAspFilterTitle: "PV ASP 筛选", essAspFilterTitle: "ESS ASP 筛选", chartPvAspTitle: "2026 月度组件ASP变化", chartPvAsp: "组件ASP(€/W)", chartEssAspTitle: "2026 月度储能ASP变化", chartEssAsp: "储能ASP(€/Set)",
    regTotal: "总金额(万€)", regBp: "BP金额(万€)", regBpRate: "BP达成（开票/总计）", regShare: "总金额占比", regEssAmount: "储能金额(万€)", regEssQty: "储能销量(Sets)", regEssAsp: "储能ASP(€/Set)", regPvAmount: "组件金额(万€)", regPvQty: "组件销量(MW)", regPvAsp: "组件ASP(€/W)", regionDetails: "查看详情", regionDetailTitle: "{region} 总计 Dashboard",
    productTitle: "产品销售分析", productMetric: "分析指标", productHierarchyTitle: "产品层级筛选", productControlTitle: "分析条件", metricRevenue: "销售收入", metricPvQty: "PV 销量 (MW)", metricEssQty: "ESS 销量 (Sets)", startMonth: "开始月份", endMonth: "结束月份", productNote: "数量视图分别显示 PV MW 或 ESS Sets，避免不同单位相加；图表和排名默认按 Level2 展示。", productTotal: "筛选区间总计", productTop: "领先产品", productTopShare: "领先产品占比", productMom: "最近月环比", productTrend: "月度趋势", productShare: "销售占比", rankName: "产品", rankValue: "指标值", rankShare: "占比", rankLatest: "最近月", rankPrevious: "上月", rankMom: "环比", noData: "无数据", other: "其他", empty: "",
  },
  en: {
    pageTitle: "Sales Analytics Dashboard (PV / ESS)", pageSubtitle: "Sales, target achievement, ASP and product-mix trends.", backHome: "← Back to Home",
    sourceLabel: "Sales Workbook Source", sourceUpload: "Upload local file", sourceRepo: "Use repository file", uploadLabel: "Upload Sales Workbook (.xlsx)", repoPathLabel: "Repository file path", repoPathTip: "Example: ../../templates/sales_workbook.xlsx", runBtn: "Run Analysis", statusInit: "Choose a source and click Run Analysis.", category: "Category", brand: "Brand", level1: "Level 1", level2: "Level 2", close: "Close",
    tabTotal: "Total Dashboard", tabRegion: "Regional Dashboard", tabProduct: "Product Analysis", overviewTitle: "2026 Overview", row1Title: "Full-Year Core Metrics", futureTitle: "Future Sales Metrics (2027+)", row2Title: "H1 Sales Metrics", row3Title: "Open Quarter Progress",
    filterIncome: "Income Type", filterYear: "Year", filterQuarter: "Quarter", filterMonth: "Month", filterRegion: "Region", incomeTotal: "Total", incomeInvoiced: "Invoiced", incomeConfirm: "Pending Confirmation", all: "All",
    statusReadRepo: "Loading repository file: {path}", statusReadUpload: "Reading uploaded file: {name}", statusNoPath: "Please enter the repository file path.", statusNoFile: "Please upload the sales workbook first.", statusNoRows: "No usable Month / Quartely data in Order details.", statusDone: "Done: {allRows} sales rows, {targetRows} target rows.", statusFail: "Failed: {msg}", statusNoRegion: "No regional data under current filters.", ordersMissing: "Sheet 'Order details' was not found in the workbook.", targetMissing: "Sheet 'Target' was not found in the workbook.", repoMissing: "Repository file not found: {path} (HTTP {status})",
    kpiRevenuePair: "Invoiced / Pending Revenue (10k €)", kpiPvQtyPair: "PV Qty MW (Invoiced/Pending)", kpiEssQtyPair: "ESS Qty Sets (Invoiced/Pending)", kpiBpRate: "BP Revenue / Total Achievement", kpiTargetDetail: "Target {target} / Total achievement {rate}", kpiFutureRevenue: "Future Revenue (10k €)", kpiFuturePvQty: "Future PV Qty (MW)", kpiFutureEssQty: "Future ESS Qty (Sets)", kpiH1Revenue: "H1 Invoiced Revenue (10k €)", kpiH1PvQty: "H1 Invoiced PV Qty (MW)", kpiH1EssQty: "H1 Invoiced ESS Qty (Sets)", kpiH1Rate: "H1 Invoiced Achievement",
    qPeriod: "Quarter / Month", qInvoicedAmount: "Invoiced (10k €)", qConfirmAmount: "Pending Confirmation (10k €)", qAllAmount: "Total (10k €)", qTargetAmount: "BP (10k €)", qInvRate: "Invoiced Achievement", qAllRate: "Total Achievement", qPvQty: "PV Qty (MW)", qEssQty: "ESS Qty (Sets)",
    chartAmountTitle: "2026 Monthly Sales Amount (line=total, bars=PV/ESS)", chartAmountY: "Amount (10k €)", chartTotalAmount: "Total Amount (10k €)", chartPvAmount: "PV Amount (10k €)", chartEssAmount: "ESS Amount (10k €)", pvAspFilterTitle: "PV ASP Filters", essAspFilterTitle: "ESS ASP Filters", chartPvAspTitle: "2026 Monthly PV ASP", chartPvAsp: "PV ASP (€/W)", chartEssAspTitle: "2026 Monthly ESS ASP", chartEssAsp: "ESS ASP (€/Set)",
    regTotal: "Total Amount (10k €)", regBp: "BP Revenue (10k €)", regBpRate: "BP Achievement (Inv./Total)", regShare: "Share", regEssAmount: "ESS Amount (10k €)", regEssQty: "ESS Qty (Sets)", regEssAsp: "ESS ASP (€/Set)", regPvAmount: "PV Amount (10k €)", regPvQty: "PV Qty (MW)", regPvAsp: "PV ASP (€/W)", regionDetails: "View details", regionDetailTitle: "{region} Total Dashboard",
    productTitle: "Product Sales Analysis", productMetric: "Metric", productHierarchyTitle: "Product Hierarchy Filters", productControlTitle: "Analysis Settings", metricRevenue: "Sales Revenue", metricPvQty: "PV Qty (MW)", metricEssQty: "ESS Qty (Sets)", startMonth: "Start Month", endMonth: "End Month", productNote: "PV MW and ESS Sets are shown separately; charts and ranking are shown by Level2.", productTotal: "Period Total", productTop: "Leading Product", productTopShare: "Leading Product Share", productMom: "Latest MoM", productTrend: "Monthly Trend", productShare: "Sales Share", rankName: "Product", rankValue: "Value", rankShare: "Share", rankLatest: "Latest Month", rankPrevious: "Previous Month", rankMom: "MoM", noData: "No data", other: "Other", empty: "",
  },
};

function t(key, vars = {}) { let text = I18N[currentLang]?.[key] ?? I18N.zh[key] ?? key; Object.entries(vars).forEach(([k, v]) => { text = text.replace(`{${k}}`, String(v)); }); return text; }
function setStatus(key, vars = {}) { lastStatus = { key, vars }; statusEl.textContent = t(key, vars); }
function n(v) { const x = Number(v); return Number.isFinite(x) ? x : 0; }
function hasValue(v) { return !(v == null || String(v).trim() === ""); }
function esc(v) { return String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
function fmtWanInt(v) { return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.round(n(v) / 10000)); }
function fmtInt(v) { return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.round(n(v))); }
function fmtOne(v) { return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(n(v)); }
function fmtAsp3(v) { return Number.isFinite(v) ? new Intl.NumberFormat("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(v) : ""; }
function fmtPct(v) { return Number.isFinite(v) ? `${v.toFixed(1)}%` : ""; }
function achievement(actual, target) { return target !== 0 ? actual / target * 100 : null; }

function parseExcelDate(value) {
  if (value == null || value === "") return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "number") return new Date(Math.floor(value - 25569) * 86400 * 1000);
  const d = new Date(String(value).trim()); return Number.isNaN(d.getTime()) ? null : d;
}
function normalizeMonth(value) {
  if (value == null || value === "") return null;
  if (typeof value === "number") { const d = parseExcelDate(value); return d ? `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}` : null; }
  const s = String(value).trim(); let m = s.match(/^(\d{4})[-/.](\d{1,2})$/);
  if (m) return `${m[1]}-${String(Number(m[2])).padStart(2, "0")}`;
  m = s.match(/^(\d{2})[-/.](\d{1,2})$/); if (m) return `20${m[1]}-${String(Number(m[2])).padStart(2, "0")}`;
  const d = new Date(s); return Number.isNaN(d.getTime()) ? null : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function normalizeQuarter(value, fallbackMonth) {
  const match = String(value ?? "").toUpperCase().trim().match(/Q?([1-4])/); if (match) return `Q${match[1]}`;
  return fallbackMonth ? `Q${Math.floor((Number(fallbackMonth.slice(5, 7)) - 1) / 3) + 1}` : null;
}

function normalizeRows(rawRows) {
  return rawRows.map((row) => {
    const month = normalizeMonth(row["Month"]), rawYear = n(row["year"]), year = rawYear > 0 ? Math.trunc(rawYear) : (month ? Number(month.slice(0, 4)) : null);
    const quarter = normalizeQuarter(row["Quartely"], month), status = String(row["Order Status2"] || "").trim().toLowerCase(), revenue = n(row["Revenue EUR"]);
    const category = String(row["Category"] || "Unknown").trim().toUpperCase() || "UNKNOWN";
    const tcl = String(row["TCL Report Product"] || "").trim().toUpperCase(), mid = String(row["Product Mid Category"] || "").trim().toUpperCase();
    const isPV = category === "PV", isESS = category === "ESS";
    const essQtyEligible = isESS && hasValue(row["Unit Price * Qty"]) && n(row["Unit Price * Qty"]) !== 0 && (mid === "HYBRID INVERTER" || ["ENERGY+_KIT GEN1", "ENERGY+_KIT", "TCL"].includes(tcl));
    return { year, quarter, month, region: mapRegionForStats(row["Region"]), revenue, isInvoiced: status === "invoiced", isConfirm: status === "confirm", category, isPV, isESS, isHP: category === "HP", brand: String(row["Brand"] || "Unknown").trim() || "Unknown", level1: String(row["Level1"] || "Unknown").trim() || "Unknown", level2: String(row["Level2"] || "Unknown").trim() || "Unknown", pvAmount: isPV ? revenue : 0, essAmount: isESS ? revenue : 0, pvQty: isPV ? n(row["Total MW"]) : 0, essQty: essQtyEligible ? n(row["Ordered Qty"]) : 0 };
  }).filter((r) => Number.isFinite(r.year) && r.quarter && r.month);
}
function normalizeTargets(rawRows) {
  return rawRows.map((row) => {
    const month = normalizeMonth(row["Month"]), rawYear = n(row["Year"] ?? row["year"]), year = rawYear > 0 ? Math.trunc(rawYear) : (month ? Number(month.slice(0, 4)) : null);
    const category = String(row["category"] ?? row["Category"] ?? "Unknown").trim().toUpperCase(), quantity = n(row["Quantity"]);
    const categorySub = String(row["category Sub"] ?? row["Category Sub"] ?? row["Sub Type"] ?? "").trim().toUpperCase();
    return { year, month, quarter: normalizeQuarter(row["Quartely"], month), region: mapRegionForStats(row["Region"] ?? row["Country"]), category, revenue: n(row["Revenue EUR"]), quantity, pvQty: category === "PV" ? quantity : 0, essQty: category === "ESS" && categorySub === "KITS" ? quantity : 0 };
  }).filter((r) => Number.isFinite(r.year) && r.month && r.quarter && r.region !== "Unknown");
}

function initAgg() { return { revenue: 0, pvAmount: 0, essAmount: 0, pvQty: 0, essQty: 0 }; }
function addAgg(a, r) { a.revenue += r.revenue; a.pvAmount += r.pvAmount || 0; a.essAmount += r.essAmount || 0; a.pvQty += r.pvQty || 0; a.essQty += r.essQty || 0; return a; }
function aggregate(rows) { return rows.reduce((a, r) => addAgg(a, r), initAgg()); }
function targetAgg(rows) { return rows.reduce((a, r) => { a.revenue += r.revenue; a.pvQty += r.pvQty; a.essQty += r.essQty; return a; }, { revenue: 0, pvQty: 0, essQty: 0 }); }
function selected(el) { return [...el.options].filter((o) => o.selected).map((o) => o.value); }
function filterMulti(rows, values, picker) { if (!values.length || values.includes("__ALL__") || values.includes("total")) return rows; const set = new Set(values); return rows.filter((r) => set.has(picker(r))); }
function filterIncome(rows, typeOrTypes) { const types = Array.isArray(typeOrTypes) ? typeOrTypes : [typeOrTypes]; if (!types.length || types.includes("total")) return rows; return rows.filter((r) => (types.includes("invoiced") && r.isInvoiced) || (types.includes("confirm") && r.isConfirm)); }
function fillSelect(el, options, selectedValues = ["__ALL__"]) { el.innerHTML = options.map((o) => `<option value="${esc(o.value)}">${esc(o.label)}</option>`).join(""); const set = new Set(selectedValues.map(String)); [...el.options].forEach((o) => { o.selected = set.has(o.value); }); if (![...el.options].some((o) => o.selected) && el.options.length) el.options[0].selected = true; }
function table(elId, headers, rows) { const head = `<thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead>`; const body = rows.length ? rows.map((row) => { const values = Array.isArray(row) ? row : row.values, cls = Array.isArray(row) ? "" : ` class="${esc(row.className || "")}"`; return `<tr${cls}>${values.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`; }).join("") : `<tr><td colspan="${headers.length}">${esc(t("noData"))}</td></tr>`; byId(elId).innerHTML = `${head}<tbody>${body}</tbody>`; }
function renderPlot(divId, traces, layout = {}) { const base = { paper_bgcolor: "#fff", plot_bgcolor: "#fff", font: { color: "#2e4f7a" }, margin: { l: 62, r: 32, t: 52, b: 72 }, legend: { orientation: "h", y: -0.25 }, xaxis: { gridcolor: "#e2ecf9" }, yaxis: { gridcolor: "#e2ecf9" } }; window.Plotly.newPlot(divId, traces, { ...base, ...layout }, { responsive: true, displayModeBar: false }); }
function card(name, value, detail = "") { return `<div class="kpi-card"><div class="kpi-name">${esc(name)}</div><div class="kpi-value">${esc(value)}</div>${detail ? `<div class="mini-tip">${esc(detail)}</div>` : ""}</div>`; }

function optionsForRows(rows, field) {
  return [...new Set(rows.map((r) => r[field]))].sort().map((v) => ({ value: v, label: v }));
}
function refreshAspCascade(filters, reset = false, sourceRows = allRows) {
  const allOption = { value: "__ALL__", label: t("all") };
  if (reset) fillSelect(filters.region, [allOption, ...optionsForRows(sourceRows, "region")], ["__ALL__"]);
  let scope = filterMulti(sourceRows, selected(filters.region), (r) => r.region);
  fillSelect(filters.brand, [allOption, ...optionsForRows(scope, "brand")], reset ? ["__ALL__"] : selected(filters.brand));
  scope = filterMulti(scope, selected(filters.brand), (r) => r.brand);
  fillSelect(filters.level1, [allOption, ...optionsForRows(scope, "level1")], reset ? ["__ALL__"] : selected(filters.level1));
  scope = filterMulti(scope, selected(filters.level1), (r) => r.level1);
  fillSelect(filters.level2, [allOption, ...optionsForRows(scope, "level2")], reset ? ["__ALL__"] : selected(filters.level2));
}
function refreshProductCascade(reset = false) {
  const allOption = { value: "__ALL__", label: t("all") };
  if (reset) fillSelect(productHierarchyFilters.category, [allOption, ...optionsForRows(allRows, "category")], ["__ALL__"]);
  let scope = filterMulti(allRows, selected(productHierarchyFilters.category), (r) => r.category);
  fillSelect(productHierarchyFilters.brand, [allOption, ...optionsForRows(scope, "brand")], reset ? ["__ALL__"] : selected(productHierarchyFilters.brand));
  scope = filterMulti(scope, selected(productHierarchyFilters.brand), (r) => r.brand);
  fillSelect(productHierarchyFilters.level1, [allOption, ...optionsForRows(scope, "level1")], reset ? ["__ALL__"] : selected(productHierarchyFilters.level1));
  scope = filterMulti(scope, selected(productHierarchyFilters.level1), (r) => r.level1);
  fillSelect(productHierarchyFilters.level2, [allOption, ...optionsForRows(scope, "level2")], reset ? ["__ALL__"] : selected(productHierarchyFilters.level2));
}
function applyProductHierarchyFilters(rows) {
  let result = filterMulti(rows, selected(productHierarchyFilters.category), (r) => r.category);
  result = filterMulti(result, selected(productHierarchyFilters.brand), (r) => r.brand);
  result = filterMulti(result, selected(productHierarchyFilters.level1), (r) => r.level1);
  return filterMulti(result, selected(productHierarchyFilters.level2), (r) => r.level2);
}
function initFilters() {
  const allOption = { value: "__ALL__", label: t("all") }, years = [...new Set(allRows.map((r) => r.year))].sort((a, b) => a - b), months = [...new Set(allRows.map((r) => r.month))].sort(), regions = [...new Set(allRows.map((r) => r.region))].sort();
  fillSelect(yearSel, [allOption, ...years.map((v) => ({ value: String(v), label: String(v) }))], years.includes(TARGET_YEAR) ? [String(TARGET_YEAR)] : ["__ALL__"]);
  fillSelect(quarterSel, [allOption, ...[1, 2, 3, 4].map((q) => ({ value: `Q${q}`, label: `Q${q}` }))]); fillSelect(monthSel, [allOption, ...months.map((v) => ({ value: v, label: v }))]);
  fillSelect(incomeTypeSel, [{ value: "total", label: t("incomeTotal") }, { value: "invoiced", label: t("incomeInvoiced") }, { value: "confirm", label: t("incomeConfirm") }], ["total"]);
  refreshAspCascade(pvAspFilters, true, allRows.filter((r) => r.isPV)); refreshAspCascade(essAspFilters, true, allRows.filter((r) => r.isESS)); refreshProductCascade(true); fillSelect(productRegionSel, [allOption, ...regions.map((v) => ({ value: v, label: v }))]);
  fillSelect(productStartMonthSel, months.map((v) => ({ value: v, label: v })), months.length ? [months[0]] : []); fillSelect(productEndMonthSel, months.map((v) => ({ value: v, label: v })), months.length ? [months[months.length - 1]] : []);
}

function renderOverview() {
  renderDashboard(allRows, allTargets, {
    year: "yearKpiRow", future: "futureKpiRow", h1: "h1KpiRow", quarter: "quarterProgressTable",
    trend: "monthlyTrendChart", pvAsp: "monthlyPvAspChart", essAsp: "monthlyEssAspChart",
  }, { pv: pvAspFilters, ess: essAspFilters });
  setStatus("statusDone", { allRows: allRows.length, targetRows: allTargets.length });
}
function renderDashboard(sourceRows, sourceTargets, ids, aspFilters = null) {
  const yearRows = sourceRows.filter((r) => r.year === TARGET_YEAR), targetYear = sourceTargets.filter((r) => r.year === TARGET_YEAR);
  const aggInv = aggregate(yearRows.filter((r) => r.isInvoiced)), aggConf = aggregate(yearRows.filter((r) => r.isConfirm)), aggYear = aggregate(yearRows), bpYear = targetAgg(targetYear);
  byId(ids.year).innerHTML = [
    card(t("kpiRevenuePair"), `${fmtWanInt(aggInv.revenue)} / ${fmtWanInt(aggConf.revenue)}`, t("kpiTargetDetail", { target: fmtWanInt(bpYear.revenue), rate: fmtPct(achievement(aggYear.revenue, bpYear.revenue)) })),
    card(t("kpiPvQtyPair"), `${fmtInt(aggInv.pvQty)} / ${fmtInt(aggConf.pvQty)}`, t("kpiTargetDetail", { target: fmtOne(bpYear.pvQty), rate: fmtPct(achievement(aggYear.pvQty, bpYear.pvQty)) })),
    card(t("kpiEssQtyPair"), `${fmtInt(aggInv.essQty)} / ${fmtInt(aggConf.essQty)}`, t("kpiTargetDetail", { target: fmtInt(bpYear.essQty), rate: fmtPct(achievement(aggYear.essQty, bpYear.essQty)) })),
    card(t("kpiBpRate"), `${fmtWanInt(bpYear.revenue)} / ${fmtPct(achievement(aggYear.revenue, bpYear.revenue))}`),
  ].join("");
  const future = aggregate(sourceRows.filter((r) => r.year > TARGET_YEAR)); byId(ids.future).innerHTML = [card(t("kpiFutureRevenue"), fmtWanInt(future.revenue)), card(t("kpiFuturePvQty"), fmtInt(future.pvQty)), card(t("kpiFutureEssQty"), fmtInt(future.essQty))].join("");
  const h1Inv = aggregate(yearRows.filter((r) => r.month <= `${TARGET_YEAR}-06` && r.isInvoiced)), h1Bp = targetAgg(targetYear.filter((r) => r.month <= `${TARGET_YEAR}-06`));
  byId(ids.h1).innerHTML = [card(t("kpiH1Revenue"), fmtWanInt(h1Inv.revenue)), card(t("kpiH1PvQty"), fmtInt(h1Inv.pvQty)), card(t("kpiH1EssQty"), fmtInt(h1Inv.essQty)), card(t("kpiH1Rate"), fmtPct(achievement(h1Inv.revenue, h1Bp.revenue)))].join("");
  renderQuarterProgress(yearRows, targetYear, ids.quarter); renderMonthlyRevenue(yearRows, ids.trend); renderAspCharts(yearRows, ids.pvAsp, ids.essAsp, aspFilters);
}
function renderQuarterProgress(yearRows, targetYear, tableId) {
  const now = new Date(), currentQuarter = now.getFullYear() === TARGET_YEAR ? Math.floor(now.getMonth() / 3) + 1 : (now.getFullYear() < TARGET_YEAR ? 1 : 4), rows = [];
  [1, 2, 3, 4].filter((q) => q >= currentQuarter).forEach((q) => {
    const qk = `Q${q}`, monthKeys = [q * 3 - 2, q * 3 - 1, q * 3].map((m) => `${TARGET_YEAR}-${String(m).padStart(2, "0")}`), periods = [{ label: `${TARGET_YEAR}-${qk}`, months: monthKeys, className: "quarter-total" }, ...monthKeys.map((m) => ({ label: m, months: [m], className: "quarter-month" }))];
    periods.forEach((period) => { const sales = yearRows.filter((r) => period.months.includes(r.month)), inv = aggregate(sales.filter((r) => r.isInvoiced)), conf = aggregate(sales.filter((r) => r.isConfirm)), total = aggregate(sales), bp = targetAgg(targetYear.filter((r) => period.months.includes(r.month))); rows.push({ className: period.className, values: [period.label, fmtWanInt(inv.revenue), fmtWanInt(conf.revenue), fmtWanInt(total.revenue), fmtWanInt(bp.revenue), fmtPct(achievement(inv.revenue, bp.revenue)), fmtPct(achievement(total.revenue, bp.revenue)), fmtInt(total.pvQty), fmtInt(total.essQty)] }); });
  });
  table(tableId, [t("qPeriod"), t("qInvoicedAmount"), t("qConfirmAmount"), t("qAllAmount"), t("qTargetAmount"), t("qInvRate"), t("qAllRate"), t("qPvQty"), t("qEssQty")], rows);
}
function renderMonthlyRevenue(yearRows, chartId) {
  const months = Array.from({ length: 12 }, (_, i) => `${TARGET_YEAR}-${String(i + 1).padStart(2, "0")}`), data = months.map((m) => aggregate(yearRows.filter((r) => r.month === m)));
  renderPlot(chartId, [{ x: months, y: data.map((x) => x.revenue / 10000), type: "scatter", mode: "lines+markers", name: t("chartTotalAmount"), line: { color: "#458CFF", width: 3 } }, { x: months, y: data.map((x) => x.pvAmount / 10000), type: "bar", name: t("chartPvAmount"), marker: { color: "#7CB4FF" } }, { x: months, y: data.map((x) => x.essAmount / 10000), type: "bar", name: t("chartEssAmount"), marker: { color: "#B48BFF" } }], { title: t("chartAmountTitle"), barmode: "group", yaxis: { title: t("chartAmountY") } });
}
function applyAspFilters(rows, filters) {
  if (!filters) return rows;
  let result = filterMulti(rows, selected(filters.region), (r) => r.region);
  result = filterMulti(result, selected(filters.brand), (r) => r.brand);
  result = filterMulti(result, selected(filters.level1), (r) => r.level1);
  return filterMulti(result, selected(filters.level2), (r) => r.level2);
}
function renderAspCharts(yearRows, pvChartId, essChartId, filters = null) {
  const months = Array.from({ length: 12 }, (_, i) => `${TARGET_YEAR}-${String(i + 1).padStart(2, "0")}`);
  const pvRows = yearRows.filter((r) => r.isPV), essRows = yearRows.filter((r) => r.isESS);
  const pvData = months.map((m) => aggregate(applyAspFilters(pvRows.filter((r) => r.month === m), filters?.pv))), pv = pvData.map((x) => x.pvQty !== 0 ? x.pvAmount / (x.pvQty * 1000000) : null);
  const essData = months.map((m) => aggregate(applyAspFilters(essRows.filter((r) => r.month === m), filters?.ess))), ess = essData.map((x) => x.essQty !== 0 ? x.essAmount / x.essQty : null);
  renderPlot(pvChartId, [{ x: months, y: pv, type: "scatter", mode: "lines+markers+text", text: pv.map((v) => v == null ? "" : fmtAsp3(v)), textposition: "top center", name: t("chartPvAsp"), line: { color: "#2E7CFF", width: 3 } }], { title: t("chartPvAspTitle"), yaxis: { title: t("chartPvAsp") } });
  renderPlot(essChartId, [{ x: months, y: ess, type: "scatter", mode: "lines+markers+text", text: ess.map((v) => v == null ? "" : fmtInt(v)), textposition: "top center", name: t("chartEssAsp"), line: { color: "#9D63FF", width: 3 } }], { title: t("chartEssAspTitle"), yaxis: { title: t("chartEssAsp") } });
}

function renderRegion() {
  let baseRows = filterMulti([...allRows], selected(yearSel), (r) => String(r.year)); baseRows = filterMulti(baseRows, selected(quarterSel), (r) => r.quarter); baseRows = filterMulti(baseRows, selected(monthSel), (r) => r.month);
  const rows = filterIncome(baseRows, selected(incomeTypeSel));
  let targets = filterMulti([...allTargets], selected(yearSel), (r) => String(r.year)); targets = filterMulti(targets, selected(quarterSel), (r) => r.quarter); targets = filterMulti(targets, selected(monthSel), (r) => r.month);
  const totalRevenue = rows.reduce((sum, r) => sum + r.revenue, 0), regions = [...new Set([...rows.map((r) => r.region), ...targets.map((r) => r.region)])];
  const list = regions.map((region) => ({ region, agg: aggregate(rows.filter((r) => r.region === region)), inv: aggregate(baseRows.filter((r) => r.region === region && r.isInvoiced)), full: aggregate(baseRows.filter((r) => r.region === region)), bp: targetAgg(targets.filter((r) => r.region === region)) })).sort((a, b) => b.agg.revenue - a.agg.revenue), grid = byId("regionGrid");
  if (!list.length) { grid.innerHTML = `<div class="mini-tip">${esc(t("statusNoRegion"))}</div>`; return; }
  grid.innerHTML = list.map(({ region, agg, inv, full, bp }) => { const share = totalRevenue !== 0 ? agg.revenue / totalRevenue * 100 : null, pvAsp = agg.pvQty !== 0 ? agg.pvAmount / (agg.pvQty * 1000000) : null, essAsp = agg.essQty !== 0 ? agg.essAmount / agg.essQty : null; return `<article class="region-card"><h4 class="region-title">${esc(region)}</h4><div class="metric-row"><span class="metric-label">${esc(t("regTotal"))}</span><span class="metric-value">${fmtWanInt(agg.revenue)}</span></div><div class="metric-row"><span class="metric-label">${esc(t("regBp"))}</span><span class="metric-value">${fmtWanInt(bp.revenue)}</span></div><div class="metric-row"><span class="metric-label">${esc(t("regBpRate"))}</span><span class="metric-value">${fmtPct(achievement(inv.revenue, bp.revenue))} / ${fmtPct(achievement(full.revenue, bp.revenue))}</span></div><div class="metric-row"><span class="metric-label">${esc(t("regShare"))}</span><span class="metric-value">${fmtPct(share)}</span></div>${agg.pvAmount !== 0 || agg.pvQty !== 0 ? `<div class="metric-row"><span class="metric-label">${esc(t("regPvAmount"))}</span><span class="metric-value">${fmtWanInt(agg.pvAmount)}</span></div><div class="metric-row"><span class="metric-label">${esc(t("regPvQty"))}</span><span class="metric-value">${fmtInt(agg.pvQty)}</span></div><div class="metric-row"><span class="metric-label">${esc(t("regPvAsp"))}</span><span class="metric-value">${fmtAsp3(pvAsp)}</span></div>` : ""}${agg.essAmount !== 0 || agg.essQty !== 0 ? `<div class="metric-row"><span class="metric-label">${esc(t("regEssAmount"))}</span><span class="metric-value">${fmtWanInt(agg.essAmount)}</span></div><div class="metric-row"><span class="metric-label">${esc(t("regEssQty"))}</span><span class="metric-value">${fmtInt(agg.essQty)}</span></div><div class="metric-row"><span class="metric-label">${esc(t("regEssAsp"))}</span><span class="metric-value">${fmtInt(essAsp)}</span></div>` : ""}<button class="detail-btn" type="button" data-region="${esc(region)}">${esc(t("regionDetails"))}</button></article>`; }).join("");
}

function openRegionDetails(region) {
  activeDetailRegion = region;
  renderRegionDetails(true);
  regionDetailModal.classList.add("open");
}
function renderRegionDetails(resetFilters = false) {
  if (!activeDetailRegion) return;
  const region = activeDetailRegion;
  const rows = allRows.filter((r) => r.region === region), targets = allTargets.filter((r) => r.region === region);
  regionDetailTitle.textContent = t("regionDetailTitle", { region });
  refreshAspCascade(detailPvAspFilters, resetFilters, rows.filter((r) => r.isPV)); refreshAspCascade(detailEssAspFilters, resetFilters, rows.filter((r) => r.isESS));
  renderDashboard(rows, targets, {
    year: "detailYearKpiRow", future: "detailFutureKpiRow", h1: "detailH1KpiRow", quarter: "detailQuarterProgressTable",
    trend: "detailMonthlyTrendChart", pvAsp: "detailMonthlyPvAspChart", essAsp: "detailMonthlyEssAspChart",
  }, { pv: detailPvAspFilters, ess: detailEssAspFilters });
}
function closeRegionDetails() { regionDetailModal.classList.remove("open"); }

function productValue(row, metric) { return metric === "pvQty" ? row.pvQty : metric === "essQty" ? row.essQty : row.revenue; }
function formatProductValue(value, metric) { return metric === "revenue" ? fmtWanInt(value) : metric === "pvQty" ? fmtOne(value) : fmtInt(value); }
function renderProduct() {
  if (!allRows.length) return;
  const metric = productMetricSel.value, dimension = "level2";
  let start = productStartMonthSel.value, end = productEndMonthSel.value;
  if (start > end) [start, end] = [end, start];
  let rows = filterIncome([...allRows], productIncomeSel.value).filter((r) => r.month >= start && r.month <= end); if (productRegionSel.value !== "__ALL__") rows = rows.filter((r) => r.region === productRegionSel.value); rows = applyProductHierarchyFilters(rows); if (metric === "pvQty") rows = rows.filter((r) => r.isPV); if (metric === "essQty") rows = rows.filter((r) => r.isESS);
  const months = [...new Set(allRows.map((r) => r.month).filter((m) => m >= start && m <= end))].sort(), totals = new Map(); rows.forEach((r) => totals.set(r[dimension], (totals.get(r[dimension]) || 0) + productValue(r, metric)));
  const ranking = [...totals.entries()].sort((a, b) => b[1] - a[1]), total = ranking.reduce((s, x) => s + x[1], 0), latest = months[months.length - 1], previous = months[months.length - 2], topName = ranking[0]?.[0] || t("noData"), latestTotal = rows.filter((r) => r.month === latest).reduce((s, r) => s + productValue(r, metric), 0), previousTotal = rows.filter((r) => r.month === previous).reduce((s, r) => s + productValue(r, metric), 0);
  byId("productKpiRow").innerHTML = [card(t("productTotal"), formatProductValue(total, metric)), card(t("productTop"), topName), card(t("productTopShare"), fmtPct(total !== 0 && ranking.length ? ranking[0][1] / total * 100 : null)), card(t("productMom"), fmtPct(previousTotal !== 0 ? (latestTotal / previousTotal - 1) * 100 : null))].join("");
  const topNames = ranking.slice(0, 8).map((x) => x[0]), traces = topNames.map((name) => ({ x: months, y: months.map((m) => rows.filter((r) => r.month === m && r[dimension] === name).reduce((s, r) => s + productValue(r, metric), 0) / (metric === "revenue" ? 10000 : 1)), type: "bar", name }));
  if (ranking.length > 8) traces.push({ x: months, y: months.map((m) => rows.filter((r) => r.month === m && !topNames.includes(r[dimension])).reduce((s, r) => s + productValue(r, metric), 0) / (metric === "revenue" ? 10000 : 1)), type: "bar", name: t("other") });
  const metricTitle = t(metric === "revenue" ? "metricRevenue" : metric === "pvQty" ? "metricPvQty" : "metricEssQty"); renderPlot("productTrendChart", traces, { title: `${t("productTrend")} · ${metricTitle}`, barmode: "stack", yaxis: { title: metric === "revenue" ? `${metricTitle} (10k €)` : metricTitle } });
  const positive = ranking.filter((x) => x[1] > 0), pieData = positive.slice(0, 9);
  if (positive.length > 9) pieData.push([t("other"), positive.slice(9).reduce((sum, x) => sum + x[1], 0)]);
  renderPlot("productShareChart", [{ labels: pieData.map((x) => x[0]), values: pieData.map((x) => x[1]), type: "pie", hole: 0.5, textinfo: "label+percent", textposition: "inside", hovertemplate: "%{label}<br>%{value:,.0f}<br>%{percent}<extra></extra>" }], { title: `${t("productShare")} · ${metricTitle}`, showlegend: true, legend: { orientation: "h", y: -0.18, x: 0, font: { size: 11 } }, margin: { l: 24, r: 24, t: 52, b: 96 } });
  const rankRows = ranking.map(([name, value]) => { const latestValue = rows.filter((r) => r.month === latest && r[dimension] === name).reduce((s, r) => s + productValue(r, metric), 0), previousValue = rows.filter((r) => r.month === previous && r[dimension] === name).reduce((s, r) => s + productValue(r, metric), 0); return [name, formatProductValue(value, metric), fmtPct(total !== 0 ? value / total * 100 : null), formatProductValue(latestValue, metric), formatProductValue(previousValue, metric), fmtPct(previousValue !== 0 ? (latestValue / previousValue - 1) * 100 : null)]; });
  table("productRankingTable", [t("rankName"), t("rankValue"), t("rankShare"), `${t("rankLatest")} (${latest || "-"})`, `${t("rankPrevious")} (${previous || "-"})`, t("rankMom")], rankRows);
}

function applyLanguage() {
  document.documentElement.lang = currentLang === "zh" ? "zh-CN" : "en";
  document.title = t("pageTitle");
  document.querySelectorAll("[data-i18n]").forEach((el) => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll("[data-i18n-aria-label]").forEach((el) => el.setAttribute("aria-label", t(el.dataset.i18nAriaLabel)));
  langZhBtn.classList.toggle("active", currentLang === "zh");
  langEnBtn.classList.toggle("active", currentLang === "en");
  langZhBtn.setAttribute("aria-pressed", String(currentLang === "zh"));
  langEnBtn.setAttribute("aria-pressed", String(currentLang === "en"));
  if (allRows.length) {
    const selectedById = new Map([...document.querySelectorAll("select[id]")].map((el) => [el.id, selected(el)]));
    initFilters();
    selectedById.forEach((values, id) => {
      const el = byId(id);
      if (!el) return;
      const wanted = new Set(values);
      [...el.options].forEach((option) => { option.selected = wanted.has(option.value); });
    });
    renderOverview();
    renderRegion();
    renderProduct();
  } else {
    setStatus(lastStatus.key, lastStatus.vars);
  }
}
function setLanguage(lang) { currentLang = lang; localStorage.setItem(APP_LANG_KEY, lang); applyLanguage(); }
async function parseWorkbookFromArrayBuffer(buffer) { const workbook = XLSX.read(buffer, { type: "array" }), ordersSheet = workbook.Sheets["Order details"], targetSheet = workbook.Sheets.Target; if (!ordersSheet) throw new Error(t("ordersMissing")); if (!targetSheet) throw new Error(t("targetMissing")); return { orders: XLSX.utils.sheet_to_json(ordersSheet, { defval: null }), targets: XLSX.utils.sheet_to_json(targetSheet, { defval: null }) }; }
async function loadWorkbookBySource() { const source = document.querySelector("input[name='salesSource']:checked")?.value || "upload"; if (source === "repo") { const path = String(repoSalesPathEl.value || "").trim(); if (!path) throw new Error(t("statusNoPath")); setStatus("statusReadRepo", { path }); const response = await fetch(path, { cache: "no-store" }); if (!response.ok) throw new Error(t("repoMissing", { path, status: response.status })); return parseWorkbookFromArrayBuffer(await response.arrayBuffer()); } const file = fileEl.files?.[0]; if (!file) throw new Error(t("statusNoFile")); setStatus("statusReadUpload", { name: file.name }); return parseWorkbookFromArrayBuffer(await file.arrayBuffer()); }
function bindMultiSelectToggle(el) { el.addEventListener("mousedown", (event) => { const option = event.target; if (!(option instanceof HTMLOptionElement)) return; event.preventDefault(); if (["__ALL__", "total"].includes(option.value)) [...el.options].forEach((o) => { o.selected = o === option; }); else { option.selected = !option.selected; [...el.options].forEach((o) => { if (["__ALL__", "total"].includes(o.value)) o.selected = false; }); if (![...el.options].some((o) => o.selected)) { const fallback = [...el.options].find((o) => ["__ALL__", "total"].includes(o.value)); if (fallback) fallback.selected = true; } } setTimeout(() => el.dispatchEvent(new Event("change", { bubbles: true })), 0); }); }

document.querySelectorAll("input[name='salesSource']").forEach((radio) => radio.addEventListener("change", () => { const useRepo = document.querySelector("input[name='salesSource']:checked")?.value === "repo"; repoRow.classList.toggle("active", useRepo); uploadRow.style.display = useRepo ? "none" : "grid"; }));
byId("jumpWrap").querySelectorAll(".jump-btn").forEach((btn) => btn.addEventListener("click", () => { byId("jumpWrap").querySelectorAll(".jump-btn").forEach((x) => x.classList.toggle("active", x === btn)); document.querySelectorAll(".content-block").forEach((panel) => panel.classList.toggle("active", panel.id === btn.dataset.target)); window.dispatchEvent(new Event("resize")); }));
runBtn.addEventListener("click", async () => { try { const raw = await loadWorkbookBySource(); allRows = normalizeRows(raw.orders); allTargets = normalizeTargets(raw.targets); if (!allRows.length) { setStatus("statusNoRows"); return; } initFilters(); renderOverview(); renderRegion(); renderProduct(); } catch (error) { setStatus("statusFail", { msg: error.message || error }); } });
[incomeTypeSel, yearSel, quarterSel, monthSel].forEach((el) => el.addEventListener("change", renderRegion));
Object.values(pvAspFilters).forEach((el) => el.addEventListener("change", () => { refreshAspCascade(pvAspFilters, false, allRows.filter((r) => r.isPV)); renderOverview(); }));
Object.values(essAspFilters).forEach((el) => el.addEventListener("change", () => { refreshAspCascade(essAspFilters, false, allRows.filter((r) => r.isESS)); renderOverview(); }));
Object.values(detailPvAspFilters).forEach((el) => el.addEventListener("change", () => { if (!activeDetailRegion) return; refreshAspCascade(detailPvAspFilters, false, allRows.filter((r) => r.region === activeDetailRegion && r.isPV)); renderRegionDetails(false); }));
Object.values(detailEssAspFilters).forEach((el) => el.addEventListener("change", () => { if (!activeDetailRegion) return; refreshAspCascade(detailEssAspFilters, false, allRows.filter((r) => r.region === activeDetailRegion && r.isESS)); renderRegionDetails(false); }));
[productMetricSel, productIncomeSel, productRegionSel, productStartMonthSel, productEndMonthSel].forEach((el) => el.addEventListener("change", renderProduct));
Object.values(productHierarchyFilters).forEach((el) => el.addEventListener("change", () => { refreshProductCascade(false); renderProduct(); }));
[incomeTypeSel, yearSel, quarterSel, monthSel, ...Object.values(pvAspFilters), ...Object.values(essAspFilters), ...Object.values(detailPvAspFilters), ...Object.values(detailEssAspFilters), ...Object.values(productHierarchyFilters)].forEach(bindMultiSelectToggle);
byId("regionGrid").addEventListener("click", (event) => { const button = event.target.closest("button[data-region]"); if (button) openRegionDetails(button.dataset.region); });
regionDetailClose.addEventListener("click", closeRegionDetails);
regionDetailModal.addEventListener("click", (event) => { if (event.target === regionDetailModal) closeRegionDetails(); });
document.addEventListener("keydown", (event) => { if (event.key === "Escape") closeRegionDetails(); });
langZhBtn.addEventListener("click", () => setLanguage("zh")); langEnBtn.addEventListener("click", () => setLanguage("en")); applyLanguage();
