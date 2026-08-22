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

function fmt(value, digit = 2) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: digit }).format(n(value));
}

function fmtWan(value, digit = 1) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: digit }).format(n(value) / 10000);
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

      const productTclReport = String(row["TCL Report Product"] || "").trim();
      const productMidCategory = String(row["Product Mid Category"] || "").trim();
      const productFlag = productTclReport.toUpperCase();
      const categoryFlag = productMidCategory.toUpperCase();

      const isEssType =
        productFlag === "ENERGY+_KIT GEN1" ||
        productFlag === "ENERGY+_KIT" ||
        categoryFlag === "HYBRID INVERTER";

      const essQty = amountNotEmpty && isEssType ? n(row["Ordered Qty"]) : 0;
      const invoiceDate = parseExcelDate(row["Invoice Date"]);

      return {
        month,
        region: regionStd || "Unknown",
        amount,
        totalMw: n(row["Total MW"]),
        essQty,
        isEssType,
        invoiced: isInvoiced(row, invoiceDate),
      };
    })
    .filter((row) => row.month !== "Unknown");
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

function initAccumulator() {
  return { pvAmount: 0, pvQty: 0, essAmount: 0, essQty: 0 };
}

function addMetric(target, metric) {
  target.pvAmount += metric.pvAmount;
  target.pvQty += metric.pvQty;
  target.essAmount += metric.essAmount;
  target.essQty += metric.essQty;
}

function totalAmount(metric) {
  return n(metric.pvAmount) + n(metric.essAmount);
}

function totalQty(metric) {
  return n(metric.pvQty) + n(metric.essQty);
}

function buildYtdRows(rows) {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const startMonth = `${TARGET_YEAR}-01`;

  return rows.filter((row) => row.invoiced && row.month >= startMonth && row.month <= currentMonth);
}

function allMonthsFromJanToCurrent() {
  const now = new Date();
  const endMonth = now.getMonth() + 1;
  const result = [];
  for (let m = 1; m <= endMonth; m += 1) {
    result.push(`${TARGET_YEAR}-${String(m).padStart(2, "0")}`);
  }
  return result;
}

function aggregateByPeriod(ytdRows) {
  const monthMap = new Map();
  const quarterMap = new Map();
  const halfMap = new Map();
  const regionMap = new Map();
  const grand = initAccumulator();

  ytdRows.forEach((row) => {
    const metric = classifyRow(row);
    addMetric(grand, metric);

    if (!monthMap.has(row.month)) monthMap.set(row.month, initAccumulator());
    addMetric(monthMap.get(row.month), metric);

    const q = quarterKey(row.month);
    if (!quarterMap.has(q)) quarterMap.set(q, initAccumulator());
    addMetric(quarterMap.get(q), metric);

    const h = halfyearKey(row.month);
    if (!halfMap.has(h)) halfMap.set(h, initAccumulator());
    addMetric(halfMap.get(h), metric);

    if (!regionMap.has(row.region)) regionMap.set(row.region, initAccumulator());
    addMetric(regionMap.get(row.region), metric);
  });

  return { monthMap, quarterMap, halfMap, regionMap, grand };
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
    margin: { l: 60, r: 50, t: 36, b: 58 },
    legend: { orientation: "h", y: -0.25 },
    xaxis: { gridcolor: "#e2ecf9", linecolor: "#d2e2f8" },
    yaxis: { gridcolor: "#e2ecf9", linecolor: "#d2e2f8" },
  };

  window.Plotly.newPlot(divId, traces, { ...baseLayout, ...layout }, { responsive: true, displayModeBar: false });
}

function renderTotalDashboard(agg) {
  const totalKpiGrid = document.getElementById("totalKpiGrid");
  const halfH1 = agg.halfMap.get(`${TARGET_YEAR}-H1`) || initAccumulator();
  const halfH2 = agg.halfMap.get(`${TARGET_YEAR}-H2`) || initAccumulator();

  const q1 = agg.quarterMap.get(`${TARGET_YEAR}-Q1`) || initAccumulator();
  const q2 = agg.quarterMap.get(`${TARGET_YEAR}-Q2`) || initAccumulator();
  const q3 = agg.quarterMap.get(`${TARGET_YEAR}-Q3`) || initAccumulator();
  const q4 = agg.quarterMap.get(`${TARGET_YEAR}-Q4`) || initAccumulator();

  const cards = [
    { name: `${TARGET_YEAR} YTD 已开票金额(万)`, value: fmtWan(totalAmount(agg.grand)) },
    { name: `${TARGET_YEAR} YTD 已开票数量`, value: fmt(totalQty(agg.grand), 0) },
    { name: `H1 金额(万)`, value: fmtWan(totalAmount(halfH1)) },
    { name: `H1 数量`, value: fmt(totalQty(halfH1), 0) },
    { name: `H2 金额(万)`, value: fmtWan(totalAmount(halfH2)) },
    { name: `H2 数量`, value: fmt(totalQty(halfH2), 0) },
    { name: `Q1 金额/数量`, value: `${fmtWan(totalAmount(q1))} / ${fmt(totalQty(q1), 0)}` },
    { name: `Q2 金额/数量`, value: `${fmtWan(totalAmount(q2))} / ${fmt(totalQty(q2), 0)}` },
    { name: `Q3 金额/数量`, value: `${fmtWan(totalAmount(q3))} / ${fmt(totalQty(q3), 0)}` },
    { name: `Q4 金额/数量`, value: `${fmtWan(totalAmount(q4))} / ${fmt(totalQty(q4), 0)}` },
  ];

  totalKpiGrid.innerHTML = cards
    .map((card) => `<div class="kpi-card"><div class="kpi-name">${escapeHtml(card.name)}</div><div class="kpi-value">${escapeHtml(String(card.value))}</div></div>`)
    .join("");

  const periodRows = [
    { period: `${TARGET_YEAR}-H1`, data: halfH1 },
    { period: `${TARGET_YEAR}-H2`, data: halfH2 },
    { period: `${TARGET_YEAR}-Q1`, data: q1 },
    { period: `${TARGET_YEAR}-Q2`, data: q2 },
    { period: `${TARGET_YEAR}-Q3`, data: q3 },
    { period: `${TARGET_YEAR}-Q4`, data: q4 },
  ];

  table(
    "periodTable",
    ["Period", "PV金额", "PV数量", "ESS金额", "ESS数量", "总金额(万)", "总数量"],
    periodRows.map((row) => [
      escapeHtml(row.period),
      fmt(row.data.pvAmount),
      fmt(row.data.pvQty, 0),
      fmt(row.data.essAmount),
      fmt(row.data.essQty, 0),
      fmtWan(totalAmount(row.data)),
      fmt(totalQty(row.data), 0),
    ])
  );

  const monthAxis = allMonthsFromJanToCurrent();
  const monthData = monthAxis.map((m) => agg.monthMap.get(m) || initAccumulator());

  renderPlot(
    "monthlyTrendChart",
    [
      {
        x: monthAxis,
        y: monthData.map((x) => totalAmount(x) / 10000),
        type: "scatter",
        mode: "lines+markers",
        name: "当期值 金额(万)",
        line: { color: "#4f8cff", width: 3 },
        marker: { size: 6 },
      },
      {
        x: monthAxis,
        y: monthData.map((x) => totalQty(x)),
        type: "scatter",
        mode: "lines+markers",
        name: "当期值 数量",
        yaxis: "y2",
        line: { color: "#b57bff", width: 3 },
        marker: { size: 6 },
      },
    ],
    {
      title: `${TARGET_YEAR} 月度变化趋势`,
      yaxis: { title: "金额(万)" },
      yaxis2: { title: "数量", overlaying: "y", side: "right" },
    }
  );
}

function renderRegionDashboard(agg) {
  const regionGrid = document.getElementById("regionGrid");
  const regions = [...agg.regionMap.entries()]
    .map(([region, metric]) => ({ region, metric }))
    .sort((a, b) => totalAmount(b.metric) - totalAmount(a.metric));

  if (!regions.length) {
    regionGrid.innerHTML = '<div class="mini-tip">暂无 2026 YTD 已开票地区数据。</div>';
    return;
  }

  regionGrid.innerHTML = regions
    .map(({ region, metric }) => {
      const amount = totalAmount(metric);
      const qty = totalQty(metric);
      const asp = qty > 0 ? amount / qty : null;

      return `
        <article class="region-card">
          <h4 class="region-title">${escapeHtml(region)}</h4>
          <div class="metric-row"><span class="metric-label">金额(万)</span><span class="metric-value">${fmtWan(amount)}</span></div>
          <div class="metric-row"><span class="metric-label">数量</span><span class="metric-value">${fmt(qty, 0)}</span></div>
          <div class="metric-row"><span class="metric-label">BP达成率</span><span class="metric-value">-</span></div>
          <div class="metric-row"><span class="metric-label">同比</span><span class="metric-value">-</span></div>
          <div class="metric-row"><span class="metric-label">ASP</span><span class="metric-value">${asp == null ? "-" : fmt(asp)}</span></div>
        </article>
      `;
    })
    .join("");
}

function renderAll(rows) {
  const ytdRows = buildYtdRows(rows);
  const agg = aggregateByPeriod(ytdRows);

  renderTotalDashboard(agg);
  renderRegionDashboard(agg);

  setStatus(`完成：${TARGET_YEAR} YTD 已开票 ${ytdRows.length} 行，地区 ${agg.regionMap.size} 个。`);
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
    normalizedRows = normalizeRows(rawRows);

    if (!normalizedRows.length) {
      setStatus("没有可用行，请检查 Order details 的日期字段。");
      return;
    }

    renderAll(normalizedRows);
  } catch (error) {
    setStatus(`失败：${error.message || error}`);
  }
});

bindSourceMode();
bindJumpButtons();
