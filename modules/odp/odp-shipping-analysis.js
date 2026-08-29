const PORT_MAPPING_KEY = "eupv2026_port_mappings_v1";
const byId = (id) => document.getElementById(id);
const fileEl = byId("odpFile");
const statusEl = byId("status");
let records = [];
let quantityZeroCount = 0;
let invalidQuantityCount = 0;
let mappings = loadMappings();

function copyDefaults() {
  return (window.DEFAULT_PORT_MAPPINGS || []).map((x) => ({ ...x }));
}

function loadMappings() {
  try {
    const value = JSON.parse(localStorage.getItem(PORT_MAPPING_KEY));
    return Array.isArray(value) ? value : copyDefaults();
  } catch (_) {
    return copyDefaults();
  }
}

function saveMappings() {
  mappings = mappings
    .map((x) => ({
      type: x.type === "POL" ? "POL" : "DEST",
      raw: normalizeText(x.raw),
      standard: normalizeText(x.standard),
      country: String(x.country || "").trim(),
      note: String(x.note || "").trim(),
    }))
    .filter((x) => x.raw && x.standard);
  localStorage.setItem(PORT_MAPPING_KEY, JSON.stringify(mappings));
}

function normalizeText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim().toUpperCase();
}

function clean(value) {
  if (value == null) return null;
  const text = String(value).replace(/\s+/g, " ").trim();
  return !text || ["N/A", "NA", "-", "NONE", "NULL"].includes(text.toUpperCase()) ? null : value;
}

function toNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const result = Number(value.replace(/,/g, ""));
    return Number.isFinite(result) ? result : null;
  }
  return null;
}

function toDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  if (typeof value === "number" && window.XLSX?.SSF) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) return new Date(parsed.y, parsed.m - 1, parsed.d);
  }
  if (typeof value === "string" && value.trim()) {
    const match = value.trim().match(/^(\d{4})[-\/]([01]?\d)[-\/]([0-3]?\d)/);
    if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  }
  return null;
}

function isoDate(value) {
  if (!(value instanceof Date)) return "";
  const y = value.getFullYear();
  return `${y}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function headerName(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c]));
}

function mappingIndex() {
  return new Map(mappings.map((x) => [`${x.type}|${normalizeText(x.raw)}`, x]));
}

function resolvePort(raw, type) {
  const normalized = normalizeText(raw);
  if (!normalized) return null;
  const mapped = mappingIndex().get(`${type}|${normalized}`);
  if (mapped) return normalizeText(mapped.standard);
  if (type === "DEST" && normalized.includes("-")) return normalizeText(normalized.split("-").at(-1));
  return normalized;
}

function ensureDiscoveredMappings() {
  const existing = mappingIndex();
  records.forEach((record) => {
    [["POL", record.rawPol], ["DEST", record.rawDestination]].forEach(([type, raw]) => {
      const normalized = normalizeText(raw);
      if (!normalized || existing.has(`${type}|${normalized}`)) return;
      const standard = type === "DEST" && normalized.includes("-") ? normalized.split("-").at(-1) : normalized;
      const item = { type, raw: normalized, standard, country: "", note: "自动发现，待确认" };
      mappings.push(item);
      existing.set(`${type}|${normalized}`, item);
    });
  });
}

function readSheet(workbook, sheetName, headerRow) {
  const ws = workbook.Sheets[sheetName];
  if (!ws) return [];
  const grid = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });
  const headers = (grid[headerRow - 1] || []).map(headerName);
  const index = Object.fromEntries(headers.map((h, i) => [h, i]).filter(([h]) => h));
  const refField = index["TCL REFERENCE"] != null ? "TCL REFERENCE" : "TCL REFERENCE NO.";
  const bookingField = index["BOOKING#"] != null ? "BOOKING#" : "Booking #";
  const result = [];
  grid.slice(headerRow).forEach((row) => {
    const ref = clean(row[index[refField]]);
    if (ref == null) return;
    const quantity = toNumber(row[index.QUANTITY]);
    let rawPol = index.POL != null ? clean(row[index.POL]) : null;
    if (rawPol == null && index["PORT OF LOADING"] != null) rawPol = clean(row[index["PORT OF LOADING"]]);
    result.push({
      source: sheetName,
      reference: String(ref).trim(),
      quantity,
      containers: toNumber(row[index.CONTAINERS]) || 0,
      status: index.STATUS != null ? String(clean(row[index.STATUS]) || "") : "",
      rawPol,
      rawDestination: clean(row[index["PORT DESTINATION"]]),
      atd: toDate(row[index["ATD PORT"]]),
      ata: toDate(row[index["ATA PORT"]]),
      vessel: index["REFERENCE V.V"] != null ? clean(row[index["REFERENCE V.V"]]) : null,
      booking: index[bookingField] != null ? clean(row[index[bookingField]]) : null,
    });
  });
  return result;
}

function parseWorkbook(workbook) {
  const sources = [
    ["PV SUPPLY DATA", 1],
    ["H2-2025 PV DATA", 1],
    ["H1-2025 PV DATA", 3],
  ];
  const unique = new Map();
  quantityZeroCount = 0;
  invalidQuantityCount = 0;
  sources.flatMap(([name, row]) => readSheet(workbook, name, row)).forEach((record) => {
    if (record.quantity == null) { invalidQuantityCount += 1; return; }
    if (record.quantity <= 0) { quantityZeroCount += 1; return; }
    if (!unique.has(record.reference)) unique.set(record.reference, record);
  });
  records = [...unique.values()];
  ensureDiscoveredMappings();
  renderMappingTable();
  const dates = records.flatMap((r) => r.atd ? [r.atd] : []).sort((a, b) => a - b);
  if (dates.length) {
    byId("startDate").value = isoDate(dates[0]);
    byId("endDate").value = isoDate(dates.at(-1));
  }
  renderRoutes();
}

function nearestRank(values, rate) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(rate * sorted.length) - 1)];
}

function buildVoyages() {
  const start = byId("startDate").value ? new Date(`${byId("startDate").value}T00:00:00`) : null;
  const end = byId("endDate").value ? new Date(`${byId("endDate").value}T23:59:59`) : null;
  const voyages = new Map();
  records.forEach((record) => {
    if (!record.atd || !record.ata || !record.rawPol || !record.rawDestination) return;
    if (start && record.atd < start) return;
    if (end && record.atd > end) return;
    const leadDays = Math.round((record.ata - record.atd) / 86400000);
    if (leadDays <= 0 || leadDays > 180) return;
    const pol = resolvePort(record.rawPol, "POL");
    const destination = resolvePort(record.rawDestination, "DEST");
    const identity = normalizeText(record.vessel) || normalizeText(record.booking) || "NO-VESSEL-OR-BOOKING";
    const key = [pol, destination, isoDate(record.atd), isoDate(record.ata), identity].join("|");
    if (!voyages.has(key)) voyages.set(key, { pol, destination, atd: record.atd, leadDays, containers: 0, references: 0 });
    const voyage = voyages.get(key);
    voyage.containers += record.containers;
    voyage.references += 1;
  });
  return [...voyages.values()];
}

function routeStats(voyages) {
  const groups = new Map();
  voyages.forEach((voyage) => {
    const key = `${voyage.pol}|${voyage.destination}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(voyage);
  });
  const minContainers = Math.max(1, Number(byId("minContainers").value) || 10);
  const minVoyages = Math.max(1, Number(byId("minVoyages").value) || 5);
  return [...groups.values()].map((group) => {
    const leads = group.map((x) => x.leadDays);
    const containers = group.reduce((sum, x) => sum + x.containers, 0);
    return {
      pol: group[0].pol,
      destination: group[0].destination,
      voyages: group.length,
      references: group.reduce((sum, x) => sum + x.references, 0),
      containers,
      min: Math.min(...leads),
      average: leads.reduce((sum, x) => sum + x, 0) / leads.length,
      max: Math.max(...leads),
      p70: nearestRank(leads, .70),
      p85: nearestRank(leads, .85),
      p90: nearestRank(leads, .90),
      firstAtd: new Date(Math.min(...group.map((x) => x.atd))),
      lastAtd: new Date(Math.max(...group.map((x) => x.atd))),
      eligible: containers >= minContainers && group.length >= minVoyages,
    };
  }).filter((x) => x.eligible).sort((a, b) => b.containers - a.containers);
}

function renderRoutes() {
  const voyages = buildVoyages();
  const routes = routeStats(voyages);
  byId("recordKpi").textContent = records.length.toLocaleString();
  byId("voyageKpi").textContent = voyages.length.toLocaleString();
  byId("routeKpi").textContent = routes.length.toLocaleString();
  byId("zeroKpi").textContent = quantityZeroCount.toLocaleString();
  const headers = ["POL", "目的港", "独立航次", "TCL记录", "累计柜量", "最小天数", "平均天数", "最大天数", "P70", "P85", "P90", "历史ATD范围"];
  const head = `<thead><tr>${headers.map((x) => `<th>${escapeHtml(x)}</th>`).join("")}</tr></thead>`;
  const body = routes.length ? routes.map((x) => `<tr><td>${escapeHtml(x.pol)}</td><td>${escapeHtml(x.destination)}</td><td>${x.voyages}</td><td>${x.references}</td><td>${x.containers.toFixed(1)}</td><td>${x.min}</td><td>${x.average.toFixed(1)}</td><td>${x.max}</td><td>${x.p70}</td><td>${x.p85}</td><td>${x.p90}</td><td>${isoDate(x.firstAtd)} ～ ${isoDate(x.lastAtd)}</td></tr>`).join("") : `<tr><td colspan="12">当前时间范围内没有满足门槛的航线。</td></tr>`;
  byId("routeTable").innerHTML = head + `<tbody>${body}</tbody>`;
  statusEl.textContent = `完成：${records.length.toLocaleString()} 条正数量记录；排除 ${quantityZeroCount} 条 Quantity≤0；${invalidQuantityCount} 条 Quantity 空白/无效；${voyages.length} 个实际航次。`;
}

function mappingUsage() {
  const counts = new Map();
  records.forEach((r) => {
    [["POL", r.rawPol], ["DEST", r.rawDestination]].forEach(([type, raw]) => {
      const key = `${type}|${normalizeText(raw)}`;
      counts.set(key, (counts.get(key) || 0) + 1);
    });
  });
  return counts;
}

function renderMappingTable() {
  const counts = mappingUsage();
  const sorted = [...mappings].sort((a, b) => a.type.localeCompare(b.type) || a.raw.localeCompare(b.raw));
  const head = `<thead><tr><th>类型</th><th>原始名称</th><th>标准港口</th><th>国家/地区</th><th>备注</th><th>当前记录数</th><th>操作</th></tr></thead>`;
  const body = sorted.map((item) => {
    const originalIndex = mappings.indexOf(item);
    const count = counts.get(`${item.type}|${normalizeText(item.raw)}`) || 0;
    return `<tr data-index="${originalIndex}"${item.note?.includes("待确认") ? ' class="warning"' : ""}>
      <td><select data-field="type"><option value="POL"${item.type === "POL" ? " selected" : ""}>POL</option><option value="DEST"${item.type === "DEST" ? " selected" : ""}>目的港</option></select></td>
      <td><input data-field="raw" value="${escapeHtml(item.raw)}" /></td>
      <td><input data-field="standard" value="${escapeHtml(item.standard)}" /></td>
      <td><input data-field="country" value="${escapeHtml(item.country)}" /></td>
      <td><input data-field="note" value="${escapeHtml(item.note)}" /></td>
      <td><span class="pill">${count}</span></td>
      <td><button class="danger delete-mapping" type="button">删除</button></td>
    </tr>`;
  }).join("");
  byId("mappingTable").innerHTML = head + `<tbody>${body}</tbody>`;
}

function collectMappingEdits() {
  byId("mappingTable").querySelectorAll("tbody tr").forEach((row) => {
    const index = Number(row.dataset.index);
    if (!mappings[index]) return;
    row.querySelectorAll("[data-field]").forEach((input) => { mappings[index][input.dataset.field] = input.value; });
  });
}

byId("runBtn").addEventListener("click", async () => {
  if (!fileEl.files[0]) { statusEl.textContent = "请先选择 ODP 工作簿。"; return; }
  try {
    statusEl.textContent = "正在读取工作簿…";
    const data = await fileEl.files[0].arrayBuffer();
    const workbook = XLSX.read(data, { type: "array", cellDates: true });
    parseWorkbook(workbook);
  } catch (error) {
    statusEl.textContent = `读取失败：${error.message || error}`;
  }
});

byId("applyBtn").addEventListener("click", renderRoutes);
byId("saveMappingBtn").addEventListener("click", () => { collectMappingEdits(); saveMappings(); renderMappingTable(); renderRoutes(); });
byId("addMappingBtn").addEventListener("click", () => { collectMappingEdits(); mappings.push({ type: "DEST", raw: "", standard: "", country: "", note: "" }); renderMappingTable(); });
byId("resetMappingBtn").addEventListener("click", () => {
  if (!confirm("确认恢复仓库内置的初始港口映射？当前浏览器修改将被覆盖。")) return;
  mappings = copyDefaults(); saveMappings(); ensureDiscoveredMappings(); renderMappingTable(); renderRoutes();
});
byId("mappingTable").addEventListener("click", (event) => {
  if (!event.target.classList.contains("delete-mapping")) return;
  collectMappingEdits();
  const index = Number(event.target.closest("tr").dataset.index);
  mappings.splice(index, 1);
  renderMappingTable();
});
byId("exportMappingBtn").addEventListener("click", () => {
  collectMappingEdits(); saveMappings();
  const blob = new Blob([JSON.stringify(mappings, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url; link.download = `eupv-port-mapping-${isoDate(new Date())}.json`; link.click();
  URL.revokeObjectURL(url);
});
byId("importMappingBtn").addEventListener("click", () => byId("importMappingFile").click());
byId("importMappingFile").addEventListener("change", async (event) => {
  try {
    const incoming = JSON.parse(await event.target.files[0].text());
    if (!Array.isArray(incoming)) throw new Error("JSON 顶层必须是数组");
    mappings = incoming; saveMappings(); ensureDiscoveredMappings(); renderMappingTable(); renderRoutes();
  } catch (error) {
    alert(`导入失败：${error.message || error}`);
  } finally {
    event.target.value = "";
  }
});

document.querySelectorAll(".tab-btn").forEach((button) => button.addEventListener("click", () => {
  document.querySelectorAll(".tab-btn").forEach((x) => x.classList.toggle("active", x === button));
  document.querySelectorAll(".tab").forEach((x) => x.classList.toggle("active", x.id === button.dataset.tab));
}));

renderMappingTable();
