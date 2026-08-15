const statusEl = document.getElementById("status");
const downloadLinkEl = document.getElementById("downloadLink");
const vizPanelEl = document.getElementById("vizPanel");

const runBtn = document.getElementById("runBtn");
const resetBtn = document.getElementById("resetBtn");

const inventoryInput = document.getElementById("inventoryFile");
const dailySupplyInput = document.getElementById("dailySupplyFile");
const odpMasterInput = document.getElementById("odpMasterFile");
const orderInput = document.getElementById("orderFile");
const transitStartInput = document.getElementById("transitStart");
const transitEndInput = document.getElementById("transitEnd");

const whFilterEl = document.getElementById("whFilter");
const categoryFilterEl = document.getElementById("categoryFilter");
const productReportFilterEl = document.getElementById("productReportFilter");
const familyFilterEl = document.getElementById("familyFilter");
const productFilterEl = document.getElementById("productFilter");
const vizStartEl = document.getElementById("vizStart");
const vizEndEl = document.getElementById("vizEnd");
const granularityEl = document.getElementById("granularity");
const applyVizBtn = document.getElementById("applyVizBtn");
const clearFiltersBtn = document.getElementById("clearFiltersBtn");
const detailTableEl = document.getElementById("detailTable");
const tableSummaryEl = document.getElementById("tableSummary");

let pyodide = null;
let pyReady = false;
let chart = null;

const vizState = {
  rows: [],
  allocations: [],
  dateHeaders: [],
  keyMeta: new Map(),
};

function setStatus(text) {
  statusEl.textContent = text;
}

function resetDownloadLink() {
  downloadLinkEl.style.display = "none";
  downloadLinkEl.removeAttribute("href");
  downloadLinkEl.removeAttribute("download");
}

function selectedValues(selectEl) {
  return Array.from(selectEl.selectedOptions).map((opt) => opt.value);
}

function toSet(arr) {
  return new Set(arr || []);
}

function fmtNumber(value) {
  const num = Number(value || 0);
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(num);
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

async function loadPyodideRuntime() {
  if (pyReady) return;

  setStatus("Loading Python runtime (first run may take 20-60 seconds)...");
  const script = document.createElement("script");
  script.src = "https://cdn.jsdelivr.net/pyodide/v0.27.2/full/pyodide.js";
  script.async = true;

  await new Promise((resolve, reject) => {
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });

  pyodide = await globalThis.loadPyodide();

  setStatus("Installing dependency: openpyxl...");
  await pyodide.loadPackage("micropip");
  await pyodide.runPythonAsync(`
import micropip
await micropip.install("openpyxl")
`);

  setStatus("Loading stock analysis script...");
  const pyCode = await fetch("./py/inventory_step1_to_stock.py", { cache: "no-store" }).then((r) => r.text());
  pyodide.FS.mkdirTree("/work");
  pyodide.FS.writeFile("/work/inventory_step1_to_stock.py", pyCode);

  await pyodide.runPythonAsync(`
import sys
if "/work" not in sys.path:
    sys.path.append("/work")
`);

  pyReady = true;
  setStatus("Environment ready. Upload files and click Generate Stock File.");
}

async function readFileAsBytes(file) {
  const arrayBuffer = await file.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}

async function fetchTemplateBytes() {
  const resp = await fetch("./templates/stock_template.xlsx", { cache: "no-store" });
  if (!resp.ok) {
    throw new Error(`Template file not found: ./templates/stock_template.xlsx (HTTP ${resp.status})`);
  }
  const buffer = await resp.arrayBuffer();
  return new Uint8Array(buffer);
}

async function writeOptionalFile(fileInput, targetPath) {
  const file = fileInput.files?.[0];
  if (!file) return null;
  const bytes = await readFileAsBytes(file);
  pyodide.FS.writeFile(targetPath, bytes);
  return targetPath;
}

function setOptions(selectEl, values) {
  const oldSelected = new Set(selectedValues(selectEl));
  const safeValues = Array.from(new Set(values.filter((v) => String(v).trim() !== ""))).sort((a, b) => String(a).localeCompare(String(b)));
  selectEl.innerHTML = safeValues.map((value) => `<option value="${String(value).replace(/"/g, "&quot;")}">${value}</option>`).join("");
  for (const opt of selectEl.options) {
    if (oldSelected.has(opt.value)) {
      opt.selected = true;
    }
  }
}

function matchByFilters(row, filters) {
  if (filters.wh.size && !filters.wh.has(row.WH)) return false;
  if (filters.category.size && !filters.category.has(row.Category)) return false;
  if (filters.productReport.size && !filters.productReport.has(row.ProductTCLReport)) return false;
  if (filters.family.size && !filters.family.has(row.Family)) return false;
  if (filters.product.size && !filters.product.has(row.ProductKey)) return false;
  return true;
}

function getDimensionFilterSets(withProduct = true) {
  return {
    wh: toSet(selectedValues(whFilterEl)),
    category: toSet(selectedValues(categoryFilterEl)),
    productReport: toSet(selectedValues(productReportFilterEl)),
    family: toSet(selectedValues(familyFilterEl)),
    product: withProduct ? toSet(selectedValues(productFilterEl)) : new Set(),
  };
}

function refreshProductOptions() {
  const filtersNoProduct = getDimensionFilterSets(false);
  const candidates = vizState.rows.filter((row) => matchByFilters(row, filtersNoProduct));
  const productValues = candidates.map((row) => row.ProductKeyLabel);

  const prev = new Set(selectedValues(productFilterEl));
  setOptions(productFilterEl, productValues);
  if (prev.size === 0) {
    for (const option of productFilterEl.options) {
      option.selected = true;
    }
  }
}

function initFilters() {
  setOptions(whFilterEl, vizState.rows.map((r) => r.WH));
  setOptions(categoryFilterEl, vizState.rows.map((r) => r.Category));
  setOptions(productReportFilterEl, vizState.rows.map((r) => r.ProductTCLReport));
  setOptions(familyFilterEl, vizState.rows.map((r) => r.Family));
  setOptions(productFilterEl, vizState.rows.map((r) => r.ProductKeyLabel));

  for (const selectEl of [whFilterEl, categoryFilterEl, productReportFilterEl, familyFilterEl, productFilterEl]) {
    for (const option of selectEl.options) {
      option.selected = true;
    }
  }

  const validDates = vizState.dateHeaders.map(parseDateLabel).filter(Boolean);
  if (validDates.length) {
    const min = validDates[0];
    const max = validDates[validDates.length - 1];
    vizStartEl.value = normalizeDateLabel(min);
    vizEndEl.value = normalizeDateLabel(max);
  }
}

function parseVisualizationDateRange() {
  const start = vizStartEl.value ? new Date(`${vizStartEl.value}T00:00:00`) : null;
  const end = vizEndEl.value ? new Date(`${vizEndEl.value}T00:00:00`) : null;
  if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
    throw new Error("Invalid visualization date range.");
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
    return { labels, values: labels.map((l) => dailyMap.get(l) || 0) };
  }

  const bucketMap = new Map();
  for (const [dayLabel, value] of dailyMap.entries()) {
    const dayDate = new Date(`${dayLabel}T00:00:00`);
    const key = granularity === "week" ? weekLabelFromDate(dayDate) : monthLabelFromDate(dayDate);
    bucketMap.set(key, value);
  }

  const labels = Array.from(bucketMap.keys());
  return { labels, values: labels.map((k) => bucketMap.get(k) || 0) };
}

function buildAllocationByMonth(filteredRows, filters, start, end) {
  const selectedRowKeys = new Set(filteredRows.map((r) => `${r.SKU}||${r.WH}`));
  const selectedProductKeys = filters.product;

  const monthMap = new Map();
  for (const alloc of vizState.allocations) {
    const linkKey = `${alloc.SKU}||${alloc.WH}`;
    if (!selectedRowKeys.has(linkKey)) continue;

    const mappedMeta = vizState.keyMeta.get(linkKey);
    if (mappedMeta) {
      if (filters.wh.size && !filters.wh.has(mappedMeta.WH)) continue;
      if (filters.category.size && !filters.category.has(mappedMeta.Category)) continue;
      if (filters.productReport.size && !filters.productReport.has(mappedMeta.ProductTCLReport)) continue;
      if (filters.family.size && !filters.family.has(mappedMeta.Family)) continue;
      if (selectedProductKeys.size && !selectedProductKeys.has(mappedMeta.ProductKey)) continue;
    }

    if (!alloc.CRDDate) continue;
    const crd = new Date(`${alloc.CRDDate}T00:00:00`);
    if (Number.isNaN(crd.getTime()) || crd < start || crd > end) continue;

    const month = monthLabelFromDate(crd);
    monthMap.set(month, (monthMap.get(month) || 0) + Number(alloc.OrderedQty || 0));
  }

  return monthMap;
}

function mapAllocationToBuckets(monthMap, granularity, bucketLabels, bucketValueMap) {
  const barMap = new Map(bucketLabels.map((label) => [label, 0]));
  const monthLabels = Array.from(monthMap.keys()).sort();

  for (const month of monthLabels) {
    const qty = monthMap.get(month) || 0;
    let bucketLabel = null;

    if (granularity === "month") {
      bucketLabel = month;
    } else if (granularity === "week") {
      const [year, mon] = month.split("-").map(Number);
      const monthEnd = new Date(year, mon, 0);
      bucketLabel = weekLabelFromDate(monthEnd);
    } else {
      const [year, mon] = month.split("-").map(Number);
      const monthEnd = new Date(year, mon, 0);
      bucketLabel = normalizeDateLabel(monthEnd);
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
        formatter: `Alloc ${fmtNumber(qty)}`,
        color: "#ffd8b3",
        fontSize: 11,
      },
      itemStyle: {
        color: "#ff8b2c",
      },
    });
  }

  return {
    barData: bucketLabels.map((label) => Number(barMap.get(label) || 0).toFixed(3) * 1),
    markPoints,
  };
}

function ensureChart() {
  if (!chart) {
    chart = echarts.init(document.getElementById("stockChart"), null, { renderer: "canvas" });
    window.addEventListener("resize", () => chart && chart.resize());
  }
}

function renderChartAndTable() {
  const filters = getDimensionFilterSets(true);
  const { start, end } = parseVisualizationDateRange();
  const granularity = granularityEl.value;

  const filteredRows = vizState.rows.filter((row) => matchByFilters(row, filters));
  if (!filteredRows.length) {
    ensureChart();
    chart.clear();
    chart.setOption({
      title: { text: "No data under current filters", left: "center", top: "middle", textStyle: { color: "#cddcff" } },
      xAxis: { show: false },
      yAxis: { show: false },
      series: [],
      backgroundColor: "transparent",
    });
    detailTableEl.innerHTML = "<div style='padding:10px;color:#cbdcff;'>No detail rows.</div>";
    tableSummaryEl.textContent = "No rows matched current filters.";
    return;
  }

  const inRangeHeaders = getDateHeadersInRange(start, end);
  if (!inRangeHeaders.length) {
    throw new Error("No transit date headers in selected date range.");
  }

  const dailyMap = new Map();
  const dailyLabels = inRangeHeaders
    .map((h) => parseDateLabel(h))
    .filter(Boolean)
    .map((d) => normalizeDateLabel(d));

  for (const label of dailyLabels) {
    dailyMap.set(label, 0);
  }

  for (const row of filteredRows) {
    let running = Number(row.Stock || 0);
    for (const header of inRangeHeaders) {
      const dateObj = parseDateLabel(header);
      if (!dateObj) continue;
      const dayLabel = normalizeDateLabel(dateObj);
      running += Number(row.Transit?.[header] || 0);
      dailyMap.set(dayLabel, (dailyMap.get(dayLabel) || 0) + running);
    }
  }

  const bucketSeries = buildBucketSeries(dailyMap, granularity);
  const bucketLabels = bucketSeries.labels;
  const bucketValues = bucketSeries.values;
  const bucketValueMap = new Map(bucketLabels.map((l, idx) => [l, bucketValues[idx]]));

  const monthAllocMap = buildAllocationByMonth(filteredRows, filters, start, end);
  const allocPlot = mapAllocationToBuckets(monthAllocMap, granularity, bucketLabels, bucketValueMap);

  ensureChart();
  chart.setOption({
    backgroundColor: "transparent",
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "cross" },
      backgroundColor: "rgba(9, 18, 38, 0.95)",
      borderColor: "#36578f",
      textStyle: { color: "#e8f0ff" },
    },
    legend: {
      top: 8,
      textStyle: { color: "#d7e5ff" },
      data: ["Available Stock", "To be allocated (CRD month)"],
    },
    grid: { left: 58, right: 58, top: 56, bottom: 50 },
    xAxis: {
      type: "category",
      data: bucketLabels,
      axisLine: { lineStyle: { color: "#4e6ea5" } },
      axisLabel: { color: "#b7cbf3" },
    },
    yAxis: [
      {
        type: "value",
        name: "Available Stock",
        nameTextStyle: { color: "#9fc0ff" },
        axisLine: { lineStyle: { color: "#4e6ea5" } },
        axisLabel: { color: "#b7cbf3" },
        splitLine: { lineStyle: { color: "rgba(78,110,165,0.25)" } },
      },
      {
        type: "value",
        name: "To be allocated",
        nameTextStyle: { color: "#ffc38d" },
        axisLine: { lineStyle: { color: "#8a6238" } },
        axisLabel: { color: "#ffd3a8" },
        splitLine: { show: false },
      },
    ],
    series: [
      {
        name: "Available Stock",
        type: "line",
        smooth: true,
        symbol: "circle",
        symbolSize: 6,
        data: bucketValues,
        lineStyle: { width: 3, color: "#5ca0ff" },
        itemStyle: { color: "#7fb4ff" },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: "rgba(92,160,255,0.35)" },
            { offset: 1, color: "rgba(92,160,255,0.06)" },
          ]),
        },
        markPoint: {
          symbol: "pin",
          symbolSize: 34,
          data: allocPlot.markPoints,
        },
      },
      {
        name: "To be allocated (CRD month)",
        type: "bar",
        yAxisIndex: 1,
        data: allocPlot.barData,
        barMaxWidth: 22,
        itemStyle: {
          color: "rgba(255, 142, 52, 0.52)",
          borderColor: "rgba(255, 186, 127, 0.95)",
          borderWidth: 1,
          borderRadius: [4, 4, 0, 0],
        },
      },
    ],
  }, true);

  renderDetailTable(filteredRows, inRangeHeaders, filters);
}

function renderDetailTable(filteredRows, inRangeHeaders, filters) {
  const productMap = new Map();
  for (const row of filteredRows) {
    const key = row.ProductKey;
    if (!productMap.has(key)) {
      productMap.set(key, {
        Product: row.ProductKeyLabel,
        Stock: 0,
        transitByDate: {},
      });
    }
    const item = productMap.get(key);
    item.Stock += Number(row.Stock || 0);
    for (const dateHeader of inRangeHeaders) {
      const qty = Number(row.Transit?.[dateHeader] || 0);
      if (!qty) continue;
      item.transitByDate[dateHeader] = (item.transitByDate[dateHeader] || 0) + qty;
    }
  }

  const arrivalDateHeaders = inRangeHeaders.filter((h) => {
    for (const item of productMap.values()) {
      if (Number(item.transitByDate[h] || 0) !== 0) return true;
    }
    return false;
  });

  const rows = Array.from(productMap.values()).sort((a, b) => a.Product.localeCompare(b.Product));
  if (!rows.length) {
    detailTableEl.innerHTML = "<div style='padding:10px;color:#cbdcff;'>No detail rows.</div>";
    tableSummaryEl.textContent = "No rows matched current filters.";
    return;
  }

  const headerHtml = [
    "<tr>",
    "<th>Product (SKU | Model)</th>",
    "<th>In-stock</th>",
    ...arrivalDateHeaders.map((d) => `<th>${d}</th>`),
    "</tr>",
  ].join("");

  const bodyHtml = rows.map((item) => {
    const cells = [
      `<td>${item.Product}</td>`,
      `<td>${fmtNumber(item.Stock)}</td>`,
      ...arrivalDateHeaders.map((d) => `<td>${fmtNumber(item.transitByDate[d] || 0)}</td>`),
    ];
    return `<tr>${cells.join("")}</tr>`;
  }).join("");

  detailTableEl.innerHTML = `<table><thead>${headerHtml}</thead><tbody>${bodyHtml}</tbody></table>`;

  const totalStock = rows.reduce((sum, item) => sum + Number(item.Stock || 0), 0);
  const totalTransit = arrivalDateHeaders.reduce((sum, header) => {
    return sum + rows.reduce((inner, item) => inner + Number(item.transitByDate[header] || 0), 0);
  }, 0);

  tableSummaryEl.textContent = `Rows: ${rows.length} | Arrival date columns: ${arrivalDateHeaders.length} | Total In-stock: ${fmtNumber(totalStock)} | Total In-transit (shown columns): ${fmtNumber(totalTransit)}`;
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

wb = load_workbook('/work/stock_output.xlsx', data_only=True)
ws = wb['stock']
headers = [cell.value for cell in ws[1]]
header_to_idx = {str(h).strip(): i for i, h in enumerate(headers) if h is not None}

required = ["WH", "Category", "Product TCL Report", "Family", "SKU", "Model", "Stock"]
for col in required:
    if col not in header_to_idx:
        raise ValueError(f"Missing expected column in stock sheet: {col}")

base_set = set(required + ["Series", "Bin", "MOQ", "To be allocated", "Total QTY", "Total MW", "MW"])

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
for row in ws.iter_rows(min_row=2, values_only=True):
    sku = _text(row[header_to_idx['SKU']])
    wh = _text(row[header_to_idx['WH']])
    if not sku or not wh:
        continue

    transit = {}
    for d in date_headers:
        qty = _num(row[header_to_idx[d]])
        if qty != 0:
            transit[d] = qty

    model = _text(row[header_to_idx['Model']])
    product_key = f"{sku}||{model}" if model else f"{sku}||"
    product_label = f"{sku} | {model}" if model else sku

    item = {
        "WH": wh,
        "Category": _text(row[header_to_idx['Category']]),
        "ProductTCLReport": _text(row[header_to_idx['Product TCL Report']]),
        "Family": _text(row[header_to_idx['Family']]),
        "SKU": sku,
        "Model": model,
        "ProductKey": product_key,
        "ProductKeyLabel": product_label,
        "Stock": _num(row[header_to_idx['Stock']]),
        "Transit": transit,
    }
    rows.append(item)
    key_meta[f"{sku}||{wh}"] = {
        "WH": item["WH"],
        "Category": item["Category"],
        "ProductTCLReport": item["ProductTCLReport"],
        "Family": item["Family"],
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
                "OrderedQty": _num(row[idx_alloc["Ordered Qty"]]),
                "CRDDate": _date_to_iso(row[idx_alloc["CRD"]]),
            })

payload = {
    "dateHeaders": date_headers,
    "rows": rows,
    "allocations": allocations,
    "keyMeta": key_meta,
}

with open('/work/stock_vis.json', 'w', encoding='utf-8') as f:
    json.dump(payload, f, ensure_ascii=False)
`);

  const jsonText = pyodide.FS.readFile("/work/stock_vis.json", { encoding: "utf8" });
  const payload = JSON.parse(jsonText);

  vizState.dateHeaders = payload.dateHeaders || [];
  vizState.rows = payload.rows || [];
  vizState.allocations = payload.allocations || [];
  vizState.keyMeta = new Map(Object.entries(payload.keyMeta || {}));
}

async function runAnalysis() {
  resetDownloadLink();

  const inventoryFile = inventoryInput.files?.[0];
  if (!inventoryFile) {
    setStatus("Please upload required file: Inventory Step1.");
    return;
  }

  runBtn.disabled = true;
  try {
    await loadPyodideRuntime();

    setStatus("Writing uploaded files...");
    const inventoryBytes = await readFileAsBytes(inventoryFile);
    const stockTemplateBytes = await fetchTemplateBytes();

    const inventoryPath = "/work/inventory_input.xlsx";
    const outputPath = "/work/stock_output.xlsx";

    pyodide.FS.writeFile(inventoryPath, inventoryBytes);
    pyodide.FS.writeFile(outputPath, stockTemplateBytes);

    const dailySupplyPath = await writeOptionalFile(dailySupplyInput, "/work/daily_supply_plan.xlsx");
    const odpMasterPath = await writeOptionalFile(odpMasterInput, "/work/odp_master.xlsx");
    const orderPath = await writeOptionalFile(orderInput, "/work/order_file.xlsx");

    const startDate = transitStartInput.value || "2026-08-01";
    const endDate = transitEndInput.value || "2026-12-31";

    const dailySupplyPy = dailySupplyPath ? `'${dailySupplyPath}'` : "None";
    const odpMasterPy = odpMasterPath ? `'${odpMasterPath}'` : "None";
    const orderPy = orderPath ? `'${orderPath}'` : "None";

    setStatus("Running available stock analysis...");

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
    downloadLinkEl.textContent = `Download ${fileName}`;
    downloadLinkEl.style.display = "inline-block";

    setStatus("Done: stock file generated. Building visualization data...");

    await extractVisualizationData();
    initFilters();
    refreshProductOptions();
    renderChartAndTable();

    vizPanelEl.style.display = "block";
    setStatus("Done: stock file generated and visualization is ready.");
  } catch (err) {
    setStatus(`Failed: ${err?.message || err}`);
    console.error(err);
  } finally {
    runBtn.disabled = false;
  }
}

function clearAllFilterSelections() {
  for (const el of [whFilterEl, categoryFilterEl, productReportFilterEl, familyFilterEl, productFilterEl]) {
    for (const opt of el.options) {
      opt.selected = true;
    }
  }
}

function resetForm() {
  inventoryInput.value = "";
  dailySupplyInput.value = "";
  odpMasterInput.value = "";
  orderInput.value = "";
  transitStartInput.value = "2026-08-01";
  transitEndInput.value = "2026-12-31";
  resetDownloadLink();
  vizPanelEl.style.display = "none";
  detailTableEl.innerHTML = "";
  tableSummaryEl.textContent = "No data.";
  if (chart) {
    chart.clear();
  }
  setStatus("Reset complete. Upload files and run again.");
}

for (const el of [whFilterEl, categoryFilterEl, productReportFilterEl, familyFilterEl]) {
  el.addEventListener("change", () => {
    refreshProductOptions();
  });
}

applyVizBtn.addEventListener("click", () => {
  try {
    renderChartAndTable();
  } catch (err) {
    setStatus(`Visualization failed: ${err?.message || err}`);
  }
});

clearFiltersBtn.addEventListener("click", () => {
  clearAllFilterSelections();
  try {
    renderChartAndTable();
  } catch (err) {
    setStatus(`Visualization failed: ${err?.message || err}`);
  }
});

runBtn.addEventListener("click", runAnalysis);
resetBtn.addEventListener("click", resetForm);