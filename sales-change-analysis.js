const statusEl = document.getElementById("status");
const fileEl = document.getElementById("salesFile");
const runBtn = document.getElementById("runBtn");
const monthSel = document.getElementById("monthSel");
const regionSel = document.getElementById("regionSel");

const REGION_MAP = {
  "Germany & Austria Region": "DACH Region",
  "Iberia Region": "Southern Europe Region",
  "lberia Region": "Southern Europe Region",
  "Italy & Adriatics Region": "Italy Region",
  "Emerging Market": "Central and Eastern Europe Region",
};

let allRows = [];

function setStatus(text) { statusEl.textContent = text; }
function n(v) { const x = Number(v); return Number.isFinite(x) ? x : 0; }
function pct(v) { return Number.isFinite(v) ? `${v.toFixed(1)}%` : "-"; }
function fmt(v) { return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(n(v)); }
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

function monthLabel(row) {
  const m = String(row["Month"] || "").trim();
  if (/^\d{4}-\d{2}$/.test(m)) return m;
  const d = parseExcelDate(row["Invoice Date"]) || parseExcelDate(row["SO Create Date"]) || parseExcelDate(row["CRD"]);
  if (!d) return "Unknown";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function daysBetween(start, end) {
  if (!start || !end) return null;
  return Math.round((end.getTime() - start.getTime()) / 86400000);
}

function normalizeRows(rawRows) {
  return rawRows.map((r) => {
    const regionRaw = String(r["Region"] || "").trim();
    const regionStd = REGION_MAP[regionRaw] || regionRaw;
    const status2 = String(r["Order Status2"] || "").trim().toLowerCase();
    return {
      month: monthLabel(r),
      regionRaw,
      regionStd,
      country: String(r["Country"] || "Unknown").trim() || "Unknown",
      customer: String(r["Management Customer Name"] || "Unknown").trim() || "Unknown",
      productFamily: String(r["Product Family"] || "Unknown").trim() || "Unknown",
      category: String(r["Category"] || "Unknown").trim() || "Unknown",
      sales: String(r["Sales"] || "Unknown").trim() || "Unknown",
      status2,
      revenue: n(r["Revenue EUR"]),
      qty: n(r["Ordered Qty"]),
      mw: n(r["Total MW"]),
      soCreate: parseExcelDate(r["SO Create Date"]),
      invoiceDate: parseExcelDate(r["Invoice Date"]),
      outstockDate: parseExcelDate(r["Outstock Date"]),
      crd: parseExcelDate(r["CRD"]),
      orderNo: String(r["SO No."] || "").trim(),
    };
  }).filter((r) => r.month !== "Unknown");
}

function uniqueSorted(arr) {
  return [...new Set(arr)].sort((a, b) => a.localeCompare(b));
}

function fillSelect(el, values, withAll = true) {
  const opts = [];
  if (withAll) opts.push(`<option value="__ALL__">All</option>`);
  values.forEach((v) => opts.push(`<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`));
  el.innerHTML = opts.join("");
}

function table(elId, headers, rows) {
  const el = document.getElementById(elId);
  const head = `<thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead>`;
  const bodyRows = rows.length
    ? rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")
    : `<tr><td colspan="${headers.length}">No data</td></tr>`;
  el.innerHTML = `${head}<tbody>${bodyRows}</tbody>`;
}

function renderPlot(divId, traces, layout) {
  const el = document.getElementById(divId);
  if (!el || !window.Plotly) return;
  const baseLayout = {
    paper_bgcolor: "#0a1730",
    plot_bgcolor: "#0a1730",
    font: { color: "#d9e6ff" },
    margin: { l: 50, r: 30, t: 40, b: 60 },
    legend: { orientation: "h", y: -0.2 },
  };
  window.Plotly.newPlot(divId, traces, { ...baseLayout, ...layout }, { responsive: true, displayModeBar: false });
}

function sumBy(rows, fn) { return rows.reduce((acc, r) => acc + fn(r), 0); }

function topNGroup(rows, key, metric, topN = 3) {
  const map = new Map();
  rows.forEach((r) => map.set(r[key], (map.get(r[key]) || 0) + metric(r)));
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, topN);
}

function getMonthPair(months, selected) {
  const idx = Math.max(0, months.indexOf(selected));
  return { cur: selected, prev: idx > 0 ? months[idx - 1] : null };
}

function renderOverview(scopedRows, curRows, prevRows, month) {
  const invoiced = curRows.filter((r) => r.status2 === "invoiced");
  const confirm = curRows.filter((r) => r.status2 === "confirm");

  const invRev = sumBy(invoiced, (r) => r.revenue);
  const confRev = sumBy(confirm, (r) => r.revenue);
  const totalRev = invRev + confRev;
  const invoiceRate = totalRev ? (invRev / totalRev) * 100 : 0;

  const prevInvRev = sumBy(prevRows.filter((r) => r.status2 === "invoiced"), (r) => r.revenue);
  const prevConfRev = sumBy(prevRows.filter((r) => r.status2 === "confirm"), (r) => r.revenue);
  const invMoM = prevInvRev ? ((invRev - prevInvRev) / prevInvRev) * 100 : NaN;
  const confMoM = prevConfRev ? ((confRev - prevConfRev) / prevConfRev) * 100 : NaN;

  const kpis = [
    ["Analysis Month", month],
    ["Invoiced Revenue", fmt(invRev)],
    ["Confirmed Revenue", fmt(confRev)],
    ["Invoice Rate", pct(invoiceRate)],
    ["Invoiced MoM", pct(invMoM)],
    ["Confirmed MoM", pct(confMoM)],
  ];
  document.getElementById("kpiGrid").innerHTML = kpis.map(([name, value]) => `
    <div class="kpi-card"><div class="kpi-name">${name}</div><div class="kpi-value">${value}</div></div>
  `).join("");

  const topCountry = topNGroup(curRows, "country", (r) => r.revenue, 3);
  const topCustomer = topNGroup(curRows, "customer", (r) => r.revenue, 3);
  const total = sumBy(curRows, (r) => r.revenue) || 1;
  const rows = [];
  topCountry.forEach(([k, v], i) => rows.push([`Top ${i + 1} Country`, escapeHtml(k), fmt(v), pct((v / total) * 100)]));
  topCustomer.forEach(([k, v], i) => rows.push([`Top ${i + 1} Customer`, escapeHtml(k), fmt(v), pct((v / total) * 100)]));
  table("overviewTable", ["Dimension", "Name", "Revenue (EUR)", "Share"], rows);

  const monthAgg = new Map();
  scopedRows.forEach((r) => {
    const x = monthAgg.get(r.month) || { invoiced: 0, confirm: 0 };
    if (r.status2 === "invoiced") x.invoiced += r.revenue;
    if (r.status2 === "confirm") x.confirm += r.revenue;
    monthAgg.set(r.month, x);
  });
  const xMonths = [...monthAgg.keys()].sort().slice(-8);
  const yInv = xMonths.map((m) => monthAgg.get(m).invoiced);
  const yCon = xMonths.map((m) => monthAgg.get(m).confirm);
  renderPlot("overviewChart", [
    { x: xMonths, y: yInv, type: "bar", name: "Invoiced" },
    { x: xMonths, y: yCon, type: "bar", name: "Confirm" },
  ], { barmode: "group", title: "Recent Monthly Revenue Trend" });
}

function renderB(curRows, prevRows) {
  const toGroup = (rows, key) => {
    const map = new Map();
    rows.forEach((r) => map.set(r[key], (map.get(r[key]) || 0) + r.revenue));
    return map;
  };
  const rgCur = toGroup(curRows, "regionStd");
  const rgPrev = toGroup(prevRows, "regionStd");
  const keys = uniqueSorted([...rgCur.keys(), ...rgPrev.keys()]);
  const regionObjects = keys.map((k) => {
    const cur = rgCur.get(k) || 0;
    const prev = rgPrev.get(k) || 0;
    const diff = cur - prev;
    const diffPct = prev ? (diff / prev) * 100 : NaN;
    return { region: k, prev, cur, diff, diffPct };
  }).sort((a, b) => b.diff - a.diff);

  table("regionMoverTable", ["Region", "Previous Revenue", "Current Revenue", "Change", "Change %"],
    regionObjects.map((x) => [escapeHtml(x.region), fmt(x.prev), fmt(x.cur), fmt(x.diff), pct(x.diffPct)]));

  const topMove = regionObjects.slice(0, 12);
  renderPlot("regionMoverChart", [{
    x: topMove.map((x) => x.region), y: topMove.map((x) => x.diff), type: "bar", name: "Revenue Change",
    marker: { color: topMove.map((x) => (x.diff >= 0 ? "#36c08d" : "#ff7f7f")) },
  }], { title: "Top Region Revenue Movers", xaxis: { tickangle: -30 } });

  const csCur = toGroup(curRows, "customer");
  const csPrev = toGroup(prevRows, "customer");
  const cKeys = uniqueSorted([...csCur.keys(), ...csPrev.keys()]);
  const customerRows = cKeys.map((k) => {
    const cur = csCur.get(k) || 0;
    const prev = csPrev.get(k) || 0;
    const diff = cur - prev;
    const diffPct = prev ? (diff / prev) * 100 : NaN;
    return [escapeHtml(k), fmt(prev), fmt(cur), fmt(diff), pct(diffPct)];
  }).sort((a, b) => n(b[3].replace(/,/g, "")) - n(a[3].replace(/,/g, ""))).slice(0, 40);
  table("customerMoverTable", ["Customer", "Previous Revenue", "Current Revenue", "Change", "Change %"], customerRows);
}

function renderC(curRows, prevRows) {
  const g = new Map();
  curRows.forEach((r) => {
    const k = `${r.regionStd}||${r.productFamily}`;
    const x = g.get(k) || { region: r.regionStd, pf: r.productFamily, rev: 0, qty: 0 };
    x.rev += r.revenue;
    x.qty += r.qty;
    g.set(k, x);
  });
  const gp = new Map();
  prevRows.forEach((r) => {
    const k = `${r.regionStd}||${r.productFamily}`;
    gp.set(k, (gp.get(k) || 0) + r.revenue);
  });

  const totalCur = sumBy(curRows, (r) => r.revenue) || 1;
  const out = [...g.values()].map((x) => {
    const key = `${x.region}||${x.pf}`;
    const prevRev = gp.get(key) || 0;
    const diff = x.rev - prevRev;
    return { ...x, prevRev, diff, share: (x.rev / totalCur) * 100 };
  }).sort((a, b) => b.rev - a.rev);

  table("productMixTable", ["Region", "Product Family", "Quantity", "Current Revenue", "Revenue Share", "vs Previous"],
    out.slice(0, 80).map((x) => [escapeHtml(x.region), escapeHtml(x.pf), fmt(x.qty), fmt(x.rev), pct(x.share), fmt(x.diff)]));

  const top = out.slice(0, 20);
  renderPlot("productMixChart", [{
    x: top.map((x) => `${x.region} | ${x.pf}`),
    y: top.map((x) => x.rev),
    type: "bar",
    name: "Current Revenue",
  }], { title: "Top Region-Product Combinations", xaxis: { tickangle: -40 } });
}

function renderD(curRows) {
  const today = new Date();
  const pipeline = curRows.filter((r) => r.status2 === "confirm");
  const pg = new Map();
  pipeline.forEach((r) => {
    const k = `${r.regionStd}||${r.customer}||${r.productFamily}`;
    const x = pg.get(k) || { region: r.regionStd, customer: r.customer, pf: r.productFamily, rev: 0, qty: 0, oldest: 0 };
    x.rev += r.revenue;
    x.qty += r.qty;
    if (r.soCreate) x.oldest = Math.max(x.oldest, daysBetween(r.soCreate, today) || 0);
    pg.set(k, x);
  });
  const pRows = [...pg.values()].sort((a, b) => b.rev - a.rev);

  table("pipelineTable", ["Region", "Customer", "Product Family", "Quantity", "Confirmed Revenue", "Oldest Age"],
    pRows.slice(0, 60).map((x) => [escapeHtml(x.region), escapeHtml(x.customer), escapeHtml(x.pf), fmt(x.qty), fmt(x.rev), x.oldest >= 45 ? `<span class=\"warn\">${x.oldest} days</span>` : `${x.oldest} days`]));

  const delayed = curRows.filter((r) => r.status2 === "invoiced" && r.invoiceDate && r.crd)
    .map((r) => ({ ...r, delay: daysBetween(r.crd, r.invoiceDate) }))
    .filter((r) => r.delay > 0)
    .sort((a, b) => b.delay - a.delay);
  table("delayRiskTable", ["SO No.", "Region", "Country", "Customer", "Product", "Invoice Delay", "Revenue"],
    delayed.slice(0, 80).map((r) => [escapeHtml(r.orderNo || "-"), escapeHtml(r.regionStd), escapeHtml(r.country), escapeHtml(r.customer), escapeHtml(r.productFamily), `${r.delay} days`, fmt(r.revenue)]));

  const regionPipe = new Map();
  pipeline.forEach((r) => regionPipe.set(r.regionStd, (regionPipe.get(r.regionStd) || 0) + r.revenue));
  const rp = [...regionPipe.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
  renderPlot("pipelineChart", [{ x: rp.map((x) => x[0]), y: rp.map((x) => x[1]), type: "bar", name: "Confirmed Revenue" }],
    { title: "Pipeline by Region", xaxis: { tickangle: -30 } });
}

function percentile(arr, q) {
  if (!arr.length) return NaN;
  const sorted = [...arr].sort((a, b) => a - b);
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sorted[base + 1] !== undefined) return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
  return sorted[base];
}

function renderE(curRows) {
  const inv = curRows.filter((r) => r.status2 === "invoiced");
  const map = new Map();

  inv.forEach((r) => {
    const x = map.get(r.regionStd) || { region: r.regionStd, cnt: 0, onTime: 0, lead: [], deliv: [] };
    x.cnt += 1;
    if (r.invoiceDate && r.crd && r.invoiceDate.getTime() <= r.crd.getTime()) x.onTime += 1;
    if (r.soCreate && r.invoiceDate) x.lead.push(daysBetween(r.soCreate, r.invoiceDate));
    if (r.outstockDate && r.invoiceDate) x.deliv.push(daysBetween(r.outstockDate, r.invoiceDate));
    map.set(r.regionStd, x);
  });

  const rowsObj = [...map.values()].map((x) => {
    const onTimeRate = x.cnt ? (x.onTime / x.cnt) * 100 : NaN;
    const leadMed = percentile(x.lead, 0.5);
    const delivMed = percentile(x.deliv, 0.5);
    const delivP90 = percentile(x.deliv, 0.9);
    return { region: x.region, cnt: x.cnt, onTimeRate, leadMed, delivMed, delivP90 };
  }).sort((a, b) => b.cnt - a.cnt);

  table("fulfillTable", ["Region", "Invoiced Orders", "On-time Rate (Invoice<=CRD)", "SO→Invoice (Median)", "Invoice-Outstock (Median)", "Invoice-Outstock (P90)"],
    rowsObj.map((x) => [escapeHtml(x.region), String(x.cnt), pct(x.onTimeRate), Number.isFinite(x.leadMed) ? `${x.leadMed.toFixed(0)} days` : "-", Number.isFinite(x.delivMed) ? `${x.delivMed.toFixed(0)} days` : "-", Number.isFinite(x.delivP90) ? `${x.delivP90.toFixed(0)} days` : "-"]));

  renderPlot("fulfillChart", [
    { x: rowsObj.map((x) => x.region), y: rowsObj.map((x) => x.onTimeRate), type: "bar", name: "On-time Rate %" },
    { x: rowsObj.map((x) => x.region), y: rowsObj.map((x) => x.delivMed), type: "scatter", mode: "lines+markers", yaxis: "y2", name: "Invoice-Outstock Median Days" },
  ], {
    title: "Regional Fulfillment Performance",
    xaxis: { tickangle: -30 },
    yaxis: { title: "On-time %" },
    yaxis2: { title: "Days", overlaying: "y", side: "right" },
  });
}

function renderMapping(rows) {
  const rawToStd = new Map();
  rows.forEach((r) => {
    const key = `${r.regionRaw}||${r.regionStd}`;
    const x = rawToStd.get(key) || { raw: r.regionRaw, std: r.regionStd, countries: new Set(), rev: 0 };
    x.countries.add(r.country);
    x.rev += r.revenue;
    rawToStd.set(key, x);
  });

  const out = [...rawToStd.values()].sort((a, b) => b.rev - a.rev);
  table("mappingTable", ["Raw Region", "Standard Region", "Country Count", "Countries", "Revenue"],
    out.map((x) => [escapeHtml(x.raw), escapeHtml(x.std), String(x.countries.size), escapeHtml([...x.countries].sort().join(", ")), fmt(x.rev)]));

  const stdAgg = new Map();
  rows.forEach((r) => {
    const x = stdAgg.get(r.regionStd) || { countries: new Set(), rev: 0 };
    x.countries.add(r.country);
    x.rev += r.revenue;
    stdAgg.set(r.regionStd, x);
  });
  const bars = [...stdAgg.entries()].map(([region, x]) => ({ region, count: x.countries.size }))
    .sort((a, b) => b.count - a.count);
  renderPlot("mappingChart", [{ x: bars.map((x) => x.region), y: bars.map((x) => x.count), type: "bar", name: "Country Count" }],
    { title: "Country Coverage by Standard Region", xaxis: { tickangle: -30 } });
}

function switchTab() {
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const key = btn.dataset.tab;
      document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
      document.getElementById(`panel-${key}`).classList.add("active");
      window.dispatchEvent(new Event("resize"));
    });
  });
}

async function parseWorkbook(file) {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const ws = wb.Sheets["Order details"];
  if (!ws) throw new Error("Sheet 'Order details' not found");
  return XLSX.utils.sheet_to_json(ws, { defval: null });
}

function runAnalysis() {
  if (!allRows.length) {
    setStatus("No data available for analysis.");
    return;
  }

  const monthList = uniqueSorted(allRows.map((r) => r.month));
  const month = monthSel.value || monthList[monthList.length - 1];
  const region = regionSel.value;

  const scoped = allRows.filter((r) => (region === "__ALL__" ? true : r.regionStd === region));
  const { cur, prev } = getMonthPair(monthList, month);
  const curRows = scoped.filter((r) => r.month === cur);
  const prevRows = prev ? scoped.filter((r) => r.month === prev) : [];

  renderOverview(scoped, curRows, prevRows, cur);
  renderB(curRows, prevRows);
  renderC(curRows, prevRows);
  renderD(curRows);
  renderE(curRows);
  renderMapping(scoped);

  setStatus(`Done: ${curRows.length} rows in ${cur}, compared with ${prev || "none"}.`);
}

runBtn.addEventListener("click", async () => {
  try {
    const file = fileEl.files?.[0];
    if (!file) {
      setStatus("Please upload an Excel file first.");
      return;
    }

    setStatus("Reading 'Order details'...");
    const raw = await parseWorkbook(file);
    allRows = normalizeRows(raw);

    if (!allRows.length) {
      setStatus("No valid rows found (month parsing failed or sheet is empty).");
      return;
    }

    const months = uniqueSorted(allRows.map((r) => r.month));
    fillSelect(monthSel, months, false);
    monthSel.value = months[months.length - 1];

    const regions = uniqueSorted(allRows.map((r) => r.regionStd).filter(Boolean));
    fillSelect(regionSel, regions, true);
    regionSel.value = "__ALL__";

    runAnalysis();
  } catch (err) {
    setStatus(`Failed: ${err.message || err}`);
  }
});

monthSel.addEventListener("change", runAnalysis);
regionSel.addEventListener("change", runAnalysis);
switchTab();
