(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.ForecastSalesCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const REGIONS = Object.freeze([
    "Benelux Region",
    "Central and Eastern Europe Region",
    "DACH Region",
    "France and Switzerland Region",
    "Italy Region",
    "Nordics Region",
    "Southern Europe Region",
    "UK Region",
  ]);

  const REGION_ALIASES = Object.freeze({
    "Italy & Adriatics Region": "Italy Region",
    "Germany & Austria Region": "DACH Region",
    "Emerging Market": "Central and Eastern Europe Region",
    "lberia Region": "Southern Europe Region",
  });

  const MANUAL_REGION_CUSTOMERS = new Set(["SOLARMARKT", "SOLEXIS"]);
  const STAGE_LABELS = Object.freeze({
    1: "1 - Lead qualification",
    2: "2 - Initial offer",
    3: "3 - Negotiation",
    4: "4 - BAFO",
    5: "5 - Finalize contract",
    6: "6 - Won",
    7: "7 - Booked",
  });

  function cleanText(value) {
    return value == null ? "" : String(value).trim();
  }

  function upper(value) {
    return cleanText(value).toUpperCase().replace(/\s+/g, " ");
  }

  function toNumber(value) {
    if (value == null || value === "") return null;
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    const parsed = Number(String(value).replace(/,/g, "").trim());
    return Number.isFinite(parsed) ? parsed : null;
  }

  function rowValue(row, aliases) {
    for (const alias of aliases) {
      if (Object.prototype.hasOwnProperty.call(row, alias)) return row[alias];
    }
    const normalized = new Map(Object.entries(row || {}).map(([key, value]) => [String(key).trim().toLowerCase(), value]));
    for (const alias of aliases) {
      const value = normalized.get(String(alias).toLowerCase());
      if (value !== undefined) return value;
    }
    return null;
  }

  function normalizeMonth(value) {
    if (value == null || value === "") return null;
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}`;
    }
    if (typeof value === "number" && typeof XLSX !== "undefined" && XLSX.SSF?.parse_date_code) {
      const parsed = XLSX.SSF.parse_date_code(value);
      if (parsed) return `${parsed.y}-${String(parsed.m).padStart(2, "0")}`;
    }
    const text = cleanText(value);
    let match = text.match(/^(\d{4})[-/.](\d{1,2})/);
    if (match) return `${match[1]}-${String(Number(match[2])).padStart(2, "0")}`;
    match = text.match(/^(\d{2})M(\d{1,2})$/i);
    if (match) return `20${match[1]}-${String(Number(match[2])).padStart(2, "0")}`;
    return null;
  }

  function monthIndex(value) {
    const month = normalizeMonth(value);
    if (!month) return null;
    const [year, number] = month.split("-").map(Number);
    return year * 12 + number - 1;
  }

  function addMonths(value, offset) {
    const index = monthIndex(value);
    if (index == null) return null;
    const next = index + Number(offset || 0);
    return `${Math.floor(next / 12)}-${String(next % 12 + 1).padStart(2, "0")}`;
  }

  function currentMonthKey(now = new Date()) {
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }

  function isCompleteMonth(month, now = new Date()) {
    return monthIndex(month) < monthIndex(currentMonthKey(now));
  }

  function monthRange(start, end) {
    const result = [];
    let cursor = normalizeMonth(start);
    const last = monthIndex(end);
    while (cursor && monthIndex(cursor) <= last && result.length < 240) {
      result.push(cursor);
      cursor = addMonths(cursor, 1);
    }
    return result;
  }

  function normalizeRegion(value, customer) {
    const raw = cleanText(value);
    if ((!raw || raw === "#N/A") && MANUAL_REGION_CUSTOMERS.has(upper(customer))) {
      return { region: "France and Switzerland Region", manual: true, supported: true };
    }
    const region = REGION_ALIASES[raw] || raw;
    return { region, manual: false, supported: REGIONS.includes(region) };
  }

  function normalizeStage(value) {
    const raw = cleanText(value);
    if (!raw) return "Unspecified";
    const match = raw.match(/^([1-7])\s*-/);
    return match ? STAGE_LABELS[Number(match[1])] : raw;
  }

  function brandFrom(row, source, model) {
    const explicit = upper(rowValue(row, ["Brand"]));
    if (source === "actual") {
      if (explicit.includes("SUNPOWER")) return "SunPower";
      if (explicit === "TCL" || explicit.startsWith("TCL ")) return "TCL";
    }
    if (/^(SPR-|P7-|MAX)/.test(model)) return "SunPower";
    if (/^(HSM-|TCL-|S4-)/.test(model)) return "TCL";
    if (explicit.includes("SUNPOWER")) return "SunPower";
    if (explicit === "TCL" || explicit.startsWith("TCL ")) return "TCL";
    const line = upper(rowValue(row, ["Product Line"]));
    if (line.startsWith("SPR_") || line.includes("P7") || line.includes("MAX")) return "SunPower";
    if (line.startsWith("TCL_")) return "TCL";
    return source === "forecast" ? "Unknown" : (cleanText(rowValue(row, ["Brand"])) || "Unknown");
  }

  function suffixCfp(text) {
    return /CFP/.test(text) ? " · CFP" : "";
  }

  function readableFallback(value) {
    return cleanText(value).replace(/[_]+/g, " ").replace(/\s+/g, " ");
  }

  function classifyPvProduct(row, source) {
    const model = upper(rowValue(row, ["Model", "Model name"]));
    const anaplan = upper(rowValue(row, ["Anaplan PL5"]));
    const conso = upper(rowValue(row, ["Product Conso"]));
    const family = upper(rowValue(row, ["Product Family"]));
    const combined = `${model} ${anaplan} ${conso} ${family}`;
    const brand = brandFrom(row, source, model);
    const cfp = suffixCfp(combined);

    if (/P7/.test(combined)) {
      if (/COM/.test(model) || (!/P7/.test(model) && /COM/.test(combined))) return `SunPower · P7 COM S BF${cfp}`;
      if (/BLK[- ]?P/.test(model)) return "SunPower · P7 RES BLK-P";
      if (/P7/.test(model) && /BLK/.test(model)) return "SunPower · P7 RES BLK 2.0";
      if (/BLK[- ]?P/.test(combined)) return "SunPower · P7 RES BLK-P";
      if (/BLK|P7 RES/.test(combined)) return "SunPower · P7 RES BLK 2.0";
    }

    const cellCode = model.match(/(?:HSM|SPR)[- ]?(NT|ND|BE|BD)(48|54|60|66|72|78)[- ]?([A-Z]{2})/);
    if (cellCode) return `${brand} · ${cellCode[1]}${cellCode[2]}-${cellCode[3]}${cfp}`;

    const tclSeries = model.match(/(?:TCL-)?(MR|MI|MG)\d{3}DT(\d+)-(\d+NS)/);
    if (tclSeries) return `TCL · ${tclSeries[1]}-DT${tclSeries[2]}-${tclSeries[3]}${cfp}`;

    const nmSeries = model.match(/HSM-([A-Z]{3})-NM\d+/);
    if (nmSeries) return `TCL · ${nmSeries[1]}-NM${cfp}`;

    const s4Series = model.match(/S4-DG\d+-(\d+BC)-([A-Z]+)/);
    if (s4Series) return `TCL · S4-DG-${s4Series[1]}-${s4Series[2]}${cfp}`;

    if (/^SPR-P6-/.test(model)) {
      const application = /COM/.test(combined) ? "COM" : "RES";
      const ac = /AC/.test(combined) ? " AC" : "";
      return `SunPower · P6 ${application}${ac}`;
    }

    if (/^(SPR-)?MAX/.test(model) || /MAX/.test(anaplan)) {
      const stable = readableFallback(rowValue(row, ["Anaplan PL5"])) || readableFallback(rowValue(row, ["Product Family"])) || "MAX";
      return `SunPower · ${stable}`;
    }

    if (/^SPR-(E\d+|X\d+)-/.test(model)) {
      const stable = readableFallback(rowValue(row, ["Anaplan PL5"])) || model.replace(/-\d{3}$/, "");
      return `SunPower · ${stable}`;
    }

    if (conso && conso !== "EXCLUDE") return `${brand} · ${readableFallback(rowValue(row, ["Product Conso"]))}${cfp}`;
    if (anaplan) return `${brand} · ${readableFallback(rowValue(row, ["Anaplan PL5"]))}${cfp}`;
    return `Unmapped · ${cleanText(rowValue(row, ["Model", "Model name"])) || "Unknown"}`;
  }

  function forecastMonthHeaders(rawRows) {
    const keys = new Set();
    rawRows.slice(0, 20).forEach((row) => Object.keys(row || {}).forEach((key) => {
      if (/^\d{2}M\d{2}$/i.test(cleanText(key))) keys.add(cleanText(key).toUpperCase());
    }));
    return [...keys].sort((a, b) => monthIndex(a) - monthIndex(b));
  }

  function normalizeForecastRows(rawRows) {
    const monthHeaders = forecastMonthHeaders(rawRows);
    const records = [];
    const mappings = new Map();
    const quality = { sourceRows: rawRows.length, pvRows: 0, excludedNonPv: 0, outsideScope: 0, manualRegionRows: 0, unmappedRows: 0, invalidValues: 0 };
    rawRows.forEach((row, index) => {
      if (upper(rowValue(row, ["Product Category"])) !== "PV") { quality.excludedNonPv += 1; return; }
      quality.pvRows += 1;
      const customer = cleanText(rowValue(row, ["Customer name"]));
      const regionInfo = normalizeRegion(rowValue(row, ["Region"]), customer);
      if (!regionInfo.supported) { quality.outsideScope += 1; return; }
      if (regionInfo.manual) quality.manualRegionRows += 1;
      const sourceModel = cleanText(rowValue(row, ["Model name"]));
      const stage = normalizeStage(rowValue(row, ["Stage"]));
      const product = classifyPvProduct(row, "forecast");
      if (product.startsWith("Unmapped")) quality.unmappedRows += 1;
      mappings.set(`forecast|${sourceModel}|${product}`, { source: "FCST", sourceModel, product });
      monthHeaders.forEach((header) => {
        const mw = toNumber(rowValue(row, [header]));
        if (mw == null) {
          const raw = rowValue(row, [header]);
          if (raw != null && cleanText(raw)) quality.invalidValues += 1;
          return;
        }
        if (mw === 0) return;
        records.push({ sourceRow: index + 2, month: normalizeMonth(header), region: regionInfo.region, product, sourceModel, stage, mw });
      });
    });
    return { records, months: monthHeaders.map(normalizeMonth), mappings: [...mappings.values()], quality };
  }

  function normalizeActualRows(rawRows) {
    const records = [];
    const mappings = new Map();
    const quality = { sourceRows: rawRows.length, pvRows: 0, excludedNonPv: 0, outsideScope: 0, unmappedRows: 0, invalidRows: 0 };
    rawRows.forEach((row, index) => {
      if (upper(rowValue(row, ["Category"])) !== "PV") { quality.excludedNonPv += 1; return; }
      quality.pvRows += 1;
      const regionInfo = normalizeRegion(rowValue(row, ["Region"]), rowValue(row, ["Customer Level 6 NAME"]));
      if (!regionInfo.supported) { quality.outsideScope += 1; return; }
      const month = normalizeMonth(rowValue(row, ["Month"]));
      const mw = toNumber(rowValue(row, ["Total MW"]));
      const status = upper(rowValue(row, ["Order Status2"])).toLowerCase();
      if (!month || mw == null || !["invoiced", "confirm"].includes(status)) { quality.invalidRows += 1; return; }
      const sourceModel = cleanText(rowValue(row, ["Model"]));
      const product = classifyPvProduct(row, "actual");
      if (product.startsWith("Unmapped")) quality.unmappedRows += 1;
      mappings.set(`actual|${sourceModel}|${product}`, { source: "Sales", sourceModel, product });
      records.push({ sourceRow: index + 2, month, region: regionInfo.region, product, sourceModel, status, mw });
    });
    return { records, mappings: [...mappings.values()], quality };
  }

  function matchesScope(row, region, product) {
    return (!region || region === "__ALL__" || row.region === region) && (!product || product === "__ALL__" || row.product === product);
  }

  function aggregate(records, options, valueSelector) {
    const result = new Map();
    records.forEach((row) => {
      if (!matchesScope(row, options.region, options.product)) return;
      const value = valueSelector(row);
      if (!value) return;
      result.set(row.month, (result.get(row.month) || 0) + value);
    });
    return result;
  }

  function matchesForecastStage(row, stages) {
    return !Array.isArray(stages) || stages.includes(row.stage);
  }

  function clamp(value, low, high) {
    return Math.max(low, Math.min(high, value));
  }

  function summarize(data, options = {}) {
    const now = options.now || new Date();
    const region = options.region || "__ALL__";
    const product = options.product || "__ALL__";
    const allMonths = data.months;
    const startMonth = normalizeMonth(options.startMonth) || allMonths[0];
    const endMonth = normalizeMonth(options.endMonth) || allMonths.at(-1);
    const months = monthRange(startMonth, endMonth);
    const forecast = aggregate(data.forecastRecords, { region, product }, (row) => matchesForecastStage(row, options.stages) ? row.mw : 0);
    const invoiced = aggregate(data.actualRecords, { region, product }, (row) => row.status === "invoiced" ? row.mw : 0);
    const confirm = aggregate(data.actualRecords, { region, product }, (row) => row.status === "confirm" ? row.mw : 0);
    const forecastMonthSet = new Set(data.forecastMonths);
    const monthly = months.map((month) => ({
      month,
      forecast: forecast.get(month) || 0,
      actual: invoiced.get(month) || 0,
      confirm: confirm.get(month) || 0,
      complete: isCompleteMonth(month, now),
      forecastCovered: forecastMonthSet.has(month),
    })).map((row) => ({ ...row, variance: row.forecast - row.actual }));
    const comparable = monthly.filter((row) => row.complete && row.forecastCovered);
    const actualTotal = comparable.reduce((sum, row) => sum + row.actual, 0);
    const forecastTotal = comparable.reduce((sum, row) => sum + row.forecast, 0);
    const absoluteError = comparable.reduce((sum, row) => sum + Math.abs(row.variance), 0);
    const wape = actualTotal === 0 ? null : absoluteError / Math.abs(actualTotal);
    const accuracy = wape == null ? null : Math.max(0, 1 - wape);
    const bias = actualTotal === 0 ? null : (forecastTotal - actualTotal) / Math.abs(actualTotal);

    const completeActualMonths = data.actualMonths.filter((month) => isCompleteMonth(month, now));
    const velocityEnd = completeActualMonths.at(-1) || addMonths(currentMonthKey(now), -1);
    const window = Math.max(1, Number(options.velocityWindow || 3));
    const velocityMonths = Array.from({ length: window }, (_, i) => addMonths(velocityEnd, i - window + 1));
    const velocityValues = velocityMonths.map((month) => invoiced.get(month) || 0);
    const runRate = velocityValues.reduce((sum, value) => sum + value, 0) / window;
    const priorMonths = velocityMonths.map((month) => addMonths(month, -window));
    const priorRate = priorMonths.reduce((sum, month) => sum + (invoiced.get(month) || 0), 0) / window;
    const trend = priorRate === 0 ? null : runRate / priorRate - 1;
    const latestThree = [addMonths(velocityEnd, -2), addMonths(velocityEnd, -1), velocityEnd];
    const weightedActualRate = latestThree.reduce((sum, month, index) => sum + (invoiced.get(month) || 0) * [0.2, 0.3, 0.5][index], 0);
    const futureMonths = [currentMonthKey(now), addMonths(currentMonthKey(now), 1), addMonths(currentMonthKey(now), 2)];
    const futureForecastRate = futureMonths.reduce((sum, month) => sum + (forecast.get(month) || 0), 0) / futureMonths.length;
    const correction = forecastTotal > 0 && actualTotal > 0 ? clamp(actualTotal / forecastTotal, 0.5, 1.5) : 1;
    const reliability = accuracy == null ? 0 : accuracy * Math.min(1, comparable.length / 3);
    const adjustedForecastRate = futureForecastRate * correction;
    const suggestedDemandRate = futureForecastRate || weightedActualRate
      ? reliability * adjustedForecastRate + (1 - reliability) * weightedActualRate
      : null;
    return {
      region, product, startMonth, endMonth, monthly, comparable, actualTotal, forecastTotal,
      absoluteError, wape, accuracy, bias, velocityMonths, runRate, priorRate, trend,
      weightedActualRate, futureMonths, futureForecastRate, correction, reliability,
      adjustedForecastRate, suggestedDemandRate,
    };
  }

  function prepare(forecastRawRows, actualRawRows, now = new Date()) {
    const forecast = normalizeForecastRows(forecastRawRows);
    const actual = normalizeActualRows(actualRawRows);
    const forecastProductSet = new Set(forecast.mappings.map((row) => row.product));
    const scopedActualRecords = actual.records.filter((row) => forecastProductSet.has(row.product));
    const scopedActualMappings = actual.mappings.filter((row) => forecastProductSet.has(row.product));
    actual.quality.excludedEolRows = actual.records.length - scopedActualRecords.length;
    actual.quality.unmappedRows = scopedActualRecords.filter((row) => row.product.startsWith("Unmapped")).length;
    const actualMonths = [...new Set(scopedActualRecords.map((row) => row.month))].sort();
    const months = [...new Set([...forecast.months, ...actualMonths])].sort();
    const products = [...forecastProductSet].sort();
    const stages = [...new Set(forecast.records.map((row) => row.stage))].sort((a, b) => {
      const ai = Number(a.match(/^\d+/)?.[0] || 99), bi = Number(b.match(/^\d+/)?.[0] || 99);
      return ai - bi || a.localeCompare(b);
    });
    return {
      forecastRecords: forecast.records,
      actualRecords: scopedActualRecords,
      forecastMonths: forecast.months,
      actualMonths,
      months,
      regions: [...REGIONS],
      products,
      stages,
      mappings: [...forecast.mappings, ...scopedActualMappings],
      quality: { forecast: forecast.quality, actual: actual.quality },
      now,
    };
  }

  function futureComparison(data, options = {}) {
    const now = options.now || new Date();
    const current = currentMonthKey(now);
    let monthSet;
    if (Array.isArray(options.months)) {
      monthSet = new Set(options.months.map(normalizeMonth).filter((month) => month && monthIndex(month) >= monthIndex(current)));
    } else {
      const requestedStart = normalizeMonth(options.startMonth) || current;
      const startMonth = monthIndex(requestedStart) < monthIndex(current) ? current : requestedStart;
      const endMonth = normalizeMonth(options.endMonth) || data.forecastMonths.at(-1) || current;
      if (monthIndex(startMonth) > monthIndex(endMonth)) return [];
      monthSet = new Set(monthRange(startMonth, endMonth));
    }
    const regionSet = Array.isArray(options.regions) ? new Set(options.regions) : null;
    const productSet = Array.isArray(options.products) ? new Set(options.products) : null;
    const region = options.region || "__ALL__";
    const product = options.product || "__ALL__";
    const rows = new Map();
    const matchesFutureScope = (row) => monthSet.has(row.month)
      && (!regionSet || regionSet.has(row.region))
      && (!productSet || productSet.has(row.product))
      && matchesScope(row, regionSet ? "__ALL__" : region, productSet ? "__ALL__" : product);
    const entryFor = (row) => {
      const key = `${row.month}|${row.region}|${row.product}`;
      if (!rows.has(key)) rows.set(key, { month:row.month, region:row.region, product:row.product, forecast:0, actual:0, confirm:0 });
      return rows.get(key);
    };
    data.forecastRecords.forEach((row) => {
      if (!matchesFutureScope(row) || !matchesForecastStage(row, options.stages)) return;
      entryFor(row).forecast += row.mw;
    });
    data.actualRecords.forEach((row) => {
      if (!matchesFutureScope(row)) return;
      const entry = entryFor(row);
      if (row.status === "invoiced") entry.actual += row.mw;
      if (row.status === "confirm") entry.confirm += row.mw;
    });
    const regionOrder = new Map(data.regions.map((name, index) => [name, index]));
    return [...rows.values()].map((row) => ({
      ...row,
      orders:row.actual + row.confirm,
      gap:row.forecast - row.actual - row.confirm,
    })).sort((a, b) => a.product.localeCompare(b.product)
      || (regionOrder.get(a.region) ?? 99) - (regionOrder.get(b.region) ?? 99)
      || a.month.localeCompare(b.month));
  }

  function velocityMatrix(data, window = 3, now = new Date()) {
    const rows = data.products.map((product) => {
      const values = {};
      data.regions.forEach((region) => { values[region] = summarize(data, { region, product, velocityWindow: window, now }).runRate; });
      values.__ALL__ = summarize(data, { region: "__ALL__", product, velocityWindow: window, now }).runRate;
      return { product, values };
    });
    return rows.filter((row) => row.values.__ALL__ !== 0).sort((a, b) => b.values.__ALL__ - a.values.__ALL__);
  }

  function productSummary(data, options = {}) {
    return data.products.map((product) => ({ product, ...summarize(data, { ...options, product }) }))
      .filter((row) => row.forecastTotal !== 0 || row.actualTotal !== 0 || row.futureForecastRate !== 0 || row.runRate !== 0)
      .sort((a, b) => (b.actualTotal + b.forecastTotal) - (a.actualTotal + a.forecastTotal));
  }

  return {
    REGIONS,
    cleanText,
    toNumber,
    normalizeMonth,
    monthIndex,
    addMonths,
    currentMonthKey,
    isCompleteMonth,
    monthRange,
    normalizeRegion,
    normalizeStage,
    classifyPvProduct,
    normalizeForecastRows,
    normalizeActualRows,
    prepare,
    summarize,
    futureComparison,
    velocityMatrix,
    productSummary,
  };
});
