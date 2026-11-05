const SOURCE_INV_DSP = "INV_DSP";
const SOURCE_ODP = "ODP";
const SOURCE_MIXED = "MIXED";
const UNMATCHED_SKU_MARK = "SKU not matched";
const DOMESTIC_WH = "CN";
const ALLOC_SHEET_NAME = "To be allocated";
const TRANSIT_SOURCE_SHEET_NAME = "_Transit Source Map";
const UNMATCHED_SHEET_NAME = "Unmatched SKU";
const PV_STOCK_COUNTRIES = ["NL", "FR", "UK", "ES", "IT"];
const STOCK_SHEET_NAMES = [...PV_STOCK_COUNTRIES.map((country) => `PV Stock ${country}`), "ESS+HP Stock"];
const DOMESTIC_DETAIL_SHEET_NAMES = ["Domestic Stock PV", "Domestic Stock ESS"];

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

function isPvCategory(value) {
  return normalizeText(value).toUpperCase().startsWith("PV");
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

function getWorksheetByNameInsensitive(workbook, name) {
  const sheetNames = workbook.worksheets ? workbook.worksheets.map((ws) => ws.name) : workbook.SheetNames;
  const actualName = sheetNames.find((candidate) => candidate.toLowerCase() === name.toLowerCase());
  if (!actualName) return null;
  return workbook.getWorksheet ? workbook.getWorksheet(actualName) : workbook.Sheets[actualName];
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

function mapTransitVirtualWarehouse(value) {
  const rawText = normalizeText(value);
  const text = rawText.toUpperCase();
  if (!text) return null;
  for (const code of Object.keys(WH_CODE_MAP)) {
    if (!text.includes(code)) continue;
    if (text.includes("ARRIVAL PLAN")) return `Arrival Plan-${code}`;
    return code;
  }
  return null;
}

function normalizeOutputVirtualWarehouse(value) {
  const rawText = normalizeText(value);
  if (!rawText) return "";
  const transitName = mapTransitVirtualWarehouse(rawText);
  if (transitName && normalizeLower(rawText).includes("arrival plan")) return transitName;
  return rawText.replace(/\s*\([^()]*\)\s*$/, "").trim();
}

function excludedInventoryRow(salesOrgName, physicalWarehouseName, virtualWarehouseName) {
  const salesOrg = normalizeLower(salesOrgName).replace(/\s+/g, " ").trim();
  if (
    salesOrg === "china" ||
    salesOrg.includes("business planning department")
  ) return true;
  if (normalizeLower(physicalWarehouseName).replace(/\s+/g, " ").trim() === "sptn china ftz(w73)") return true;
  const virtualWarehouse = normalizeLower(virtualWarehouseName).trim();
  return ["fru", "hold", "market material", "scrap", "spec"].some((prefix) => virtualWarehouse.startsWith(prefix))
    || virtualWarehouse === "natec sunenergy b.v. consignment wh";
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

function inferLegacyCategory(family, brand, fallbackCategory = "") {
  const normalizedFamily = normalizeLower(family);
  const prefix = normalizedFamily === "hp"
    ? "HP"
    : (normalizedFamily.includes("ess") || ["ac charger", "other", "tcl blueark"].some((value) => normalizedFamily.startsWith(value)))
      ? "ESS"
      : "PV";
  const fallback = normalizeText(fallbackCategory);
  if (fallback.toUpperCase().startsWith(prefix)) return fallback;
  const normalizedBrand = normalizeText(brand);
  return normalizedBrand ? `${prefix} - ${normalizedBrand}` : prefix;
}

function buildSkuLookup(workbook) {
  const skuWorksheet = getWorksheetByNameInsensitive(workbook, "SKU")
    || getWorksheetByNameInsensitive(workbook, "SKU Mapping");
  const legacyWorksheet = getWorksheetByNameInsensitive(workbook, "Legacy Mapping Product");
  if (!skuWorksheet && !legacyWorksheet) throw localizedError("skuSheetMissing", { name: "Legacy Mapping Product / SKU" });
  const sheetName = [skuWorksheet?.name, legacyWorksheet?.name].filter(Boolean).join(", ");

  const lookup = new Map();
  if (skuWorksheet) {
    const { rows, index } = readSheetRows(skuWorksheet);
    const required = [
      "sku no", "product model", "category", "brand", "level2", "level3",
      "billable watts(w)", "connector", "total pcs per 40hq container",
    ];
    const missing = required.filter((key) => index[key] == null);
    if (missing.length) throw localizedError("missingColumns", { sheet: "SKU", columns: missing.join(", ") });
    for (const row of rows) {
      const key = normalizeSkuKey(row[index["sku no"]]);
      if (!key || lookup.has(key)) continue;
      lookup.set(key, {
        Category: normalizeText(row[index.category]),
        Brand: normalizeText(row[index.brand]),
        "Product TCL Report": normalizeText(row[index.level2]),
        Family: normalizeText(row[index.level3]),
        Model: normalizeText(row[index["product model"]]),
        Connector: normalizeText(row[index.connector]),
        Bin: safeFloat(row[index["billable watts(w)"]]),
        MOQ: safeFloat(row[index["total pcs per 40hq container"]]),
      });
    }
  }

  if (legacyWorksheet) {
    const { rows, index } = readSheetRows(legacyWorksheet);
    const required = ["sku no.", "anaplan pl6", "brand", "family", "product tcl report", "bins", "container loading"];
    const missing = required.filter((key) => index[key] == null);
    if (missing.length) throw localizedError("missingColumns", { sheet: "Legacy Mapping Product", columns: missing.join(", ") });
    const legacyRows = new Map();
    for (const row of rows) {
      const key = normalizeSkuKey(row[index["sku no."]]);
      if (!key || legacyRows.has(key)) continue;
      legacyRows.set(key, row);
    }
    for (const [key, row] of legacyRows) {
      const fallback = lookup.get(key) || {};
      const family = normalizeText(row[index.family]);
      const brand = normalizeText(row[index.brand]);
      lookup.set(key, {
        Category: inferLegacyCategory(family, brand, fallback.Category),
        Brand: brand || fallback.Brand || "",
        "Product TCL Report": normalizeText(row[index["product tcl report"]]) || fallback["Product TCL Report"] || "",
        Family: family || fallback.Family || "",
        Model: normalizeText(row[index["anaplan pl6"]]) || fallback.Model || "",
        Connector: fallback.Connector || "",
        Bin: safeFloat(row[index.bins]) || safeFloat(fallback.Bin),
        MOQ: safeFloat(row[index["container loading"]]) || safeFloat(fallback.MOQ),
      });
    }
  }
  return { lookup, sheetName };
}

function extractInventoryRows(workbook, stockMode = "available") {
  const { rows, index } = readSheetRows(getFirstWorksheet(workbook));
  const required = [
    "customer model",
    "product model",
    "category",
    stockMode === "total" ? "actual stock" : "available stock",
    "sales organization name",
    "virtual warehouse name",
    "physical warehouse name",
  ];
  const missing = required.filter((key) => index[key] == null);
  if (missing.length) throw localizedError("missingColumns", { sheet: "Inventory Detail", columns: missing.join(", ") });

  const stockColumn = stockMode === "total" ? "actual stock" : "available stock";
  const grouped = new Map();
  for (const row of rows) {
    const salesOrgName = row[index["sales organization name"]];
    const virtualWarehouseName = row[index["virtual warehouse name"]];
    const physicalWarehouseName = row[index["physical warehouse name"]];
    if (excludedInventoryRow(salesOrgName, physicalWarehouseName, virtualWarehouseName)) continue;
    const sku = normalizeText(row[index["customer model"]]);
    if (!sku) continue;
    const category = normalizeText(row[index.category]);
    const productModel = normalizeText(row[index["product model"]]);
    const salesOrg = normalizeText(salesOrgName);
    const virtualWarehouse = normalizeOutputVirtualWarehouse(virtualWarehouseName);
    const key = `${salesOrg}\u0000${virtualWarehouse}\u0000${category}\u0000${sku}\u0000${productModel}`;
    grouped.set(key, (grouped.get(key) || 0) + safeFloat(row[index[stockColumn]]));
  }

  return [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, stock]) => {
    const [salesOrg, virtualWarehouse, category, sku, productModel] = key.split("\u0000");
    return {
      SKU: sku,
      Category: category,
      ProductModel: productModel,
      VirtualWarehouse: virtualWarehouse,
      Stock: Number(stock.toFixed(3)),
      WH: mapCountryCode(salesOrg),
    };
  });
}

function extractTransitData(workbook, startValue, endValue, stockMode = "available") {
  const { rows, index } = readSheetRows(getFirstWorksheet(workbook));
  const quantityColumn = stockMode === "total" ? "scheduled quantity" : "available quantity";
  const required = ["in-transit warehouse(code)", "customer model", "product model", "category", "supply date", quantityColumn];
  const missing = required.filter((key) => index[key] == null);
  if (missing.length) throw localizedError("missingColumns", { sheet: "DailySupplyPlan", columns: missing.join(", ") });

  const qty = new Map();
  for (const row of rows) {
    const sku = normalizeText(row[index["customer model"]]);
    const rawWarehouse = row[index["in-transit warehouse(code)"]];
    const wh = mapTransitWhCode(rawWarehouse);
    const virtualWarehouse = mapTransitVirtualWarehouse(rawWarehouse);
    const parts = parseDateParts(row[index["supply date"]]);
    if (!sku || !wh || !virtualWarehouse || !parts) continue;
    const dateKey = partsToDateKey(parts);
    if (!isWithinRange(dateKey, startValue, endValue)) continue;
    const category = normalizeText(row[index.category]);
    const productModel = normalizeText(row[index["product model"]]);
    addMapNumber(qty, transitRecordKey(sku, wh, virtualWarehouse, category, productModel, dateKey), safeFloat(row[index[quantityColumn]]));
  }
  return { qty };
}

function extractOdpTransitData(workbook, startValue, endValue) {
  const qty = new Map();
  const domesticQty = new Map();
  const domesticDetailMap = new Map();
  const category = new Map();
  const blockedDestinations = new Set([
    "piraeus", "gdansk", "cork", "yangon", "limassol", "douala", "manila north",
    "karachi", "dar es salaam", "laem chabang", "pointe des galets", "davao", "thessaloniki",
  ]);
  const sheetSpecs = [
    { name: "PV SUPPLY DATA", category: "PV" },
    { name: "ESS SUPPLY DATA", category: "ESS" },
  ];

  for (const sheetSpec of sheetSpecs) {
    const ws = workbook.getWorksheet ? workbook.getWorksheet(sheetSpec.name) : workbook.Sheets[sheetSpec.name];
    if (!ws) throw localizedError("odpSupplySheetMissing", { name: sheetSpec.name });
    const { rows, index } = readSheetRows(ws);
    const required = [
      "sptn-pvhk new ark po#", "new ark po type", "allocation planning", "port destination", "new ark wh",
      "new ark sku", "model", "quantity", "eta for new ark update",
    ];
    const missing = required.filter((key) => index[key] == null);
    if (missing.length) throw localizedError("missingColumns", { sheet: sheetSpec.name, columns: missing.join(", ") });

    for (const row of rows) {
      if (normalizeText(row[index["sptn-pvhk new ark po#"]])) continue;
      if (normalizeLower(row[index["new ark po type"]]) === "offshore") continue;
      if (normalizeLower(row[index["allocation planning"]]) === "non-eu") continue;
      if (blockedDestinations.has(normalizeLower(row[index["port destination"]]))) continue;

      const sku = normalizeText(row[index["new ark sku"]]);
      if (!sku) continue;
      const rawWh = row[index["new ark wh"]];
      const quantity = safeFloat(row[index.quantity]);
      const model = normalizeText(row[index.model]);
      const wh = mapTransitWhCode(rawWh);
      const virtualWarehouse = mapTransitVirtualWarehouse(rawWh) || "";
      const isArrivalPlanWarehouse = normalizeLower(rawWh).includes("arrival plan") && Boolean(wh);
      if (!isArrivalPlanWarehouse) {
        addMapNumber(domesticQty, sku, quantity);
        const factory = index["factory location"] == null ? "" : normalizeText(row[index["factory location"]]);
        const mw = index.mw == null ? 0 : safeFloat(row[index.mw]);
        const detailKey = `${sheetSpec.category}\u0000${sku}\u0000${model}\u0000${factory}`;
        const detail = domesticDetailMap.get(detailKey) || { SKU: sku, Model: model, Factory: factory, Category: sheetSpec.category, Quantity: 0, MW: 0 };
        detail.Quantity += quantity;
        detail.MW += mw;
        domesticDetailMap.set(detailKey, detail);
        continue;
      }

      const rawEta = row[index["eta for new ark update"]];
      if (["", "n/a", "na", "none", "null"].includes(normalizeLower(rawEta))) continue;
      const parts = parseDateParts(rawEta);
      if (!parts || parts.year <= 1900) continue;
      const dateKey = partsToDateKey(parts);
      if (!isWithinRange(dateKey, startValue, endValue)) continue;
      addMapNumber(qty, transitRecordKey(sku, wh, virtualWarehouse, sheetSpec.category, model, dateKey), quantity);
      const categoryKey = `${sku}||${wh}`;
      if (!category.has(categoryKey)) category.set(categoryKey, sheetSpec.category);
    }
  }
  const domesticDetails = [...domesticDetailMap.values()]
    .map((item) => ({ ...item, Quantity: Number(item.Quantity.toFixed(3)), MW: Number(item.MW.toFixed(6)) }))
    .filter((item) => safeFloat(item.Quantity) !== 0)
    .sort((a, b) => `${a.SKU}\u0000${a.Model}\u0000${a.Factory}`.localeCompare(`${b.SKU}\u0000${b.Model}\u0000${b.Factory}`));
  return { qty, category, domesticQty, domesticDetails };
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
    Brand: UNMATCHED_SKU_MARK,
    "Product TCL Report": UNMATCHED_SKU_MARK,
    Family: UNMATCHED_SKU_MARK,
    Model: UNMATCHED_SKU_MARK,
    Connector: UNMATCHED_SKU_MARK,
    Bin: 0,
    MOQ: 0,
  };
}

function createStockRecord(wh, sku, mapped, stock = 0, domesticStock = 0, virtualWarehouse = "", sourceCategory = "", sourceProductModel = "") {
  return {
    WH: wh,
    VirtualWarehouse: virtualWarehouse,
    SKU: sku,
    Category: sourceCategory || mapped.Category,
    Brand: mapped.Brand,
    ProductTCLReport: mapped["Product TCL Report"],
    Family: mapped.Family,
    Model: sourceProductModel || mapped.Model,
    Connector: mapped.Connector,
    Bin: mapped.Bin,
    MOQ: mapped.MOQ,
    Stock: stock,
    DomesticStock: domesticStock,
    ToBeAllocated: 0,
    Transit: {},
    TransitSource: {},
    StatusQuantity: { Inventory: stock, DailySupplyPlan: 0, ODP: 0 },
  };
}

function transitRecordKey(sku, wh, virtualWarehouse, category, productModel, dateKey) {
  return [sku, wh, virtualWarehouse, category, productModel, dateKey].join("\u0000");
}

function splitTransitRecordKey(key) {
  return key.split("\u0000");
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
  if ([record.Category, record.Brand, record.ProductTCLReport, record.Family, record.Model].some((value) => normalizeLower(value) === marker)) return null;
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
    VirtualWarehouse: record.VirtualWarehouse,
    Category: record.Category,
    Brand: record.Brand,
    ProductTCLReport: record.ProductTCLReport,
    Family: record.Family,
    SKU: record.SKU,
    Model: record.Model,
    Connector: record.Connector,
    ProductKey: productKey,
    ProductKeyLabel: productLabel,
    Bin: safeFloat(record.Bin),
    StockMW: isPvCategory(record.Category) ? (safeFloat(record.Stock) * safeFloat(record.Bin)) / 1000000 : 0,
    Stock: safeFloat(record.Stock),
    DomesticStock: safeFloat(record.DomesticStock),
    ToBeAllocated: safeFloat(record.ToBeAllocated),
    StatusQuantity: {
      Inventory: safeFloat(record.StatusQuantity?.Inventory ?? record.Stock),
      DailySupplyPlan: safeFloat(record.StatusQuantity?.DailySupplyPlan),
      ODP: safeFloat(record.StatusQuantity?.ODP) + safeFloat(record.DomesticStock),
    },
    Transit: transit,
    TransitSource: transitSource,
  };
  keyMeta[`${record.SKU}||${record.WH}`] = {
    WH: item.WH,
    Category: item.Category,
    Brand: item.Brand,
    ProductTCLReport: item.ProductTCLReport,
    Family: item.Family,
    Connector: item.Connector,
    ProductKey: item.ProductKey,
  };
  return item;
}

function buildVisualizationPayload(records, dateKeys, orders, stockMode, domesticDetails = []) {
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
    domesticDetails,
    stockMode,
  };
}

function aggregateRecordsBySku(records) {
  const grouped = new Map();
  const virtualWarehouses = new Map();
  for (const source of records) {
    const key = normalizeSkuKey(source.SKU);
    if (!key) continue;
    if (!grouped.has(key)) {
      grouped.set(key, {
        ...source,
        Stock: safeFloat(source.Stock),
        DomesticStock: safeFloat(source.DomesticStock),
        ToBeAllocated: safeFloat(source.ToBeAllocated),
        Transit: { ...source.Transit },
        TransitSource: { ...source.TransitSource },
        StatusQuantity: {
          Inventory: safeFloat(source.StatusQuantity?.Inventory),
          DailySupplyPlan: safeFloat(source.StatusQuantity?.DailySupplyPlan),
          ODP: safeFloat(source.StatusQuantity?.ODP),
        },
      });
      virtualWarehouses.set(key, new Set());
    } else {
      const target = grouped.get(key);
      target.Stock += safeFloat(source.Stock);
      target.DomesticStock += safeFloat(source.DomesticStock);
      target.ToBeAllocated += safeFloat(source.ToBeAllocated);
      target.StatusQuantity.Inventory += safeFloat(source.StatusQuantity?.Inventory);
      target.StatusQuantity.DailySupplyPlan += safeFloat(source.StatusQuantity?.DailySupplyPlan);
      target.StatusQuantity.ODP += safeFloat(source.StatusQuantity?.ODP);
      for (const [dateKey, qty] of Object.entries(source.Transit || {})) {
        target.Transit[dateKey] = safeFloat(target.Transit[dateKey]) + safeFloat(qty);
        target.TransitSource[dateKey] = mergeSourceTag(target.TransitSource[dateKey], source.TransitSource?.[dateKey]);
      }
    }
    const sourceNames = normalizeText(source.VirtualWarehouse).split(" / ").map((value) => value.trim()).filter(Boolean);
    for (const sourceName of sourceNames) virtualWarehouses.get(key).add(sourceName);
  }
  for (const [key, record] of grouped) {
    record.VirtualWarehouse = [...virtualWarehouses.get(key)].sort((a, b) => a.localeCompare(b)).join(" / ");
  }
  return [...grouped.values()];
}

function isUnmatchedRecord(record) {
  const marker = UNMATCHED_SKU_MARK.toLowerCase();
  return [record.Category, record.Brand, record.ProductTCLReport, record.Family, record.Model]
    .some((value) => normalizeLower(value) === marker);
}

function stockTableName(sheetName) {
  return `Tbl_${sheetName.replace(/[^A-Za-z0-9_]/g, "_")}`;
}

function writeStockWorksheet(workbook, sheetName, records, dateKeys, sourceTags) {
  const old = workbook.getWorksheet(sheetName);
  if (old) workbook.removeWorksheet(old.id);
  const ws = workbook.addWorksheet(sheetName);
  const baseHeaders = [
    "WH", "Virtual Warehouse", "Category", "Brand", "Product TCL Report", "Family", "SKU", "Model", "Connector", "Bin", "MOQ",
    "To be allocated", "Total QTY", "Total MW", "MW", "Stock", "Domestic Stock",
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
  const domesticStockCol = baseHeaders.indexOf("Domestic Stock") + 1;
  const dateStartCol = baseHeaders.length + 1;
  applyFill(headerRow.getCell(stockCol), CELL_FILL_BY_SOURCE[SOURCE_INV_DSP]);
  applyFill(headerRow.getCell(domesticStockCol), CELL_FILL_BY_SOURCE[SOURCE_ODP]);
  for (let i = 0; i < dateHeaders.length; i += 1) {
    const header = dateHeaders[i];
    const source = sourceTags[header] || SOURCE_INV_DSP;
    applyFill(headerRow.getCell(dateStartCol + i), CELL_FILL_BY_SOURCE[source] || CELL_FILL_BY_SOURCE[SOURCE_INV_DSP]);
  }

  for (const record of records) {
    const transitTotal = dateKeys.reduce((sum, dateKey) => sum + safeFloat(record.Transit[dateKey]), 0);
    const totalQty = safeFloat(record.Stock) + safeFloat(record.DomesticStock) + transitTotal;
    const pv = isPvCategory(record.Category);
    const mw = pv ? (safeFloat(record.Stock) * safeFloat(record.Bin)) / 1000000 : null;
    const totalMw = pv ? (totalQty * safeFloat(record.Bin)) / 1000000 : null;
    record.TotalQTY = Number(totalQty.toFixed(3));
    record.TotalMW = totalMw == null ? null : Number(totalMw.toFixed(3));
    record.MW = mw == null ? null : Number(mw.toFixed(3));

    const row = ws.addRow([
      record.WH, record.VirtualWarehouse, record.Category, record.Brand, record.ProductTCLReport, record.Family, record.SKU, record.Model, record.Connector,
      record.Bin, record.MOQ, record.ToBeAllocated, record.TotalQTY, record.TotalMW, record.MW, record.Stock, record.DomesticStock,
      ...dateKeys.map((dateKey) => (record.Transit[dateKey] ? record.Transit[dateKey] : null)),
    ]);
    row.eachCell((cell) => { cell.numFmt = "#,##0.###"; });
    applyFill(row.getCell(stockCol), CELL_FILL_BY_SOURCE[SOURCE_INV_DSP]);
    if (safeFloat(record.DomesticStock)) applyFill(row.getCell(domesticStockCol), CELL_FILL_BY_SOURCE[SOURCE_ODP]);
    for (let i = 0; i < dateKeys.length; i += 1) {
      const dateKey = dateKeys[i];
      const qty = safeFloat(record.Transit[dateKey]);
      if (!qty) continue;
      const source = record.TransitSource[dateKey] || SOURCE_INV_DSP;
      applyFill(row.getCell(dateStartCol + i), CELL_FILL_BY_SOURCE[source] || CELL_FILL_BY_SOURCE[SOURCE_INV_DSP]);
    }
  }

  ws.addTable({
    name: stockTableName(sheetName),
    ref: "A1",
    headerRow: true,
    totalsRow: false,
    style: { theme: "TableStyleLight2", showRowStripes: true, showColumnStripes: false },
    columns: headers.map((name) => ({ name })),
    rows: records.map((record) => [
      record.WH, record.VirtualWarehouse, record.Category, record.Brand, record.ProductTCLReport, record.Family, record.SKU, record.Model, record.Connector,
      record.Bin, record.MOQ, record.ToBeAllocated, record.TotalQTY, record.TotalMW, record.MW, record.Stock, record.DomesticStock,
      ...dateKeys.map((dateKey) => (record.Transit[dateKey] ? record.Transit[dateKey] : null)),
    ]),
  });

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

function writeTransitSourceWorksheet(workbook, transitSourceTag, dailyTransitQty, odpTransitQty, skuLookup) {
  const old = workbook.getWorksheet(TRANSIT_SOURCE_SHEET_NAME);
  if (old) workbook.removeWorksheet(old.id);
  const ws = workbook.addWorksheet(TRANSIT_SOURCE_SHEET_NAME);
  ws.addRow(["SKU", "WH", "Virtual Warehouse", "Category", "Model", "Date", "Source", "Daily Supply Plan Qty", "ODP Qty"]);
  const sourceKeys = new Set([...transitSourceTag.keys(), ...dailyTransitQty.keys(), ...odpTransitQty.keys()]);
  for (const key of [...sourceKeys].sort((a, b) => a.localeCompare(b))) {
    const [sku, wh, virtualWarehouse, category, productModel, dateKey] = splitTransitRecordKey(key);
    const mapped = skuLookup.get(normalizeSkuKey(sku));
    const resolvedCategory = category || normalizeText(mapped?.Category);
    const resolvedProductModel = productModel || normalizeText(mapped?.Model);
    ws.addRow([
      sku,
      wh,
      virtualWarehouse,
      resolvedCategory,
      resolvedProductModel,
      dateKeyToHeader(dateKey),
      transitSourceTag.get(key) || SOURCE_INV_DSP,
      safeFloat(dailyTransitQty.get(key)),
      safeFloat(odpTransitQty.get(key)),
    ]);
  }
  ws.getRow(1).font = { bold: true };
  ws.columns.forEach((column) => { column.width = 16; });
  return ws;
}

function writeDomesticStockWorksheet(workbook, sheetName, domesticDetails) {
  const old = workbook.getWorksheet(sheetName);
  if (old) workbook.removeWorksheet(old.id);
  const ws = workbook.addWorksheet(sheetName);
  ws.addRow(["SKU", "Model", "Factory", "Quantity", "MW"]);
  for (const item of domesticDetails.filter((row) => safeFloat(row.Quantity) !== 0)) {
    ws.addRow([item.SKU, item.Model, item.Factory, item.Quantity, item.MW]);
  }
  ws.views = [{ state: "frozen", ySplit: 1 }];
  ws.getRow(1).font = { bold: true };
  ws.columns = [18, 28, 18, 14, 14].map((width) => ({ width }));
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
  stockMode = "available",
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
  const { lookup: skuLookup, sheetName: skuSheetName } = buildSkuLookup(templateWorkbook);
  const normalizedStockMode = stockMode === "total" ? "total" : "available";
  const inventoryRows = extractInventoryRows(inventoryWorkbook, normalizedStockMode);
  const transitQty = new Map();
  const dailyTransitQty = new Map();
  const odpTransitQty = new Map();
  const domesticQty = new Map();
  let domesticDetails = [];
  const transitSourceTag = new Map();
  if (dailySupplyWorkbook) {
    const daily = extractTransitData(dailySupplyWorkbook, startDate, endDate, normalizedStockMode);
    mergeMapValues(dailyTransitQty, daily.qty);
    mergeMapValues(transitQty, daily.qty);
    for (const key of daily.qty.keys()) transitSourceTag.set(key, mergeSourceTag(transitSourceTag.get(key), SOURCE_INV_DSP));
  }
  if (odpWorkbook) {
    const odp = extractOdpTransitData(odpWorkbook, startDate, endDate);
    mergeMapValues(odpTransitQty, odp.qty);
    mergeMapValues(transitQty, odp.qty);
    for (const key of odp.qty.keys()) transitSourceTag.set(key, mergeSourceTag(transitSourceTag.get(key), SOURCE_ODP));
    mergeMapValues(domesticQty, odp.domesticQty);
    domesticDetails = odp.domesticDetails;
  }
  const allocationData = orderWorkbook ? extractAllocatedOrders(orderWorkbook) : { orders: [], need: new Map() };

  const activeSkuKeys = new Set();
  for (const row of inventoryRows) if (safeFloat(row.Stock) !== 0) activeSkuKeys.add(normalizeSkuKey(row.SKU));
  for (const [key, qty] of transitQty) if (safeFloat(qty) !== 0) activeSkuKeys.add(normalizeSkuKey(splitTransitRecordKey(key)[0]));
  for (const [key, qty] of allocationData.need) if (safeFloat(qty) !== 0) activeSkuKeys.add(normalizeSkuKey(splitKey2(key)[0]));
  for (const [sku, qty] of domesticQty) if (safeFloat(qty) !== 0) activeSkuKeys.add(normalizeSkuKey(sku));

  const records = [];
  const rowByKey = new Map();
  const transitRowByKey = new Map();
  const markedRows = [];
  const resolve = (sku) => {
    const mapped = skuLookup.get(normalizeSkuKey(sku));
    return mapped ? { mapped, unmatched: false } : { mapped: makeUnmatchedMapping(), unmatched: true };
  };
  const appendRecord = (wh, sku, mapped, stock, domesticStock = 0, virtualWarehouse = "", sourceCategory = "", sourceProductModel = "") => {
    const record = createStockRecord(wh, sku, mapped, stock, domesticStock, virtualWarehouse, sourceCategory, sourceProductModel);
    records.push(record);
    if (!normalizeText(virtualWarehouse)) {
      const key = recordKey(sku, wh);
      if (!rowByKey.has(key)) rowByKey.set(key, record);
    }
    return record;
  };

  for (const item of inventoryRows) {
    if (!activeSkuKeys.has(normalizeSkuKey(item.SKU))) continue;
    const { mapped, unmatched } = resolve(item.SKU);
    if (unmatched) markedRows.push({ SKU: item.SKU, WH: item.WH, Reason: UNMATCHED_SKU_MARK });
    appendRecord(item.WH, item.SKU, mapped, item.Stock, 0, item.VirtualWarehouse, item.Category, item.ProductModel);
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
  for (const [sku, qty] of domesticQty) {
    if (!safeFloat(qty)) continue;
    const rowKey = recordKey(sku, DOMESTIC_WH);
    let record = rowByKey.get(rowKey);
    if (!record) {
      const { mapped, unmatched } = resolve(sku);
      if (unmatched) markedRows.push({ SKU: sku, WH: DOMESTIC_WH, Reason: UNMATCHED_SKU_MARK });
      record = appendRecord(DOMESTIC_WH, sku, mapped, 0, 0);
    }
    record.DomesticStock += safeFloat(qty);
  }
  for (const [key, qty] of transitQty) {
    if (!safeFloat(qty)) continue;
    const [sku, wh, virtualWarehouse, sourceCategory, sourceProductModel, dateKey] = splitTransitRecordKey(key);
    if (!activeSkuKeys.has(normalizeSkuKey(sku))) continue;
    const { mapped, unmatched } = resolve(sku);
    const category = sourceCategory || mapped.Category;
    const productModel = sourceProductModel || mapped.Model;
    const rowKey = [sku, wh, virtualWarehouse, category, productModel].join("\u0000");
    let record = transitRowByKey.get(rowKey);
    if (!record) {
      if (unmatched) markedRows.push({ SKU: sku, WH: wh, Reason: UNMATCHED_SKU_MARK });
      record = appendRecord(wh, sku, mapped, 0, 0, virtualWarehouse, category, productModel);
      transitRowByKey.set(rowKey, record);
    }
    record.Transit[dateKey] = (record.Transit[dateKey] || 0) + qty;
    record.TransitSource[dateKey] = mergeSourceTag(record.TransitSource[dateKey], transitSourceTag.get(key) || SOURCE_INV_DSP);
    record.StatusQuantity.DailySupplyPlan += safeFloat(dailyTransitQty.get(key));
    record.StatusQuantity.ODP += safeFloat(odpTransitQty.get(key));
  }
  for (const record of records) {
    record.ToBeAllocated = normalizeText(record.VirtualWarehouse)
      ? 0
      : safeFloat(allocationData.need.get(recordKey(record.SKU, record.WH)) || 0);
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

  for (const obsoleteName of ["stock", "PV Stock", UNMATCHED_SHEET_NAME, ...STOCK_SHEET_NAMES]) {
    const obsoleteStock = templateWorkbook.getWorksheet(obsoleteName);
    if (obsoleteStock) templateWorkbook.removeWorksheet(obsoleteStock.id);
  }
  const matchedRecords = records.filter((record) => !isUnmatchedRecord(record));
  const unmatchedRecords = records.filter(isUnmatchedRecord);
  for (const country of PV_STOCK_COUNTRIES) {
    const countryRecords = matchedRecords.filter((record) => isPvCategory(record.Category) && normalizeText(record.WH).toUpperCase() === country);
    writeStockWorksheet(templateWorkbook, `PV Stock ${country}`, aggregateRecordsBySku(countryRecords), dateKeys, dateSourceTags);
  }
  writeStockWorksheet(templateWorkbook, "ESS+HP Stock", matchedRecords.filter((record) => !isPvCategory(record.Category)), dateKeys, dateSourceTags);
  writeStockWorksheet(templateWorkbook, UNMATCHED_SHEET_NAME, unmatchedRecords, dateKeys, dateSourceTags);
  writeAllocationWorksheet(templateWorkbook, allocationData.orders, skuLookup);
  writeTransitSourceWorksheet(templateWorkbook, transitSourceTag, dailyTransitQty, odpTransitQty, skuLookup);
  const obsoleteDomestic = templateWorkbook.getWorksheet("Domestic Stock");
  if (obsoleteDomestic) templateWorkbook.removeWorksheet(obsoleteDomestic.id);
  writeDomesticStockWorksheet(templateWorkbook, DOMESTIC_DETAIL_SHEET_NAMES[0], domesticDetails.filter((item) => normalizeText(item.Category).toUpperCase() === "PV"));
  writeDomesticStockWorksheet(templateWorkbook, DOMESTIC_DETAIL_SHEET_NAMES[1], domesticDetails.filter((item) => normalizeText(item.Category).toUpperCase() === "ESS"));
  const outputBytes = await templateWorkbook.xlsx.writeBuffer();
  const visualization = buildVisualizationPayload(records, dateKeys, allocationData.orders, normalizedStockMode, domesticDetails);

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
      noSheets: "工作簿中没有工作表。", skuSheetMissing: "未找到 SKU 工作表：{name}", invalidTransitRange: "在途日期范围无效。", missingColumns: "{sheet} 缺少字段：{columns}", odpSupplySheetMissing: "ODP 文件中缺少工作表：{name}", outputEngineMissing: "JavaScript Excel 输出引擎未加载。", inputEngineMissing: "JavaScript Excel 输入引擎未加载。", readFailed: "无法读取 {label}：{message}"
    },
    en: {
      noSheets: "Workbook has no worksheets.", skuSheetMissing: "SKU sheet not found: {name}", invalidTransitRange: "Invalid transit range.", missingColumns: "{sheet} is missing columns: {columns}", odpSupplySheetMissing: "ODP file is missing worksheet: {name}", outputEngineMissing: "JavaScript Excel output engine is not loaded.", inputEngineMissing: "JavaScript Excel input engine is not loaded.", readFailed: "{label} could not be read: {message}"
    }
  };
  let message = messages[lang][key] || key;
  Object.entries(vars).forEach(([name, value]) => { message = message.replace(`{${name}}`, String(value)); });
  return new Error(message);
}
