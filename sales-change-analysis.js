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

const TARGET_YEAR = 2026;

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

function fmt(value, digit = 2) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: digit }).format(n(value));
}

function fmtWan(value, digit = 1) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: digit }).format(n(value) / 10000);
}

function fmtPct(value, digit = 1) {
  if (!Number.isFinite(value)) return "-";
  return `${value.toFixed(digit)}%`;
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
      const regionStd = REGION_MAP[regionRaw] || regionRaw;

      const amountRaw = row["Unit Price * Qty"];
      const amount = n(amountRaw);
      const amountNotEmpty = hasValue(amountRaw);

      const productTclReport = String(row["TCL Report Product"] || "").trim().toUpperCase();
      const productMidCategory = String(row["Product Mid Category"] || "").trim().toUpperCase();
      const isEssType =
        productTclReport === "ENERGY+_KIT GEN1" ||
        productTclReport === "ENERGY+_KIT" ||
        productMidCategory === "HYBRID INVERTER";

      const invoiceDate = parseExcelDate(row["Invoice Date"]);

      return {
        month,
        region: regionStd || "Unknown",
        amount,
        pvQtyMw: isEssType ? 0 : n(row["Total MW"]),
        essQtySet: isEssType && amountNotEmpty ? n(row["Ordered Qty"]) : 0,
        isEssType,
        invoiced: isInvoiced(row, invoiceDate),
      };
    })
    .filter((row) => row.month !== "Unknown" && row.month.startsWith(`${TARGET_YEAR}-`));
}

function initMetric() {
  return { totalAmount: 0, pvAmount: 0, essAmount: 0, pvQtyMw: 0, essQtySet: 0 };
}

function addRowMetric(target, row) {
  target.totalAmount += row.amount;
  if (row.isEssType) {
    target.essAmount += row.amount;
    target.essQtySet += row.essQtySet;
  } else {
    target.pvAmount += row.amount;
    target.pvQtyMw += row.pvQtyMw;
  }
}

function calcPvAspEurPerW(metric) {
  if (!metric || metric.pvQtyMw <= 0) return null;
  return metric.pvAmount / (metric.pvQtyMw * 1_000_000);
}

function calcEssAspEurPerSet(metric) {
  if (!metric || metric.essQtySet <= 0) return null;
  return metric.essAmount / metric.essQtySet;
}

function monthList2026() {
  return Array.from({ length: 12 }, (_, idx) => `${TARGET_YEAR}-${String(idx + 1).padStart(2, "0")}`);
}

function aggregateData(rows) {
  const all2026 = rows;
  const invoicedRows = all2026.filter((x) => x.invoiced);
  const backlogRows = all2026.filter((x) => !x.invoiced);

  const allOrderByQuarter = new Map();
  const invoicedByMonth = new Map();
  const invoicedByQuarter = new Map();
  const invoicedByRegion = new Map();

  monthList2026().forEach((m) => invoicedByMonth.set(m, initMetric()));
  [1, 2, 3, 4].forEach((q) => {
    allOrderByQuarter.set(`${TARGET_YEAR}-Q${q}`, initMetric());
    invoicedByQuarter.set(`${TARGET_YEAR}-Q${q}`, initMetric());
  });

  all2026.forEach((row) => {
    const q = quarterKey(row.month);
    addRowMetric(allOrderByQuarter.get(q), row);
  });

  invoicedRows.forEach((row) => {
    addRowMetric(invoicedByMonth.get(row.month), row);
    addRowMetric(invoicedByQuarter.get(quarterKey(row.month)), row);

    if (!invoicedByRegion.has(row.region)) invoicedByRegion.set(row.region, initMetric());
    addRowMetric(invoicedByRegion.get(row.region), row);
  });

  const totalInvoiced = initMetric();
  const totalBacklog = initMetric();
  invoicedRows.forEach((row) => addRowMetric(totalInvoiced, row));
  backlogRows.forEach((row) => addRowMetric(totalBacklog, row));

  const h1 = initMetric();
  const h2 = initMetric();
  invoicedRows.forEach((row) => {
    if (row.month <= `${TARGET_YEAR}-06`) addRowMetric(h1, row);
    else addRowMetric(h2, row);
  });

  return {
    totalInvoiced,
    totalBacklog,
    h1,
    h2,
    allOrderByQuarter,
    invoicedByMonth,
    invoicedByQuarter,
    invoicedByRegion,
    invoicedRows,
  };
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
    paper_bgcolor: "#ffffff",
    plot_bgcolor: "#ffffff",
    font: { color: "#2e4f7a" },
    margin: { l: 60, r: 55, t: 42, b: 60 },
    legend: { orientation: "h", y: -0.25 },
    xaxis: { gridcolor: "#e2ecf9", linecolor: "#d2e2f8" },
    yaxis: { gridcolor: "#e2ecf9", linecolor: "#d2e2f8" },
    bargap: 0.24,
  };

  window.Plotly.newPlot(divId, traces, { ...baseLayout, ...layout }, { responsive: true, displayModeBar: false });
}

function renderTotalDashboard(agg) {
  const totalKpiGrid = document.getElementById("totalKpiGrid");

  const q1All = agg.allOrderByQuarter.get(`${TARGET_YEAR}-Q1`) || initMetric();
  const q2All = agg.allOrderByQuarter.get(`${TARGET_YEAR}-Q2`) || initMetric();
  const q3All = agg.allOrderByQuarter.get(`${TARGET_YEAR}-Q3`) || initMetric();
  const q4All = agg.allOrderByQuarter.get(`${TARGET_YEAR}-Q4`) || initMetric();

  const cards = [
    { name: `${TARGET_YEAR}年已开票销售额(€)`, value: fmt(agg.totalInvoiced.totalAmount) },
    { name: `${TARGET_YEAR}年Backlog订单金额(€)`, value: fmt(agg.totalBacklog.totalAmount) },
    { name: `${TARGET_YEAR}年已销售组件数量(MW)`, value: fmt(agg.totalInvoiced.pvQtyMw, 3) },
    { name: `${TARGET_YEAR}年已销售储能产品ESS数量(Sets)`, value: fmt(agg.totalInvoiced.essQtySet, 0) },

    { name: `H1 已开票销售额(€)`, value: fmt(agg.h1.totalAmount) },
    { name: `H1 组件数量(MW)`, value: fmt(agg.h1.pvQtyMw, 3) },
    { name: `H1 组件平均价格(€/W)`, value: calcPvAspEurPerW(agg.h1) == null ? "-" : fmt(calcPvAspEurPerW(agg.h1), 4) },
    { name: `H1 储能数量(Sets)`, value: fmt(agg.h1.essQtySet, 0) },
    { name: `H1 储能平均价格(€/Set)`, value: calcEssAspEurPerSet(agg.h1) == null ? "-" : fmt(calcEssAspEurPerSet(agg.h1), 2) },

    { name: `Q1 订单金额(€)`, value: fmt(q1All.totalAmount) },
    { name: `Q2 订单金额(€)`, value: fmt(q2All.totalAmount) },
    { name: `Q3 订单金额(€)`, value: fmt(q3All.totalAmount) },
    { name: `Q4 订单金额(€)`, value: fmt(q4All.totalAmount) },
  ];

  totalKpiGrid.innerHTML = cards
    .map((card) => `<div class="kpi-card"><div class="kpi-name">${escapeHtml(card.name)}</div><div class="kpi-value">${escapeHtml(String(card.value))}</div></div>`)
    .join("");

  const quarterRows = [1, 2, 3, 4].map((q) => {
    const k = `${TARGET_YEAR}-Q${q}`;
    const d = agg.allOrderByQuarter.get(k) || initMetric();
    return [k, fmt(d.totalAmount), fmt(d.pvAmount), fmt(d.essAmount), fmt(d.pvQtyMw, 3), fmt(d.essQtySet, 0)];
  });

  table(
    "periodTable",
    ["Quarter", "订单总金额(€)", "组件金额(€)", "ESS金额(€)", "组件数量(MW)", "ESS数量(Sets)"],
    quarterRows
  );

  const months = monthList2026();
  const monthData = months.map((m) => agg.invoicedByMonth.get(m) || initMetric());

  renderPlot(
    "monthlyTrendChart",
    [
      {
        x: months,
        y: monthData.map((x) => x.totalAmount / 10000),
        type: "scatter",
        mode: "lines+markers",
        name: "总销售金额(万€)",
        line: { color: "#4f8cff", width: 3 },
      },
      {
        x: months,
        y: monthData.map((x) => x.pvAmount / 10000),
        type: "bar",
        name: "组件金额(万€)",
        marker: { color: "#78b1ff" },
        opacity: 0.8,
      },
      {
        x: months,
        y: monthData.map((x) => x.essAmount / 10000),
        type: "bar",
        name: "ESS金额(万€)",
        marker: { color: "#b48bff" },
        opacity: 0.8,
      },
    ],
    {
      title: `${TARGET_YEAR} 月度销售金额变化`,
      barmode: "group",
      yaxis: { title: "金额(万€)" },
    }
  );

  renderPlot(
    "monthlyAspChart",
    [
      {
        x: months,
        y: monthData.map((x) => (calcPvAspEurPerW(x) == null ? null : calcPvAspEurPerW(x))),
        type: "scatter",
        mode: "lines+markers",
        name: "组件ASP(€/W)",
        line: { color: "#2c7dff", width: 3 },
      },
      {
        x: months,
        y: monthData.map((x) => (calcEssAspEurPerSet(x) == null ? null : calcEssAspEurPerSet(x))),
        type: "scatter",
        mode: "lines+markers",
        yaxis: "y2",
        name: "ESS ASP(€/Set)",
        line: { color: "#a36bff", width: 3 },
      },
    ],
    {
      title: `${TARGET_YEAR} 月度平均售价变化`,
      yaxis: { title: "组件ASP (€/W)" },
      yaxis2: { title: "ESS ASP (€/Set)", overlaying: "y", side: "right" },
    }
  );
}
function renderRegionDashboard(agg) {
  const regionGrid = document.getElementById("regionGrid");
  const grand = agg.totalInvoiced.totalAmount;

  const regions = [...agg.invoicedByRegion.entries()]
    .map(([region, metric]) => ({ region, metric }))
    .sort((a, b) => b.metric.totalAmount - a.metric.totalAmount);

  if (!regions.length) {
    regionGrid.innerHTML = '<div class="mini-tip">暂无 2026 年已开票地区数据。</div>';
    return;
  }

  regionGrid.innerHTML = regions
    .map(({ region, metric }) => {
      const share = grand > 0 ? (metric.totalAmount / grand) * 100 : null;
      const pvAsp = calcPvAspEurPerW(metric);
      const essAsp = calcEssAspEurPerSet(metric);

      return `
        <article class="region-card">
          <h4 class="region-title">${escapeHtml(region)}</h4>
          <div class="metric-row"><span class="metric-label">总金额(万€)</span><span class="metric-value">${fmtWan(metric.totalAmount)}</span></div>
          <div class="metric-row"><span class="metric-label">BP达成率</span><span class="metric-value">-</span></div>
          <div class="metric-row"><span class="metric-label">同比</span><span class="metric-value">-</span></div>
          <div class="metric-row"><span class="metric-label">总金额占比</span><span class="metric-value">${share == null ? "-" : fmtPct(share)}</span></div>

          <div class="metric-row"><span class="metric-label">ESS金额(万€)</span><span class="metric-value">${fmtWan(metric.essAmount)}</span></div>
          <div class="metric-row"><span class="metric-label">ESS数量(Sets)</span><span class="metric-value">${fmt(metric.essQtySet, 0)}</span></div>
          <div class="metric-row"><span class="metric-label">ESS ASP(€/Set)</span><span class="metric-value">${essAsp == null ? "-" : fmt(essAsp, 2)}</span></div>

          <div class="metric-row"><span class="metric-label">组件金额(万€)</span><span class="metric-value">${fmtWan(metric.pvAmount)}</span></div>
          <div class="metric-row"><span class="metric-label">组件数量(MW)</span><span class="metric-value">${fmt(metric.pvQtyMw, 3)}</span></div>
          <div class="metric-row"><span class="metric-label">组件ASP(€/W)</span><span class="metric-value">${pvAsp == null ? "-" : fmt(pvAsp, 4)}</span></div>
        </article>
      `;
    })
    .join("");
}

function renderAll(rows) {
  const agg = aggregateData(rows);
  renderTotalDashboard(agg);
  renderRegionDashboard(agg);
  setStatus(`完成：${TARGET_YEAR} 全年数据 ${rows.length} 行；已开票 ${agg.invoicedRows.length} 行。`);
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
    if (!repoPath) throw new Error("请输入仓库文件路径。");

    setStatus(`读取仓库文件：${repoPath}`);
    const response = await fetch(repoPath, { cache: "no-store" });
    if (!response.ok) throw new Error(`Repository file not found: ${repoPath} (HTTP ${response.status})`);

    const buffer = await response.arrayBuffer();
    return parseWorkbookFromArrayBuffer(buffer);
  }

  const file = fileEl.files?.[0];
  if (!file) throw new Error("请先上传销售工作簿文件。");

  setStatus(`读取上传文件：${file.name}`);
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
    const rows = normalizeRows(rawRows);

    if (!rows.length) {
      setStatus(`没有 ${TARGET_YEAR} 年可用行，请检查 Order details 日期。`);
      return;
    }

    renderAll(rows);
  } catch (error) {
    setStatus(`失败：${error.message || error}`);
  }
});

bindSourceMode();
bindJumpButtons();



