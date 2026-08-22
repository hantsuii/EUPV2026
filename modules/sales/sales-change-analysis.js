const TARGET_YEAR = 2026;
const APP_LANG_KEY = "app_lang";

const statusEl = document.getElementById("status");
const fileEl = document.getElementById("salesFile");
const runBtn = document.getElementById("runBtn");
const uploadRow = document.getElementById("uploadRow");
const repoRow = document.getElementById("repoRow");
const repoSalesPathEl = document.getElementById("repoSalesPath");
const langZhBtn = document.getElementById("langZh");
const langEnBtn = document.getElementById("langEn");

const incomeTypeSel = document.getElementById("incomeTypeSel");
const yearSel = document.getElementById("yearSel");
const quarterSel = document.getElementById("quarterSel");
const monthSel = document.getElementById("monthSel");

let currentLang = localStorage.getItem(APP_LANG_KEY) || "zh";
let allRows = [];
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
    pageTitle: "销售分析看板（PV / ESS）",
    pageSubtitle: "统一库存分析模块风格，展示 2026 年总览与各区域看板。",
    backHome: "← 返回主页",
    sourceLabel: "Sales Workbook Source",
    sourceUpload: "上传本地文件",
    sourceRepo: "使用 GitHub 仓库文件",
    uploadLabel: "上传 Sales 工作簿 (.xlsx)",
    repoPathLabel: "仓库文件路径",
    repoPathTip: "例如：../../templates/sales_workbook.xlsx",
    runBtn: "运行分析",
    statusInit: "请选择文件来源并点击运行。",
    tabTotal: "总计 Dashboard",
    tabRegion: "各地区看板",
    overviewTitle: "2026年总览",
    row1Title: "全年核心指标",
    futureTitle: "未来销售指标（2027+）",
    row2Title: "H1 销售数据",
    row3Title: "未结束季度进度",

    filterIncome: "收入类型",
    filterYear: "年份",
    filterQuarter: "季度",
    filterMonth: "月份",
    incomeTotal: "总计",
    incomeInvoiced: "开票收入",
    incomeConfirm: "待确认收入",
    all: "全部",

    statusReadRepo: "读取仓库文件：{path}",
    statusReadUpload: "读取上传文件：{name}",
    statusNoPath: "请输入仓库文件路径。",
    statusNoFile: "请先上传销售工作簿文件。",
    statusNoRows: `没有 ${TARGET_YEAR} 年及以后可用行，请检查 year / Quartely / Month。`,
    statusDone: `完成：总行数 {allRows}，{TARGET_YEAR} 年行数 {yearRows}。`,
    statusFail: "失败：{msg}",
    statusNoRegion: "当前筛选下无地区数据。",

    kpiRevenuePair: "开票收入 / 待确认收入(万€)",
    kpiPvQtyPair: "组件销量MW（开票/待确认）",
    kpiEssQtyPair: "储能销量Sets（开票/待确认）",
    kpiBpRate: "BP / 达成率",
    kpiFutureRevenue: "未来销售收入(万€)",
    kpiFuturePvQty: "未来组件销量(MW)",
    kpiFutureEssQty: "未来储能销量(Sets)",
    kpiH1Revenue: "H1 开票金额(万€)",
    kpiH1PvQty: "H1 开票组件销量(MW)",
    kpiH1EssQty: "H1 开票储能销量(Sets)",
    kpiH1Rate: "H1 达成率",

    qQuarter: "季度",
    qAllAmount: "全部金额(万€)",
    qInvoicedAmount: "开票收入(万€)",
    qPvQty: "组件销量(MW)",
    qEssQty: "储能销量(Sets)",
    qRate: "达成率",

    chartAmountTitle: `${TARGET_YEAR} 月度销售金额变化（折线=总金额，柱=组件/ESS）`,
    chartAmountY: "金额(万€)",
    chartTotalAmount: "总金额(万€)",
    chartPvAmount: "组件金额(万€)",
    chartEssAmount: "ESS金额(万€)",
    chartPvAspTitle: `${TARGET_YEAR} 月度组件ASP变化`,
    chartPvAsp: "组件ASP(€/W)",
    chartEssAspTitle: `${TARGET_YEAR} 月度储能ASP变化`,
    chartEssAsp: "储能ASP(€/Set)",

    regTotal: "总金额(万€)",
    regBp: "BP达成率",
    regYoy: "同比",
    regShare: "总金额占比",
    regEssAmount: "储能金额(万€)",
    regEssQty: "储能销量(Sets)",
    regEssAsp: "储能ASP(€/Set)",
    regPvAmount: "组件金额(万€)",
    regPvQty: "组件销量(MW)",
    regPvAsp: "组件ASP(€/W)",

    pairInvoiced: "开票",
    pairConfirm: "待确认",
    empty: "",
  },
  en: {
    pageTitle: "Sales Analytics Dashboard (PV / ESS)",
    pageSubtitle: "Aligned with inventory style, showing 2026 overview and regional dashboard.",
    backHome: "← Back to Home",
    sourceLabel: "Sales Workbook Source",
    sourceUpload: "Upload local file",
    sourceRepo: "Use GitHub repository file",
    uploadLabel: "Upload Sales Workbook (.xlsx)",
    repoPathLabel: "Repository file path",
    repoPathTip: "Example: ../../templates/sales_workbook.xlsx",
    runBtn: "Run Analysis",
    statusInit: "Choose source and click Run Analysis.",
    tabTotal: "Total Dashboard",
    tabRegion: "Regional Dashboard",
    overviewTitle: "2026 Overview",
    row1Title: "Full-Year Core Metrics",
    futureTitle: "Future Sales Metrics (2027+)",
    row2Title: "H1 Sales Metrics",
    row3Title: "Open Quarter Progress",

    filterIncome: "Income Type",
    filterYear: "Year",
    filterQuarter: "Quarter",
    filterMonth: "Month",
    incomeTotal: "Total",
    incomeInvoiced: "Invoiced",
    incomeConfirm: "Confirm",
    all: "All",

    statusReadRepo: "Loading repository file: {path}",
    statusReadUpload: "Reading uploaded file: {name}",
    statusNoPath: "Please input repository file path.",
    statusNoFile: "Please upload sales workbook first.",
    statusNoRows: `No valid rows from ${TARGET_YEAR}+; check year / Quartely / Month.`,
    statusDone: `Done: total rows {allRows}, ${TARGET_YEAR} rows {yearRows}.`,
    statusFail: "Failed: {msg}",
    statusNoRegion: "No regional data under current filters.",

    kpiRevenuePair: "Invoiced / Confirm Revenue (10k €)",
    kpiPvQtyPair: "PV Sales Qty MW (Invoiced/Confirm)",
    kpiEssQtyPair: "ESS Sales Qty Sets (Invoiced/Confirm)",
    kpiBpRate: "BP / Achievement",
    kpiFutureRevenue: "Future Sales Revenue (10k €)",
    kpiFuturePvQty: "Future PV Sales Qty (MW)",
    kpiFutureEssQty: "Future ESS Sales Qty (Sets)",
    kpiH1Revenue: "H1 Invoiced Revenue (10k €)",
    kpiH1PvQty: "H1 Invoiced PV Sales Qty (MW)",
    kpiH1EssQty: "H1 Invoiced ESS Sales Qty (Sets)",
    kpiH1Rate: "H1 Achievement",

    qQuarter: "Quarter",
    qAllAmount: "All Amount (10k €)",
    qInvoicedAmount: "Invoiced (10k €)",
    qPvQty: "PV Sales Qty (MW)",
    qEssQty: "ESS Sales Qty (Sets)",
    qRate: "Achievement",

    chartAmountTitle: `${TARGET_YEAR} Monthly Sales Amount (line=total, bars=PV/ESS)`,
    chartAmountY: "Amount (10k €)",
    chartTotalAmount: "Total Amount (10k €)",
    chartPvAmount: "PV Amount (10k €)",
    chartEssAmount: "ESS Amount (10k €)",
    chartPvAspTitle: `${TARGET_YEAR} Monthly PV ASP`,
    chartPvAsp: "PV ASP (€/W)",
    chartEssAspTitle: `${TARGET_YEAR} Monthly ESS ASP`,
    chartEssAsp: "ESS ASP (€/Set)",

    regTotal: "Total Amount (10k €)",
    regBp: "BP Achievement",
    regYoy: "YoY",
    regShare: "Share",
    regEssAmount: "ESS Amount (10k €)",
    regEssQty: "ESS Sales Qty (Sets)",
    regEssAsp: "ESS ASP (€/Set)",
    regPvAmount: "PV Amount (10k €)",
    regPvQty: "PV Sales Qty (MW)",
    regPvAsp: "PV ASP (€/W)",

    pairInvoiced: "Invoiced",
    pairConfirm: "Confirm",
    empty: "",
  },
};

function t(key, vars = {}) {
  let text = I18N[currentLang]?.[key] ?? I18N.zh[key] ?? key;
  Object.entries(vars).forEach(([k, v]) => {
    text = text.replace(`{${k}}`, String(v));
  });
  return text;
}

function setStatus(text) { statusEl.textContent = text; }
function n(v) { const x = Number(v); return Number.isFinite(x) ? x : 0; }
function hasValue(v) { return !(v == null || String(v).trim() === ""); }
function fmtWanInt(v) { return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.round(n(v) / 10000)); }
function fmtInt(v) { return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.round(n(v))); }
function fmtAsp3(v) { if (!Number.isFinite(v)) return ""; return new Intl.NumberFormat("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(v); }
function fmtPct1(v) { if (!Number.isFinite(v)) return ""; return `${v.toFixed(1)}%`; }

function parseExcelDate(value) {
  if (value == null || value === "") return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "number") {
    const utcDays = Math.floor(value - 25569);
    return new Date(utcDays * 86400 * 1000);
  }
  const d = new Date(String(value).trim());
  return Number.isNaN(d.getTime()) ? null : d;
}

function normalizeMonth(value) {
  if (value == null || value === "") return null;
  if (typeof value === "number") {
    const d = parseExcelDate(value);
    if (!d) return null;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }
  const s = String(value).trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})[-/.](\d{1,2})$/);
  if (m) return `${m[1]}-${String(Number(m[2])).padStart(2, "0")}`;
  m = s.match(/^(\d{2})[-/.](\d{1,2})$/);
  if (m) return `20${m[1]}-${String(Number(m[2])).padStart(2, "0")}`;
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  return null;
}

function normalizeQuarter(value, fallbackMonth) {
  const s = String(value ?? "").toUpperCase().trim();
  const m = s.match(/Q?([1-4])/);
  if (m) return `Q${m[1]}`;
  if (!fallbackMonth) return null;
  const monthNum = Number(fallbackMonth.slice(5, 7));
  return `Q${Math.floor((monthNum - 1) / 3) + 1}`;
}

function normalizeRows(rawRows) {
  return rawRows.map((row) => {
    const month = normalizeMonth(row["Month"]);
    const yearRaw = n(row["year"]);
    const year = Number.isFinite(yearRaw) && yearRaw > 0 ? Math.trunc(yearRaw) : (month ? Number(month.slice(0, 4)) : null);
    const quarter = normalizeQuarter(row["Quartely"], month);

    const status = String(row["Order Status2"] || "").trim().toLowerCase();
    const isInvoiced = status === "invoiced";
    const isConfirm = status === "confirm";

    const revenue = n(row["Revenue EUR"]);

    const category = String(row["Category"] || "").trim().toUpperCase();
    const tcl = String(row["TCL Report Product"] || "").trim().toUpperCase();
    const mid = String(row["Product Mid Category"] || "").trim().toUpperCase();

    const isPV = category === "PV";
    const isESS = category === "ESS";
    const isHP = category === "HP";

    const essQtyEligible =
      isESS &&
      upqNotEmpty &&
      (
        mid === "HYBRID INVERTER" ||
        tcl === "ENERGY+_KIT GEN1" ||
        tcl === "ENERGY+_KIT" ||
        tcl === "TCL"
      );

    return {
      year,
      quarter,
      month,
      region: String(row["RegionStd"] || row["Region"] || "Unknown").trim() || "Unknown",
      revenue,
      isInvoiced,
      isConfirm,
      category,
      isPV,
      isESS,
      isHP,
      pvAmount: isPV ? revenue : 0,
      essAmount: isESS ? revenue : 0,
      pvQty: isPV ? n(row["Total MW"]) : 0,
      essQty: essQtyEligible ? n(row["Ordered Qty"]) : 0,
    };
  }).filter((r) => Number.isFinite(r.year) && r.year >= TARGET_YEAR && r.quarter && r.month);
}

function initAgg() {
  return { revenue: 0, pvAmount: 0, essAmount: 0, pvQty: 0, essQty: 0 };
}
function addAgg(a, r) {
  a.revenue += r.revenue;
  a.pvAmount += r.pvAmount;
  a.essAmount += r.essAmount;
  a.pvQty += r.pvQty;
  a.essQty += r.essQty;
}

function selectIncomeRows(rows, incomeType) {
  if (incomeType === "invoiced") return rows.filter((r) => r.isInvoiced);
  if (incomeType === "confirm") return rows.filter((r) => r.isConfirm);
  return rows;
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
  };
  window.Plotly.newPlot(divId, traces, { ...baseLayout, ...layout }, { responsive: true, displayModeBar: false });
}

function card(name, value) {
  return `<div class="kpi-card"><div class="kpi-name">${name}</div><div class="kpi-value">${value}</div></div>`;
}

function renderOverview() {
  const yearRows = allRows.filter((r) => r.year === TARGET_YEAR);
  const invoiced = yearRows.filter((r) => r.isInvoiced);
  const confirm = yearRows.filter((r) => r.isConfirm);

  const aggInv = initAgg();
  const aggConf = initAgg();
  const aggYear = initAgg();
  invoiced.forEach((r) => addAgg(aggInv, r));
  confirm.forEach((r) => addAgg(aggConf, r));
  yearRows.forEach((r) => addAgg(aggYear, r));

  document.getElementById("yearKpiRow").innerHTML = [
    card(t("kpiRevenuePair"), `${fmtWanInt(aggInv.revenue)} / ${fmtWanInt(aggConf.revenue)}`),
    card(t("kpiPvQtyPair"), `${fmtInt(aggInv.pvQty)} / ${fmtInt(aggConf.pvQty)}`),
    card(t("kpiEssQtyPair"), `${fmtInt(aggInv.essQty)} / ${fmtInt(aggConf.essQty)}`),
    (() => { const bpValue = t("empty"); const rateValue = t("empty"); const pair = bpValue && rateValue ? `${bpValue}/${rateValue}` : ""; return card(t("kpiBpRate"), pair); })(),
  ].join("");

  const futureRows = allRows.filter((r) => r.year > TARGET_YEAR);
  const aggFuture = initAgg();
  futureRows.forEach((r) => addAgg(aggFuture, r));
  document.getElementById("futureKpiRow").innerHTML = [
    card(t("kpiFutureRevenue"), fmtWanInt(aggFuture.revenue)),
    card(t("kpiFuturePvQty"), fmtInt(aggFuture.pvQty)),
    card(t("kpiFutureEssQty"), fmtInt(aggFuture.essQty)),
  ].join("");

  const h1Rows = yearRows.filter((r) => r.month <= `${TARGET_YEAR}-06` && r.isInvoiced);
  const aggH1 = initAgg();
  h1Rows.forEach((r) => addAgg(aggH1, r));
  document.getElementById("h1KpiRow").innerHTML = [
    card(t("kpiH1Revenue"), fmtWanInt(aggH1.revenue)),
    card(t("kpiH1PvQty"), fmtInt(aggH1.pvQty)),
    card(t("kpiH1EssQty"), fmtInt(aggH1.essQty)),
    card(t("kpiH1Rate"), t("empty")),
  ].join("");

  const currentQuarter = Math.floor((new Date().getMonth()) / 3) + 1;
  const openQs = [1, 2, 3, 4].filter((q) => q >= currentQuarter);
  const qRows = openQs.map((q) => {
    const qk = `Q${q}`;
    const allQ = yearRows.filter((r) => r.quarter === qk);
    const invQ = allQ.filter((r) => r.isInvoiced);
    const aggAll = initAgg();
    const aggInvQ = initAgg();
    allQ.forEach((r) => addAgg(aggAll, r));
    invQ.forEach((r) => addAgg(aggInvQ, r));
    return [
      `${TARGET_YEAR}-${qk}`,
      fmtWanInt(aggAll.revenue),
      fmtWanInt(aggInvQ.revenue),
      fmtInt(aggAll.pvQty),
      fmtInt(aggAll.essQty),
      t("empty"),
    ];
  });
  table("quarterProgressTable", [t("qQuarter"), t("qAllAmount"), t("qInvoicedAmount"), t("qPvQty"), t("qEssQty"), t("qRate")], qRows);

  const months = Array.from({ length: 12 }, (_, i) => `${TARGET_YEAR}-${String(i + 1).padStart(2, "0")}`);
  const monthly = new Map(months.map((m) => [m, initAgg()]));
  yearRows.forEach((r) => addAgg(monthly.get(r.month), r));
  const data = months.map((m) => monthly.get(m));

  renderPlot("monthlyTrendChart", [
    {
      x: months,
      y: data.map((x) => Math.round(x.revenue / 10000)),
      type: "scatter",
      mode: "lines+markers+text",
      text: data.map((x) => String(Math.round(x.revenue / 10000))),
      textposition: "top center",
      name: t("chartTotalAmount"),
      line: { color: "#458CFF", width: 3 },
    },
    {
      x: months,
      y: data.map((x) => Math.round(x.pvAmount / 10000)),
      type: "bar",
      name: t("chartPvAmount"),
      marker: { color: "#7CB4FF" },
    },
    {
      x: months,
      y: data.map((x) => Math.round(x.essAmount / 10000)),
      type: "bar",
      name: t("chartEssAmount"),
      marker: { color: "#B48BFF" },
    },
  ], {
    title: t("chartAmountTitle"),
    barmode: "group",
    yaxis: { title: t("chartAmountY") },
  });

  const pvAspData = data.map((x) => (x.pvQty > 0 ? x.pvAmount / (x.pvQty * 1000000) : null));
  renderPlot("monthlyPvAspChart", [{
    x: months,
    y: pvAspData,
    type: "scatter",
    mode: "lines+markers+text",
    text: pvAspData.map((v) => (v == null ? "" : fmtAsp3(v))),
    textposition: "top center",
    name: t("chartPvAsp"),
    line: { color: "#2E7CFF", width: 3 },
  }], {
    title: t("chartPvAspTitle"),
    yaxis: { title: t("chartPvAsp") },
  });

  const essAspData = data.map((x) => (x.essQty > 0 ? x.essAmount / x.essQty : null));
  renderPlot("monthlyEssAspChart", [{
    x: months,
    y: essAspData,
    type: "scatter",
    mode: "lines+markers+text",
    text: essAspData.map((v) => (v == null ? "" : fmtInt(v))),
    textposition: "top center",
    name: t("chartEssAsp"),
    line: { color: "#9D63FF", width: 3 },
  }], {
    title: t("chartEssAspTitle"),
    yaxis: { title: t("chartEssAsp") },
  });

  setStatus(t("statusDone", { allRows: allRows.length, yearRows: yearRows.length }));
}

function getSelectedValues(el) {
  return [...el.options].filter((opt) => opt.selected).map((opt) => opt.value);
}

function fillSelect(el, options, selectedValues = ["__ALL__"]) {
  el.innerHTML = options.map((o) => `<option value="${o.value}">${o.label}</option>`).join("");
  const selectedSet = new Set(selectedValues);
  [...el.options].forEach((opt) => {
    opt.selected = selectedSet.has(opt.value);
  });
  if (![...el.options].some((opt) => opt.selected) && el.options.length) {
    el.options[0].selected = true;
  }
}

function initFilters() {
  const years = [...new Set(allRows.map((r) => r.year))].sort((a, b) => a - b);
  fillSelect(yearSel, [{ value: "__ALL__", label: t("all") }, ...years.map((y) => ({ value: String(y), label: String(y) }))], [String(TARGET_YEAR)]);
  fillSelect(quarterSel, [{ value: "__ALL__", label: t("all") }, ...[1, 2, 3, 4].map((q) => ({ value: `Q${q}`, label: `Q${q}` }))], ["__ALL__"]);

  const months = [...new Set(allRows.map((r) => r.month))].sort((a, b) => a.localeCompare(b));
  fillSelect(monthSel, [{ value: "__ALL__", label: t("all") }, ...months.map((m) => ({ value: m, label: m }))], ["__ALL__"]);

  fillSelect(incomeTypeSel, [
    { value: "total", label: t("incomeTotal") },
    { value: "invoiced", label: t("incomeInvoiced") },
    { value: "confirm", label: t("incomeConfirm") },
  ], ["total"]);
}

function applyMultiFilter(rows, values, picker) {
  if (!values.length || values.includes("__ALL__") || values.includes("total")) return rows;
  const selected = new Set(values);
  return rows.filter((row) => selected.has(picker(row)));
}

function renderRegion() {
  let rows = [...allRows];

  const incomeTypes = getSelectedValues(incomeTypeSel);
  if (incomeTypes.length && !incomeTypes.includes("total")) {
    rows = rows.filter((r) => {
      return (incomeTypes.includes("invoiced") && r.isInvoiced) || (incomeTypes.includes("confirm") && r.isConfirm);
    });
  }

  const years = getSelectedValues(yearSel);
  rows = applyMultiFilter(rows, years, (r) => String(r.year));

  const quarters = getSelectedValues(quarterSel);
  rows = applyMultiFilter(rows, quarters, (r) => r.quarter);

  const months = getSelectedValues(monthSel);
  rows = applyMultiFilter(rows, months, (r) => r.month);

  const totalRevenue = rows.reduce((acc, r) => acc + r.revenue, 0);
  const map = new Map();
  rows.forEach((r) => {
    const regionKey = mapRegionForStats(r.region);
    if (!map.has(regionKey)) map.set(regionKey, initAgg());
    addAgg(map.get(regionKey), r);
  });

  const regionGrid = document.getElementById("regionGrid");
  const list = [...map.entries()].map(([region, agg]) => ({ region, agg })).sort((a, b) => b.agg.revenue - a.agg.revenue);
  if (!list.length) {
    regionGrid.innerHTML = `<div class="mini-tip">${t("statusNoRegion")}</div>`;
    return;
  }

  regionGrid.innerHTML = list.map(({ region, agg }) => {
    const share = totalRevenue > 0 ? (agg.revenue / totalRevenue) * 100 : null;
    const pvAsp = agg.pvQty > 0 ? agg.pvAmount / (agg.pvQty * 1000000) : null;
    const essAsp = agg.essQty > 0 ? agg.essAmount / agg.essQty : null;
    return `
      <article class="region-card">
        <h4 class="region-title">${region}</h4>
        <div class="metric-row"><span class="metric-label">${t("regTotal")}</span><span class="metric-value">${fmtWanInt(agg.revenue)}</span></div>
        <div class="metric-row"><span class="metric-label">${t("regBp")}</span><span class="metric-value">${t("empty")}</span></div>
        <div class="metric-row"><span class="metric-label">${t("regYoy")}</span><span class="metric-value">${t("empty")}</span></div>
        <div class="metric-row"><span class="metric-label">${t("regShare")}</span><span class="metric-value">${fmtPct1(share)}</span></div>
        <div class="metric-row"><span class="metric-label">${t("regEssAmount")}</span><span class="metric-value">${fmtWanInt(agg.essAmount)}</span></div>
        <div class="metric-row"><span class="metric-label">${t("regEssQty")}</span><span class="metric-value">${fmtInt(agg.essQty)}</span></div>
        <div class="metric-row"><span class="metric-label">${t("regEssAsp")}</span><span class="metric-value">${fmtInt(essAsp)}</span></div>
        <div class="metric-row"><span class="metric-label">${t("regPvAmount")}</span><span class="metric-value">${fmtWanInt(agg.pvAmount)}</span></div>
        <div class="metric-row"><span class="metric-label">${t("regPvQty")}</span><span class="metric-value">${fmtInt(agg.pvQty)}</span></div>
        <div class="metric-row"><span class="metric-label">${t("regPvAsp")}</span><span class="metric-value">${fmtAsp3(pvAsp)}</span></div>
      </article>
    `;
  }).join("");
}
function applyLanguage() {
  document.documentElement.lang = currentLang === "zh" ? "zh-CN" : "en";
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = t(el.getAttribute("data-i18n"));
  });
  langZhBtn.classList.toggle("active", currentLang === "zh");
  langEnBtn.classList.toggle("active", currentLang === "en");
  if (allRows.length) {
    initFilters();
    renderOverview();
    renderRegion();
  }
}

function setLanguage(lang) {
  currentLang = lang;
  localStorage.setItem(APP_LANG_KEY, lang);
  applyLanguage();
}

async function parseWorkbookFromArrayBuffer(buffer) {
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = workbook.Sheets["Order details"];
  if (!sheet) throw new Error("Sheet 'Order details' not found in workbook.");
  return XLSX.utils.sheet_to_json(sheet, { defval: null });
}

async function loadWorkbookBySource() {
  const source = document.querySelector("input[name='salesSource']:checked")?.value || "upload";
  if (source === "repo") {
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

function bindMultiSelectToggle(el) {
  el.addEventListener("mousedown", (event) => {
    const option = event.target;
    if (!(option instanceof HTMLOptionElement)) return;
    event.preventDefault();
    if (option.value === "__ALL__" || option.value === "total") {
      [...el.options].forEach((opt) => { opt.selected = opt.value === option.value; });
    } else {
      option.selected = !option.selected;
      [...el.options].forEach((opt) => {
        if (opt.value === "__ALL__" || opt.value === "total") opt.selected = false;
      });
      if (![...el.options].some((opt) => opt.selected)) {
        const fallback = [...el.options].find((opt) => opt.value === "__ALL__" || opt.value === "total");
        if (fallback) fallback.selected = true;
      }
    }
    setTimeout(() => el.dispatchEvent(new Event("change", { bubbles: true })), 0);
  });
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
    allRows = normalizeRows(rawRows);
    if (!allRows.length) {
      setStatus(t("statusNoRows"));
      return;
    }
    initFilters();
    renderOverview();
    renderRegion();
  } catch (error) {
    setStatus(t("statusFail", { msg: error.message || error }));
  }
});

[incomeTypeSel, yearSel, quarterSel, monthSel].forEach((el) => el.addEventListener("change", renderRegion));
langZhBtn.addEventListener("click", () => setLanguage("zh"));
langEnBtn.addEventListener("click", () => setLanguage("en"));

bindSourceMode();
bindJumpButtons();
[incomeTypeSel, yearSel, quarterSel, monthSel].forEach(bindMultiSelectToggle);
applyLanguage();


















