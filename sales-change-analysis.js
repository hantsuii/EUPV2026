const statusEl = document.getElementById("status");
const fileEl = document.getElementById("salesFile");
const runBtn = document.getElementById("runBtn");
const uploadRow = document.getElementById("uploadRow");
const repoRow = document.getElementById("repoRow");
const repoSalesPathEl = document.getElementById("repoSalesPath");

const REGION_MAP = {
  "Germany & Austria Region": "DACH Region",
  "Iberia Region": "Southern Europe Region",
  "lberia Region": "Southern Europe Region",
  "Italy & Adriatics Region": "Italy Region",
  "Emerging Market": "Central and Eastern Europe Region",
};

let normalizedRows = [];

function setStatus(text) {
  statusEl.textContent = text;
}

function n(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function hasValue(value) {
  return !(value == null || String(value).trim() === "");
}

function fmt(value) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(n(value));
}

function fmtInt(value) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n(value));
}

function escapeHtml(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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

  const refDate =
    parseExcelDate(row["Invoice Date"]) ||
    parseExcelDate(row["SO Create Date"]) ||
    parseExcelDate(row["CRD"]);

  if (!refDate) return "Unknown";
  return `${refDate.getFullYear()}-${String(refDate.getMonth() + 1).padStart(2, "0")}`;
}

function quarterKey(month) {
  const year = Number(month.slice(0, 4));
  const monthNumber = Number(month.slice(5, 7));
  const quarter = Math.floor((monthNumber - 1) / 3) + 1;
  return `${year}-Q${quarter}`;
}

function halfyearKey(month) {
  const year = Number(month.slice(0, 4));
  const monthNumber = Number(month.slice(5, 7));
  const half = monthNumber <= 6 ? 1 : 2;
  return `${year}-H${half}`;
}

function normalizeRows(rawRows) {
  return rawRows
    .map((row) => {
      const month = monthFromRow(row);
      const regionRaw = String(row["Region"] || row["RegionStd"] || "Unknown").trim() || "Unknown";
      const regionStd = REGION_MAP[regionRaw] || regionRaw;

      const amountRaw = row["Unit Price * Qty"];
      const amount = n(amountRaw);
      const amountNotEmpty = hasValue(amountRaw);

      const productTclReport = String(row["TCL Report Product"] || "").trim();
      const productMidCategory = String(row["Product Mid Category"] || "").trim();
      const productFlag = productTclReport.toUpperCase();
      const categoryFlag = productMidCategory.toUpperCase();

      const isEssType =
        productFlag === "ENERGY+_KIT GEN1" ||
        productFlag === "ENERGY+_KIT" ||
        categoryFlag === "HYBRID INVERTER";

      const essQty = amountNotEmpty && isEssType ? n(row["Ordered Qty"]) : 0;

      return {
        month,
        region: regionStd || "Unknown",
        amount,
        amountNotEmpty,
        totalMw: n(row["Total MW"]),
        essQty,
        isEssType,
      };
    })
    .filter((row) => row.month !== "Unknown");
}

function table(elId, headers, rows) {
  const el = document.getElementById(elId);
  if (!el) return;

  const head = `<thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead>`;
  const bodyRows = rows.length
    ? rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")
    : `<tr><td colspan="${headers.length}">No data</td></tr>`;

  el.innerHTML = `${head}<tbody>${bodyRows}</tbody>`;
}

function renderPlot(divId, traces, layout = {}) {
  const el = document.getElementById(divId);
  if (!el || !window.Plotly) return;

  const baseLayout = {
    paper_bgcolor: "#0a1730",
    plot_bgcolor: "#0a1730",
    font: { color: "#d9e6ff" },
    margin: { l: 56, r: 40, t: 40, b: 64 },
    legend: { orientation: "h", y: -0.25 },
    xaxis: { gridcolor: "#243e70" },
    yaxis: { gridcolor: "#243e70" },
  };

  window.Plotly.newPlot(divId, traces, { ...baseLayout, ...layout }, { responsive: true, displayModeBar: false });
}

function initAccumulator() {
  return { pvAmount: 0, pvQty: 0, essAmount: 0, essQty: 0 };
}

function accumulate(target, source) {
  target.pvAmount += source.pvAmount;
  target.pvQty += source.pvQty;
  target.essAmount += source.essAmount;
  target.essQty += source.essQty;
}

function classifyRow(row) {
  if (row.isEssType) {
    return {
      pvAmount: 0,
      pvQty: 0,
      essAmount: row.amount,
      essQty: row.essQty,
    };
  }

  return {
    pvAmount: row.amount,
    pvQty: row.totalMw,
    essAmount: 0,
    essQty: 0,
  };
}

function sortedMonthList(rows) {
  return [...new Set(rows.map((row) => row.month))].sort((a, b) => a.localeCompare(b));
}

function buildAggregations(rows) {
  const months = sortedMonthList(rows);
  const regions = [...new Set(rows.map((row) => row.region))].sort((a, b) => a.localeCompare(b));

  const monthRegionMap = new Map();
  const monthTotalMap = new Map();

  rows.forEach((row) => {
    const metric = classifyRow(row);

    const detailKey = `${row.month}||${row.region}`;
    if (!monthRegionMap.has(detailKey)) monthRegionMap.set(detailKey, initAccumulator());
    accumulate(monthRegionMap.get(detailKey), metric);

    if (!monthTotalMap.has(row.month)) monthTotalMap.set(row.month, initAccumulator());
    accumulate(monthTotalMap.get(row.month), metric);
  });

  const detailRows = [];
  months.forEach((month) => {
    regions.forEach((region) => {
      const key = `${month}||${region}`;
      const value = monthRegionMap.get(key) || initAccumulator();
      detailRows.push({ month, region, ...value });
    });

    const total = monthTotalMap.get(month) || initAccumulator();
    detailRows.push({ month, region: "Total", ...total });
  });

  const quarterMap = new Map();
  const halfyearMap = new Map();

  months.forEach((month) => {
    const total = monthTotalMap.get(month) || initAccumulator();
    const qKey = quarterKey(month);
    const hKey = halfyearKey(month);

    if (!quarterMap.has(qKey)) quarterMap.set(qKey, initAccumulator());
    if (!halfyearMap.has(hKey)) halfyearMap.set(hKey, initAccumulator());

    accumulate(quarterMap.get(qKey), total);
    accumulate(halfyearMap.get(hKey), total);
  });

  const quarterRows = [...quarterMap.entries()]
    .map(([period, value]) => ({ period, ...value }))
    .sort((a, b) => a.period.localeCompare(b.period));

  const halfyearRows = [...halfyearMap.entries()]
    .map(([period, value]) => ({ period, ...value }))
    .sort((a, b) => a.period.localeCompare(b.period));

  return {
    months,
    regions,
    detailRows,
    quarterRows,
    halfyearRows,
    monthTotalMap,
  };
}

function metricTotalAmount(x) {
  return n(x.pvAmount) + n(x.essAmount);
}

function metricTotalQty(x) {
  return n(x.pvQty) + n(x.essQty);
}

function renderDetailTable(detailRows) {
  table(
    "detailTable",
    [
      "Month",
      "Region",
      "PV Sales Amount (Unit Price * Qty)",
      "PV Sales Qty (Total MW)",
      "ESS Sales Amount (Unit Price * Qty)",
      "ESS Sales Qty (Ordered Qty)",
      "Total Amount",
      "Total Qty",
    ],
    detailRows.map((row) => [
      escapeHtml(row.month),
      escapeHtml(row.region),
      fmt(row.pvAmount),
      fmt(row.pvQty),
      fmt(row.essAmount),
      fmt(row.essQty),
      fmt(metricTotalAmount(row)),
      fmt(metricTotalQty(row)),
    ])
  );
}

function renderPeriodTable(tableId, title, rows) {
  table(
    tableId,
    [
      title,
      "PV Amount",
      "PV Qty",
      "ESS Amount",
      "ESS Qty",
      "Total Amount",
      "Total Qty",
    ],
    rows.map((row) => [
      escapeHtml(row.period),
      fmt(row.pvAmount),
      fmt(row.pvQty),
      fmt(row.essAmount),
      fmt(row.essQty),
      fmt(metricTotalAmount(row)),
      fmt(metricTotalQty(row)),
    ])
  );
}

function renderKpis(months, regions, quarterRows, halfyearRows) {
  const kpiGrid = document.getElementById("kpiGrid");
  if (!kpiGrid) return;

  const latestQuarter = quarterRows[quarterRows.length - 1] || null;
  const latestHalfyear = halfyearRows[halfyearRows.length - 1] || null;

  const cards = [
    { name: "Months Covered", value: fmtInt(months.length) },
    { name: "Regions Covered", value: fmtInt(regions.length) },
    { name: "Latest Quarter", value: latestQuarter ? latestQuarter.period : "-" },
    { name: "Latest Quarter Total Amount", value: latestQuarter ? fmt(metricTotalAmount(latestQuarter)) : "-" },
    { name: "Latest Half-Year", value: latestHalfyear ? latestHalfyear.period : "-" },
    { name: "Latest Half-Year Total Amount", value: latestHalfyear ? fmt(metricTotalAmount(latestHalfyear)) : "-" },
    { name: "Latest Quarter Total Qty", value: latestQuarter ? fmt(metricTotalQty(latestQuarter)) : "-" },
    { name: "Latest Half-Year Total Qty", value: latestHalfyear ? fmt(metricTotalQty(latestHalfyear)) : "-" },
  ];

  kpiGrid.innerHTML = cards
    .map((card) => `<div class="kpi-card"><div class="kpi-name">${escapeHtml(card.name)}</div><div class="kpi-value">${escapeHtml(String(card.value))}</div></div>`)
    .join("");
}

function renderCharts(agg) {
  const months = agg.months;
  const monthTotals = months.map((month) => agg.monthTotalMap.get(month) || initAccumulator());

  renderPlot(
    "trendMonthlyChart",
    [
      {
        x: months,
        y: monthTotals.map((x) => x.pvAmount),
        type: "scatter",
        mode: "lines+markers",
        name: "PV Amount",
        line: { color: "#4f8cff", width: 3 },
      },
      {
        x: months,
        y: monthTotals.map((x) => x.essAmount),
        type: "scatter",
        mode: "lines+markers",
        name: "ESS Amount",
        line: { color: "#f6a13a", width: 3 },
      },
      {
        x: months,
        y: monthTotals.map((x) => x.pvQty),
        type: "scatter",
        mode: "lines+markers",
        yaxis: "y2",
        name: "PV Qty",
        line: { color: "#5fd1b9", dash: "dot" },
      },
      {
        x: months,
        y: monthTotals.map((x) => x.essQty),
        type: "scatter",
        mode: "lines+markers",
        yaxis: "y2",
        name: "ESS Qty",
        line: { color: "#d2c366", dash: "dot" },
      },
    ],
    {
      title: "Monthly Trend (All Regions Total)",
      yaxis: { title: "Sales Amount" },
      yaxis2: { title: "Sales Qty", overlaying: "y", side: "right" },
    }
  );

  renderPlot(
    "trendQuarterChart",
    [
      {
        x: agg.quarterRows.map((x) => x.period),
        y: agg.quarterRows.map((x) => x.pvAmount),
        type: "bar",
        name: "PV Amount",
        marker: { color: "#4f8cff" },
      },
      {
        x: agg.quarterRows.map((x) => x.period),
        y: agg.quarterRows.map((x) => x.essAmount),
        type: "bar",
        name: "ESS Amount",
        marker: { color: "#f6a13a" },
      },
      {
        x: agg.quarterRows.map((x) => x.period),
        y: agg.quarterRows.map((x) => metricTotalQty(x)),
        type: "scatter",
        mode: "lines+markers",
        yaxis: "y2",
        name: "Total Qty",
        line: { color: "#5fd1b9", width: 2 },
      },
    ],
    {
      barmode: "group",
      title: "Quarterly Sales Snapshot",
      yaxis: { title: "Sales Amount" },
      yaxis2: { title: "Total Qty", overlaying: "y", side: "right" },
    }
  );

  renderPlot(
    "trendHalfyearChart",
    [
      {
        x: agg.halfyearRows.map((x) => x.period),
        y: agg.halfyearRows.map((x) => x.pvAmount),
        type: "bar",
        name: "PV Amount",
        marker: { color: "#4f8cff" },
      },
      {
        x: agg.halfyearRows.map((x) => x.period),
        y: agg.halfyearRows.map((x) => x.essAmount),
        type: "bar",
        name: "ESS Amount",
        marker: { color: "#f6a13a" },
      },
      {
        x: agg.halfyearRows.map((x) => x.period),
        y: agg.halfyearRows.map((x) => metricTotalQty(x)),
        type: "scatter",
        mode: "lines+markers",
        yaxis: "y2",
        name: "Total Qty",
        line: { color: "#d2c366", width: 2 },
      },
    ],
    {
      barmode: "group",
      title: "Half-Year Sales Snapshot",
      yaxis: { title: "Sales Amount" },
      yaxis2: { title: "Total Qty", overlaying: "y", side: "right" },
    }
  );

  const regionMonthlyMap = new Map();
  normalizedRows.forEach((row) => {
    const key = `${row.month}||${row.region}`;
    regionMonthlyMap.set(key, (regionMonthlyMap.get(key) || 0) + classifyRow(row).pvAmount + classifyRow(row).essAmount);
  });

  const regionTotalAmountMap = new Map();
  normalizedRows.forEach((row) => {
    regionTotalAmountMap.set(row.region, (regionTotalAmountMap.get(row.region) || 0) + classifyRow(row).pvAmount + classifyRow(row).essAmount);
  });

  const topRegions = [...regionTotalAmountMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map((x) => x[0]);

  const traces = topRegions.map((region) => ({
    x: months,
    y: months.map((month) => regionMonthlyMap.get(`${month}||${region}`) || 0),
    type: "scatter",
    mode: "lines+markers",
    name: region,
  }));

  renderPlot("trendByRegionChart", traces, {
    title: "Monthly Sales Amount Trend by Region (Top 6)",
    yaxis: { title: "Sales Amount" },
  });
}

function renderAll(rows) {
  const agg = buildAggregations(rows);

  renderDetailTable(agg.detailRows);
  renderKpis(agg.months, agg.regions, agg.quarterRows, agg.halfyearRows);
  renderPeriodTable("quarterTable", "Quarter", agg.quarterRows);
  renderPeriodTable("halfyearTable", "Half-Year", agg.halfyearRows);
  renderCharts(agg);

  setStatus(`Done: ${rows.length} rows | ${agg.months.length} months | ${agg.regions.length} regions.`);
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
    if (!repoPath) throw new Error("Please input a repository file path.");

    setStatus(`Loading repository file: ${repoPath}`);
    const response = await fetch(repoPath, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Repository file not found: ${repoPath} (HTTP ${response.status})`);
    }

    const buffer = await response.arrayBuffer();
    return parseWorkbookFromArrayBuffer(buffer);
  }

  const file = fileEl.files?.[0];
  if (!file) {
    throw new Error("Please upload a sales workbook first.");
  }

  setStatus(`Reading uploaded file: ${file.name}`);
  const buffer = await file.arrayBuffer();
  return parseWorkbookFromArrayBuffer(buffer);
}

function bindSourceMode() {
  document.querySelectorAll("input[name='salesSource']").forEach((radio) => {
    radio.addEventListener("change", () => {
      const source = document.querySelector("input[name='salesSource']:checked")?.value;
      const useRepo = source === "repo";
      repoRow.classList.toggle("active", useRepo);
      uploadRow.style.display = useRepo ? "none" : "grid";
    });
  });
}

function bindJumpButtons() {
  const wrap = document.getElementById("jumpWrap");
  if (!wrap) return;

  wrap.querySelectorAll(".jump-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.target;

      wrap.querySelectorAll(".jump-btn").forEach((item) => item.classList.remove("active"));
      btn.classList.add("active");

      document.querySelectorAll(".content-block").forEach((block) => {
        block.classList.toggle("active", block.id === target);
      });

      window.dispatchEvent(new Event("resize"));
    });
  });
}

runBtn.addEventListener("click", async () => {
  try {
    const rawRows = await loadWorkbookBySource();
    normalizedRows = normalizeRows(rawRows);

    if (!normalizedRows.length) {
      setStatus("No valid rows found. Please check month/date columns in 'Order details'.");
      return;
    }

    renderAll(normalizedRows);
  } catch (error) {
    setStatus(`Failed: ${error.message || error}`);
  }
});

bindSourceMode();
bindJumpButtons();
