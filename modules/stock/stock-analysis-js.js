const SOURCE_INV_DSP = "INV_DSP";
const SOURCE_ODP = "ODP";
const SOURCE_MIXED = "MIXED";
const UNMATCHED_SKU_MARK = "SKU not matched";
const ALLOC_SHEET_NAME = "To be allocated";
const TRANSIT_SOURCE_SHEET_NAME = "_Transit Source Map";

const CELL_FILL_BY_SOURCE = {
  [SOURCE_INV_DSP]: "FFDDEBFF",
  [SOURCE_ODP]: "FFFFE8CC",
  [SOURCE_MIXED]: "FFEBDCFF",
};

const WH_CODE_MAP = {
  SPNL: "NL",
  SPFR: "FR",
  SPTN: "FR",
  SPUK: "UK",
  SPIT: "IT",
  SPES: "ES",
};

function unwrapValue(value) {
  if (value == null) return value;
  if (value instanceof Date) return value;
  if (typeof value !== "object") return value;
  if (Object.prototype.hasOwnProperty.call(value, "result")) return value.result;
  if (Array.isArray(value.richText)) return value.richText.map((part) => part.text || "").join("");
  if (Object.prototype.hasOwnProperty.call(value, "text")) return value.text;
  return value;
}

function normalizeText(value) {
  const unwrapped = unwrapValue(value);
  if (unwrapped == null) return "";
  return String(unwrapped).trim();
}

function normalizeLower(value) {
  return normalizeText(value).toLowerCase();
}

function normalizeSkuKey(value) {
  return normalizeText(value).toUpperCase();
}

function safeFloat(value) {
  const unwrapped = unwrapValue(value);
  if (unwrapped == null || unwrapped === "") return 0;
  if (typeof unwrapped === "number") return Number.isFinite(unwrapped) ? unwrapped : 0;
  const text = normalizeText(unwrapped).replace(/,/g, "");
  if (!text) return 0;
  const num = Number(text);
  return Number.isFinite(num) ? num : 0;
}

function buildHeaderIndex(headers) {
  const out = {};
  headers.forEach((header, index) => {
    const key = normalizeLower(header);
    if (key && out[key] == null) out[key] = index;
  });
  return out;
}

function readCell(ws, rowNumber, columnNumber) {
  return unwrapValue(ws.getCell(rowNumber, columnNumber).value);
}

function readSheetRows(ws, headerRow = 1) {
  if (ws && !ws.getCell) {
    const matrix = globalThis.XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });
    const headers = matrix[headerRow - 1] || [];
    const rows = matrix.slice(headerRow).filter((row) => row.some((value) => value !== null && value !== undefined && value !== ""));
    return { headers, rows, index: buildHeaderIndex(headers) };
  }

  const headers = [];
  for (let c = 1; c <= ws.columnCount; c += 1) headers.push(readCell(ws, headerRow, c));

  const rows = [];
  for (let r = headerRow + 1; r <= ws.rowCount; r += 1) {
    const row = [];
    let hasValue = false;
    for (let c = 1; c <= ws.columnCount; c += 1) {
      const value = readCell(ws, r, c);
      row.push(value);
      if (value !== null && value !== undefined && value !== "") hasValue = true;
    }
    if (hasValue) rows.push(row);
  }
  return { headers, rows, index: buildHeaderIndex(headers) };
}

function getFirstWorksheet(workbook) {
  const names = workbook.worksheets ? workbook.worksheets.map((ws) => ws.name) : workbook.SheetNames;
  const name = names?.[0];
  if (!name) throw localizedError("noSheets");
  return workbook.getWorksheet ? workbook.getWorksheet(name) : workbook.Sheets[name];
}

function pickSkuSheetName(workbook, explicitName) {
  const sheetNames = workbook.worksheets ? workbook.worksheets.map((ws) => ws.name) : workbook.SheetNames;
  if (explicitName) {
    if (sheetNames.includes(explicitName)) return explicitName;
    throw localizedError("skuSheetMissing", { name: explicitName });
  }
  const candidates = ["SKU", "SKU Mapping", "Legacy Mapping Product"];
  const lowered = new Map(sheetNames.map((name) => [name.toLowerCase(), name]));
  for (const candidate of candidates) {
    if (lowered.has(candidate.toLowerCase())) return lowered.get(candidate.toLowerCase());
  }
  return sheetNames[0];
}

function mapCountryCode(salesOrgName) {
  const name = normalizeLower(salesOrgName);
  if (name.includes("netherland")) return "NL";
  if (name.includes("france")) return "FR";
  if (name.includes("united kingdom") || name === "uk" || name.endsWith(" uk")) return "UK";
  if (name.includes("italy")) return "IT";
  if (name.includes("spain")) return "ES";
  return normalizeText(salesOrgName).slice(0, 2).toUpperCase();
}

function mapTransitWhCode(value) {
  const text = normalizeText(value).toUpperCase();
  if (!text) return null;
  for (const [code, wh] of Object.entries(WH_CODE_MAP)) {
    if (text.includes(code)) return wh;
  }
  return null;
}

function excludedInventoryRow(brand, salesOrgName, virtualWarehouseName) {
  if (normalizeLower(brand) === "other") return true;
  const salesOrg = normalizeLower(salesOrgName).replace(/\s+/g, " ").trim();
  if (
    salesOrg === "china" ||
    salesOrg.includes("business planning departmen") ||
    salesOrg.includes("business planning department")
  ) return true;
  return normalizeLower(virtualWarehouseName).includes("arrival plan");
}

function parseDateParts(value) {
  const unwrapped = unwrapValue(value);
  if (unwrapped == null || unwrapped === "") return null;
  if (unwrapped instanceof Date && !Number.isNaN(unwrapped.getTime())) {
    return { year: unwrapped.getFullYear(), month: unwrapped.getMonth() + 1, day: unwrapped.getDate() };
  }
  if (typeof unwrapped === "number" && Number.isFinite(unwrapped)) {
    const excelDate = new Date(Date.UTC(1899, 11, 30) + unwrapped * 86400000);
    return { year: excelDate.getUTCFullYear(), month: excelDate.getUTCMonth() + 1, day: excelDate.getUTCDate() };
  }
  const text = normalizeText(unwrapped);
  const match = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (match) return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return null;
  return { year: parsed.getFullYear(), month: parsed.getMonth() + 1, day: parsed.getDate() };
}

function partsToDateKey(parts) {
  if (!parts) return "";
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

function parseDateKey(value) {
  const text = normalizeText(value);
  const match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

function dateKeyToHeader(dateKey) {
  const parts = parseDateKey(dateKey);
  return parts ? `${parts.year}.${parts.month}.${parts.day}` : "";
}

function compareDateParts(a, b) {
  return `${a.year}-${String(a.month).padStart(2, "0")}-${String(a.day).padStart(2, "0")}`.localeCompare(
    `${b.year}-${String(b.month).padStart(2, "0")}-${String(b.day).padStart(2, "0")}`,
  );
}

function iterDateKeys(startValue, endValue) {
  const start = parseDateParts(startValue);
  const end = parseDateParts(endValue);
  if (!start || !end || compareDateParts(start, end) > 0) throw localizedError("invalidTransitRange");
  const cursor = new Date(start.year, start.month - 1, start.day);
  const endDate = new Date(end.year, end.month - 1, end.day);
  const out = [];
  while (cursor <= endDate) {
    out.push(partsToDateKey({ year: cursor.getFullYear(), month: cursor.getMonth() + 1, day: cursor.getDate() }));
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

function isWithinRange(dateKey, startValue, endValue) {
  const date = parseDateKey(dateKey);
  const start = parseDateParts(startValue);
  const end = parseDateParts(endValue);
  return date && start && end && compareDateParts(date, start) >= 0 && compareDateParts(date, end) <= 0;
}

function mergeSourceTag(current, incoming) {
  if (!incoming) return current || "";
  if (!current || current === incoming) return incoming;
  return SOURCE_MIXED;
}

function addMapNumber(map, key, value) {
  map.set(key, (map.get(key) || 0) + value);
}

function mergeMapValues(base, incoming) {
  for (const [key, value] of incoming) addMapNumber(base, key, value);
}

function buildSkuLookup(workbook, sheetName) {
  const ws = workbook.getWorksheet ? workbook.getWorksheet(sheetName) : workbook.Sheets[sheetName];
  const { headers, rows, index } = readSheetRows(ws);
  const required = [
    "sku no",
    "product model",
    "category",
    "level2",
    "level3",
    "billable watts(w)",
    "connector",
    "total pcs per 40hq container",
  ];
  const missing = required.filter((key) => index[key] == null);
  if (missing.length) throw localizedError("missingColumns", { sheet: "SKU", columns: missing.join(", ") });

  const lookup = new Map();
  for (const row of rows) {
    const key = normalizeSkuKey(row[index["sku no"]]);
    if (!key || lookup.has(key)) continue;
    lookup.set(key, {
      Category: normalizeText(row[index.category]),
      "Product TCL Report": normalizeText(row[index.level2]),
      Family: normalizeText(row[index.level3]),
      Model: normalizeText(row[index["product model"]]),
      Connector: normalizeText(row[index.connector]),
      Bin: safeFloat(row[index["billable watts(w)"]]),
      MOQ: safeFloat(row[index["total pcs per 40hq container"]]),
    });
  }
  return lookup;
}

function extractInventoryRows(workbook) {
  const { rows, index } = readSheetRows(getFirstWorksheet(workbook));
  const required = [
    "customer model",
    "category",
    "available stock",
    "sales organization name",
    "virtual warehouse name",
    "brand",
  ];
  const missing = required.filter((key) => index[key] == null);
  if (missing.length) throw localizedError("missingColumns", { sheet: "Inventory Detail", columns: missing.join(", ") });

  const grouped = new Map();
  for (const row of rows) {
    const brand = row[index.brand];
    const salesOrgName = row[index["sales organization name"]];
    const virtualWarehouseName = row[index["virtual warehouse name"]];
    if (excludedInventoryRow(brand, salesOrgName, virtualWarehouseName)) continue;
    const sku = normalizeText(row[index["customer model"]]);
    if (!sku) continue;
    const category = normalizeText(row[index.category]);
    const salesOrg = normalizeText(salesOrgName);
    const key = `${sku}\u0000${category}\u0000${salesOrg}`;
    grouped.set(key, (grouped.get(key) || 0) + safeFloat(row[index["available stock"]]));
  }

  return [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, stock]) => {
    const [sku, category, salesOrg] = key.split("\u0000");
    return { SKU: sku, Category: category, Stock: Number(stock.toFixed(3)), WH: mapCountryCode(salesOrg) };
  });
}

function extractTransitData(workbook, startValue, endValue) {
  const { rows, index } = readSheetRows(getFirstWorksheet(workbook));
  const required = ["in-transit warehouse(code)", "customer model", "supply date", "available quantity"];
  const missing = required.filter((key) => index[key] == null);
  if (missing.length) throw localizedError("missingColumns", { sheet: "DailySupplyPlan", columns: missing.join(", ") });

  const qty = new Map();
  const category = new Map();
  const hasCategory = index.category != null;
  for (const row of rows) {
    const sku = normalizeText(row[index["customer model"]]);
    const wh = mapTransitWhCode(row[index["in-transit warehouse(code)"]]);
    const parts = parseDateParts(row[index["supply date"]]);
    if (!sku || !wh || !parts) continue;
    const dateKey = partsToDateKey(parts);
    if (!isWithinRange(dateKey, startValue, endValue)) continue;
    addMapNumber(qty, `${sku}||${wh}||${dateKey}`, safeFloat(row[index["available quantity"]]));
    if (hasCategory) {
      const categoryValue = normalizeText(row[index.category]);
      const key = `${sku}||${wh}`;
      if (categoryValue && !category.has(key)) category.set(key, categoryValue);
    }
  }
  return { qty, category };
}

function extractOdpTransitData(workbook, startValue, endValue) {
  let ws = workbook.getWorksheet
    ? (workbook.getWorksheet("Total Stcok") || workbook.getWorksheet("Total Stock"))
    : (workbook.Sheets["Total Stcok"] || workbook.Sheets["Total Stock"]);
  if (!ws) throw localizedError("odpSheetMissing");
  const { rows, index } = readSheetRows(ws);
  const required = ["new ark wh", "new ark sku", "quantity", "eta for new ark update"];
  const missing = required.filter((key) => index[key] == null);
  if (missing.length) throw localizedError("missingColumns", { sheet: "ODP Total Stock", columns: missing.join(", ") });

  const qty = new Map();
  const category = new Map();
  const hasProductType = index["product type"] != null;
  for (const row of rows) {
    const sku = normalizeText(row[index["new ark sku"]]);
    const rawWh = row[index["new ark wh"]];
    const rawEta = row[index["eta for new ark update"]];
    if (!sku || ["", "n/a", "na", "none", "null"].includes(normalizeLower(rawWh))) continue;
    if (["", "n/a", "na", "none", "null"].includes(normalizeLower(rawEta))) continue;
    const wh = mapTransitWhCode(rawWh);
    const parts = parseDateParts(rawEta);
    if (!wh || !parts || parts.year <= 1900) continue;
    const dateKey = partsToDateKey(parts);
    if (!isWithinRange(dateKey, startValue, endValue)) continue;
    addMapNumber(qty, `${sku}||${wh}||${dateKey}`, safeFloat(row[index.quantity]));
    if (hasProductType) {
      const categoryValue = normalizeText(row[index["product type"]]);
      const key = `${sku}||${wh}`;
      if (categoryValue && !category.has(key)) category.set(key, categoryValue);
    }
  }
  return { qty, category };
}

function extractAllocatedOrders(workbook) {
  const { rows, index } = readSheetRows(getFirstWorksheet(workbook), 2);
  const required = [
    "allocation status",
    "material",
    "ordered qty",
    "crd",
    "customer level 6 name",
    "so no.",
    "so line",
    "model",
    "factory",
  ];
  const missing = required.filter((key) => index[key] == null);
  if (missing.length) throw localizedError("missingColumns", { sheet: "Order file", columns: missing.join(", ") });

  const orders = [];
  const need = new Map();
  for (const row of rows) {
    if (normalizeLower(row[index["allocation status"]]) !== "to be allocated") continue;
    const sku = normalizeText(row[index.material]);
    const qty = safeFloat(row[index["ordered qty"]]);
    const crd = row[index.crd];
    const factory = row[index.factory];
    const wh = mapTransitWhCode(factory) || "";
    orders.push({
      SKU: sku,
      "Ordered Qty": Number(qty.toFixed(3)),
      CRD: crd,
      "Customer Name": row[index["customer level 6 name"]],
      "SO No.": row[index["so no."]],
      "SO Line": row[index["so line"]],
      Model: row[index.model],
      Factory: factory,
      WH: wh,
    });
    if (sku && wh) addMapNumber(need, `${sku}||${wh}`, qty);
  }
  return { orders, need };
}

function makeUnmatchedMapping() {
  return {
    Category: UNMATCHED_SKU_MARK,
    "Product TCL Report": UNMATCHED_SKU_MARK,
    Family: UNMATCHED_SKU_MARK,
    Model: UNMATCHED_SKU_MARK,
    Connector: UNMATCHED_SKU_MARK,
    Bin: 0,
    MOQ: 0,
  };
}

function createStockRecord(wh, sku, mapped, stock = 0) {
  return {
    WH: wh,
    SKU: sku,
    Category: mapped.Category,
    ProductTCLReport: mapped["Product TCL Report"],
    Family: mapped.Family,
    Model: mapped.Model,
    Connector: mapped.Connector,
    Bin: mapped.Bin,
    MOQ: mapped.MOQ,
    Stock: stock,
    ToBeAllocated: 0,
    Transit: {},
    TransitSource: {},
  };
}

function splitKey3(key) {
  const first = key.indexOf("||");
  const second = key.indexOf("||", first + 2);
  return [key.slice(0, first), key.slice(first + 2, second), key.slice(second + 2)];
}

function splitKey2(key) {
  const splitAt = key.indexOf("||");
  return [key.slice(0, splitAt), key.slice(splitAt + 2)];
}

function recordKey(sku, wh) {
  return `${sku}||${wh}`;
}

function applyFill(cell, argb) {
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb } };
}

function columnName(number) {
  let n = number;
  let out = "";
  while (n > 0) {
    const remainder = (n - 1) % 26;
    out = String.fromCharCode(65 + remainder) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

function normalizeRecordForVisualization(record, dateHeaders, dateSourceTags, keyMeta) {
  const marker = UNMATCHED_SKU_MARK.toLowerCase();
  if ([record.Category, record.ProductTCLReport, record.Family, record.Model].some((value) => normalizeLower(value) === marker)) return null;
  const productKey = `${record.SKU}||${record.Model || ""}`;
  const parts = [record.Model, record.SKU, record.Connector].map(normalizeText).filter(Boolean);
  const productLabel = parts.join(" | ") || record.SKU;
  const transit = {};
  const transitSource = {};
  for (const dateKey of dateHeaders) {
    const header = dateKeyToHeader(dateKey);
    const qty = safeFloat(record.Transit[dateKey]);
    if (qty === 0) continue;
    transit[header] = qty;
    const source = record.TransitSource[dateKey] || SOURCE_INV_DSP;
    transitSource[header] = source;
    dateSourceTags[header] = mergeSourceTag(dateSourceTags[header], source);
  }
  const item = {
    WH: record.WH,
    Category: record.Category,
    ProductTCLReport: record.ProductTCLReport,
    Family: record.Family,
    SKU: record.SKU,
    Model: record.Model,
    Connector: record.Connector,
    ProductKey: productKey,
    ProductKeyLabel: productLabel,
    Stock: safeFloat(record.Stock),
    ToBeAllocated: safeFloat(record.ToBeAllocated),
    Transit: transit,
    TransitSource: transitSource,
  };
  keyMeta[`${record.SKU}||${record.WH}`] = {
    WH: item.WH,
    Category: item.Category,
    ProductTCLReport: item.ProductTCLReport,
    Family: item.Family,
    Connector: item.Connector,
    ProductKey: item.ProductKey,
  };
  return item;
}

function buildVisualizationPayload(records, dateKeys, orders) {
  const dateSourceTags = {};
  const keyMeta = {};
  const rows = records.map((record) => normalizeRecordForVisualization(record, dateKeys, dateSourceTags, keyMeta)).filter(Boolean);
  const allocations = orders
    .filter((order) => normalizeText(order.SKU) && normalizeText(order.WH) && safeFloat(order["Ordered Qty"]) !== 0)
    .map((order) => ({
      SKU: normalizeText(order.SKU),
      WH: normalizeText(order.WH),
      Model: normalizeText(order.Model),
      OrderedQty: safeFloat(order["Ordered Qty"]),
      CRDDate: partsToDateKey(parseDateParts(order.CRD)),
    }));
  return {
    dateHeaders: dateKeys.map(dateKeyToHeader),
    rows,
    allocations,
    keyMeta,
    dateSourceTags,
  };
}

function writeStockWorksheet(workbook, records, dateKeys, sourceTags) {
  const old = workbook.getWorksheet("stock");
  if (old) workbook.removeWorksheet(old.id);
  const ws = workbook.addWorksheet("stock");
  const baseHeaders = [
    "WH", "Category", "Product TCL Report", "Family", "SKU", "Model", "Connector", "Bin", "MOQ",
    "To be allocated", "Total QTY", "Total MW", "MW", "Stock",
  ];
  const dateHeaders = dateKeys.map(dateKeyToHeader);
  const headers = [...baseHeaders, ...dateHeaders];
  ws.addRow(headers);
  ws.views = [{ state: "frozen", ySplit: 1 }];
  ws.autoFilter = { from: "A1", to: `${columnName(headers.length)}1` };

  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FF17345F" } };
  headerRow.alignment = { vertical: "middle", horizontal: "center" };
  headerRow.height = 22;
  for (let columnNumber = 1; columnNumber <= headers.length; columnNumber += 1) {
    headerRow.getCell(columnNumber).border = {
      bottom: { style: "thin", color: { argb: "FFB8C9E2" } },
    };
  }

  const stockCol = baseHeaders.indexOf("Stock") + 1;
  const dateStartCol = baseHeaders.length + 1;
  applyFill(headerRow.getCell(stockCol), CELL_FILL_BY_SOURCE[SOURCE_INV_DSP]);
  for (let i = 0; i < dateHeaders.length; i += 1) {
    const header = dateHeaders[i];
    const source = sourceTags[header] || SOURCE_INV_DSP;
    applyFill(headerRow.getCell(dateStartCol + i), CELL_FILL_BY_SOURCE[source] || CELL_FILL_BY_SOURCE[SOURCE_INV_DSP]);
  }

  for (const record of records) {
    const transitTotal = dateKeys.reduce((sum, dateKey) => sum + safeFloat(record.Transit[dateKey]), 0);
    const totalQty = safeFloat(record.Stock) + transitTotal;
    const mw = (safeFloat(record.Stock) * safeFloat(record.Bin)) / 1000000;
    const totalMw = (totalQty * safeFloat(record.Bin)) / 1000000;
    record.TotalQTY = Number(totalQty.toFixed(3));
    record.TotalMW = Number(totalMw.toFixed(3));
    record.MW = Number(mw.toFixed(3));

    const row = ws.addRow([
      record.WH, record.Category, record.ProductTCLReport, record.Family, record.SKU, record.Model, record.Connector,
      record.Bin, record.MOQ, record.ToBeAllocated, record.TotalQTY, record.TotalMW, record.MW, record.Stock,
      ...dateKeys.map((dateKey) => (record.Transit[dateKey] ? record.Transit[dateKey] : null)),
    ]);
    row.eachCell((cell) => { cell.numFmt = "#,##0.###"; });
    applyFill(row.getCell(stockCol), CELL_FILL_BY_SOURCE[SOURCE_INV_DSP]);
    for (let i = 0; i < dateKeys.length; i += 1) {
      const dateKey = dateKeys[i];
      const qty = safeFloat(record.Transit[dateKey]);
      if (!qty) continue;
      const source = record.TransitSource[dateKey] || SOURCE_INV_DSP;
      applyFill(row.getCell(dateStartCol + i), CELL_FILL_BY_SOURCE[source] || CELL_FILL_BY_SOURCE[SOURCE_INV_DSP]);
    }
  }

  ws.columns.forEach((column, index) => {
    const defaultWidth = index < 7 ? 18 : 13;
    column.width = Math.max(defaultWidth, String(headers[index] || "").length + 2);
  });
  return ws;
}

function writeAllocationWorksheet(workbook, orders, skuLookup) {
  const old = workbook.getWorksheet(ALLOC_SHEET_NAME);
  if (old) workbook.removeWorksheet(old.id);
  const ws = workbook.addWorksheet(ALLOC_SHEET_NAME);
  ws.addRow(["SKU", "Connector", "Ordered Qty", "CRD", "Customer Name", "SO No.", "SO Line", "Model", "Factory", "WH"]);
  for (const order of orders) {
    if (safeFloat(order["Ordered Qty"]) === 0) continue;
    const mapped = skuLookup.get(normalizeSkuKey(order.SKU)) || makeUnmatchedMapping();
    ws.addRow([
      order.SKU, mapped.Connector, order["Ordered Qty"], order.CRD, order["Customer Name"], order["SO No."],
      order["SO Line"], order.Model, order.Factory, order.WH,
    ]);
  }
  ws.views = [{ state: "frozen", ySplit: 1 }];
  ws.getRow(1).font = { bold: true };
  ws.columns.forEach((column) => { column.width = 16; });
  return ws;
}

function writeTransitSourceWorksheet(workbook, transitSourceTag) {
  const old = workbook.getWorksheet(TRANSIT_SOURCE_SHEET_NAME);
  if (old) workbook.removeWorksheet(old.id);
  const ws = workbook.addWorksheet(TRANSIT_SOURCE_SHEET_NAME);
  ws.addRow(["SKU", "WH", "Date", "Source"]);
  for (const [key, source] of [...transitSourceTag.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const [sku, wh, dateKey] = splitKey3(key);
    ws.addRow([sku, wh, dateKeyToHeader(dateKey), source]);
  }
  ws.getRow(1).font = { bold: true };
  ws.columns.forEach((column) => { column.width = 16; });
  return ws;
}

export async function buildStockOutputJs({
  stockTemplateBytes,
  inventoryBytes,
  dailySupplyBytes,
  odpBytes,
  orderBytes,
  startDate,
  endDate,
}) {
  if (!globalThis.ExcelJS) throw localizedError("outputEngineMissing");
  if (!globalThis.XLSX) throw localizedError("inputEngineMissing");
  const loadTemplate = async (bytes, label) => {
    if (!bytes) return null;
    const workbook = new globalThis.ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(bytes);
      return workbook;
    } catch (error) {
      throw localizedError("readFailed", { label, message: error?.message || error });
    }
  };
  const loadSource = async (bytes, label) => {
    if (!bytes) return null;
    try {
      return globalThis.XLSX.read(bytes, { type: "array", cellDates: true, cellFormula: true, raw: true });
    } catch (error) {
      throw localizedError("readFailed", { label, message: error?.message || error });
    }
  };

  const templateWorkbook = await loadTemplate(stockTemplateBytes, "Stock template");
  const inventoryWorkbook = await loadSource(inventoryBytes, "Inventory");
  const dailySupplyWorkbook = await loadSource(dailySupplyBytes, "Daily Supply Plan");
  const odpWorkbook = await loadSource(odpBytes, "ODP");
  const orderWorkbook = await loadSource(orderBytes, "Orderfile Base");

  const dateKeys = iterDateKeys(startDate, endDate);
  const skuSheetName = pickSkuSheetName(templateWorkbook);
  const skuLookup = buildSkuLookup(templateWorkbook, skuSheetName);
  const inventoryRows = extractInventoryRows(inventoryWorkbook);
  const transitQty = new Map();
  const transitSourceTag = new Map();
  if (dailySupplyWorkbook) {
    const daily = extractTransitData(dailySupplyWorkbook, startDate, endDate);
    mergeMapValues(transitQty, daily.qty);
    for (const key of daily.qty.keys()) transitSourceTag.set(key, mergeSourceTag(transitSourceTag.get(key), SOURCE_INV_DSP));
  }
  if (odpWorkbook) {
    const odp = extractOdpTransitData(odpWorkbook, startDate, endDate);
    mergeMapValues(transitQty, odp.qty);
    for (const key of odp.qty.keys()) transitSourceTag.set(key, mergeSourceTag(transitSourceTag.get(key), SOURCE_ODP));
  }
  const allocationData = orderWorkbook ? extractAllocatedOrders(orderWorkbook) : { orders: [], need: new Map() };

  const activeSkuKeys = new Set();
  for (const row of inventoryRows) if (safeFloat(row.Stock) !== 0) activeSkuKeys.add(normalizeSkuKey(row.SKU));
  for (const [key, qty] of transitQty) if (safeFloat(qty) !== 0) activeSkuKeys.add(normalizeSkuKey(splitKey3(key)[0]));
  for (const [key, qty] of allocationData.need) if (safeFloat(qty) !== 0) activeSkuKeys.add(normalizeSkuKey(splitKey2(key)[0]));

  const records = [];
  const rowByKey = new Map();
  const markedRows = [];
  const resolve = (sku) => {
    const mapped = skuLookup.get(normalizeSkuKey(sku));
    return mapped ? { mapped, unmatched: false } : { mapped: makeUnmatchedMapping(), unmatched: true };
  };
  const appendRecord = (wh, sku, mapped, stock) => {
    const record = createStockRecord(wh, sku, mapped, stock);
    records.push(record);
    const key = recordKey(sku, wh);
    if (!rowByKey.has(key)) rowByKey.set(key, record);
    return record;
  };

  for (const item of inventoryRows) {
    if (!activeSkuKeys.has(normalizeSkuKey(item.SKU))) continue;
    const { mapped, unmatched } = resolve(item.SKU);
    if (unmatched) markedRows.push({ SKU: item.SKU, WH: item.WH, Reason: UNMATCHED_SKU_MARK });
    appendRecord(item.WH, item.SKU, mapped, item.Stock);
  }
  for (const [key, qty] of allocationData.need) {
    if (!safeFloat(qty)) continue;
    const [sku, wh] = splitKey2(key);
    const rowKey = recordKey(sku, wh);
    if (rowByKey.has(rowKey)) continue;
    const { mapped, unmatched } = resolve(sku);
    if (unmatched) markedRows.push({ SKU: sku, WH: wh, Reason: UNMATCHED_SKU_MARK });
    appendRecord(wh, sku, mapped, 0);
  }
  for (const [key, qty] of transitQty) {
    if (!safeFloat(qty)) continue;
    const [sku, wh, dateKey] = splitKey3(key);
    if (!activeSkuKeys.has(normalizeSkuKey(sku))) continue;
    const rowKey = recordKey(sku, wh);
    let record = rowByKey.get(rowKey);
    if (!record) {
      const { mapped, unmatched } = resolve(sku);
      if (unmatched) markedRows.push({ SKU: sku, WH: wh, Reason: UNMATCHED_SKU_MARK });
      record = appendRecord(wh, sku, mapped, 0);
    }
    record.Transit[dateKey] = (record.Transit[dateKey] || 0) + qty;
    record.TransitSource[dateKey] = mergeSourceTag(record.TransitSource[dateKey], transitSourceTag.get(key) || SOURCE_INV_DSP);
  }
  for (const record of records) {
    record.ToBeAllocated = safeFloat(allocationData.need.get(recordKey(record.SKU, record.WH)) || 0);
  }

  const dateSourceTags = {};
  for (const record of records) {
    for (const dateKey of dateKeys) {
      if (!safeFloat(record.Transit[dateKey])) continue;
      const source = record.TransitSource[dateKey] || SOURCE_INV_DSP;
      const header = dateKeyToHeader(dateKey);
      dateSourceTags[header] = mergeSourceTag(dateSourceTags[header], source);
    }
  }

  writeStockWorksheet(templateWorkbook, records, dateKeys, dateSourceTags);
  writeAllocationWorksheet(templateWorkbook, allocationData.orders, skuLookup);
  writeTransitSourceWorksheet(templateWorkbook, transitSourceTag);
  const outputBytes = await templateWorkbook.xlsx.writeBuffer();
  const visualization = buildVisualizationPayload(records, dateKeys, allocationData.orders);

  return {
    outputBytes,
    visualization,
    summary: {
      totalRows: records.length,
      activeSkuCount: activeSkuKeys.size,
      markedUnmatchedSkuRows: new Set(markedRows.map((item) => `${item.SKU}||${item.WH}`)).size,
      skuSheetName,
    },
  };
}
function localizedError(key, vars = {}) {
  const lang = localStorage.getItem("app_lang") === "en" ? "en" : "zh";
  const messages = {
    zh: {
      noSheets: "工作簿中没有工作表。", skuSheetMissing: "未找到 SKU 工作表：{name}", invalidTransitRange: "在途日期范围无效。", missingColumns: "{sheet} 缺少字段：{columns}", odpSheetMissing: "ODP 文件中缺少“Total Stcok”或“Total Stock”工作表。", outputEngineMissing: "JavaScript Excel 输出引擎未加载。", inputEngineMissing: "JavaScript Excel 输入引擎未加载。", readFailed: "无法读取 {label}：{message}"
    },
    en: {
      noSheets: "Workbook has no worksheets.", skuSheetMissing: "SKU sheet not found: {name}", invalidTransitRange: "Invalid transit date range.", missingColumns: "{sheet} is missing columns: {columns}", odpSheetMissing: "ODP file is missing the 'Total Stcok' or 'Total Stock' sheet.", outputEngineMissing: "JavaScript Excel output engine is not loaded.", inputEngineMissing: "JavaScript Excel input engine is not loaded.", readFailed: "{label} could not be read: {message}"
    }
  };
  let message = messages[lang][key] || key;
  Object.entries(vars).forEach(([name, value]) => { message = message.replace(`{${name}}`, String(value)); });
  return new Error(message);
}
