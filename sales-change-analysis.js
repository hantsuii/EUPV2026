const statusEl = document.getElementById("status");
const fileEl = document.getElementById("salesFile");
const runBtn = document.getElementById("runBtn");
const uploadRow = document.getElementById("uploadRow");
const repoRow = document.getElementById("repoRow");
const repoSalesPathEl = document.getElementById("repoSalesPath");
const langZhBtn = document.getElementById("langZh");
const langEnBtn = document.getElementById("langEn");

const TARGET_YEAR = 2026;
const APP_LANG_KEY = "app_lang";
let currentLang = localStorage.getItem(APP_LANG_KEY) || "zh";

const REGION_MAP = {
  "Germany & Austria Region": "DACH Region",
  "Iberia Region": "Southern Europe Region",
  "lberia Region": "Southern Europe Region",
  "Italy & Adriatics Region": "Italy Region",
  "Emerging Market": "Central and Eastern Europe Region",
};

const I18N = {
  zh: {
    pageTitle: "销售分析看板（PV / ESS）",
    pageSubtitle: "统一库存分析模块风格，展示 2026 年总览与各区域看板。",
    backHome: "← 返回主页",
    sourceLabel: "Sales Workbook Source",
    sourceUpload: "上传本地文件",
    sourceRepo: "使用 GitHub 仓库文件",
    uploadLabel: "上传 Sales 工作簿 (.xlsx)",
    repoPathLabel: "仓库文件路径",
    repoPathTip: "例如：./templates/sales_workbook.xlsx",
    runBtn: "运行分析",
    statusInit: "请选择文件来源并点击运行。",
    tabTotal: "总计 Dashboard",
    tabRegion: "各地区看板",
    overviewTitle: "2026年总览",
    row1Title: "全年核心指标",
    row2Title: "H1 开票指标",
    row3Title: "未结束季度进度",
    regionTitle: "各地区看板（总览 + 组件/储能销售明细）",
    statusReadRepo: "读取仓库文件：{path}",
    statusReadUpload: "读取上传文件：{name}",
    statusNoPath: "请输入仓库文件路径。",
    statusNoFile: "请先上传销售工作簿文件。",
    statusNoRows: `没有 ${TARGET_YEAR} 年可用行，请检查 Order details 日期。`,
    statusDone: `完成：${TARGET_YEAR} 全年数据 {allRows} 行；已开票 {invoicedRows} 行。`,
    statusFail: "失败：{msg}",
    statusNoRegion: `暂无 ${TARGET_YEAR} 年已开票地区数据。`,
    notEndedQuarterTitle: "未结束季度（含当季）",
    qTableQuarter: "季度",
    qTableAllAmount: "全部金额(万€)",
    qTablePvQty: "组件数量(MW)",
    qTableEssQty: "储能数量(Sets)",
    qTableRate: "达成率",
    chartAmountTitle: `${TARGET_YEAR} 月度销售金额变化（折线=总金额，柱=组件/ESS）`,
    chartAmountY: "金额(万€)",
    chartTotalAmount: "总金额(万€)",
    chartPvAmount: "组件金额(万€)",
    chartEssAmount: "ESS金额(万€)",
    chartAspTitle: `${TARGET_YEAR} 月度平均售价变化`,
    chartPvAsp: "组件ASP(€/W)",
    chartEssAsp: "ESS ASP(€/Set)",
    chartPvAspY: "组件ASP (€/W)",
    chartEssAspY: "ESS ASP (€/Set)",
    kpiYearInvoiced: `${TARGET_YEAR}年已开票销售额(万€)`,
    kpiYearBacklog: `${TARGET_YEAR}年Backlog订单金额(万€)`,
    kpiYearPvQty: `${TARGET_YEAR}年已开票组件数量(MW)`,
    kpiYearEssQty: `${TARGET_YEAR}年已开票储能数量(Sets)`,
    kpiYearRate: `${TARGET_YEAR}年达成率(含未开票)`,
    kpiH1Invoiced: "H1 开票金额(万€)",
    kpiH1PvQty: "H1 开票组件数量(MW)",
    kpiH1EssQty: "H1 开票储能数量(Sets)",
    kpiH1Rate: "H1 达成率",
    kpiH1Reserved: "H1 说明",
    h1ReservedValue: "-",
    regionTotalAmount: "总金额(万€)",
    regionBpRate: "BP达成率",
    regionYoy: "同比",
    regionShare: "总金额占比",
    regionEssAmount: "储能金额(万€)",
    regionEssQty: "储能数量(Sets)",
    regionEssAsp: "储能ASP(€/Set)",
    regionPvAmount: "组件金额(万€)",
    regionPvQty: "组件数量(MW)",
    regionPvAsp: "组件ASP(€/W)",
  },
  en: {
    pageTitle: "Sales Analytics Dashboard (PV / ESS)",
    pageSubtitle: "Aligned with inventory module style, showing 2026 overview and regional dashboards.",
    backHome: "← Back to Home",
    sourceLabel: "Sales Workbook Source",
    sourceUpload: "Upload local file",
    sourceRepo: "Use GitHub repository file",
    uploadLabel: "Upload Sales Workbook (.xlsx)",
    repoPathLabel: "Repository file path",
    repoPathTip: "Example: ./templates/sales_workbook.xlsx",
    runBtn: "Run Analysis",
    statusInit: "Choose source and click Run Analysis.",
    tabTotal: "Total Dashboard",
    tabRegion: "Regional Dashboard",
    overviewTitle: "2026 Overview",
    row1Title: "Full-Year Core Metrics",
    row2Title: "H1 Invoiced Metrics",
    row3Title: "Open Quarter Progress",
    regionTitle: "Regional Dashboard (Overall + PV/ESS Details)",
    statusReadRepo: "Loading repository file: {path}",
    statusReadUpload: "Reading uploaded file: {name}",
    statusNoPath: "Please input repository file path.",
    statusNoFile: "Please upload sales workbook first.",
    statusNoRows: `No valid ${TARGET_YEAR} rows. Check Order details date fields.`,
    statusDone: `Done: ${TARGET_YEAR} total rows {allRows}; invoiced {invoicedRows}.`,
    statusFail: "Failed: {msg}",
    statusNoRegion: `No invoiced regional data in ${TARGET_YEAR}.`,
    notEndedQuarterTitle: "Open Quarters (incl. current)",
    qTableQuarter: "Quarter",
    qTableAllAmount: "All Amount (10k €)",
    qTablePvQty: "PV Qty (MW)",
    qTableEssQty: "ESS Qty (Sets)",
    qTableRate: "Achievement Rate",
    chartAmountTitle: `${TARGET_YEAR} Monthly Sales Amount Trend (line=total, bars=PV/ESS)`,
    chartAmountY: "Amount (10k €)",
    chartTotalAmount: "Total Amount (10k €)",
    chartPvAmount: "PV Amount (10k €)",
    chartEssAmount: "ESS Amount (10k €)",
    chartAspTitle: `${TARGET_YEAR} Monthly ASP Trend`,
    chartPvAsp: "PV ASP (€/W)",
    chartEssAsp: "ESS ASP (€/Set)",
    chartPvAspY: "PV ASP (€/W)",
    chartEssAspY: "ESS ASP (€/Set)",
    kpiYearInvoiced: `${TARGET_YEAR} Invoiced Amount (10k €)`,
    kpiYearBacklog: `${TARGET_YEAR} Backlog Amount (10k €)`,
    kpiYearPvQty: `${TARGET_YEAR} Invoiced PV Qty (MW)`,
    kpiYearEssQty: `${TARGET_YEAR} Invoiced ESS Qty (Sets)`,
    kpiYearRate: `${TARGET_YEAR} Achievement Rate (incl. backlog)`,
    kpiH1Invoiced: "H1 Invoiced Amount (10k €)",
    kpiH1PvQty: "H1 Invoiced PV Qty (MW)",
    kpiH1EssQty: "H1 Invoiced ESS Qty (Sets)",
    kpiH1Rate: "H1 Achievement Rate",
    kpiH1Reserved: "H1 Note",
    h1ReservedValue: "-",
    regionTotalAmount: "Total Amount (10k €)",
    regionBpRate: "BP Achievement",
    regionYoy: "YoY",
    regionShare: "Share of Total",
    regionEssAmount: "ESS Amount (10k €)",
    regionEssQty: "ESS Qty (Sets)",
    regionEssAsp: "ESS ASP (€/Set)",
    regionPvAmount: "PV Amount (10k €)",
    regionPvQty: "PV Qty (MW)",
    regionPvAsp: "PV ASP (€/W)",
  },
};

function t(key, vars = {}) {
  let text = I18N[currentLang]?.[key] ?? I18N.zh[key] ?? key;
  Object.entries(vars).forEach(([k, v]) => {
    text = text.replace(`{${k}}`, String(v));
  });
  return text;
}

function n(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function hasValue(value) {
  return !(value == null || String(value).trim() === "");
}

function fmtAmountWanInt(value) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.round(n(value) / 10000));
}

function fmtPvQtyMw(value) {
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(n(value));
}

function fmtAsp3(value) {
  if (!Number.isFinite(value)) return "-";
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(value);
}

function fmtInt(value) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.round(n(value)));
}

function fmtPct(value) {
  if (!Number.isFinite(value)) return "-";
  return `${value.toFixed(1)}%`;
}

function parseExcelDate(value) {
  if (value == null || value === "") return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "number") {
    const utcDays = Math.floor(value - 25569);
    const utcValue = utcDays * 86400;
    return new Date(utcValue * 1000);
  }
  const s = String(value).trim();
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function monthFromRow(row) {
  const monthRaw = String(row["Month"] || "").trim();
  if (/^\d{4}-\d{2}$/.test(monthRaw)) return monthRaw;
  const refDate = parseExcelDate(row["Invoice Date"]) || parseExcelDate(row["SO Create Date"]) || parseExcelDate(row["CRD"]);
  if (!refDate) return "Unknown";
  return `${refDate.getFullYear()}-${String(refDate.getMonth() + 1).padStart(2, "0")}`;
}

function quarterFromMonth(month) {
  const monthNumber = Number(month.slice(5, 7));
  return Math.floor((monthNumber - 1) / 3) + 1;
}

function quarterKey(month) {
  return `${TARGET_YEAR}-Q${quarterFromMonth(month)}`;
}

function isInvoiced(row, invoiceDate) {
  if (invoiceDate) return true;
  const s1 = String(row["Order Status2"] || "").toLowerCase();
  const s2 = String(row["Order Status"] || "").toLowerCase();
  return /invoice|invoiced|已开票|开票/.test(s1) || /invoice|invoiced|已开票|开票/.test(s2);
}

function normalizeRows(rawRows) {
  return rawRows
    .map((row) => {
      const month = monthFromRow(row);
      const regionRaw = String(row["Region"] || row["RegionStd"] || "Unknown").trim() || "Unknown";
      const region = REGION_MAP[regionRaw] || regionRaw;
      const amountRaw = row["Unit Price * Qty"];
      const amount = n(amountRaw);
      const amountNotEmpty = hasValue(amountRaw);
      const tcl = String(row["TCL Report Product"] || "").trim().toUpperCase();
      const mid = String(row["Product Mid Category"] || "").trim().toUpperCase();
      const isEssType = tcl === "ENERGY+_KIT GEN1" || tcl === "ENERGY+_KIT" || mid === "HYBRID INVERTER";
      const invoiceDate = parseExcelDate(row["Invoice Date"]);
      return {
        month,
        region,
        amount,
        pvQtyMw: isEssType ? 0 : n(row["Total MW"]),
        essQtySet: isEssType && amountNotEmpty ? n(row["Ordered Qty"]) : 0,
        isEssType,
        invoiced: isInvoiced(row, invoiceDate),
      };
    })
    .filter((r) => r.month.startsWith(`${TARGET_YEAR}-`));
}

function initMetric() {
  return { totalAmount: 0, pvAmount: 0, essAmount: 0, pvQtyMw: 0, essQtySet: 0 };
}

function addMetric(target, row) {
  target.totalAmount += row.amount;
  if (row.isEssType) {
    target.essAmount += row.amount;
    target.essQtySet += row.essQtySet;
  } else {
    target.pvAmount += row.amount;
    target.pvQtyMw += row.pvQtyMw;
  }
}

function calcRate(numerator, denominator) {
  if (denominator <= 0) return null;
  return (numerator / denominator) * 100;
}

function calcPvAspEurPerW(metric) {
  if (!metric || metric.pvQtyMw <= 0) return null;
  return metric.pvAmount / (metric.pvQtyMw * 1_000_000);
}

function calcEssAspEurPerSet(metric) {
  if (!metric || metric.essQtySet <= 0) return null;
  return metric.essAmount / metric.essQtySet;
}

function monthsOfYear() {
  return Array.from({ length: 12 }, (_, i) => `${TARGET_YEAR}-${String(i + 1).padStart(2, "0")}`);
}

function aggregate(rows) {
  const allRows = rows;
  const invoicedRows = allRows.filter((r) => r.invoiced);

  const allYear = initMetric();
  const invoicedYear = initMetric();
  const allH1 = initMetric();
  const invoicedH1 = initMetric();

  const allByQuarter = new Map();
  const invoicedByQuarter = new Map();
  const allByMonth = new Map();
  const invoicedByRegion = new Map();

  [1, 2, 3, 4].forEach((q) => {
    allByQuarter.set(`${TARGET_YEAR}-Q${q}`, initMetric());
    invoicedByQuarter.set(`${TARGET_YEAR}-Q${q}`, initMetric());
  });
  monthsOfYear().forEach((m) => allByMonth.set(m, initMetric()));

  allRows.forEach((row) => {
    addMetric(allYear, row);
    addMetric(allByQuarter.get(quarterKey(row.month)), row);
    addMetric(allByMonth.get(row.month), row);
    if (row.month <= `${TARGET_YEAR}-06`) addMetric(allH1, row);
  });

  invoicedRows.forEach((row) => {
    addMetric(invoicedYear, row);
    addMetric(invoicedByQuarter.get(quarterKey(row.month)), row);
    if (!invoicedByRegion.has(row.region)) invoicedByRegion.set(row.region, initMetric());
    addMetric(invoicedByRegion.get(row.region), row);
    if (row.month <= `${TARGET_YEAR}-06`) addMetric(invoicedH1, row);
  });

  return {
    allRows,
    invoicedRows,
    allYear,
    invoicedYear,
    allH1,
    invoicedH1,
    allByQuarter,
    invoicedByQuarter,
    allByMonth,
    invoicedByRegion,
  };
}

function table(elId, headers, rows) {
  const el = document.getElementById(elId);
  const head = `<thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead>`;
  const body = rows.length
    ? rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")
    : `<tr><td colspan="${headers.length}">No data</td></tr>`;
  el.innerHTML = `${head}<tbody>${body}</tbody>`;
}

function renderPlot(divId, traces, layout = {}) {
  const baseLayout = {
    paper_bgcolor: "#ffffff",
    plot_bgcolor: "#ffffff",
    font: { color: "#2e4f7a" },
    margin: { l: 62, r: 60, t: 44, b: 62 },
    legend: { orientation: "h", y: -0.25 },
    xaxis: { gridcolor: "#e2ecf9" },
    yaxis: { gridcolor: "#e2ecf9" },
    bargap: 0.24,
  };
  window.Plotly.newPlot(divId, traces, { ...baseLayout, ...layout }, { responsive: true, displayModeBar: false });
}

function renderYearAndH1(agg) {
  const yearRow = document.getElementById("yearKpiRow");
  const h1Row = document.getElementById("h1KpiRow");

  const yearRate = calcRate(agg.invoicedYear.totalAmount, agg.allYear.totalAmount);
  const h1Rate = calcRate(agg.invoicedH1.totalAmount, agg.allH1.totalAmount);

  const yearCards = [
    { name: t("kpiYearInvoiced"), value: fmtAmountWanInt(agg.invoicedYear.totalAmount) },
    { name: t("kpiYearBacklog"), value: fmtAmountWanInt(agg.allYear.totalAmount - agg.invoicedYear.totalAmount) },
    { name: t("kpiYearPvQty"), value: fmtPvQtyMw(agg.invoicedYear.pvQtyMw) },
    { name: t("kpiYearEssQty"), value: fmtInt(agg.invoicedYear.essQtySet) },
    { name: t("kpiYearRate"), value: fmtPct(yearRate) },
  ];

  const h1Cards = [
    { name: t("kpiH1Invoiced"), value: fmtAmountWanInt(agg.invoicedH1.totalAmount) },
    { name: t("kpiH1PvQty"), value: fmtPvQtyMw(agg.invoicedH1.pvQtyMw) },
    { name: t("kpiH1EssQty"), value: fmtInt(agg.invoicedH1.essQtySet) },
    { name: t("kpiH1Rate"), value: fmtPct(h1Rate) },
    { name: t("kpiH1Reserved"), value: t("h1ReservedValue") },
  ];

  const renderCards = (cards) => cards
    .map((x) => `<div class="kpi-card"><div class="kpi-name">${x.name}</div><div class="kpi-value">${x.value}</div></div>`)
    .join("");

  yearRow.innerHTML = renderCards(yearCards);
  h1Row.innerHTML = renderCards(h1Cards);
}

function renderOpenQuarterTable(agg) {
  const now = new Date();
  const currentQuarter = now.getFullYear() === TARGET_YEAR ? Math.floor(now.getMonth() / 3) + 1 : 1;
  const openQuarters = [1, 2, 3, 4].filter((q) => q >= currentQuarter);

  const rows = openQuarters.map((q) => {
    const key = `${TARGET_YEAR}-Q${q}`;
    const allQ = agg.allByQuarter.get(key) || initMetric();
    const invQ = agg.invoicedByQuarter.get(key) || initMetric();
    const rate = calcRate(invQ.totalAmount, allQ.totalAmount);
    return [
      key,
      fmtAmountWanInt(allQ.totalAmount),
      fmtPvQtyMw(allQ.pvQtyMw),
      fmtInt(allQ.essQtySet),
      fmtPct(rate),
    ];
  });

  table("quarterProgressTable", [t("qTableQuarter"), t("qTableAllAmount"), t("qTablePvQty"), t("qTableEssQty"), t("qTableRate")], rows);
}

function renderMonthlyCharts(agg) {
  const months = monthsOfYear();
  const data = months.map((m) => agg.allByMonth.get(m) || initMetric());

  renderPlot(
    "monthlyTrendChart",
    [
      {
        x: months,
        y: data.map((x) => x.totalAmount / 10000),
        type: "scatter",
        mode: "lines+markers",
        name: t("chartTotalAmount"),
        line: { color: "#458CFF", width: 3 },
      },
      {
        x: months,
        y: data.map((x) => x.pvAmount / 10000),
        type: "bar",
        name: t("chartPvAmount"),
        marker: { color: "#7CB4FF" },
      },
      {
        x: months,
        y: data.map((x) => x.essAmount / 10000),
        type: "bar",
        name: t("chartEssAmount"),
        marker: { color: "#B48BFF" },
      },
    ],
    {
      title: t("chartAmountTitle"),
      barmode: "group",
      yaxis: { title: t("chartAmountY") },
    }
  );

  renderPlot(
    "monthlyAspChart",
    [
      {
        x: months,
        y: data.map((x) => calcPvAspEurPerW(x)),
        type: "scatter",
        mode: "lines+markers",
        name: t("chartPvAsp"),
        line: { color: "#2E7CFF", width: 3 },
      },
      {
        x: months,
        y: data.map((x) => calcEssAspEurPerSet(x)),
        type: "scatter",
        mode: "lines+markers",
        yaxis: "y2",
        name: t("chartEssAsp"),
        line: { color: "#9D63FF", width: 3 },
      },
    ],
    {
      title: t("chartAspTitle"),
      yaxis: { title: t("chartPvAspY") },
      yaxis2: { title: t("chartEssAspY"), overlaying: "y", side: "right" },
    }
  );
}

function renderRegion(agg) {
  const regionGrid = document.getElementById("regionGrid");
  const total = agg.invoicedYear.totalAmount;
  const regions = [...agg.invoicedByRegion.entries()]
    .map(([region, metric]) => ({ region, metric }))
    .sort((a, b) => b.metric.totalAmount - a.metric.totalAmount);

  if (!regions.length) {
    regionGrid.innerHTML = `<div class="mini-tip">${t("statusNoRegion")}</div>`;
    return;
  }

  regionGrid.innerHTML = regions
    .map(({ region, metric }) => {
      const share = calcRate(metric.totalAmount, total);
      const essAsp = calcEssAspEurPerSet(metric);
      const pvAsp = calcPvAspEurPerW(metric);
      return `
        <article class="region-card">
          <h4 class="region-title">${region}</h4>
          <div class="metric-row"><span class="metric-label">${t("regionTotalAmount")}</span><span class="metric-value">${fmtAmountWanInt(metric.totalAmount)}</span></div>
          <div class="metric-row"><span class="metric-label">${t("regionBpRate")}</span><span class="metric-value">-</span></div>
          <div class="metric-row"><span class="metric-label">${t("regionYoy")}</span><span class="metric-value">-</span></div>
          <div class="metric-row"><span class="metric-label">${t("regionShare")}</span><span class="metric-value">${fmtPct(share)}</span></div>
          <div class="metric-row"><span class="metric-label">${t("regionEssAmount")}</span><span class="metric-value">${fmtAmountWanInt(metric.essAmount)}</span></div>
          <div class="metric-row"><span class="metric-label">${t("regionEssQty")}</span><span class="metric-value">${fmtInt(metric.essQtySet)}</span></div>
          <div class="metric-row"><span class="metric-label">${t("regionEssAsp")}</span><span class="metric-value">${essAsp == null ? "-" : fmtInt(essAsp)}</span></div>
          <div class="metric-row"><span class="metric-label">${t("regionPvAmount")}</span><span class="metric-value">${fmtAmountWanInt(metric.pvAmount)}</span></div>
          <div class="metric-row"><span class="metric-label">${t("regionPvQty")}</span><span class="metric-value">${fmtPvQtyMw(metric.pvQtyMw)}</span></div>
          <div class="metric-row"><span class="metric-label">${t("regionPvAsp")}</span><span class="metric-value">${pvAsp == null ? "-" : fmtAsp3(pvAsp)}</span></div>
        </article>
      `;
    })
    .join("");
}

let lastAgg = null;

function renderAll(rows) {
  const agg = aggregate(rows);
  lastAgg = agg;
  renderYearAndH1(agg);
  renderOpenQuarterTable(agg);
  renderMonthlyCharts(agg);
  renderRegion(agg);
  setStatus(t("statusDone", { allRows: rows.length, invoicedRows: agg.invoicedRows.length }));
}

function applyLanguage() {
  document.documentElement.lang = currentLang === "zh" ? "zh-CN" : "en";
  document.querySelectorAll("[data-i18n]").forEach((node) => {
    const key = node.getAttribute("data-i18n");
    node.textContent = t(key);
  });
  langZhBtn.classList.toggle("active", currentLang === "zh");
  langEnBtn.classList.toggle("active", currentLang === "en");
  if (lastAgg) {
    renderYearAndH1(lastAgg);
    renderOpenQuarterTable(lastAgg);
    renderMonthlyCharts(lastAgg);
    renderRegion(lastAgg);
  }
}

function setLanguage(lang) {
  currentLang = lang;
  localStorage.setItem(APP_LANG_KEY, lang);
  applyLanguage();
}

function setStatus(text) {
  statusEl.textContent = text;
}

async function parseWorkbookFromArrayBuffer(buffer) {
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = workbook.Sheets["Order details"];
  if (!sheet) throw new Error("Sheet 'Order details' not found in workbook.");
  return XLSX.utils.sheet_to_json(sheet, { defval: null });
}

async function loadWorkbookBySource() {
  const selectedSource = document.querySelector("input[name='salesSource']:checked")?.value || "upload";
  if (selectedSource === "repo") {
    const repoPath = String(repoSalesPathEl.value || "").trim();
    if (!repoPath) throw new Error(t("statusNoPath"));
    setStatus(t("statusReadRepo", { path: repoPath }));
    const response = await fetch(repoPath, { cache: "no-store" });
    if (!response.ok) throw new Error(`Repository file not found: ${repoPath} (HTTP ${response.status})`);
    return parseWorkbookFromArrayBuffer(await response.arrayBuffer());
  }

  const file = fileEl.files?.[0];
  if (!file) throw new Error(t("statusNoFile"));
  setStatus(t("statusReadUpload", { name: file.name }));
  return parseWorkbookFromArrayBuffer(await file.arrayBuffer());
}

function bindSourceMode() {
  document.querySelectorAll("input[name='salesSource']").forEach((radio) => {
    radio.addEventListener("change", () => {
      const useRepo = document.querySelector("input[name='salesSource']:checked")?.value === "repo";
      repoRow.classList.toggle("active", useRepo);
      uploadRow.style.display = useRepo ? "none" : "grid";
    });
  });
}

function bindJumpButtons() {
  const wrap = document.getElementById("jumpWrap");
  wrap.querySelectorAll(".jump-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.target;
      wrap.querySelectorAll(".jump-btn").forEach((x) => x.classList.remove("active"));
      btn.classList.add("active");
      document.querySelectorAll(".content-block").forEach((panel) => panel.classList.toggle("active", panel.id === target));
      window.dispatchEvent(new Event("resize"));
    });
  });
}

runBtn.addEventListener("click", async () => {
  try {
    const rawRows = await loadWorkbookBySource();
    const rows = normalizeRows(rawRows);
    if (!rows.length) {
      setStatus(t("statusNoRows"));
      return;
    }
    renderAll(rows);
  } catch (error) {
    setStatus(t("statusFail", { msg: error.message || error }));
  }
});

langZhBtn.addEventListener("click", () => setLanguage("zh"));
langEnBtn.addEventListener("click", () => setLanguage("en"));

bindSourceMode();
bindJumpButtons();
applyLanguage();


