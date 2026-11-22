const SOURCE_INV_DSP = "INV_DSP";
const SOURCE_ODP = "ODP";
const SOURCE_MIXED = "MIXED";
const UNMATCHED_SKU_MARK = "SKU not matched";
const REMOVED_SKU_MARK = "Remove-list";
const DOMESTIC_WH = "CN";
const ALLOC_SHEET_NAME = "To be allocated";
const ALLOCATION_DEDUCTION_SHEET_NAME = "Allocation Deduction";
const TRANSIT_SOURCE_SHEET_NAME = "_Transit Source Map";
const UNMATCHED_SHEET_NAME = "Unmatched SKU";
const PV_STOCK_COUNTRIES = ["NL", "FR", "UK", "ES", "IT"];
const STOCK_SHEET_NAMES = [...PV_STOCK_COUNTRIES.map((country) => `${country}_PV`), "ESS+HP Stock"];
const DOMESTIC_DETAIL_SHEET_NAMES = ["Domestic Stock PV", "Domestic Stock ESS"];
const MW_SHEET_NAME = "MW";
const SUNPOWER_MW_SHEET_NAME = "SunPower MW";
const TCL_MW_SHEET_NAME = "TCL MW";
const EXCLUDED_ESS_HP_FAMILIES = new Set(["AC CHARGER", "CELLS", "MARKETING"]);
const ALLOCATION_EXPORT_COLUMNS = [
  "Category", "Month", "SO Create Date", "CRD", "Customer Level 6 Name", "Sub Type", "SO No.", "SO Line",
  "Brand", "Material", "Model", "Ordered Qty", "Total KW", "Warehouse Name",
];

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

const ORDER_WAREHOUSE_NAME_MAP = {
  "store-fr(w74)": "FR",
  "store-fr(w40)": "FR",
  "store-fr(w75)": "FR",
  "gca store": "FR",
  "fos port direct delivery wh": "FR",
  "fru-nl(w72)": "NL",
  "store-vdh-bot": "NL",
  "store w72 nl battery": "NL",
  "store-it(w81)-haihang": "IT",
  "store-it(w82)-haihang": "IT",
  "store-uk(w80)-worldex": "UK",
  "felixstowe port direct delivery wh": "UK",
  "valencia port direct delivery wh": "ES",
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

function isExcludedEssHpFamily(value) {
  return EXCLUDED_ESS_HP_FAMILIES.has(normalizeText(value).toUpperCase());
}

function isExcludedInventoryFamily(value) {
  return normalizeText(value).toUpperCase() === "MARKETING";
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

function mapOrderWarehouseName(value) {
  return ORDER_WAREHOUSE_NAME_MAP[normalizeLower(value)] || null;
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

function isoWeekLabel(dateKey) {
  const parts = parseDateKey(dateKey);
  if (!parts) return "";
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  return `${String(date.getUTCFullYear()).slice(-2)}-W${String(week).padStart(2, "0")}`;
}

function monthLabel(dateKey) {
  const parts = parseDateKey(dateKey);
  return parts ? `${parts.year}-${String(parts.month).padStart(2, "0")}` : "";
}

function compareDateParts(a, b) {
  return `${a.year}-${String(a.month).padStart(2, "0")}-${String(a.day).padStart(2, "0")}`.localeCompare(
    `${b.year}-${String(b.month).padStart(2, "0")}-${String(b.day).padStart(2, "0")}`,
  );
}

function addCalendarMonths(parts, months) {
  const first = new Date(parts.year, parts.month - 1 + months, 1);
  const lastDay = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  return {
    year: first.getFullYear(),
    month: first.getMonth() + 1,
    day: Math.min(parts.day, lastDay),
  };
}

function canonicalBrand(value) {
  const brand = normalizeText(value);
  return brand.toUpperCase() === "SUNPOWER" ? "SunPower" : brand;
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
  const removedSkus = new Set();
  const removeWorksheet = getWorksheetByNameInsensitive(workbook, "Remove-list");
  if (removeWorksheet) {
    const { rows, index } = readSheetRows(removeWorksheet);
    const skuIndex = index.sku == null ? 0 : index.sku;
    for (const row of rows) {
      const key = normalizeSkuKey(row[skuIndex]);
      if (key) removedSkus.add(key);
    }
  }

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
        Brand: canonicalBrand(row[index.brand]),
        Family: normalizeText(row[index.level2]),
        Size: normalizeText(row[index.level3]),
        Model: normalizeText(row[index["product model"]]),
        Connector: normalizeText(row[index.connector]),
        CableLength: index["cable length"] == null ? "" : normalizeText(row[index["cable length"]]),
        Bin: safeFloat(row[index["billable watts(w)"]]),
        MOQ: safeFloat(row[index["total pcs per 40hq container"]]),
        MappingSource: "SKU",
      });
    }
  }

  if (legacyWorksheet) {
    const { rows, index } = readSheetRows(legacyWorksheet);
    const skuKey = index["sku no."] == null ? index["sku no"] : index["sku no."];
    const familyKey = index.family;
    const sizeKey = index.size;
    const required = ["anaplan pl6", "brand", "family", "bins", "container loading"];
    if (skuKey == null) required.unshift("sku no.");
    const missing = required.filter((key) => index[key] == null);
    if (missing.length) throw localizedError("missingColumns", { sheet: "Legacy Mapping Product", columns: missing.join(", ") });
    const legacyRows = new Map();
    for (const row of rows) {
      const key = normalizeSkuKey(row[skuKey]);
      if (!key || legacyRows.has(key)) continue;
      legacyRows.set(key, row);
    }
    for (const [key, row] of legacyRows) {
      if (lookup.has(key)) continue;
      const family = normalizeText(row[familyKey]);
      const size = sizeKey == null ? "" : normalizeText(row[sizeKey]);
      const brand = canonicalBrand(row[index.brand]);
      lookup.set(key, {
        Category: inferLegacyCategory(family, brand),
        Brand: brand,
        Family: family,
        Size: size,
        Model: normalizeText(row[index["anaplan pl6"]]),
        Connector: "",
        CableLength: "",
        Bin: safeFloat(row[index.bins]),
        MOQ: safeFloat(row[index["container loading"]]),
        MappingSource: "Legacy Mapping Product",
      });
    }
  }
  return { lookup, sheetName, removedSkus };
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
    const virtualWarehouse = normalizeText(virtualWarehouseName);
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
  const { headers, rows, index } = readSheetRows(getFirstWorksheet(workbook), 2);
  const required = ["allocation status", ...ALLOCATION_EXPORT_COLUMNS.map(normalizeLower)];
  const missing = required.filter((key) => index[key] == null);
  if (missing.length) throw localizedError("missingColumns", { sheet: "Order file", columns: missing.join(", ") });

  const orders = [];
  const need = new Map();
  const subTypeIndex = index["sub type"];
  const today = new Date();
  const todayParts = { year: today.getFullYear(), month: today.getMonth() + 1, day: today.getDate() };
  const cutoff = addCalendarMonths(todayParts, 3);
  for (const [orderIndex, row] of rows.entries()) {
    if (normalizeLower(row[index["allocation status"]]) !== "to be allocated") continue;
    if (subTypeIndex != null && normalizeLower(row[subTypeIndex]) === "offshore") continue;
    const sku = normalizeText(row[index.material]);
    const qty = safeFloat(row[index["ordered qty"]]);
    const crd = row[index.crd];
    const warehouseName = row[index["warehouse name"]];
    const wh = mapOrderWarehouseName(warehouseName) || "";
    const crdParts = parseDateParts(crd);
    const eligibleForDeduction = Boolean(crdParts && compareDateParts(crdParts, cutoff) <= 0);
    if (sku && qty !== 0 && !wh) {
      throw new Error(`Unknown Warehouse Name in To be allocated: ${normalizeText(warehouseName) || "(blank)"}`);
    }
    orders.push({
      SKU: sku,
      "Ordered Qty": Number(qty.toFixed(3)),
      CRD: crd,
      Model: row[index.model],
      WarehouseName: warehouseName,
      WH: wh,
      OrderIndex: orderIndex,
      EligibleForDeduction: eligibleForDeduction,
      RawRow: ALLOCATION_EXPORT_COLUMNS.map((column) => row[index[normalizeLower(column)]]),
    });
    if (sku && wh && eligibleForDeduction) addMapNumber(need, `${sku}||${wh}`, qty);
  }
  return { headers: ALLOCATION_EXPORT_COLUMNS, orders, need };
}

function makeUnmatchedMapping(reason = UNMATCHED_SKU_MARK) {
  return {
    Category: reason,
    Brand: reason,
    Family: reason,
    Size: reason,
    Model: reason,
    Connector: reason,
    CableLength: reason,
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
    Family: mapped.Family,
    Size: mapped.Size,
    Model: sourceProductModel || mapped.Model,
    Connector: mapped.Connector,
    CableLength: mapped.CableLength,
    Bin: mapped.Bin,
    MOQ: mapped.MOQ,
    Stock: stock,
    DomesticStock: domesticStock,
    ToBeAllocated: 0,
    Transit: {},
    StockTransit: {},
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
  if (isUnmatchedRecord(record)) return null;
  const productKey = `${record.SKU}||${record.Model || ""}`;
  const accessory = [record.Connector, record.CableLength].map(normalizeText).filter(Boolean).join(" + ");
  const productLabel = [record.Model, accessory].map(normalizeText).filter(Boolean).join(" | ") || record.SKU;
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
    Family: record.Family,
    Size: record.Size,
    SKU: record.SKU,
    Model: record.Model,
    Connector: record.Connector,
    CableLength: record.CableLength,
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
    Family: item.Family,
    Size: item.Size,
    Connector: item.Connector,
    CableLength: item.CableLength,
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
        StockTransit: { ...source.StockTransit },
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
      for (const [dateKey, qty] of Object.entries(source.StockTransit || {})) {
        target.StockTransit[dateKey] = safeFloat(target.StockTransit[dateKey]) + safeFloat(qty);
      }
    }
    const hasInventoryOrDsp = safeFloat(source.Stock) !== 0
      || Object.values(source.StockTransit || {}).some((qty) => safeFloat(qty) !== 0);
    if (hasInventoryOrDsp) {
      const sourceNames = normalizeText(source.VirtualWarehouse).split(" / ").map((value) => value.trim()).filter(Boolean);
      for (const sourceName of sourceNames) virtualWarehouses.get(key).add(sourceName);
    }
  }
  for (const [key, record] of grouped) {
    record.VirtualWarehouse = [...virtualWarehouses.get(key)].sort((a, b) => a.localeCompare(b)).join(" / ");
  }
  return [...grouped.values()];
}

function isUnmatchedRecord(record) {
  const markers = new Set([UNMATCHED_SKU_MARK.toLowerCase(), REMOVED_SKU_MARK.toLowerCase()]);
  return [record.Category, record.Brand, record.Family, record.Size, record.Model]
    .some((value) => markers.has(normalizeLower(value)));
}

function cloneStockRecords(records) {
  return records.map((record) => ({
    ...record,
    Transit: { ...(record.Transit || {}) },
    StockTransit: { ...(record.StockTransit || {}) },
    TransitSource: { ...(record.TransitSource || {}) },
    StatusQuantity: { ...(record.StatusQuantity || {}) },
  }));
}

function isExportInventoryRecord(record) {
  if (isUnmatchedRecord(record) || isExcludedInventoryFamily(record.Family)) return false;
  const wh = normalizeText(record.WH).toUpperCase();
  if (isPvCategory(record.Category)) return PV_STOCK_COUNTRIES.includes(wh);
  return wh !== DOMESTIC_WH && !isExcludedEssHpFamily(record.Family);
}

function applyAllocationDeductions(records, orders, dateKeys) {
  const recordsByKey = new Map();
  const initialAvailableByKey = new Map();
  for (const record of records) {
    if (!isExportInventoryRecord(record)) continue;
    const key = recordKey(record.SKU, record.WH);
    if (!recordsByKey.has(key)) recordsByKey.set(key, []);
    recordsByKey.get(key).push(record);
    const available = safeFloat(record.Stock)
      + dateKeys.reduce((sum, dateKey) => sum + safeFloat(record.StockTransit?.[dateKey]), 0);
    initialAvailableByKey.set(key, (initialAvailableByKey.get(key) || 0) + available);
  }

  const eligibleOrders = orders
    .filter((order) => order.EligibleForDeduction && safeFloat(order["Ordered Qty"]) > 0)
    .sort((a, b) => {
      const aDate = partsToDateKey(parseDateParts(a.CRD));
      const bDate = partsToDateKey(parseDateParts(b.CRD));
      return aDate.localeCompare(bDate) || safeFloat(a.OrderIndex) - safeFloat(b.OrderIndex);
    });
  const results = [];
  for (const order of eligibleOrders) {
    const key = recordKey(order.SKU, order.WH);
    if (safeFloat(initialAvailableByKey.get(key)) <= 0) continue;
    const candidates = recordsByKey.get(key) || [];
    let remaining = safeFloat(order["Ordered Qty"]);
    let stockDeducted = 0;
    let transitDeducted = 0;
    const detail = [];

    for (const record of candidates) {
      if (remaining <= 0) break;
      const available = Math.max(0, safeFloat(record.Stock));
      const deducted = Math.min(available, remaining);
      if (deducted <= 0) continue;
      record.Stock = safeFloat(record.Stock) - deducted;
      record.StatusQuantity.Inventory = Math.max(0, safeFloat(record.StatusQuantity.Inventory) - deducted);
      stockDeducted += deducted;
      remaining -= deducted;
    }
    if (stockDeducted > 0) detail.push(`Stock: ${Number(stockDeducted.toFixed(3))}`);

    for (const dateKey of dateKeys) {
      if (remaining <= 0) break;
      let dateDeducted = 0;
      for (const record of candidates) {
        if (remaining <= 0) break;
        const available = Math.max(0, safeFloat(record.StockTransit?.[dateKey]));
        const deducted = Math.min(available, remaining);
        if (deducted <= 0) continue;
        record.StockTransit[dateKey] = safeFloat(record.StockTransit[dateKey]) - deducted;
        record.StatusQuantity.DailySupplyPlan = Math.max(0, safeFloat(record.StatusQuantity.DailySupplyPlan) - deducted);
        dateDeducted += deducted;
        transitDeducted += deducted;
        remaining -= deducted;
      }
      if (dateDeducted > 0) detail.push(`${dateKeyToHeader(dateKey)}: ${Number(dateDeducted.toFixed(3))}`);
    }

    results.push({
      ...order,
      StockDeducted: Number(stockDeducted.toFixed(3)),
      TransitDeducted: Number(transitDeducted.toFixed(3)),
      DeductedQty: Number((stockDeducted + transitDeducted).toFixed(3)),
      RemainingQty: Number(Math.max(0, remaining).toFixed(3)),
      DeductionDetail: detail.join(" / "),
    });
  }
  return results;
}

function writeAllocationDeductionWorksheet(workbook, deductions) {
  const old = workbook.getWorksheet(ALLOCATION_DEDUCTION_SHEET_NAME);
  if (old) workbook.removeWorksheet(old.id);
  const ws = workbook.addWorksheet(ALLOCATION_DEDUCTION_SHEET_NAME);
  const headers = [
    ...ALLOCATION_EXPORT_COLUMNS, "WH", "Stock Deducted", "Transit Deducted", "Deducted Qty", "Remaining Qty", "Deduction Detail",
  ];
  ws.addRow(headers);
  for (const item of deductions) {
    ws.addRow([
      ...(item.RawRow || []), item.WH, item.StockDeducted, item.TransitDeducted, item.DeductedQty, item.RemainingQty, item.DeductionDetail,
    ]);
  }
  ws.getRow(1).eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9EAF7" } };
    cell.font = { bold: true };
    cell.alignment = { horizontal: "center", vertical: "middle" };
  });
  ws.autoFilter = `A1:T${Math.max(1, ws.rowCount)}`;
  ws.views = [{ state: "frozen", ySplit: 1 }];
  ws.columns.forEach((column, index) => { column.width = index === 19 ? 36 : 16; });
  return ws;
}

function writeStockWorksheet(workbook, sheetName, records, dateKeys, sourceTags, options = {}) {
  const old = workbook.getWorksheet(sheetName);
  if (old) workbook.removeWorksheet(old.id);
  const ws = workbook.addWorksheet(sheetName);
  const locationHeaders = options.includeLocation === false ? [] : ["Location"];
  const baseHeaders = options.includeTechnicalFields === false ? [
    "WH", ...locationHeaders, "Brand", "Family", "Model", "SKU", "MOQ", "Available QTY", "Stock",
  ] : [
    "WH", ...locationHeaders, "Brand", "Family", "Bin", "Model", "SKU", "Connector", "Cable Length", "MOQ",
    "Available QTY", "MW", "Stock",
  ];
  const dateHeaders = dateKeys.map(dateKeyToHeader);
  const headers = [...baseHeaders, ...dateHeaders];
  ws.addRow(headers);

  for (const record of records) {
    const stockTransit = record.StockTransit || record.Transit || {};
    const transitTotal = dateKeys.reduce((sum, dateKey) => sum + safeFloat(stockTransit[dateKey]), 0);
    const totalQty = safeFloat(record.Stock) + transitTotal;
    const pv = isPvCategory(record.Category);
    const totalMw = pv ? (totalQty * safeFloat(record.Bin)) / 1000000 : null;
    record.AvailableQTY = Number(totalQty.toFixed(3));
    record.MW = totalMw == null ? null : Number(totalMw.toFixed(3));
    if (record.AvailableQTY === 0) continue;

    const locationValues = options.includeLocation === false ? [] : [record.VirtualWarehouse || ""];
    const row = options.includeTechnicalFields === false
      ? [record.WH, ...locationValues, record.Brand, record.Family, record.Model, record.SKU, record.MOQ, record.AvailableQTY, record.Stock]
      : [record.WH, ...locationValues, record.Brand, record.Family, record.Bin, record.Model, record.SKU, record.Connector, record.CableLength,
        record.MOQ, record.AvailableQTY, record.MW, record.Stock];
    ws.addRow([...row, ...dateKeys.map((dateKey) => (stockTransit[dateKey] ? stockTransit[dateKey] : null))]);
  }
  if (options.applyTableStyle !== false) {
    ws.getRow(1).eachCell((cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9EAF7" } };
      cell.font = { bold: true, color: { argb: "FF000000" } };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border = { bottom: { style: "thin", color: { argb: "FF5B9BD5" } } };
    });
    for (let rowNumber = 2; rowNumber <= ws.rowCount; rowNumber += 1) {
      if (rowNumber % 2 !== 0) continue;
      ws.getRow(rowNumber).eachCell({ includeEmpty: true }, (cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF5FAFD" } };
      });
    }
    ws.autoFilter = `A1:${ws.getCell(Math.max(1, ws.rowCount), headers.length).address}`;
    ws.views = [{ state: "frozen", ySplit: 1 }];
    ws.columns.forEach((column, index) => {
      const header = headers[index];
      if (header === "WH") column.width = 10;
      else if (header === "Location") column.width = 26;
      else if (header === "Model") column.width = 30;
      else if (header === "SKU") column.width = 20;
      else if (header === "Connector" || header === "Cable Length") column.width = 18;
      else if (dateHeaders.includes(header)) column.width = 12;
      else column.width = 14;
    });
  }
  return ws;
}

function writeMwWorksheet(workbook, records, dateKeys) {
  const old = workbook.getWorksheet(MW_SHEET_NAME);
  if (old) workbook.removeWorksheet(old.id);

  const grouped = new Map();
  const weekOrder = [];
  const monthOrder = [];
  const seenWeeks = new Set();
  const seenMonths = new Set();

  for (const record of records) {
    const wh = normalizeText(record.WH).toUpperCase();
    if (!wh || !isPvCategory(record.Category) || isExcludedInventoryFamily(record.Family)) continue;
    const key = `${wh}||${normalizeSkuKey(record.SKU)}`;
    if (!grouped.has(key)) {
      grouped.set(key, {
        WH: wh,
        Brand: record.Brand,
        Family: record.Family,
        Bin: safeFloat(record.Bin),
        Model: record.Model,
        SKU: record.SKU,
        Connector: record.Connector,
        CableLength: record.CableLength,
        MOQ: safeFloat(record.MOQ),
        Locations: new Set(),
        StockMW: 0,
        Daily: new Map(),
        Weekly: new Map(),
        Monthly: new Map(),
      });
    }
    const summary = grouped.get(key);
    const hasInventoryOrDsp = safeFloat(record.Stock) !== 0
      || Object.values(record.StockTransit || {}).some((qty) => safeFloat(qty) !== 0);
    if (hasInventoryOrDsp) {
      for (const location of normalizeText(record.VirtualWarehouse).split(" / ").map((value) => value.trim()).filter(Boolean)) {
        summary.Locations.add(location);
      }
    }
    summary.StockMW += (safeFloat(record.Stock) * safeFloat(record.Bin)) / 1000000;
    for (const dateKey of dateKeys) {
      const qty = safeFloat(record.StockTransit?.[dateKey]);
      if (qty === 0) continue;
      const arrivalMw = (qty * safeFloat(record.Bin)) / 1000000;
      const dateHeader = dateKeyToHeader(dateKey);
      const week = isoWeekLabel(dateKey);
      const month = monthLabel(dateKey);
      summary.Daily.set(dateHeader, (summary.Daily.get(dateHeader) || 0) + arrivalMw);
      summary.Weekly.set(week, (summary.Weekly.get(week) || 0) + arrivalMw);
      summary.Monthly.set(month, (summary.Monthly.get(month) || 0) + arrivalMw);
      if (!seenWeeks.has(week)) { seenWeeks.add(week); weekOrder.push(week); }
      if (!seenMonths.has(month)) { seenMonths.add(month); monthOrder.push(month); }
    }
  }

  weekOrder.sort();
  monthOrder.sort();
  const ws = workbook.addWorksheet(MW_SHEET_NAME);
  const headers = [
    "WH", "Location", "Brand", "Family", "Bin", "Model", "SKU", "Connector", "Cable Length", "MOQ", "Total MW", "Stock MW",
    ...dateKeys.map(dateKeyToHeader),
    ...weekOrder,
    ...monthOrder,
  ];
  ws.addRow(headers);
  for (const summary of [...grouped.values()].sort((a, b) => `${a.WH}||${a.SKU}`.localeCompare(`${b.WH}||${b.SKU}`))) {
    const transitMw = [...summary.Daily.values()].reduce((sum, value) => sum + safeFloat(value), 0);
    const totalMw = summary.StockMW + transitMw;
    const displayedTotalMw = Number(totalMw.toFixed(3));
    if (displayedTotalMw === 0) continue;
    ws.addRow([
      summary.WH, [...summary.Locations].sort((a, b) => a.localeCompare(b)).join(" / "), summary.Brand, summary.Family, summary.Bin, summary.Model, summary.SKU, summary.Connector, summary.CableLength, summary.MOQ,
      displayedTotalMw,
      Number(summary.StockMW.toFixed(3)),
      ...dateKeys.map((dateKey) => Number((summary.Daily.get(dateKeyToHeader(dateKey)) || 0).toFixed(3))),
      ...weekOrder.map((period) => Number((summary.Weekly.get(period) || 0).toFixed(3))),
      ...monthOrder.map((period) => Number((summary.Monthly.get(period) || 0).toFixed(3))),
    ]);
  }
  return { ws, grouped, monthOrder };
}

function writeBrandMwWorksheet(workbook, mwGroups, monthOrder, brandName, sheetName) {
  const old = workbook.getWorksheet(sheetName);
  if (old) workbook.removeWorksheet(old.id);

  const detailGroups = new Map();
  const addSummary = (target, key, fields, source) => {
    if (!target.has(key)) {
      target.set(key, { ...fields, StockMW: 0, TotalMW: 0, Monthly: new Map() });
    }
    const item = target.get(key);
    item.StockMW += safeFloat(source.StockMW);
    item.TotalMW += safeFloat(source.StockMW)
      + [...source.Daily.values()].reduce((sum, value) => sum + safeFloat(value), 0);
    for (const month of monthOrder) {
      item.Monthly.set(month, (item.Monthly.get(month) || 0) + safeFloat(source.Monthly.get(month)));
    }
  };

  for (const summary of mwGroups.values()) {
    if (normalizeText(summary.Brand).toUpperCase() !== brandName.toUpperCase()) continue;
    const totalMw = safeFloat(summary.StockMW)
      + [...summary.Daily.values()].reduce((sum, value) => sum + safeFloat(value), 0);
    if (Number(totalMw.toFixed(3)) === 0) continue;
    const detailFields = {
      WH: summary.WH,
      Model: summary.Model,
      Connector: summary.Connector,
      CableLength: summary.CableLength,
    };
    addSummary(
      detailGroups,
      [detailFields.WH, detailFields.Model, detailFields.Connector, detailFields.CableLength].map(normalizeText).join("\u0000"),
      detailFields,
      summary,
    );
  }

  const ws = workbook.addWorksheet(sheetName);
  const detailHeaders = ["WH", "Model", "Connector", "Cable Length", "Stock MW", ...monthOrder, "Total MW"];
  const sortByFields = (fields) => (a, b) => fields
    .map((field) => normalizeText(a[field]).localeCompare(normalizeText(b[field])))
    .find((value) => value !== 0) || 0;
  const numericValues = (item) => [
    Number(item.StockMW.toFixed(3)),
    ...monthOrder.map((month) => Number((item.Monthly.get(month) || 0).toFixed(3))),
    Number(item.TotalMW.toFixed(3)),
  ];

  ws.addRow([`${brandName} MW Detail`]);
  const detailHeaderRow = ws.addRow(detailHeaders);
  const subtotalRows = [];
  const byWarehouse = new Map();
  for (const item of [...detailGroups.values()].sort(sortByFields(["WH", "Model", "Connector", "CableLength"]))) {
    if (!byWarehouse.has(item.WH)) byWarehouse.set(item.WH, []);
    byWarehouse.get(item.WH).push(item);
  }
  const sortedWarehouses = [...byWarehouse.entries()].sort((a, b) => {
    const totalA = a[1].reduce((sum, item) => sum + safeFloat(item.TotalMW), 0);
    const totalB = b[1].reduce((sum, item) => sum + safeFloat(item.TotalMW), 0);
    return totalB - totalA || a[0].localeCompare(b[0]);
  });
  const grandTotal = { StockMW: 0, TotalMW: 0, Monthly: new Map() };
  for (const [wh, items] of sortedWarehouses) {
    const subtotal = { StockMW: 0, TotalMW: 0, Monthly: new Map() };
    for (const item of items) {
      ws.addRow([item.WH, item.Model, item.Connector, item.CableLength, ...numericValues(item)]);
      subtotal.StockMW += Number(item.StockMW.toFixed(3));
      subtotal.TotalMW += Number(item.TotalMW.toFixed(3));
      for (const month of monthOrder) {
        subtotal.Monthly.set(month, (subtotal.Monthly.get(month) || 0) + Number(safeFloat(item.Monthly.get(month)).toFixed(3)));
      }
    }
    subtotalRows.push(ws.addRow([`${wh} Total`, "", "", "", ...numericValues(subtotal)]));
    grandTotal.StockMW += Number(subtotal.StockMW.toFixed(3));
    grandTotal.TotalMW += Number(subtotal.TotalMW.toFixed(3));
    for (const month of monthOrder) {
      grandTotal.Monthly.set(month, (grandTotal.Monthly.get(month) || 0) + Number(safeFloat(subtotal.Monthly.get(month)).toFixed(3)));
    }
  }
  const grandTotalRow = ws.addRow(["All WH Total", "", "", "", ...numericValues(grandTotal)]);

  const styleHeader = (row) => {
    row.eachCell((cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9EAF7" } };
      cell.font = { bold: true, color: { argb: "FF000000" } };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border = { bottom: { style: "thin", color: { argb: "FF5B9BD5" } } };
    });
  };
  styleHeader(detailHeaderRow);
  ws.getCell(1, 1).font = { bold: true, size: 13, color: { argb: "FF1F4E78" } };
  for (const row of subtotalRows) {
    row.eachCell((cell) => {
      cell.font = { bold: true };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEAF2F8" } };
      cell.border = { top: { style: "thin", color: { argb: "FF5B9BD5" } } };
    });
  }
  grandTotalRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FF1F1F1F" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFB4C7E7" } };
    cell.border = { top: { style: "medium", color: { argb: "FF4472C4" } } };
  });
  for (let rowNumber = 3; rowNumber <= ws.rowCount; rowNumber += 1) {
    const row = ws.getRow(rowNumber);
    for (let column = 5; column <= row.cellCount; column += 1) {
      row.getCell(column).numFmt = "0.000";
    }
  }
  ws.columns.forEach((column, index) => {
    if (index === 0) column.width = 14;
    else if (index === 1) column.width = 30;
    else if (index === 2 || index === 3) column.width = 18;
    else column.width = 13;
  });
  ws.autoFilter = `A2:${ws.getCell(ws.rowCount, detailHeaders.length).address}`;
  ws.views = [{ state: "frozen", ySplit: 2 }];
  return ws;
}

function writeAllocationWorksheet(workbook, headers, orders) {
  const old = workbook.getWorksheet(ALLOC_SHEET_NAME);
  if (old) workbook.removeWorksheet(old.id);
  const ws = workbook.addWorksheet(ALLOC_SHEET_NAME);
  ws.addRow(headers?.length ? headers : ["No order source"]);
  for (const order of orders) {
    if (safeFloat(order["Ordered Qty"]) === 0) continue;
    ws.addRow(order.RawRow || []);
  }
  return ws;
}

function writeTransitSourceWorksheet(workbook, transitSourceTag, dailyTransitQty, odpTransitQty, skuLookup) {
  const old = workbook.getWorksheet(TRANSIT_SOURCE_SHEET_NAME);
  if (old) workbook.removeWorksheet(old.id);
  const ws = workbook.addWorksheet(TRANSIT_SOURCE_SHEET_NAME);
  ws.addRow(["SKU", "WH", "Category", "Model", "Date", "Source", "Daily Supply Plan Qty", "ODP Qty"]);
  const sourceKeys = new Set([...transitSourceTag.keys(), ...dailyTransitQty.keys(), ...odpTransitQty.keys()]);
  for (const key of [...sourceKeys].sort((a, b) => a.localeCompare(b))) {
    const [sku, wh, virtualWarehouse, category, productModel, dateKey] = splitTransitRecordKey(key);
    const mapped = skuLookup.get(normalizeSkuKey(sku));
    const resolvedCategory = category || normalizeText(mapped?.Category);
    const resolvedProductModel = productModel || normalizeText(mapped?.Model);
    ws.addRow([
      sku,
      wh,
      resolvedCategory,
      resolvedProductModel,
      dateKeyToHeader(dateKey),
      transitSourceTag.get(key) || SOURCE_INV_DSP,
      safeFloat(dailyTransitQty.get(key)),
      safeFloat(odpTransitQty.get(key)),
    ]);
  }
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
  const { lookup: skuLookup, sheetName: skuSheetName, removedSkus } = buildSkuLookup(templateWorkbook);
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
  const allocationData = orderWorkbook ? extractAllocatedOrders(orderWorkbook) : { headers: [], orders: [], need: new Map() };

  const activeSkuKeys = new Set();
  for (const row of inventoryRows) if (safeFloat(row.Stock) !== 0) activeSkuKeys.add(normalizeSkuKey(row.SKU));
  for (const [key, qty] of transitQty) if (safeFloat(qty) !== 0) activeSkuKeys.add(normalizeSkuKey(splitTransitRecordKey(key)[0]));
  for (const [sku, qty] of domesticQty) if (safeFloat(qty) !== 0) activeSkuKeys.add(normalizeSkuKey(sku));

  const records = [];
  const rowByKey = new Map();
  const transitRowByKey = new Map();
  const markedRows = [];
  const resolve = (sku) => {
    const skuKey = normalizeSkuKey(sku);
    if (removedSkus.has(skuKey)) return { mapped: makeUnmatchedMapping(REMOVED_SKU_MARK), unmatched: true, reason: REMOVED_SKU_MARK };
    const mapped = skuLookup.get(skuKey);
    return mapped ? { mapped, unmatched: false, reason: "" } : { mapped: makeUnmatchedMapping(), unmatched: true, reason: UNMATCHED_SKU_MARK };
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
    const { mapped, unmatched, reason } = resolve(item.SKU);
    if (unmatched) markedRows.push({ SKU: item.SKU, WH: item.WH, Reason: reason });
    appendRecord(item.WH, item.SKU, mapped, item.Stock, 0, item.VirtualWarehouse, item.Category, item.ProductModel);
  }
  for (const [sku, qty] of domesticQty) {
    if (!safeFloat(qty)) continue;
    const rowKey = recordKey(sku, DOMESTIC_WH);
    let record = rowByKey.get(rowKey);
    if (!record) {
      const { mapped, unmatched, reason } = resolve(sku);
      if (unmatched) markedRows.push({ SKU: sku, WH: DOMESTIC_WH, Reason: reason });
      record = appendRecord(DOMESTIC_WH, sku, mapped, 0, 0);
    }
    record.DomesticStock += safeFloat(qty);
  }
  for (const [key, qty] of transitQty) {
    if (!safeFloat(qty)) continue;
    const [sku, wh, virtualWarehouse, sourceCategory, sourceProductModel, dateKey] = splitTransitRecordKey(key);
    if (!activeSkuKeys.has(normalizeSkuKey(sku))) continue;
    const { mapped, unmatched, reason } = resolve(sku);
    const category = sourceCategory || mapped.Category;
    const productModel = sourceProductModel || mapped.Model;
    const rowKey = [sku, wh, virtualWarehouse, category, productModel].join("\u0000");
    let record = transitRowByKey.get(rowKey);
    if (!record) {
      if (unmatched) markedRows.push({ SKU: sku, WH: wh, Reason: reason });
      record = appendRecord(wh, sku, mapped, 0, 0, virtualWarehouse, category, productModel);
      transitRowByKey.set(rowKey, record);
    }
    record.Transit[dateKey] = (record.Transit[dateKey] || 0) + qty;
    record.TransitSource[dateKey] = mergeSourceTag(record.TransitSource[dateKey], transitSourceTag.get(key) || SOURCE_INV_DSP);
    const dailyQty = safeFloat(dailyTransitQty.get(key));
    const odpQty = safeFloat(odpTransitQty.get(key));
    if (dailyQty !== 0) record.StockTransit[dateKey] = (record.StockTransit[dateKey] || 0) + dailyQty;
    record.StatusQuantity.DailySupplyPlan += dailyQty;
    record.StatusQuantity.ODP += odpQty;
  }
  for (const record of records) {
    record.ToBeAllocated = normalizeText(record.VirtualWarehouse)
      ? 0
      : safeFloat(allocationData.need.get(recordKey(record.SKU, record.WH)) || 0);
  }
  const visualization = buildVisualizationPayload(records, dateKeys, allocationData.orders, normalizedStockMode, domesticDetails);
  const exportRecords = cloneStockRecords(records);
  const allocationDeductions = applyAllocationDeductions(exportRecords, allocationData.orders, dateKeys);

  const dateSourceTags = {};
  for (const record of exportRecords) {
    for (const dateKey of dateKeys) {
      if (!safeFloat(record.Transit[dateKey])) continue;
      const source = record.TransitSource[dateKey] || SOURCE_INV_DSP;
      const header = dateKeyToHeader(dateKey);
      dateSourceTags[header] = mergeSourceTag(dateSourceTags[header], source);
    }
  }

  for (const obsoleteName of [
    "stock", "PV Stock", UNMATCHED_SHEET_NAME, ...STOCK_SHEET_NAMES,
    ...PV_STOCK_COUNTRIES.map((country) => `PV Stock ${country}`), MW_SHEET_NAME, "MW Summary",
    SUNPOWER_MW_SHEET_NAME, TCL_MW_SHEET_NAME, ALLOCATION_DEDUCTION_SHEET_NAME,
  ]) {
    const obsoleteStock = templateWorkbook.getWorksheet(obsoleteName);
    if (obsoleteStock) templateWorkbook.removeWorksheet(obsoleteStock.id);
  }
  const matchedRecords = exportRecords.filter((record) => !isUnmatchedRecord(record));
  const unmatchedRecords = exportRecords.filter(isUnmatchedRecord);
  for (const country of PV_STOCK_COUNTRIES) {
    const countryRecords = matchedRecords.filter((record) => isPvCategory(record.Category)
      && normalizeText(record.WH).toUpperCase() === country
      && !isExcludedInventoryFamily(record.Family));
    writeStockWorksheet(templateWorkbook, `${country}_PV`, aggregateRecordsBySku(countryRecords), dateKeys, dateSourceTags);
  }
  writeStockWorksheet(
    templateWorkbook,
    "ESS+HP Stock",
    matchedRecords.filter((record) => !isPvCategory(record.Category)
      && normalizeText(record.WH).toUpperCase() !== DOMESTIC_WH
      && !isExcludedEssHpFamily(record.Family)),
    dateKeys,
    dateSourceTags,
    { includeTechnicalFields: false },
  );
  const mwResult = writeMwWorksheet(templateWorkbook, matchedRecords, dateKeys);
  writeBrandMwWorksheet(templateWorkbook, mwResult.grouped, mwResult.monthOrder, "SunPower", SUNPOWER_MW_SHEET_NAME);
  writeBrandMwWorksheet(templateWorkbook, mwResult.grouped, mwResult.monthOrder, "TCL", TCL_MW_SHEET_NAME);
  writeStockWorksheet(templateWorkbook, UNMATCHED_SHEET_NAME, unmatchedRecords, dateKeys, dateSourceTags, {
    includeLocation: false,
    applyTableStyle: false,
  });
  writeAllocationWorksheet(templateWorkbook, allocationData.headers, allocationData.orders);
  writeAllocationDeductionWorksheet(templateWorkbook, allocationDeductions);
  writeTransitSourceWorksheet(templateWorkbook, transitSourceTag, dailyTransitQty, odpTransitQty, skuLookup);
  const obsoleteDomestic = templateWorkbook.getWorksheet("Domestic Stock");
  if (obsoleteDomestic) templateWorkbook.removeWorksheet(obsoleteDomestic.id);
  writeDomesticStockWorksheet(templateWorkbook, DOMESTIC_DETAIL_SHEET_NAMES[0], []);
  writeDomesticStockWorksheet(templateWorkbook, DOMESTIC_DETAIL_SHEET_NAMES[1], []);
  for (const mappingSheetName of ["Legacy Mapping Product", "SKU", "SKU Mapping", "Remove-list"]) {
    const mappingSheet = getWorksheetByNameInsensitive(templateWorkbook, mappingSheetName);
    if (mappingSheet) templateWorkbook.removeWorksheet(mappingSheet.id);
  }
  const outputBytes = await templateWorkbook.xlsx.writeBuffer();

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
