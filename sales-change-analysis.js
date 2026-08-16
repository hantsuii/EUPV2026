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
  if (!Number.isNaN(d.getTime())) return d;
  return null;
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
    const soCreate = parseExcelDate(r["SO Create Date"]);
    const invoiceDate = parseExcelDate(r["Invoice Date"]);
    const outstockDate = parseExcelDate(r["Outstock Date"]);
    const crd = parseExcelDate(r["CRD"]);

    return {
      month: monthLabel(r),
      regionRaw,
      regionStd,
      country: String(r["Country"] || "Unknown").trim() || "Unknown",
      customer: String(r["Management Customer Name"] || "Unknown").trim() || "Unknown",
      productFamily: String(r["Product Family"] || "Unknown").trim() || "Unknown",
      pvCategory: String(r["PV category"] || "Unknown").trim() || "Unknown",
      category: String(r["Category"] || "Unknown").trim() || "Unknown",
      sales: String(r["Sales"] || "Unknown").trim() || "Unknown",
      status2,
      revenue: n(r["Revenue EUR"]),
      qty: n(r["Ordered Qty"]),
      mw: n(r["Total MW"]),
      soCreate,
      invoiceDate,
      outstockDate,
      crd,
      orderNo: String(r["SO No."] || "").trim(),
    };
  }).filter((r) => r.month !== "Unknown");
}

function uniqueSorted(arr) {
  return [...new Set(arr)].sort((a, b) => a.localeCompare(b));
}

function fillSelect(el, values, withAll = true) {
  const opts = [];
  if (withAll) opts.push(`<option value="__ALL__">全部</option>`);
  values.forEach((v) => opts.push(`<option value="${v}">${v}</option>`));
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

function renderOverview(baseRows, curRows, prevRows, month) {
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

  const topCountry = topNGroup(curRows, "country", (r) => r.revenue, 3);
  const topCustomer = topNGroup(curRows, "customer", (r) => r.revenue, 3);

  const kpis = [
    ["分析月份", month],
    ["本月开票收入", fmt(invRev)],
    ["本月待确认收入", fmt(confRev)],
    ["开票率", pct(invoiceRate)],
    ["开票环比", pct(invMoM)],
    ["确认环比", pct(confMoM)],
  ];
  document.getElementById("kpiGrid").innerHTML = kpis.map(([name, value]) => `
    <div class="kpi-card"><div class="kpi-name">${name}</div><div class="kpi-value">${value}</div></div>
  `).join("");

  const total = sumBy(curRows, (r) => r.revenue) || 1;
  const rows = [];
  topCountry.forEach(([k, v], i) => rows.push([`Top${i + 1} 国家`, k, fmt(v), pct((v / total) * 100)]));
  topCustomer.forEach(([k, v], i) => rows.push([`Top${i + 1} 客户`, k, fmt(v), pct((v / total) * 100)]));
  table("overviewTable", ["维度", "对象", "收入(EUR)", "贡献占比"], rows);
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
  const regionRows = keys.map((k) => {
    const cur = rgCur.get(k) || 0;
    const prev = rgPrev.get(k) || 0;
    const diff = cur - prev;
    const diffPct = prev ? (diff / prev) * 100 : NaN;
    return [k, fmt(prev), fmt(cur), fmt(diff), pct(diffPct)];
  }).sort((a, b) => n(b[3].replace(/,/g, "")) - n(a[3].replace(/,/g, "")));
  table("regionMoverTable", ["区域", "上月收入", "本月收入", "变动", "变动%"], regionRows);

  const csCur = toGroup(curRows, "customer");
  const csPrev = toGroup(prevRows, "customer");
  const cKeys = uniqueSorted([...csCur.keys(), ...csPrev.keys()]);
  const customerRows = cKeys.map((k) => {
    const cur = csCur.get(k) || 0;
    const prev = csPrev.get(k) || 0;
    const diff = cur - prev;
    const diffPct = prev ? (diff / prev) * 100 : NaN;
    return [k, fmt(prev), fmt(cur), fmt(diff), pct(diffPct)];
  }).sort((a, b) => n(b[3].replace(/,/g, "")) - n(a[3].replace(/,/g, ""))).slice(0, 40);
  table("customerMoverTable", ["客户", "上月收入", "本月收入", "变动", "变动%"], customerRows);
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
    return [x.region, x.pf, fmt(x.qty), fmt(x.rev), pct((x.rev / totalCur) * 100), fmt(diff)];
  }).sort((a, b) => n(b[3].replace(/,/g, "")) - n(a[3].replace(/,/g, ""))).slice(0, 80);
  table("productMixTable", ["区域", "产品系列", "数量", "本月收入", "收入占比", "较上月变动"], out);
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
    if (r.soCreate) {
      const age = daysBetween(r.soCreate, today);
      x.oldest = Math.max(x.oldest, age || 0);
    }
    pg.set(k, x);
  });
  const pipelineRows = [...pg.values()].sort((a, b) => b.rev - a.rev).slice(0, 60)
    .map((x) => [x.region, x.customer, x.pf, fmt(x.qty), fmt(x.rev), x.oldest >= 45 ? `<span class="warn">${x.oldest} 天</span>` : `${x.oldest} 天`]);
  table("pipelineTable", ["区域", "客户", "产品系列", "数量", "确认收入", "最长账龄"], pipelineRows);

  const delayed = curRows.filter((r) => r.status2 === "invoiced" && r.invoiceDate && r.crd)
    .map((r) => ({ ...r, delay: daysBetween(r.crd, r.invoiceDate) }))
    .filter((r) => r.delay > 0)
    .sort((a, b) => b.delay - a.delay)
    .slice(0, 80)
    .map((r) => [r.orderNo || "-", r.regionStd, r.country, r.customer, r.productFamily, `${r.delay} 天`, fmt(r.revenue)]);
  table("delayRiskTable", ["SO No.", "区域", "国家", "客户", "产品", "开票延迟", "收入"], delayed);
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

  const rows = [...map.values()].map((x) => {
    const onTimeRate = x.cnt ? (x.onTime / x.cnt) * 100 : NaN;
    const leadMed = percentile(x.lead, 0.5);
    const delivMed = percentile(x.deliv, 0.5);
    const delivP90 = percentile(x.deliv, 0.9);
    return [x.region, String(x.cnt), pct(onTimeRate), Number.isFinite(leadMed) ? `${leadMed.toFixed(0)} 天` : "-", Number.isFinite(delivMed) ? `${delivMed.toFixed(0)} 天` : "-", Number.isFinite(delivP90) ? `${delivP90.toFixed(0)} 天` : "-"];
  }).sort((a, b) => n(b[1]) - n(a[1]));

  table("fulfillTable", ["区域", "开票订单数", "准时率(Invoice<=CRD)", "订单到开票(中位)", "开票-出库(中位)", "开票-出库(P90)"], rows);
}

function renderMapping(rows) {
  const map = new Map();
  rows.forEach((r) => {
    const key = `${r.regionRaw}||${r.regionStd}`;
    const x = map.get(key) || { raw: r.regionRaw, std: r.regionStd, countries: new Set(), rev: 0 };
    x.countries.add(r.country);
    x.rev += r.revenue;
    map.set(key, x);
  });

  const out = [...map.values()].sort((a, b) => b.rev - a.rev)
    .map((x) => [x.raw, x.std, String(x.countries.size), [...x.countries].sort().join(", "), fmt(x.rev)]);
  table("mappingTable", ["原始区域", "标准区域", "国家数", "国家列表", "收入"], out);
}

function switchTab() {
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const key = btn.dataset.tab;
      document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
      document.getElementById(`panel-${key}`).classList.add("active");
    });
  });
}

async function parseWorkbook(file) {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const ws = wb.Sheets["Order details"];
  if (!ws) throw new Error("未找到 Order details 工作表");
  return XLSX.utils.sheet_to_json(ws, { defval: null });
}

function runAnalysis() {
  if (!allRows.length) {
    setStatus("没有可分析的数据。");
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

  setStatus(`分析完成：${curRows.length} 行（${cur}），对比月份：${prev || "无"}。`);
}

runBtn.addEventListener("click", async () => {
  try {
    const file = fileEl.files?.[0];
    if (!file) {
      setStatus("请先上传 Excel 文件。");
      return;
    }

    setStatus("正在读取 Order details...");
    const raw = await parseWorkbook(file);
    allRows = normalizeRows(raw);

    if (!allRows.length) {
      setStatus("Order details 为空或无有效月份数据。");
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
    setStatus(`处理失败：${err.message || err}`);
  }
});

monthSel.addEventListener("change", runAnalysis);
regionSel.addEventListener("change", runAnalysis);
switchTab();
