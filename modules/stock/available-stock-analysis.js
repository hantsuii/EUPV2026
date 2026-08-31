const statusEl = document.getElementById("status");
import { buildStockOutputJs } from "./stock-analysis-js.js";

const downloadLinkEl = document.getElementById("downloadLink");
const vizPanelEl = document.getElementById("vizPanel");

const runBtn = document.getElementById("runBtn");
const resetBtn = document.getElementById("resetBtn");

const inventoryInput = document.getElementById("inventoryFile");
const dailySupplyInput = document.getElementById("dailySupplyFile");
const odpMasterInput = document.getElementById("odpMasterFile");
const orderInput = document.getElementById("orderFile");
const useRepoInventoryEl = document.getElementById("useRepoInventory");
const useRepoDailySupplyEl = document.getElementById("useRepoDailySupply");
const useRepoOdpMasterEl = document.getElementById("useRepoOdpMaster");
const useRepoOrderfileEl = document.getElementById("useRepoOrderfile");
const transitStartInput = document.getElementById("transitStart");
const transitEndInput = document.getElementById("transitEnd");
const engineModeEl = document.getElementById("engineMode");

const whFilterEl = document.getElementById("whFilter");
const categoryFilterEl = document.getElementById("categoryFilter");
const productReportFilterEl = document.getElementById("productReportFilter");
const familyFilterEl = document.getElementById("familyFilter");
const productFilterEl = document.getElementById("productFilter");
const whSelectionSummaryEl = document.getElementById("whSelectionSummary");
const categorySelectionSummaryEl = document.getElementById("categorySelectionSummary");
const productReportSelectionSummaryEl = document.getElementById("productReportSelectionSummary");
const familySelectionSummaryEl = document.getElementById("familySelectionSummary");
const productSelectionSummaryEl = document.getElementById("productSelectionSummary");
const vizStartEl = document.getElementById("vizStart");
const vizEndEl = document.getElementById("vizEnd");
const granularityEl = document.getElementById("granularity");
const lineModeEl = document.getElementById("lineMode");
const applyVizBtn = document.getElementById("applyVizBtn");
const clearFiltersBtn = document.getElementById("clearFiltersBtn");
const detailTableEl = document.getElementById("detailTable");
const tableSummaryEl = document.getElementById("tableSummary");
const pvInventoryTotalEl = document.getElementById("pvInventoryTotal");
const essInventoryTotalEl = document.getElementById("essInventoryTotal");
const hpInventoryTotalEl = document.getElementById("hpInventoryTotal");
const pvStatusChartEl = document.getElementById("pvStatusChart");
const essStatusChartEl = document.getElementById("essStatusChart");
const hpStatusChartEl = document.getElementById("hpStatusChart");
const inventoryStatusTableEl = document.getElementById("inventoryStatusTable");

let pyodide = null;
let pyReady = false;
let chart = null;
let pvStatusChart = null;
let essStatusChart = null;
let hpStatusChart = null;
let lastStatus = { key: "waiting", params: {} };

function t(key, params = {}) {
  return window.appI18n?.text(key, params) ?? key;
}

const vizState = {
  rows: [],
  allocations: [],
  dateHeaders: [],
  keyMeta: new Map(),
  dateSourceTags: {},
};

const SOURCE_TAG = {
  INV_DSP: "INV_DSP",
  ODP: "ODP",
  MIXED: "MIXED",
};

const DEFAULT_REPO_FILE = {
  inventory: "../../templates/inventory.xlsx",
  dailySupply: "../../templates/daily_supply_plan.xlsx",
  odpMaster: "../../templates/odp.xlsx",
  orderfile: "../../templates/orderfile_base.xlsx",
};

const levelDefs = [
  { key: "WH", el: whFilterEl },
  { key: "Category", el: categoryFilterEl },
  { key: "ProductTCLReport", el: productReportFilterEl },
  { key: "Family", el: familyFilterEl },
  { key: "ProductKey", el: productFilterEl, labelKey: "ProductKeyLabel" },
];

function setStatus(key, params = {}) {
  lastStatus = { key, params };
  statusEl.textContent = t(key, params);
}

function resetDownloadLink() {
  downloadLinkEl.style.display = "none";
  downloadLinkEl.removeAttribute("href");
  downloadLinkEl.removeAttribute("download");
}

function escapeHtml(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function selectedValues(selectEl) {
  return Array.from(selectEl.selectedOptions).map((opt) => opt.value);
}

function selectedSet(selectEl) {
  return new Set(selectedValues(selectEl));
}

function fmtNumber(value) {
  const num = Number(value || 0);
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(num);
}

function fmtMw(value) {
  const num = Number(value || 0);
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(num);
}

function normalizeDateLabel(dateObj) {
  return `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, "0")}-${String(dateObj.getDate()).padStart(2, "0")}`;
}

function parseDateLabel(label) {
  const parts = String(label).split(".").map((x) => Number(x));
  if (parts.length !== 3 || parts.some((x) => Number.isNaN(x))) return null;
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

function monthLabelFromDate(dateObj) {
  return `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, "0")}`;
}

function weekLabelFromDate(dateObj) {
  const date = new Date(Date.UTC(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

function getRowValueByLevel(row, def) {
  if (def.key === "ProductKey") return row.ProductKey;
  return row[def.key];
}

function getRowLabelByLevel(row, def) {
  if (def.key === "ProductKey") return row[def.labelKey || "ProductKey"] || row.ProductKey;
  return row[def.key];
}

function setSelectOptions(selectEl, options, selectedSetToKeep, forceSelectAll = false) {
  const selected = selectedSetToKeep || new Set();
  selectEl.innerHTML = options
    .map((item) => `<option value="${escapeHtml(item.value)}">${escapeHtml(item.label)}</option>`)
    .join("");

  if (forceSelectAll) {
    for (const opt of selectEl.options) {
      opt.selected = true;
    }
    return;
  }

  for (const opt of selectEl.options) {
    if (selected.has(opt.value)) {
      opt.selected = true;
    }
  }
}

function enableClickToggleMultiSelect(selectEl) {
  selectEl.addEventListener("mousedown", (event) => {
    if (!(event.target instanceof HTMLOptionElement)) return;
    event.preventDefault();

    const option = event.target;
    option.selected = !option.selected;

    selectEl.focus();
    selectEl.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

function applySelectVisualState(selectEl) {
  const selectedCount = selectEl?.selectedOptions?.length || 0;
  selectEl.classList.toggle("has-selection", selectedCount > 0);
}

function updateSelectionSummary(selectEl, summaryEl) {
  if (!summaryEl || !selectEl) return;
  const labels = Array.from(selectEl.selectedOptions || []).map((opt) => String(opt.textContent || "").trim()).filter(Boolean);
  if (!labels.length) {
    summaryEl.textContent = t("noSelection");
    summaryEl.classList.add("is-empty");
    summaryEl.classList.remove("is-active");
    return;
  }

  const preview = labels.slice(0, 2).join(" / ");
  const suffix = labels.length > 2 ? ` +${labels.length - 2}` : "";
  summaryEl.textContent = t("selectedSummary", { count: labels.length, preview, suffix });
  summaryEl.classList.remove("is-empty");
  summaryEl.classList.add("is-active");
}

const filterSummaryDefs = [
  { selectEl: whFilterEl, summaryEl: whSelectionSummaryEl },
  { selectEl: categoryFilterEl, summaryEl: categorySelectionSummaryEl },
  { selectEl: productReportFilterEl, summaryEl: productReportSelectionSummaryEl },
  { selectEl: familyFilterEl, summaryEl: familySelectionSummaryEl },
  { selectEl: productFilterEl, summaryEl: productSelectionSummaryEl },
];

function refreshFilterSummaries() {
  for (const def of filterSummaryDefs) {
    applySelectVisualState(def.selectEl);
    updateSelectionSummary(def.selectEl, def.summaryEl);
  }
}

async function loadPyodideRuntime() {
  if (pyReady) return;

  setStatus("loadingPython");
  const script = document.createElement("script");
  script.src = "https://cdn.jsdelivr.net/pyodide/v0.27.2/full/pyodide.js";
  script.async = true;

  await new Promise((resolve, reject) => {
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });

  pyodide = await globalThis.loadPyodide();

  setStatus("installing");
  await pyodide.loadPackage("micropip");
  await pyodide.runPythonAsync(`
import micropip
await micropip.install("openpyxl")
`);

  setStatus("loadingScript");
  const pyCode = await fetch("../../py/inventory_step1_to_stock.py", { cache: "no-store" }).then((r) => r.text());
  pyodide.FS.mkdirTree("/work");
  pyodide.FS.writeFile("/work/inventory_step1_to_stock.py", pyCode);

  await pyodide.runPythonAsync(`
import sys
if "/work" not in sys.path:
    sys.path.append("/work")
`);

  pyReady = true;
  setStatus("environmentReady");
}

async function readFileAsBytes(file) {
  const arrayBuffer = await file.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}

async function fetchTemplateBytes() {
  const resp = await fetch("../../templates/stock_template.xlsx", { cache: "no-store" });
  if (!resp.ok) {
    throw new Error(t("templateMissing", { path: "../../templates/stock_template.xlsx", status: resp.status }));
  }
  const buffer = await resp.arrayBuffer();
  return new Uint8Array(buffer);
}

async function fetchRepoFileBytes(repoPath, label) {
  const resp = await fetch(repoPath, { cache: "no-store" });
  if (!resp.ok) {
    throw new Error(t("repoMissing", { label, path: repoPath, status: resp.status }));
  }
  const buf = await resp.arrayBuffer();
  return new Uint8Array(buf);
}


function ensureWorkbookIsXlsxZip(bytes, label) {
  const b0 = Number(bytes?.[0] ?? -1);
  const b1 = Number(bytes?.[1] ?? -1);
  if (b0 !== 0x50 || b1 !== 0x4b) {
    throw new Error(t("invalidWorkbook", { label }));
  }
}

function sourceClassFromTag(tag) {
  if (tag === SOURCE_TAG.ODP) return "src-odp";
  if (tag === SOURCE_TAG.MIXED) return "src-mixed";
  return "src-inv-dsp";
}

function mergeSourceTag(currentTag, incomingTag) {
  if (!incomingTag) return currentTag || "";
  if (!currentTag || currentTag === incomingTag) return incomingTag;
  return SOURCE_TAG.MIXED;
}

async function resolveInputWorkbook({
  fileInput,
  useRepoDefault,
  repoPath,
  targetPath,
  label,
  required = false,
}) {
  const uploaded = fileInput?.files?.[0];
  if (uploaded) {
    const bytes = await readFileAsBytes(uploaded);
    ensureWorkbookIsXlsxZip(bytes, label);
    pyodide.FS.writeFile(targetPath, bytes);
    return targetPath;
  }

  if (useRepoDefault) {
    const bytes = await fetchRepoFileBytes(repoPath, label);
    ensureWorkbookIsXlsxZip(bytes, label);
    pyodide.FS.writeFile(targetPath, bytes);
    return targetPath;
  }

  if (required) {
    throw new Error(t("requiredFile", { label }));
  }

  return null;
}

async function resolveInputBytes({
  fileInput,
  useRepoDefault,
  repoPath,
  label,
  required = false,
}) {
  const uploaded = fileInput?.files?.[0];
  if (uploaded) {
    const bytes = await readFileAsBytes(uploaded);
    ensureWorkbookIsXlsxZip(bytes, label);
    return bytes;
  }

  if (useRepoDefault) {
    const bytes = await fetchRepoFileBytes(repoPath, label);
    ensureWorkbookIsXlsxZip(bytes, label);
    return bytes;
  }

  if (required) {
    throw new Error(t("requiredFile", { label }));
  }
  return null;
}

function rowsMatchingPrevLevels(levelIndex) {
  let rows = vizState.rows;
  for (let i = 0; i < levelIndex; i += 1) {
    const def = levelDefs[i];
    const set = selectedSet(def.el);
    if (!set.size) continue;
    rows = rows.filter((row) => set.has(String(getRowValueByLevel(row, def))));
  }
  return rows;
}

function buildOptionsForLevel(levelIndex, baseRows) {
  const def = levelDefs[levelIndex];
  const seen = new Map();

  for (const row of baseRows) {
    const value = String(getRowValueByLevel(row, def) || "").trim();
    if (!value) continue;
    const label = String(getRowLabelByLevel(row, def) || value).trim();
    if (!seen.has(value)) {
      seen.set(value, label);
    }
  }

  return Array.from(seen.entries())
    .sort((a, b) => a[1].localeCompare(b[1]))
    .map(([value, label]) => ({ value, label }));
}

function rebuildCascadeFrom(startLevelIndex, resetSelections = true) {
  for (let levelIndex = startLevelIndex; levelIndex < levelDefs.length; levelIndex += 1) {
    const def = levelDefs[levelIndex];
    const before = selectedSet(def.el);
    const baseRows = rowsMatchingPrevLevels(levelIndex);
    const options = buildOptionsForLevel(levelIndex, baseRows);
    setSelectOptions(def.el, options, before, resetSelections);
    applySelectVisualState(def.el);
  }
}

function initializeCascadeFilters() {
  const firstOptions = buildOptionsForLevel(0, vizState.rows);
  setSelectOptions(levelDefs[0].el, firstOptions, new Set(), false);

  rebuildCascadeFrom(1, false);

  // Explicitly keep all filters unselected at initial load
  clearAllFilterSelections();
  refreshFilterSummaries();

  const validDates = vizState.dateHeaders.map(parseDateLabel).filter(Boolean);
  if (validDates.length) {
    vizStartEl.value = normalizeDateLabel(validDates[0]);
    vizEndEl.value = normalizeDateLabel(validDates[validDates.length - 1]);
  }

  granularityEl.value = "week";
  if (lineModeEl) {
    lineModeEl.value = "total";
  }
}

function getFilterState() {
  return {
    wh: selectedSet(whFilterEl),
    category: selectedSet(categoryFilterEl),
    productReport: selectedSet(productReportFilterEl),
    family: selectedSet(familyFilterEl),
    product: selectedSet(productFilterEl),
  };
}

function matchByFilters(row, filters) {
  if (filters.wh.size && !filters.wh.has(String(row.WH))) return false;
  if (filters.category.size && !filters.category.has(String(row.Category))) return false;
  if (filters.productReport.size && !filters.productReport.has(String(row.ProductTCLReport))) return false;
  if (filters.family.size && !filters.family.has(String(row.Family))) return false;
  if (filters.product.size && !filters.product.has(String(row.ProductKey))) return false;
  return true;
}

function parseVisualizationDateRange() {
  const start = vizStartEl.value ? new Date(`${vizStartEl.value}T00:00:00`) : null;
  const end = vizEndEl.value ? new Date(`${vizEndEl.value}T00:00:00`) : null;
  if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
    throw new Error(t("invalidDate"));
  }
  return { start, end };
}

function getDateHeadersInRange(start, end) {
  return vizState.dateHeaders.filter((h) => {
    const d = parseDateLabel(h);
    if (!d) return false;
    return d >= start && d <= end;
  });
}

function buildBucketSeries(dailyMap, granularity) {
  if (granularity === "day") {
    const labels = Array.from(dailyMap.keys());
    return { labels, values: labels.map((label) => dailyMap.get(label) || 0) };
  }

  const bucketMap = new Map();
  for (const [dayLabel, value] of dailyMap.entries()) {
    const dayDate = new Date(`${dayLabel}T00:00:00`);
    const key = granularity === "week" ? weekLabelFromDate(dayDate) : monthLabelFromDate(dayDate);
    bucketMap.set(key, value);
  }

  const labels = Array.from(bucketMap.keys());
  return { labels, values: labels.map((label) => bucketMap.get(label) || 0) };
}

function buildAllocationByMonthAndModel(filteredRows, start, end) {
  const skuWhToModel = new Map();
  for (const row of filteredRows) {
    const model = String(row.Model || "").trim();
    const fallback = String(row.ProductKeyLabel || row.SKU || "").trim();
    skuWhToModel.set(`${row.SKU}||${row.WH}`, model || fallback || t("unknownModel"));
  }

  const byModel = new Map();
  for (const alloc of vizState.allocations) {
    const key = `${alloc.SKU}||${alloc.WH}`;
    const mappedModel = skuWhToModel.get(key);
    if (!mappedModel) continue;

    if (!alloc.CRDDate) continue;
    const crd = new Date(`${alloc.CRDDate}T00:00:00`);
    if (Number.isNaN(crd.getTime()) || crd < start || crd > end) continue;

    const model = String(alloc.Model || "").trim() || mappedModel;
    const month = monthLabelFromDate(crd);
    if (!byModel.has(model)) {
      byModel.set(model, new Map());
    }
    const monthMap = byModel.get(model);
    monthMap.set(month, (monthMap.get(month) || 0) + Number(alloc.OrderedQty || 0));
  }

  return byModel;
}

function mapAllocationToBuckets(monthMap, granularity, bucketLabels, bucketValueMap) {
  const barMap = new Map(bucketLabels.map((label) => [label, 0]));

  for (const [month, qty] of monthMap.entries()) {
    let bucketLabel = null;

    if (granularity === "month") {
      bucketLabel = month;
    } else if (granularity === "week") {
      const [year, mon] = month.split("-").map(Number);
      bucketLabel = weekLabelFromDate(new Date(year, mon, 0));
    } else {
      const [year, mon] = month.split("-").map(Number);
      bucketLabel = normalizeDateLabel(new Date(year, mon, 0));
    }

    if (!barMap.has(bucketLabel)) continue;
    barMap.set(bucketLabel, (barMap.get(bucketLabel) || 0) + qty);
  }

  const markPoints = [];
  for (const [label, qty] of barMap.entries()) {
    if (!qty) continue;
    markPoints.push({
      coord: [label, bucketValueMap.get(label) || 0],
      value: qty,
      label: {
        show: true,
        formatter: t("alloc", { qty: fmtNumber(qty) }),
        color: "#ffd8b3",
        fontSize: 11,
      },
      itemStyle: { color: "#ff8b2c" },
    });
  }

  return {
    barData: bucketLabels.map((label) => Number(barMap.get(label) || 0)),
    markPoints,
  };
}

function ensureChart() {
  if (!chart) {
    chart = echarts.init(document.getElementById("stockChart"), null, { renderer: "canvas" });
    window.addEventListener("resize", () => {
      chart && chart.resize();
      pvStatusChart && pvStatusChart.resize();
      essStatusChart && essStatusChart.resize();
      hpStatusChart && hpStatusChart.resize();
    });
  }
}

function ensureInventoryOverviewCharts() {
  if (!pvStatusChart && pvStatusChartEl) {
    pvStatusChart = echarts.init(pvStatusChartEl, null, { renderer: "canvas" });
  }
  if (!essStatusChart && essStatusChartEl) {
    essStatusChart = echarts.init(essStatusChartEl, null, { renderer: "canvas" });
  }
  if (!hpStatusChart && hpStatusChartEl) {
    hpStatusChart = echarts.init(hpStatusChartEl, null, { renderer: "canvas" });
  }
}

function inventoryCategoryGroup(value) {
  const text = String(value || "").trim().toUpperCase();
  if (text.startsWith("PV")) return "PV";
  if (text.startsWith("ESS")) return "ESS";
  if (text.startsWith("HP")) return "HP";
  return "";
}

function renderStatusChart(chartInstance, values, unit, useMw) {
  const statusDefs = [
    { key: "Inventory", name: t("statusInventory"), color: "#2f6fed" },
    { key: "DailySupplyPlan", name: t("statusDailySupply"), color: "#0f9d75" },
    { key: "ODP", name: t("statusOdp"), color: "#e57a00" },
  ];
  const data = statusDefs
    .map((item) => ({ name: item.name, value: Number(values[item.key] || 0), itemStyle: { color: item.color } }))
    .filter((item) => item.value > 0);

  if (!data.length) {
    chartInstance?.setOption({
      animation: false,
      title: { text: t("noInventoryData"), left: "center", top: "middle", textStyle: { color: "#6b83a5", fontSize: 13, fontWeight: 500 } },
      series: [],
    }, true);
    return;
  }

  const formatValue = (value) => useMw ? fmtMw(value) : fmtNumber(value);
  chartInstance?.setOption({
    animation: false,
    tooltip: { trigger: "item", formatter: ({ name, value, percent }) => `${escapeHtml(name)}<br>${formatValue(value)} ${unit} (${percent}%)` },
    legend: { type: "scroll", bottom: 0, left: "center", textStyle: { color: "#516f96", fontSize: 10 } },
    series: [{
      type: "pie",
      radius: ["40%", "64%"],
      center: ["50%", "42%"],
      minAngle: 3,
      avoidLabelOverlap: true,
      itemStyle: { borderColor: "#ffffff", borderWidth: 3, borderRadius: 5 },
      label: {
        color: "#435f86",
        fontSize: 10,
        formatter: ({ name, value, percent }) => `${name}\n${formatValue(value)} ${unit}\n${percent}%`,
      },
      labelLine: { length: 8, length2: 6, lineStyle: { color: "#b7c8dc" } },
      data,
    }],
  }, true);
}

function renderInventoryOverview(filteredRows) {
  ensureInventoryOverviewCharts();
  const totals = {
    PV: { Inventory: 0, DailySupplyPlan: 0, ODP: 0 },
    ESS: { Inventory: 0, DailySupplyPlan: 0, ODP: 0 },
    HP: { Inventory: 0, DailySupplyPlan: 0, ODP: 0 },
  };

  for (const row of filteredRows) {
    const group = inventoryCategoryGroup(row.Category);
    if (!group) continue;
    const factor = group === "PV" ? Number(row.Bin || 0) / 1000000 : 1;
    if (group === "PV" && factor <= 0) continue;
    for (const status of ["Inventory", "DailySupplyPlan", "ODP"]) {
      totals[group][status] += Number(row.StatusQuantity?.[status] || 0) * factor;
    }
  }

  const categoryTotal = (group) => Object.values(totals[group]).reduce((sum, value) => sum + Number(value || 0), 0);
  pvInventoryTotalEl.innerHTML = `${fmtMw(categoryTotal("PV"))} <span class="unit">MW</span>`;
  essInventoryTotalEl.innerHTML = `${fmtNumber(categoryTotal("ESS"))} <span class="unit">${escapeHtml(t("quantityUnit"))}</span>`;
  hpInventoryTotalEl.innerHTML = `${fmtNumber(categoryTotal("HP"))} <span class="unit">${escapeHtml(t("quantityUnit"))}</span>`;

  renderStatusChart(pvStatusChart, totals.PV, "MW", true);
  renderStatusChart(essStatusChart, totals.ESS, t("quantityUnit"), false);
  renderStatusChart(hpStatusChart, totals.HP, t("quantityUnit"), false);

  const statusLabels = {
    Inventory: t("statusInventory"),
    DailySupplyPlan: t("statusDailySupply"),
    ODP: t("statusOdp"),
  };
  const tableRows = [];
  for (const group of ["PV", "ESS", "HP"]) {
    const total = categoryTotal(group);
    const unit = group === "PV" ? "MW" : t("quantityUnit");
    for (const status of ["Inventory", "DailySupplyPlan", "ODP"]) {
      const value = Number(totals[group][status] || 0);
      if (value === 0) continue;
      const formatted = group === "PV" ? fmtMw(value) : fmtNumber(value);
      const share = total ? `${((value / total) * 100).toFixed(2)}%` : "0.00%";
      tableRows.push(`<tr><td>${group}</td><td>${escapeHtml(statusLabels[status])}</td><td>${formatted} ${escapeHtml(unit)}</td><td>${share}</td></tr>`);
    }
  }
  inventoryStatusTableEl.innerHTML = tableRows.length
    ? `<table><thead><tr><th>${escapeHtml(t("statusCategory"))}</th><th>${escapeHtml(t("statusName"))}</th><th>${escapeHtml(t("statusValue"))}</th><th>${escapeHtml(t("statusShare"))}</th></tr></thead><tbody>${tableRows.join("")}</tbody></table>`
    : `<div class="small-tip" style="padding:12px;">${escapeHtml(t("noInventoryData"))}</div>`;

  pvStatusChart?.resize();
  essStatusChart?.resize();
  hpStatusChart?.resize();
}

function dayLabelShort(dayLabel) {
  return dayLabel.slice(5);
}

function buildDailySeriesForProductRows(rows, inRangeHeaders) {
  const dailyMap = new Map();
  const dailyLabels = inRangeHeaders
    .map((header) => parseDateLabel(header))
    .filter(Boolean)
    .map((dateObj) => normalizeDateLabel(dateObj));

  for (const label of dailyLabels) {
    dailyMap.set(label, 0);
  }

  for (const row of rows) {
    let running = Number(row.Stock || 0);
    for (const header of inRangeHeaders) {
      const dateObj = parseDateLabel(header);
      if (!dateObj) continue;
      const dayLabel = normalizeDateLabel(dateObj);
      running += Number(row.Transit?.[header] || 0);
      dailyMap.set(dayLabel, (dailyMap.get(dayLabel) || 0) + running);
    }
  }

  return dailyMap;
}


function hasAnyActivityInRange(row, inRangeHeaders) {
  if (Number(row.Stock || 0) !== 0) return true;
  if (Number(row.ToBeAllocated || 0) !== 0) return true;
  for (const header of inRangeHeaders) {
    if (Number(row.Transit?.[header] || 0) !== 0) return true;
  }
  return false;
}


function buildDailySeriesByTransitSource(rows, inRangeHeaders) {
  const dailyLabels = inRangeHeaders
    .map((header) => parseDateLabel(header))
    .filter(Boolean)
    .map((dateObj) => normalizeDateLabel(dateObj));

  const invDsp = new Map();
  const odp = new Map();
  const mixed = new Map();
  for (const label of dailyLabels) {
    invDsp.set(label, 0);
    odp.set(label, 0);
    mixed.set(label, 0);
  }

  for (const row of rows) {
    let runningInvDsp = 0;
    let runningOdp = 0;
    let runningMixed = 0;

    for (const header of inRangeHeaders) {
      const dateObj = parseDateLabel(header);
      if (!dateObj) continue;
      const dayLabel = normalizeDateLabel(dateObj);

      const qty = Number(row.Transit?.[header] || 0);
      const sourceTag = row.TransitSource?.[header] || SOURCE_TAG.INV_DSP;

      if (qty) {
        if (sourceTag === SOURCE_TAG.ODP) {
          runningOdp += qty;
        } else if (sourceTag === SOURCE_TAG.MIXED) {
          runningMixed += qty;
        } else {
          runningInvDsp += qty;
        }
      }

      invDsp.set(dayLabel, (invDsp.get(dayLabel) || 0) + runningInvDsp);
      odp.set(dayLabel, (odp.get(dayLabel) || 0) + runningOdp);
      mixed.set(dayLabel, (mixed.get(dayLabel) || 0) + runningMixed);
    }
  }

  return { invDsp, odp, mixed };
}


function renderChartAndTable() {
  const filters = getFilterState();
  const { start, end } = parseVisualizationDateRange();
  const granularity = granularityEl.value;
  const lineMode = lineModeEl ? lineModeEl.value : "total";

  const matchedRows = vizState.rows.filter((row) => matchByFilters(row, filters));
  ensureChart();
  renderInventoryOverview(matchedRows);

  if (!matchedRows.length) {
    chart.clear();
    chart.setOption({
      title: { text: t("noFilterData"), left: "center", top: "middle", textStyle: { color: "#cddcff" } },
      xAxis: { show: false },
      yAxis: { show: false },
      series: [],
      backgroundColor: "transparent",
    });
    detailTableEl.innerHTML = `<div style='padding:10px;color:#cbdcff;'>${escapeHtml(t("noDetailRows"))}</div>`;
    tableSummaryEl.textContent = t("noFilterRows");
    return;
  }

  const inRangeHeaders = getDateHeadersInRange(start, end);
  if (!inRangeHeaders.length) {
    throw new Error(t("noTransitHeaders"));
  }

  const analysisRows = matchedRows.filter((row) => hasAnyActivityInRange(row, inRangeHeaders));

  if (!analysisRows.length) {
    chart.clear();
    chart.setOption({
      title: { text: t("noActiveData"), left: "center", top: "middle", textStyle: { color: "#cddcff" } },
      xAxis: { show: false },
      yAxis: { show: false },
      series: [],
      backgroundColor: "transparent",
    });
    detailTableEl.innerHTML = `<div style='padding:10px;color:#cbdcff;'>${escapeHtml(t("noActiveRows"))}</div>`;
    tableSummaryEl.textContent = t("zeroRows");
    return;
  }

  if (matchedRows.length > analysisRows.length) {
    setStatus("excludedRows", { count: matchedRows.length - analysisRows.length });
  }

  const allocByModel = buildAllocationByMonthAndModel(analysisRows, start, end);

  const allSeries = [];
  let bucketLabels = [];
  let bucketValuesForAllocRef = [];

  if (lineMode === "split") {
    const groups = new Map();
    for (const row of analysisRows) {
      const key = row.ProductKey;
      if (!groups.has(key)) {
        groups.set(key, { label: row.ProductKeyLabel, rows: [] });
      }
      groups.get(key).rows.push(row);
    }

    const entries = Array.from(groups.entries()).map(([key, g]) => {
      const daily = buildDailySeriesForProductRows(g.rows, inRangeHeaders);
      const bucket = buildBucketSeries(daily, granularity);
      const finalValue = bucket.values[bucket.values.length - 1] || 0;
      return { key, label: g.label, bucket, finalValue };
    });

    entries.sort((a, b) => b.finalValue - a.finalValue);
    const shown = entries.slice(0, 12);

    if (entries.length > shown.length) {
      setStatus("topLines", { count: entries.length, shown: shown.length });
    }

    if (!shown.length) {
      throw new Error(t("noSplitSeries"));
    }

    bucketLabels = shown[0].bucket.labels;
    bucketValuesForAllocRef = shown[0].bucket.values;

    for (const item of shown) {
      allSeries.push({
        name: item.label,
        type: "line",
        smooth: true,
        symbol: item.bucket.labels.length > 60 ? "none" : "circle",
        symbolSize: 4,
        data: item.bucket.values,
      });
    }
  } else if (lineMode === "warehouse") {
    const groups = new Map();
    for (const row of analysisRows) {
      const key = row.WH || t("unknownWarehouse");
      if (!groups.has(key)) {
        groups.set(key, { label: t("warehouseSeries", { name: key }), rows: [] });
      }
      groups.get(key).rows.push(row);
    }

    const entries = Array.from(groups.entries()).map(([key, g]) => {
      const daily = buildDailySeriesForProductRows(g.rows, inRangeHeaders);
      const bucket = buildBucketSeries(daily, granularity);
      const finalValue = bucket.values[bucket.values.length - 1] || 0;
      return { key, label: g.label, bucket, finalValue };
    });

    entries.sort((a, b) => b.finalValue - a.finalValue);

    if (!entries.length) {
      throw new Error(t("noWarehouseSeries"));
    }

    bucketLabels = entries[0].bucket.labels;
    bucketValuesForAllocRef = entries[0].bucket.values;

    for (const item of entries) {
      allSeries.push({
        name: item.label,
        type: "line",
        smooth: true,
        symbol: item.bucket.labels.length > 70 ? "none" : "circle",
        symbolSize: 4,
        data: item.bucket.values,
      });
    }
  } else {
    const daily = buildDailySeriesForProductRows(analysisRows, inRangeHeaders);
    const bucket = buildBucketSeries(daily, granularity);
    bucketLabels = bucket.labels;
    bucketValuesForAllocRef = bucket.values;

    allSeries.push({
      name: t("availableStock"),
      type: "line",
      smooth: true,
      symbol: bucket.labels.length > 80 ? "none" : "circle",
      symbolSize: 5,
      data: bucket.values,
      lineStyle: { width: 3, color: "#5ca0ff" },
      itemStyle: { color: "#7fb4ff" },
      areaStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: "rgba(92,160,255,0.35)" },
          { offset: 1, color: "rgba(92,160,255,0.06)" },
        ]),
      },
    });

    const sourceDaily = buildDailySeriesByTransitSource(analysisRows, inRangeHeaders);
    const sourceBucketInv = buildBucketSeries(sourceDaily.invDsp, granularity);
    const sourceBucketOdp = buildBucketSeries(sourceDaily.odp, granularity);
    const sourceBucketMixed = buildBucketSeries(sourceDaily.mixed, granularity);

    const sourceLineDefs = [
      { name: t("transitInv"), bucket: sourceBucketInv, color: "#7fc4ff" },
      { name: t("transitOdp"), bucket: sourceBucketOdp, color: "#ffbb77" },
      { name: t("transitMixed"), bucket: sourceBucketMixed, color: "#c59dff" },
    ];

    for (const def of sourceLineDefs) {
      const hasAny = (def.bucket.values || []).some((v) => Number(v || 0) !== 0);
      if (!hasAny) continue;
      allSeries.push({
        name: def.name,
        type: "line",
        smooth: false,
        symbol: "none",
        data: def.bucket.values,
        lineStyle: { width: 1.6, color: def.color, type: "dashed", opacity: 0.95 },
        itemStyle: { color: def.color },
        emphasis: { focus: "series" },
      });
    }
  }

  const bucketValueMap = new Map(bucketLabels.map((label, idx) => [label, bucketValuesForAllocRef[idx] || 0]));

  const allocPalette = [
    ["rgba(255, 142, 52, 0.42)", "rgba(255, 186, 127, 0.95)"],
    ["rgba(129, 194, 255, 0.42)", "rgba(164, 216, 255, 0.95)"],
    ["rgba(150, 230, 150, 0.42)", "rgba(192, 255, 192, 0.95)"],
    ["rgba(214, 153, 255, 0.42)", "rgba(228, 196, 255, 0.95)"],
    ["rgba(255, 214, 102, 0.42)", "rgba(255, 232, 163, 0.95)"],
    ["rgba(255, 128, 171, 0.42)", "rgba(255, 181, 206, 0.95)"],
  ];

  const allocModelEntries = Array.from(allocByModel.entries())
    .map(([model, monthMap]) => {
      let total = 0;
      for (const qty of monthMap.values()) total += Number(qty || 0);
      return { model, monthMap, total };
    })
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);

  for (let idx = 0; idx < allocModelEntries.length; idx += 1) {
    const entry = allocModelEntries[idx];
    const allocPlot = mapAllocationToBuckets(entry.monthMap, granularity, bucketLabels, bucketValueMap);
    const hasData = allocPlot.barData.some((x) => Number(x) !== 0);
    if (!hasData) continue;

    const [fillColor, borderColor] = allocPalette[idx % allocPalette.length];

    allSeries.push({
      name: t("toAllocate", { model: entry.model }),
      type: "bar",
      stack: "alloc",
      yAxisIndex: 1,
      data: allocPlot.barData,
      barMaxWidth: 22,
      itemStyle: {
        color: fillColor,
        borderColor,
        borderWidth: 1,
        borderRadius: [4, 4, 0, 0],
      },
    });
  }

  const manyPoints = bucketLabels.length > 80;

  chart.setOption({
    backgroundColor: "transparent",
    animation: false,
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "cross" },
      backgroundColor: "rgba(255, 255, 255, 0.96)",
      borderColor: "#b8d2f0",
      textStyle: { color: "#274b78" },
    },
    legend: {
      top: 8,
      textStyle: { color: "#2f527f" },
    },
    grid: { left: 62, right: 62, top: 62, bottom: 92 },
    dataZoom: [
      { type: "inside", xAxisIndex: 0, start: 0, end: 100, filterMode: "none" },
      {
        type: "slider",
        xAxisIndex: 0,
        bottom: 28,
        height: 18,
        start: manyPoints ? 70 : 0,
        end: 100,
        borderColor: "#b5cdeb",
        backgroundColor: "rgba(233, 242, 255, 0.9)",
        fillerColor: "rgba(92, 160, 255, 0.24)",
      },
    ],
    xAxis: {
      type: "category",
      boundaryGap: false,
      data: bucketLabels,
      axisLine: { lineStyle: { color: "#8bb0dd" } },
      axisLabel: {
        color: "#50719f",
        hideOverlap: true,
        rotate: granularity === "day" ? 45 : 0,
        formatter: (val) => (granularity === "day" ? dayLabelShort(val) : val),
      },
    },
    yAxis: [
      {
        type: "value",
        name: t("availableStock"),
        nameTextStyle: { color: "#4f79ad" },
        axisLine: { lineStyle: { color: "#8bb0dd" } },
        axisLabel: { color: "#50719f" },
        splitLine: { lineStyle: { color: "rgba(132, 165, 208, 0.28)" } },
      },
      {
        type: "value",
        name: t("axisAllocated"),
        nameTextStyle: { color: "#c88034" },
        axisLine: { lineStyle: { color: "#c8a177" } },
        axisLabel: { color: "#c27c35" },
        splitLine: { show: false },
      },
    ],
    series: allSeries,
  }, true);

  chart.resize();
  renderDetailTable(analysisRows, inRangeHeaders, start, end);
}

function buildProductAllocationMap(filteredRows, startDate, endDate) {
  const skuWhToProduct = new Map();
  for (const row of filteredRows) {
    skuWhToProduct.set(`${row.SKU}||${row.WH}`, row.ProductKey);
  }

  const productAlloc = new Map();
  for (const alloc of vizState.allocations) {
    const key = `${alloc.SKU}||${alloc.WH}`;
    const productKey = skuWhToProduct.get(key);
    if (!productKey) continue;

    if (!alloc.CRDDate) continue;
    const crd = new Date(`${alloc.CRDDate}T00:00:00`);
    if (Number.isNaN(crd.getTime()) || crd < startDate || crd > endDate) continue;

    productAlloc.set(productKey, (productAlloc.get(productKey) || 0) + Number(alloc.OrderedQty || 0));
  }

  return productAlloc;
}

function renderDetailTable(filteredRows, inRangeHeaders, startDate, endDate) {
  const productMap = new Map();
  for (const row of filteredRows) {
    const key = row.ProductKey;
    if (!productMap.has(key)) {
      productMap.set(key, {
        Product: row.ProductKeyLabel,
        Stock: 0,
        transitByDate: {},
        sourceByDate: {},
        TransitTotal: 0,
      });
    }

    const item = productMap.get(key);
    item.Stock += Number(row.Stock || 0);

    for (const dateHeader of inRangeHeaders) {
      const qty = Number(row.Transit?.[dateHeader] || 0);
      if (!qty) continue;
      item.transitByDate[dateHeader] = (item.transitByDate[dateHeader] || 0) + qty;
      const sourceTag = row.TransitSource?.[dateHeader] || SOURCE_TAG.INV_DSP;
      item.sourceByDate[dateHeader] = mergeSourceTag(item.sourceByDate[dateHeader], sourceTag);
      item.TransitTotal += qty;
    }
  }

  const productAllocMap = buildProductAllocationMap(filteredRows, startDate, endDate);

  const arrivalDateHeaders = inRangeHeaders.filter((header) => {
    for (const item of productMap.values()) {
      if (Number(item.transitByDate[header] || 0) !== 0) return true;
    }
    return false;
  });

  const rows = Array.from(productMap.entries())
    .map(([productKey, item]) => {
      const allocated = Number(productAllocMap.get(productKey) || 0);
      const available = Number(item.Stock || 0) + Number(item.TransitTotal || 0) - allocated;
      return {
        ...item,
        Allocated: allocated,
        Available: available,
      };
    })
    .sort((a, b) => a.Product.localeCompare(b.Product));

  if (!rows.length) {
    detailTableEl.innerHTML = `<div style='padding:10px;color:#cbdcff;'>${escapeHtml(t("noDetailRows"))}</div>`;
    tableSummaryEl.textContent = t("noFilterRows");
    return;
  }

  const headerHtml = [
    "<tr>",
    `<th>${escapeHtml(t("tableProduct"))}</th>`,
    `<th>${escapeHtml(t("inStock"))}</th>`,
    `<th>${escapeHtml(t("inTransitRange"))}</th>`,
    `<th>${escapeHtml(t("allocated"))}</th>`,
    `<th>${escapeHtml(t("availableQty"))}</th>`,
    ...arrivalDateHeaders.map((dateHeader) => {
      const sourceTag = vizState.dateSourceTags?.[dateHeader] || SOURCE_TAG.INV_DSP;
      const className = `th-${sourceClassFromTag(sourceTag)}`;
      return `<th class="${className}">${escapeHtml(dateHeader)}</th>`;
    }),
    "</tr>",
  ].join("");

  const bodyHtml = rows.map((item) => {
    const cells = [
      `<td>${escapeHtml(item.Product)}</td>`,
      `<td>${fmtNumber(item.Stock)}</td>`,
      `<td>${fmtNumber(item.TransitTotal)}</td>`,
      `<td>${fmtNumber(item.Allocated)}</td>`,
      `<td>${fmtNumber(item.Available)}</td>`,
      ...arrivalDateHeaders.map((dateHeader) => {
        const sourceTag = item.sourceByDate[dateHeader] || vizState.dateSourceTags?.[dateHeader] || SOURCE_TAG.INV_DSP;
        const className = `td-${sourceClassFromTag(sourceTag)}`;
        return `<td class="${className}">${fmtNumber(item.transitByDate[dateHeader] || 0)}</td>`;
      }),
    ];
    return `<tr>${cells.join("")}</tr>`;
  }).join("");

  detailTableEl.innerHTML = `<table><thead>${headerHtml}</thead><tbody>${bodyHtml}</tbody></table>`;

  const totalStock = rows.reduce((sum, item) => sum + Number(item.Stock || 0), 0);
  const totalTransit = rows.reduce((sum, item) => sum + Number(item.TransitTotal || 0), 0);
  const totalAllocated = rows.reduce((sum, item) => sum + Number(item.Allocated || 0), 0);
  const totalAvailable = rows.reduce((sum, item) => sum + Number(item.Available || 0), 0);

  tableSummaryEl.textContent = t("tableSummary", { rows: rows.length, dates: arrivalDateHeaders.length, stock: fmtNumber(totalStock), transit: fmtNumber(totalTransit), allocated: fmtNumber(totalAllocated), available: fmtNumber(totalAvailable) });
}

function applyVisualizationPayload(payload) {
  vizState.dateHeaders = payload?.dateHeaders || [];
  vizState.rows = payload?.rows || [];
  vizState.allocations = payload?.allocations || [];
  vizState.keyMeta = new Map(Object.entries(payload?.keyMeta || {}));
  vizState.dateSourceTags = payload?.dateSourceTags || {};
}

async function extractVisualizationData() {
  await pyodide.runPythonAsync(`
import json
from datetime import date, datetime
from openpyxl import load_workbook


def _text(value):
    if value is None:
        return ""
    return str(value).strip()


def _num(value):
    if value in (None, ""):
        return 0.0
    if isinstance(value, (int, float)):
        return float(value)
    text = str(value).strip().replace(",", "")
    if not text:
        return 0.0
    try:
        return float(text)
    except Exception:
        return 0.0


def _date_to_iso(value):
    if value in (None, ""):
        return ""
    if isinstance(value, datetime):
        return value.date().isoformat()
    if isinstance(value, date):
        return value.isoformat()
    text = str(value).strip()
    if not text:
        return ""
    for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%Y-%m-%d %H:%M:%S", "%Y/%m/%d %H:%M:%S"):
        try:
            return datetime.strptime(text, fmt).date().isoformat()
        except Exception:
            pass
    return ""


def _merge_tag(curr, incoming):
    if not incoming:
        return curr or ""
    if not curr or curr == incoming:
        return incoming
    return "MIXED"

wb = load_workbook('/work/stock_output.xlsx', data_only=True)
ws = wb['stock']
headers = [cell.value for cell in ws[1]]
header_to_idx = {str(h).strip(): i for i, h in enumerate(headers) if h is not None}

source_map = {}
status_qty_map = {}
if '_Transit Source Map' in wb.sheetnames:
    ws_src = wb['_Transit Source Map']
    src_headers = [cell.value for cell in ws_src[1]]
    src_idx = {str(h).strip(): i for i, h in enumerate(src_headers) if h is not None}
    required_src = ["SKU", "WH", "Date", "Source"]
    if all(c in src_idx for c in required_src):
        for src_row in ws_src.iter_rows(min_row=2, values_only=True):
            sku = _text(src_row[src_idx["SKU"]])
            wh = _text(src_row[src_idx["WH"]])
            d_header = _text(src_row[src_idx["Date"]])
            source = _text(src_row[src_idx["Source"]])
            if sku and wh and d_header and source:
                source_map[f"{sku}||{wh}||{d_header}"] = source
                status_key = f"{sku}||{wh}"
                if status_key not in status_qty_map:
                    status_qty_map[status_key] = {"DailySupplyPlan": 0.0, "ODP": 0.0}
                if "Daily Supply Plan Qty" in src_idx:
                    status_qty_map[status_key]["DailySupplyPlan"] += _num(src_row[src_idx["Daily Supply Plan Qty"]])
                if "ODP Qty" in src_idx:
                    status_qty_map[status_key]["ODP"] += _num(src_row[src_idx["ODP Qty"]])

required = ["WH", "Category", "Product TCL Report", "Family", "SKU", "Model", "Connector", "Stock", "To be allocated"]
for col in required:
    if col not in header_to_idx:
        raise ValueError(f"Missing expected column in stock sheet: {col}")

base_set = set(required + ["Bin", "MOQ", "To be allocated", "Total QTY", "Total MW", "MW"])

date_headers = []
for h in headers:
    if h is None:
        continue
    hs = str(h).strip()
    if hs in base_set:
        continue
    parts = hs.split('.')
    if len(parts) == 3 and all(p.isdigit() for p in parts):
        date_headers.append(hs)

rows = []
key_meta = {}
date_source_tags = {}
stock_rows = list(ws.iter_rows(min_row=2, values_only=True))
active_sku_keys = set()
status_assigned_keys = set()
for row in stock_rows:
    sku = _text(row[header_to_idx['SKU']])
    if not sku:
        continue
    has_activity = _num(row[header_to_idx['Stock']]) != 0 or _num(row[header_to_idx['To be allocated']]) != 0
    if not has_activity:
        has_activity = any(_num(row[header_to_idx[d]]) != 0 for d in date_headers)
    if has_activity:
        active_sku_keys.add(sku.upper())

for row in stock_rows:
    sku = _text(row[header_to_idx['SKU']])
    wh = _text(row[header_to_idx['WH']])
    if not sku or not wh:
        continue
    if sku.upper() not in active_sku_keys:
        continue

    category = _text(row[header_to_idx['Category']])
    product_report = _text(row[header_to_idx['Product TCL Report']])
    family = _text(row[header_to_idx['Family']])
    model = _text(row[header_to_idx['Model']])
    connector = _text(row[header_to_idx['Connector']])

    marker = "sku not matched"
    if any(v.lower() == marker for v in (category, product_report, family, model)):
        continue

    transit = {}
    transit_source = {}
    for d in date_headers:
        qty = _num(row[header_to_idx[d]])
        if qty != 0:
            transit[d] = qty
            src = source_map.get(f"{sku}||{wh}||{d}", "INV_DSP")
            transit_source[d] = src
            date_source_tags[d] = _merge_tag(date_source_tags.get(d), src)

    product_key = f"{sku}||{model}" if model else f"{sku}||"
    product_parts = [part for part in (model, sku, connector) if part]
    product_label = " | ".join(product_parts) if product_parts else sku
    status_key = f"{sku}||{wh}"
    transit_status = status_qty_map.get(status_key, {}) if status_key not in status_assigned_keys else {}
    status_assigned_keys.add(status_key)
    bin_value = _num(row[header_to_idx['Bin']]) if 'Bin' in header_to_idx else 0
    stock_value = _num(row[header_to_idx['Stock']])

    item = {
        "WH": wh,
        "Category": category,
        "ProductTCLReport": product_report,
        "Family": family,
        "SKU": sku,
        "Model": model,
        "Connector": connector,
        "ProductKey": product_key,
        "ProductKeyLabel": product_label,
        "Bin": bin_value,
        "StockMW": (stock_value * bin_value / 1000000) if category.upper().startswith("PV") else 0,
        "Stock": stock_value,
        "ToBeAllocated": _num(row[header_to_idx['To be allocated']]),
        "StatusQuantity": {
            "Inventory": stock_value,
            "DailySupplyPlan": _num(transit_status.get("DailySupplyPlan")),
            "ODP": _num(transit_status.get("ODP")),
        },
        "Transit": transit,
        "TransitSource": transit_source,
    }
    rows.append(item)
    key_meta[f"{sku}||{wh}"] = {
        "WH": item["WH"],
        "Category": item["Category"],
        "ProductTCLReport": item["ProductTCLReport"],
        "Family": item["Family"],
        "Connector": item["Connector"],
        "ProductKey": item["ProductKey"],
    }

allocations = []
if 'To be allocated' in wb.sheetnames:
    ws_alloc = wb['To be allocated']
    alloc_headers = [cell.value for cell in ws_alloc[1]]
    idx_alloc = {str(h).strip(): i for i, h in enumerate(alloc_headers) if h is not None}

    required_alloc = ["SKU", "Ordered Qty", "CRD", "WH"]
    has_alloc = all(c in idx_alloc for c in required_alloc)
    if has_alloc:
        for row in ws_alloc.iter_rows(min_row=2, values_only=True):
            sku = _text(row[idx_alloc["SKU"]])
            wh = _text(row[idx_alloc["WH"]])
            if not sku or not wh:
                continue
            allocations.append({
                "SKU": sku,
                "WH": wh,
                "Model": _text(row[idx_alloc["Model"]]) if "Model" in idx_alloc else "",
                "OrderedQty": _num(row[idx_alloc["Ordered Qty"]]),
                "CRDDate": _date_to_iso(row[idx_alloc["CRD"]]),
            })

payload = {
    "dateHeaders": date_headers,
    "rows": rows,
    "allocations": allocations,
    "keyMeta": key_meta,
    "dateSourceTags": date_source_tags,
}

with open('/work/stock_vis.json', 'w', encoding='utf-8') as f:
    json.dump(payload, f, ensure_ascii=False)
`);

  const jsonText = pyodide.FS.readFile("/work/stock_vis.json", { encoding: "utf8" });
  const payload = JSON.parse(jsonText);

  applyVisualizationPayload(payload);
}

async function runPythonAnalysis() {
  resetDownloadLink();

  runBtn.disabled = true;
  try {
    await loadPyodideRuntime();

    setStatus("preparingInputs");
    const stockTemplateBytes = await fetchTemplateBytes();

    const inventoryPath = await resolveInputWorkbook({
      fileInput: inventoryInput,
      useRepoDefault: Boolean(useRepoInventoryEl?.checked),
      repoPath: DEFAULT_REPO_FILE.inventory,
      targetPath: "/work/inventory_input.xlsx",
      label: "Inventory Step1",
      required: true,
    });

    const outputPath = "/work/stock_output.xlsx";

    pyodide.FS.writeFile(outputPath, stockTemplateBytes);

    const dailySupplyPath = await resolveInputWorkbook({
      fileInput: dailySupplyInput,
      useRepoDefault: Boolean(useRepoDailySupplyEl?.checked),
      repoPath: DEFAULT_REPO_FILE.dailySupply,
      targetPath: "/work/daily_supply_plan.xlsx",
      label: "DailySupplyPlan",
      required: true,
    });
    const odpMasterPath = await resolveInputWorkbook({
      fileInput: odpMasterInput,
      useRepoDefault: Boolean(useRepoOdpMasterEl?.checked),
      repoPath: DEFAULT_REPO_FILE.odpMaster,
      targetPath: "/work/odp_master.xlsx",
      label: "EUPV ODP MASTER",
      required: false,
    });
    const orderPath = await resolveInputWorkbook({
      fileInput: orderInput,
      useRepoDefault: Boolean(useRepoOrderfileEl?.checked),
      repoPath: DEFAULT_REPO_FILE.orderfile,
      targetPath: "/work/order_file.xlsx",
      label: "Orderfile Base",
      required: false,
    });

    const startDate = transitStartInput.value || "2026-08-01";
    const endDate = transitEndInput.value || "2026-12-31";

    const dailySupplyPy = dailySupplyPath ? `'${dailySupplyPath}'` : "None";
    const odpMasterPy = odpMasterPath ? `'${odpMasterPath}'` : "None";
    const orderPy = orderPath ? `'${orderPath}'` : "None";

    setStatus("runningPython");

    await pyodide.runPythonAsync(`
from pathlib import Path
from inventory_step1_to_stock import run, _parse_cli_date

run(
    inventory_path=Path("${inventoryPath}"),
    stock_path=Path("${outputPath}"),
    sku_sheet_name=None,
    daily_supply_plan_path=Path(${dailySupplyPy}) if ${dailySupplyPy} is not None else None,
    odp_master_path=Path(${odpMasterPy}) if ${odpMasterPy} is not None else None,
    order_file_path=Path(${orderPy}) if ${orderPy} is not None else None,
    transit_start_date=_parse_cli_date("${startDate}"),
    transit_end_date=_parse_cli_date("${endDate}"),
)
`);

    const outputBytes = pyodide.FS.readFile(outputPath);
    const blob = new Blob([outputBytes], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const objectUrl = URL.createObjectURL(blob);

    const now = new Date();
    const fileName = `stock_output_${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}.xlsx`;

    downloadLinkEl.href = objectUrl;
    downloadLinkEl.download = fileName;
    downloadLinkEl.textContent = t("download", { file: fileName });
    downloadLinkEl.style.display = "inline-block";

    setStatus("generatedBuilding");

    await extractVisualizationData();
    initializeCascadeFilters();

    vizPanelEl.style.display = "block";
    renderChartAndTable();
    setTimeout(() => chart && chart.resize(), 30);

    setStatus("generatedReady");
  } catch (err) {
    setStatus("failed", { message: err?.message || err });
    console.error(err);
  } finally {
    runBtn.disabled = false;
  }
}

async function runJavascriptAnalysis() {
  resetDownloadLink();
  runBtn.disabled = true;
  try {
    setStatus("preparingJs");
    const stockTemplateBytes = await fetchTemplateBytes();
    const inventoryBytes = await resolveInputBytes({
      fileInput: inventoryInput,
      useRepoDefault: Boolean(useRepoInventoryEl?.checked),
      repoPath: DEFAULT_REPO_FILE.inventory,
      label: "Inventory Step1",
      required: true,
    });
    const dailySupplyBytes = await resolveInputBytes({
      fileInput: dailySupplyInput,
      useRepoDefault: Boolean(useRepoDailySupplyEl?.checked),
      repoPath: DEFAULT_REPO_FILE.dailySupply,
      label: "DailySupplyPlan",
      required: true,
    });
    const odpBytes = await resolveInputBytes({
      fileInput: odpMasterInput,
      useRepoDefault: Boolean(useRepoOdpMasterEl?.checked),
      repoPath: DEFAULT_REPO_FILE.odpMaster,
      label: "EUPV ODP MASTER",
      required: false,
    });
    const orderBytes = await resolveInputBytes({
      fileInput: orderInput,
      useRepoDefault: Boolean(useRepoOrderfileEl?.checked),
      repoPath: DEFAULT_REPO_FILE.orderfile,
      label: "Orderfile Base",
      required: false,
    });

    setStatus("runningJs");
    const result = await buildStockOutputJs({
      stockTemplateBytes,
      inventoryBytes,
      dailySupplyBytes,
      odpBytes,
      orderBytes,
      startDate: transitStartInput.value || "2026-08-01",
      endDate: transitEndInput.value || "2026-12-31",
    });

    const blob = new Blob([result.outputBytes], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const objectUrl = URL.createObjectURL(blob);
    const now = new Date();
    const fileName = `stock_output_${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}.xlsx`;
    downloadLinkEl.href = objectUrl;
    downloadLinkEl.download = fileName;
    downloadLinkEl.textContent = t("download", { file: fileName });
    downloadLinkEl.style.display = "inline-block";

    applyVisualizationPayload(result.visualization);
    initializeCascadeFilters();
    vizPanelEl.style.display = "block";
    renderChartAndTable();
    setTimeout(() => chart && chart.resize(), 30);
    setStatus("jsDone", { rows: result.summary.totalRows, skus: result.summary.activeSkuCount });
  } catch (err) {
    setStatus("jsFailed", { message: err?.message || err });
    console.error(err);
  } finally {
    runBtn.disabled = false;
  }
}

async function runAnalysis() {
  if (engineModeEl?.value === "python") return runPythonAnalysis();
  return runJavascriptAnalysis();
}

function clearAllFilterSelections() {
  for (const def of levelDefs) {
    for (const opt of def.el.options) {
      opt.selected = false;
    }
    applySelectVisualState(def.el);
  }
  refreshFilterSummaries();
}

function resetForm() {
  inventoryInput.value = "";
  dailySupplyInput.value = "";
  odpMasterInput.value = "";
  orderInput.value = "";
  if (engineModeEl) engineModeEl.value = "javascript";
  if (useRepoInventoryEl) useRepoInventoryEl.checked = false;
  if (useRepoDailySupplyEl) useRepoDailySupplyEl.checked = false;
  if (useRepoOdpMasterEl) useRepoOdpMasterEl.checked = false;
  if (useRepoOrderfileEl) useRepoOrderfileEl.checked = false;
  transitStartInput.value = "2026-08-01";
  transitEndInput.value = "2026-12-31";
  resetDownloadLink();
  vizPanelEl.style.display = "none";
  detailTableEl.innerHTML = "";
  tableSummaryEl.textContent = t("noData");
  vizState.rows = [];
  vizState.allocations = [];
  vizState.dateHeaders = [];
  vizState.keyMeta = new Map();
  vizState.dateSourceTags = {};
  if (chart) {
    chart.clear();
  }
  setStatus("resetDone");
}

for (let i = 0; i < levelDefs.length; i += 1) {
  const def = levelDefs[i];
  enableClickToggleMultiSelect(def.el);

  def.el.addEventListener("change", () => {
    rebuildCascadeFrom(i + 1, false);
    refreshFilterSummaries();
    if (vizPanelEl.style.display !== "none") {
      try { renderChartAndTable(); } catch (err) { setStatus("visualizationFailed", { message: err?.message || err }); }
    }
  });
}

applyVizBtn.addEventListener("click", () => {
  try {
    renderChartAndTable();
  } catch (err) {
    setStatus("visualizationFailed", { message: err?.message || err });
  }
});

clearFiltersBtn.addEventListener("click", () => {
  try {
    clearAllFilterSelections();
    rebuildCascadeFrom(1, false);
    renderChartAndTable();
  } catch (err) {
    setStatus("visualizationFailed", { message: err?.message || err });
  }
});


if (lineModeEl) {
  lineModeEl.addEventListener("change", () => {
    try {
      renderChartAndTable();
    } catch (err) {
      setStatus("visualizationFailed", { message: err?.message || err });
    }
  });
}

runBtn.addEventListener("click", runAnalysis);
resetBtn.addEventListener("click", resetForm);

window.addEventListener("app-language-change", () => {
  statusEl.textContent = t(lastStatus.key, lastStatus.params);
  refreshFilterSummaries();
  if (downloadLinkEl.download) {
    downloadLinkEl.textContent = t("download", { file: downloadLinkEl.download });
  }
  if (vizPanelEl.style.display !== "none" && vizState.rows.length) {
    try {
      renderChartAndTable();
    } catch (err) {
      setStatus("visualizationFailed", { message: err?.message || err });
    }
  }
});
