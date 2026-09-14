"use strict";

window.PAGE_I18N = {
  zh: {
    pageTitle: "销售预测分析",
    pageSubtitle: "比较月初预测与已结束月份的实际销量，识别预测偏差、时间错位和权重效果。",
    backHome: "返回主页",
    sourceTitle: "读取预测文件",
    sourcePrivacy: "文件仅在当前浏览器中处理。",
    fileLabel: "FCST KPI 工作簿",
    categoryLabel: "产品类别",
    regionLabel: "销售地区",
    horizonLabel: "预测周期",
    basisLabel: "预测口径",
    runButton: "读取并分析",
    exportButton: "下载分析明细",
    statusInitial: "请选择包含 Data 工作表的 FCST KPI 文件。",
    statusReading: "正在读取并核对 Data 工作表……",
    statusDone: "已完成：读取 {rows} 行有效数据，实际月份截至 {month}。",
    statusNoFile: "请先选择 FCST KPI 工作簿。",
    statusNoDataSheet: "工作簿中未找到 Data 工作表。",
    statusNoRows: "Data 工作表中没有可用记录。",
    statusFailed: "读取失败：{message}",
    methodNote: "官方口径：M+1及M+1～M+3使用MW；M+3、M+6及M+1～M+6使用MW Weighted。只评价已完整结束月份。",
    categoryOverviewTitle: "产品类别总览",
    selectedSummaryTitle: "当前筛选结果",
    weightTitle: "MW 与 MW Weighted 效果",
    weightNote: "在相同样本上比较 WAPE，数值越低越好。",
    regionTitle: "Sales Region 对比",
    regionNote: "点击地区行可切换到该地区的详细结果。",
    detailTitle: "月份与预测版本明细",
    qualityTitle: "数据检查",
    qualityNote: "重复维度记录参与求和，不会自动删除。",
    allRegions: "所有地区",
    officialBasis: "官方口径",
    rawBasis: "MW",
    weightedBasis: "MW Weighted",
    basisOfficialShort: "官方",
    sampleActual: "样本实际量",
    sampleForecast: "样本预测量",
    variance: "预测差异",
    accuracy: "预测准确率",
    wape: "WAPE",
    bias: "Bias",
    hitRate: "±20% 命中率",
    sampleCount: "可比较样本",
    samples: "{count} 个",
    unavailable: "—",
    overForecast: "高估",
    underForecast: "低估",
    balanced: "无偏差",
    category: "类别",
    region: "Sales Region",
    horizon: "周期",
    basis: "口径",
    actual: "Actual (MW)",
    forecast: "Forecast (MW)",
    forecastSeries: "Series",
    targetPeriod: "目标月份 / 区间",
    error: "差异 (MW)",
    absolutePctError: "绝对误差率",
    direction: "方向",
    missingPairs: "缺少匹配",
    noComparable: "当前筛选下没有可比较的已结束月份。",
    trendTitle: "预测与实际趋势",
    trendActual: "Actual",
    trendForecast: "Forecast",
    horizonTitle: "各预测周期准确率",
    horizonAccuracy: "准确率",
    horizonBias: "Bias",
    weightChartTitle: "权重调整前后 WAPE",
    mwWape: "MW WAPE",
    weightedWape: "MW Weighted WAPE",
    regionChartTitle: "地区 WAPE",
    totalRows: "有效数据行",
    actualRows: "Actuals 行",
    forecastRows: "预测行",
    completeThrough: "完整月份截至",
    duplicateGroups: "相同维度记录组",
    invalidRows: "无效行",
    negativeRows: "目标月早于 Series",
    incompleteActuals: "未结束月份 Actuals 行",
    qualityWarningText: "发现 {duplicates} 组相同 Series、国家、地区、类别和目标月份的记录，分析时已求和。另有 {negative} 行目标月份早于 Series，不纳入已确认的预测周期指标。",
    categoryOverviewNote: "{horizon} · {basis} · 所有地区",
    scopeNote: "{category} · {region} · {horizon} · {basis}",
    detailNote: "采用 {basis}，缺少 Actual 或 Forecast 的组合不计入准确率。",
    csvFile: "销售预测准确性明细.csv",
    M1: "M+1",
    M3: "M+3",
    M6: "M+6",
    M1_3: "M+1～M+3",
    M1_6: "M+1～M+6",
  },
  en: {
    pageTitle: "Sales Forecast Accuracy",
    pageSubtitle: "Compare month-start forecasts with completed-month actuals to identify bias, timing shifts, and weighting effectiveness.",
    backHome: "Back to Home",
    sourceTitle: "Load forecast workbook",
    sourcePrivacy: "The file is processed only in this browser.",
    fileLabel: "FCST KPI workbook",
    categoryLabel: "Product category",
    regionLabel: "Sales region",
    horizonLabel: "Forecast horizon",
    basisLabel: "Forecast basis",
    runButton: "Load and analyze",
    exportButton: "Download detail",
    statusInitial: "Choose an FCST KPI workbook containing a Data sheet.",
    statusReading: "Reading and validating the Data sheet…",
    statusDone: "Complete: {rows} valid rows loaded; completed actuals through {month}.",
    statusNoFile: "Choose an FCST KPI workbook first.",
    statusNoDataSheet: "The workbook does not contain a Data sheet.",
    statusNoRows: "No usable rows were found in the Data sheet.",
    statusFailed: "Could not read the file: {message}",
    methodNote: "Official basis: M+1 and M+1–M+3 use MW; M+3, M+6 and M+1–M+6 use MW Weighted. Only completed months are evaluated.",
    categoryOverviewTitle: "Product category overview",
    selectedSummaryTitle: "Selected result",
    weightTitle: "MW vs MW Weighted",
    weightNote: "WAPE is compared on matching samples; lower is better.",
    regionTitle: "Sales Region comparison",
    regionNote: "Select a region row to open its detailed results.",
    detailTitle: "Monthly and forecast-series detail",
    qualityTitle: "Data checks",
    qualityNote: "Repeated dimension rows are summed and not removed.",
    allRegions: "All regions",
    officialBasis: "Official basis",
    rawBasis: "MW",
    weightedBasis: "MW Weighted",
    basisOfficialShort: "Official",
    sampleActual: "Sample actual",
    sampleForecast: "Sample forecast",
    variance: "Forecast variance",
    accuracy: "Forecast accuracy",
    wape: "WAPE",
    bias: "Bias",
    hitRate: "±20% hit rate",
    sampleCount: "Comparable samples",
    samples: "{count}",
    unavailable: "—",
    overForecast: "Over",
    underForecast: "Under",
    balanced: "On target",
    category: "Category",
    region: "Sales Region",
    horizon: "Horizon",
    basis: "Basis",
    actual: "Actual (MW)",
    forecast: "Forecast (MW)",
    forecastSeries: "Series",
    targetPeriod: "Target month / window",
    error: "Variance (MW)",
    absolutePctError: "Absolute % error",
    direction: "Direction",
    missingPairs: "Missing matches",
    noComparable: "No comparable completed periods for the current filters.",
    trendTitle: "Forecast vs actual",
    trendActual: "Actual",
    trendForecast: "Forecast",
    horizonTitle: "Accuracy by forecast horizon",
    horizonAccuracy: "Accuracy",
    horizonBias: "Bias",
    weightChartTitle: "WAPE before and after weighting",
    mwWape: "MW WAPE",
    weightedWape: "MW Weighted WAPE",
    regionChartTitle: "Regional WAPE",
    totalRows: "Valid rows",
    actualRows: "Actual rows",
    forecastRows: "Forecast rows",
    completeThrough: "Completed through",
    duplicateGroups: "Repeated dimension groups",
    invalidRows: "Invalid rows",
    negativeRows: "Target before Series",
    incompleteActuals: "Current/future actual rows",
    qualityWarningText: "{duplicates} groups share the same Series, country, region, category and target month; they are summed. {negative} rows target a month before Series and are excluded from the agreed forecast-horizon metrics.",
    categoryOverviewNote: "{horizon} · {basis} · all regions",
    scopeNote: "{category} · {region} · {horizon} · {basis}",
    detailNote: "Using {basis}; combinations missing Actual or Forecast are excluded from accuracy metrics.",
    csvFile: "sales_forecast_accuracy_detail.csv",
    M1: "M+1",
    M3: "M+3",
    M6: "M+6",
    M1_3: "M+1–M+3",
    M1_6: "M+1–M+6",
  },
};

const Core = window.ForecastCore;
const byId = (id) => document.getElementById(id);
const fileEl = byId("forecastFile");
const runBtn = byId("runBtn");
const exportBtn = byId("exportBtn");
const categorySel = byId("categorySel");
const regionSel = byId("regionSel");
const horizonSel = byId("horizonSel");
const basisSel = byId("basisSel");
const statusEl = byId("status");
const dashboard = byId("dashboard");
let normalizedRows = [];
let invalidRows = [];
let quality = null;
let activeAnalysis = null;

function t(key, params = {}) {
  return window.appI18n?.text(key, params) ?? key;
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
}

function fmtNumber(value, digits = 1) {
  if (value == null || !Number.isFinite(value)) return t("unavailable");
  return new Intl.NumberFormat(window.appI18n?.language === "en" ? "en-GB" : "zh-CN", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
}

function fmtPct(value) {
  if (value == null || !Number.isFinite(value)) return t("unavailable");
  return `${(value * 100).toFixed(1)}%`;
}

function horizonName(id) {
  return t(id);
}

function basisName(value, horizonId = horizonSel.value) {
  if (value === "mw") return t("rawBasis");
  if (value === "weighted") return t("weightedBasis");
  const config = Core.HORIZONS[horizonId] || Core.HORIZONS.M1;
  return `${t("officialBasis")} (${config.officialBasis === "mw" ? t("rawBasis") : t("weightedBasis")})`;
}

function setStatus(key, params = {}) {
  statusEl.textContent = t(key, params);
}

function setOptions(select, options, selectedValue) {
  const current = selectedValue ?? select.value;
  select.innerHTML = options.map((item) => `<option value="${esc(item.value)}">${esc(item.label)}</option>`).join("");
  if ([...select.options].some((option) => option.value === current)) select.value = current;
}

function initControls() {
  const categories = ["PV", "ESS", "HP"].filter((category) => normalizedRows.some((row) => row.category === category));
  setOptions(categorySel, categories.map((value) => ({ value, label: value })), categorySel.value || categories[0]);
  setOptions(horizonSel, Object.keys(Core.HORIZONS).map((value) => ({ value, label: horizonName(value) })), horizonSel.value || "M1");
  setOptions(basisSel, [
    { value: "official", label: t("officialBasis") },
    { value: "mw", label: t("rawBasis") },
    { value: "weighted", label: t("weightedBasis") },
  ], basisSel.value || "official");
  refreshRegions(regionSel.value || "__ALL__");
  [categorySel, regionSel, horizonSel, basisSel].forEach((select) => { select.disabled = false; });
}

function refreshRegions(selectedValue = "__ALL__") {
  const regions = [...new Set(normalizedRows.filter((row) => row.category === categorySel.value).map((row) => row.region))].sort();
  setOptions(regionSel, [{ value: "__ALL__", label: t("allRegions") }, ...regions.map((value) => ({ value, label: value }))], selectedValue);
}

function buildTable(tableId, headers, rows, attributes = []) {
  const head = `<thead><tr>${headers.map((header) => `<th>${esc(header)}</th>`).join("")}</tr></thead>`;
  const body = rows.length
    ? rows.map((row, index) => `<tr${attributes[index] || ""}>${row.map((value) => `<td>${esc(value)}</td>`).join("")}</tr>`).join("")
    : `<tr><td colspan="${headers.length}" class="empty-state">${esc(t("noComparable"))}</td></tr>`;
  byId(tableId).innerHTML = `${head}<tbody>${body}</tbody>`;
}

function analysisOptions(overrides = {}) {
  return {
    category: categorySel.value,
    region: regionSel.value,
    horizonId: horizonSel.value,
    basisMode: basisSel.value,
    hitThreshold: 0.2,
    now: new Date(),
    ...overrides,
  };
}

function renderCategoryOverview() {
  const results = Core.analyzeCategories(normalizedRows, analysisOptions());
  const rows = results.map((item) => [
    item.category,
    basisName(item.basis, item.config.id),
    fmtNumber(item.summary.actual),
    fmtNumber(item.summary.forecast),
    fmtPct(item.summary.wape),
    fmtPct(item.summary.accuracy),
    fmtPct(item.summary.bias),
    fmtPct(item.summary.hitRate),
    String(item.summary.sampleCount),
  ]);
  buildTable("categoryTable", [t("category"), t("basis"), t("actual"), t("forecast"), t("wape"), t("accuracy"), t("bias"), t("hitRate"), t("sampleCount")], rows,
    results.map((item) => ` data-category="${esc(item.category)}"${item.category === categorySel.value ? ' class="selected"' : ""}`));
  byId("categoryOverviewNote").textContent = t("categoryOverviewNote", { horizon: horizonName(horizonSel.value), basis: basisName(basisSel.value) });
  byId("categoryTable").querySelectorAll("tbody tr[data-category]").forEach((row) => row.addEventListener("click", () => {
    categorySel.value = row.dataset.category;
    refreshRegions("__ALL__");
    renderAll();
  }));
}

function kpiCard(name, value, detail = "", valueClass = "") {
  return `<article class="kpi-card"><div class="kpi-name">${esc(name)}</div><div class="kpi-value ${esc(valueClass)}">${esc(value)}</div>${detail ? `<div class="kpi-detail">${esc(detail)}</div>` : ""}</article>`;
}

function renderKpis(result) {
  const summary = result.summary;
  const biasDirection = summary.bias == null || Math.abs(summary.bias) < 0.0005 ? t("balanced") : summary.bias > 0 ? t("overForecast") : t("underForecast");
  const biasClass = summary.bias > 0 ? "positive" : summary.bias < 0 ? "negative" : "";
  byId("kpiGrid").innerHTML = [
    kpiCard(t("sampleActual"), fmtNumber(summary.actual), t("samples", { count: summary.sampleCount })),
    kpiCard(t("sampleForecast"), fmtNumber(summary.forecast), basisName(result.basis, result.config.id)),
    kpiCard(t("wape"), fmtPct(summary.wape), t("accuracy") + ` ${fmtPct(summary.accuracy)}`),
    kpiCard(t("bias"), fmtPct(summary.bias), biasDirection, biasClass),
    kpiCard(t("hitRate"), fmtPct(summary.hitRate), t("samples", { count: summary.sampleCount - summary.zeroActualCount })),
    kpiCard(t("missingPairs"), String(result.missingActual + result.missingForecast), `${t("sampleCount")}: ${summary.sampleCount}`),
  ].join("");
  byId("scopeNote").textContent = t("scopeNote", {
    category: categorySel.value,
    region: regionSel.value === "__ALL__" ? t("allRegions") : regionSel.value,
    horizon: horizonName(horizonSel.value),
    basis: basisName(basisSel.value),
  });
}

function plot(divId, traces, layout) {
  const base = {
    paper_bgcolor: "#fff", plot_bgcolor: "#fff", font: { color: "#355568", family: "Arial, sans-serif" },
    margin: { l: 62, r: 28, t: 54, b: 64 }, legend: { orientation: "h", y: -0.22 },
    xaxis: { gridcolor: "#e5edf2", zerolinecolor: "#cddae2" }, yaxis: { gridcolor: "#e5edf2", zerolinecolor: "#cddae2" },
  };
  Plotly.react(divId, traces, { ...base, ...layout }, { responsive: true, displayModeBar: false });
}

function renderTrend(result) {
  const samples = result.samples;
  plot("trendChart", [
    { x: samples.map((row) => row.series), y: samples.map((row) => row.actual), type: "scatter", mode: "lines+markers", name: t("trendActual"), line: { color: "#158879", width: 3 }, customdata: samples.map((row) => row.periodLabel), hovertemplate: "%{x}<br>%{customdata}<br>%{y:.1f} MW<extra></extra>" },
    { x: samples.map((row) => row.series), y: samples.map((row) => row.forecast), type: "scatter", mode: "lines+markers", name: t("trendForecast"), line: { color: "#2f72ad", width: 3 }, customdata: samples.map((row) => row.periodLabel), hovertemplate: "%{x}<br>%{customdata}<br>%{y:.1f} MW<extra></extra>" },
  ], { title: t("trendTitle"), xaxis: { title: t("forecastSeries"), gridcolor: "#e5edf2" }, yaxis: { title: "MW", gridcolor: "#e5edf2" } });
}

function renderHorizonChart() {
  const ids = Object.keys(Core.HORIZONS);
  const results = ids.map((id) => Core.analyze(normalizedRows, analysisOptions({ horizonId: id })));
  plot("horizonChart", [
    { x: ids.map(horizonName), y: results.map((item) => item.summary.accuracy == null ? null : item.summary.accuracy * 100), type: "bar", name: t("horizonAccuracy"), marker: { color: "#2a8c82" }, text: results.map((item) => fmtPct(item.summary.accuracy)), textposition: "outside", hovertemplate: "%{x}<br>%{y:.1f}%<extra></extra>" },
    { x: ids.map(horizonName), y: results.map((item) => item.summary.bias == null ? null : item.summary.bias * 100), type: "scatter", mode: "lines+markers", name: t("horizonBias"), yaxis: "y2", line: { color: "#d07836", width: 3 }, hovertemplate: "%{x}<br>%{y:.1f}%<extra></extra>" },
  ], { title: t("horizonTitle"), yaxis: { title: "%", range: [0, 105], gridcolor: "#e5edf2" }, yaxis2: { title: t("bias"), overlaying: "y", side: "right", ticksuffix: "%", zeroline: true, zerolinecolor: "#8ca0ae" }, margin: { l: 56, r: 58, t: 54, b: 64 } });
}

function renderWeightChart() {
  const ids = Object.keys(Core.HORIZONS);
  const raw = ids.map((id) => Core.analyze(normalizedRows, analysisOptions({ horizonId: id, basisMode: "mw" })).summary.wape);
  const weighted = ids.map((id) => Core.analyze(normalizedRows, analysisOptions({ horizonId: id, basisMode: "weighted" })).summary.wape);
  plot("weightChart", [
    { x: ids.map(horizonName), y: raw.map((value) => value == null ? null : value * 100), type: "bar", name: t("mwWape"), marker: { color: "#4c86bd" }, text: raw.map(fmtPct), textposition: "outside" },
    { x: ids.map(horizonName), y: weighted.map((value) => value == null ? null : value * 100), type: "bar", name: t("weightedWape"), marker: { color: "#8f72bd" }, text: weighted.map(fmtPct), textposition: "outside" },
  ], { title: t("weightChartTitle"), barmode: "group", yaxis: { title: "WAPE", ticksuffix: "%", gridcolor: "#e5edf2" } });
}

function renderRegions() {
  const results = Core.analyzeRegions(normalizedRows, analysisOptions()).sort((a, b) => (a.summary.wape ?? Infinity) - (b.summary.wape ?? Infinity));
  const chartRows = [...results].sort((a, b) => (b.summary.wape ?? -Infinity) - (a.summary.wape ?? -Infinity));
  plot("regionChart", [{
    x: chartRows.map((item) => item.summary.wape == null ? null : item.summary.wape * 100), y: chartRows.map((item) => item.region),
    type: "bar", orientation: "h", name: t("wape"),
    marker: { color: chartRows.map((item) => item.summary.bias > 0 ? "#d58a49" : "#3d9b8e") },
    customdata: chartRows.map((item) => item.summary.bias == null ? null : item.summary.bias * 100),
    hovertemplate: "%{y}<br>WAPE %{x:.1f}%<br>Bias %{customdata:.1f}%<extra></extra>",
  }], { title: t("regionChartTitle"), xaxis: { title: "WAPE", ticksuffix: "%", gridcolor: "#e5edf2" }, margin: { l: 185, r: 24, t: 54, b: 58 } });

  const rows = results.map((item) => [item.region, fmtPct(item.summary.wape), fmtPct(item.summary.accuracy), fmtPct(item.summary.bias), fmtPct(item.summary.hitRate), String(item.summary.sampleCount)]);
  buildTable("regionTable", [t("region"), t("wape"), t("accuracy"), t("bias"), t("hitRate"), t("sampleCount")], rows,
    results.map((item) => ` data-region="${esc(item.region)}"${item.region === regionSel.value ? ' class="selected"' : ""}`));
  byId("regionTable").querySelectorAll("tbody tr[data-region]").forEach((row) => row.addEventListener("click", () => {
    regionSel.value = row.dataset.region;
    renderAll();
    window.scrollTo({ top: byId("kpiGrid").getBoundingClientRect().top + window.scrollY - 24, behavior: "smooth" });
  }));
}

function renderDetail(result) {
  const rows = result.samples.map((row) => [
    row.series, row.periodLabel, basisName(row.basis, result.config.id), fmtNumber(row.actual), fmtNumber(row.forecast), fmtNumber(row.error), fmtPct(row.ape), t(row.direction === "over" ? "overForecast" : row.direction === "under" ? "underForecast" : "balanced"),
  ]);
  buildTable("detailTable", [t("forecastSeries"), t("targetPeriod"), t("basis"), t("actual"), t("forecast"), t("error"), t("absolutePctError"), t("direction")], rows);
  byId("detailNote").textContent = t("detailNote", { basis: basisName(result.basis, result.config.id) });
}

function qualityCard(name, value) {
  return `<div class="quality-item"><span>${esc(name)}</span><strong>${esc(value)}</strong></div>`;
}

function renderQuality() {
  byId("qualityGrid").innerHTML = [
    qualityCard(t("totalRows"), quality.totalRows), qualityCard(t("actualRows"), quality.actualRows),
    qualityCard(t("forecastRows"), quality.forecastRows), qualityCard(t("completeThrough"), quality.completeThrough || t("unavailable")),
    qualityCard(t("duplicateGroups"), quality.duplicateGroups), qualityCard(t("invalidRows"), quality.invalidRows),
    qualityCard(t("negativeRows"), quality.negativeHorizonRows), qualityCard(t("incompleteActuals"), quality.incompleteActualRows),
  ].join("");
  byId("qualityWarning").textContent = t("qualityWarningText", { duplicates: quality.duplicateGroups, negative: quality.negativeHorizonRows });
}

function renderAll() {
  if (!normalizedRows.length) return;
  dashboard.classList.add("ready");
  activeAnalysis = Core.analyze(normalizedRows, analysisOptions());
  renderCategoryOverview();
  renderKpis(activeAnalysis);
  renderTrend(activeAnalysis);
  renderHorizonChart();
  renderWeightChart();
  renderRegions();
  renderDetail(activeAnalysis);
  renderQuality();
  exportBtn.disabled = activeAnalysis.samples.length === 0;
}

async function loadWorkbook() {
  const file = fileEl.files?.[0];
  if (!file) { setStatus("statusNoFile"); return; }
  try {
    setStatus("statusReading");
    runBtn.disabled = true;
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
    const sheet = workbook.Sheets.Data;
    if (!sheet) throw new Error(t("statusNoDataSheet"));
    const sourceRows = XLSX.utils.sheet_to_json(sheet, { defval: null, raw: true });
    const normalized = Core.normalizeRows(sourceRows);
    normalizedRows = normalized.rows;
    invalidRows = normalized.invalidRows;
    if (!normalizedRows.length) throw new Error(t("statusNoRows"));
    quality = Core.qualitySummary(normalizedRows, invalidRows, new Date());
    initControls();
    renderAll();
    setStatus("statusDone", { rows: normalizedRows.length, month: quality.completeThrough || t("unavailable") });
  } catch (error) {
    dashboard.classList.remove("ready");
    exportBtn.disabled = true;
    setStatus("statusFailed", { message: error?.message || String(error) });
  } finally {
    runBtn.disabled = false;
  }
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function exportDetail() {
  if (!activeAnalysis?.samples.length) return;
  const header = [t("category"), t("region"), t("horizon"), t("forecastSeries"), t("targetPeriod"), t("basis"), t("actual"), t("forecast"), t("error"), t("absolutePctError"), t("direction")];
  const scopeRegion = regionSel.value === "__ALL__" ? t("allRegions") : regionSel.value;
  const rows = activeAnalysis.samples.map((row) => [categorySel.value, scopeRegion, horizonName(horizonSel.value), row.series, row.periodLabel, basisName(row.basis, activeAnalysis.config.id), row.actual, row.forecast, row.error, row.ape == null ? "" : row.ape, t(row.direction === "over" ? "overForecast" : row.direction === "under" ? "underForecast" : "balanced")]);
  const csv = "\ufeff" + [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = t("csvFile");
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

runBtn.addEventListener("click", loadWorkbook);
exportBtn.addEventListener("click", exportDetail);
categorySel.addEventListener("change", () => { refreshRegions("__ALL__"); renderAll(); });
[regionSel, horizonSel, basisSel].forEach((select) => select.addEventListener("change", renderAll));
window.addEventListener("app-language-change", () => {
  if (!normalizedRows.length) return;
  const category = categorySel.value;
  const region = regionSel.value;
  const horizon = horizonSel.value;
  const basis = basisSel.value;
  initControls();
  categorySel.value = category;
  refreshRegions(region);
  horizonSel.value = horizon;
  basisSel.value = basis;
  renderAll();
  setStatus("statusDone", { rows: normalizedRows.length, month: quality.completeThrough || t("unavailable") });
});
