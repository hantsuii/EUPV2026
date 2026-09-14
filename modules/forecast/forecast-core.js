(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.ForecastCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const HORIZONS = Object.freeze({
    M1: { id: "M1", start: 1, end: 1, kind: "point", officialBasis: "mw" },
    M3: { id: "M3", start: 3, end: 3, kind: "point", officialBasis: "weighted" },
    M6: { id: "M6", start: 6, end: 6, kind: "point", officialBasis: "weighted" },
    M1_3: { id: "M1_3", start: 1, end: 3, kind: "window", officialBasis: "mw" },
    M1_6: { id: "M1_6", start: 1, end: 6, kind: "window", officialBasis: "weighted" },
  });

  function cleanText(value) {
    return value == null ? "" : String(value).trim();
  }

  function toNumber(value) {
    if (value == null || value === "") return null;
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    const normalized = String(value).replace(/,/g, "").trim();
    if (!normalized) return null;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
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
    let match = text.match(/^(\d{4})[-/.](\d{1,2})(?:[-/.]\d{1,2})?/);
    if (match) return `${match[1]}-${String(Number(match[2])).padStart(2, "0")}`;
    match = text.match(/^(\d{2})M(\d{1,2})$/i);
    if (match) return `20${match[1]}-${String(Number(match[2])).padStart(2, "0")}`;
    return null;
  }

  function monthIndex(month) {
    const normalized = normalizeMonth(month);
    if (!normalized) return null;
    const [year, value] = normalized.split("-").map(Number);
    return year * 12 + value - 1;
  }

  function addMonths(month, offset) {
    const baseIndex = monthIndex(month);
    if (baseIndex == null) return null;
    const index = baseIndex + Number(offset || 0);
    const year = Math.floor(index / 12);
    const value = index % 12 + 1;
    return `${year}-${String(value).padStart(2, "0")}`;
  }

  function currentMonthKey(now = new Date()) {
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }

  function isCompleteMonth(month, now = new Date()) {
    const value = monthIndex(month);
    const current = monthIndex(currentMonthKey(now));
    return value != null && current != null && value < current;
  }

  function valueByAliases(row, aliases) {
    for (const key of aliases) {
      if (Object.prototype.hasOwnProperty.call(row, key)) return row[key];
    }
    const normalized = new Map(Object.keys(row).map((key) => [key.trim().toLowerCase(), row[key]]));
    for (const key of aliases) {
      const value = normalized.get(key.toLowerCase());
      if (value !== undefined) return value;
    }
    return null;
  }

  function normalizeRows(sourceRows) {
    const rows = [];
    const invalidRows = [];
    sourceRows.forEach((source, index) => {
      const rowNumber = index + 2;
      const rawSeries = valueByAliases(source, ["Series"]);
      const seriesText = cleanText(rawSeries);
      const isActual = /^actuals?$/i.test(seriesText);
      const series = isActual ? "Actuals" : normalizeMonth(rawSeries);
      const month = normalizeMonth(valueByAliases(source, ["Month", "Date"]));
      const category = cleanText(valueByAliases(source, ["Category"])).toUpperCase();
      const region = cleanText(valueByAliases(source, ["Sales Region", "SalesRegion"]));
      const country = cleanText(valueByAliases(source, ["Country"]));
      const mw = toNumber(valueByAliases(source, ["MW"]));
      const weighted = toNumber(valueByAliases(source, ["MW Weighted", "MWWeighted"]));
      const reasons = [];
      if (!series) reasons.push("series");
      if (!month) reasons.push("month");
      if (!category) reasons.push("category");
      if (!region) reasons.push("region");
      if (mw == null) reasons.push("mw");
      if (!isActual && weighted == null) reasons.push("weighted");
      if (reasons.length) {
        invalidRows.push({ rowNumber, reasons });
        return;
      }
      rows.push({ rowNumber, series, isActual, country, region, category, month, mw, weighted: weighted == null ? mw : weighted });
    });
    return { rows, invalidRows };
  }

  function resolveBasis(config, basisMode) {
    return basisMode === "mw" || basisMode === "weighted" ? basisMode : config.officialBasis;
  }

  function filterScope(rows, category, region) {
    return rows.filter((row) => (!category || row.category === category) && (!region || region === "__ALL__" || row.region === region));
  }

  function buildMaps(rows, category, region, now = new Date()) {
    const scoped = filterScope(rows, category, region);
    const actual = new Map();
    const forecast = new Map();
    const seriesSet = new Set();
    scoped.forEach((row) => {
      if (row.isActual) {
        if (!isCompleteMonth(row.month, now)) return;
        const item = actual.get(row.month) || { value: 0, rows: 0 };
        item.value += row.mw;
        item.rows += 1;
        actual.set(row.month, item);
        return;
      }
      seriesSet.add(row.series);
      const key = `${row.series}|${row.month}`;
      const item = forecast.get(key) || { mw: 0, weighted: 0, hasMw: false, hasWeighted: false, rows: 0 };
      if (row.mw != null) { item.mw += row.mw; item.hasMw = true; }
      if (row.weighted != null) { item.weighted += row.weighted; item.hasWeighted = true; }
      item.rows += 1;
      forecast.set(key, item);
    });
    return { actual, forecast, series: [...seriesSet].sort() };
  }

  function buildSamples(rows, options) {
    const config = HORIZONS[options.horizonId] || HORIZONS.M1;
    const basis = resolveBasis(config, options.basisMode || "official");
    const now = options.now || new Date();
    const maps = buildMaps(rows, options.category, options.region || "__ALL__", now);
    const samples = [];
    let missingActual = 0;
    let missingForecast = 0;
    let notComplete = 0;

    maps.series.forEach((series) => {
      const months = [];
      for (let horizon = config.start; horizon <= config.end; horizon += 1) months.push(addMonths(series, horizon - 1));
      if (months.some((month) => !isCompleteMonth(month, now))) {
        notComplete += 1;
        return;
      }
      let actualValue = 0;
      let forecastValue = 0;
      let hasMissingActual = false;
      let hasMissingForecast = false;
      months.forEach((month) => {
        const actual = maps.actual.get(month);
        const forecast = maps.forecast.get(`${series}|${month}`);
        if (!actual) hasMissingActual = true;
        else actualValue += actual.value;
        if (!forecast || (basis === "mw" ? !forecast.hasMw : !forecast.hasWeighted)) hasMissingForecast = true;
        else forecastValue += forecast[basis];
      });
      if (hasMissingActual) { missingActual += 1; return; }
      if (hasMissingForecast) { missingForecast += 1; return; }
      const error = forecastValue - actualValue;
      const ape = actualValue === 0 ? null : Math.abs(error) / Math.abs(actualValue);
      samples.push({
        series,
        periodStart: months[0],
        periodEnd: months[months.length - 1],
        periodLabel: months.length === 1 ? months[0] : `${months[0]} ~ ${months[months.length - 1]}`,
        actual: actualValue,
        forecast: forecastValue,
        error,
        ape,
        direction: error > 0 ? "over" : error < 0 ? "under" : "exact",
        basis,
      });
    });
    return { samples, basis, config, missingActual, missingForecast, notComplete };
  }

  function summarize(samples, hitThreshold = 0.2) {
    const actual = samples.reduce((sum, row) => sum + row.actual, 0);
    const forecast = samples.reduce((sum, row) => sum + row.forecast, 0);
    const absoluteError = samples.reduce((sum, row) => sum + Math.abs(row.error), 0);
    const signedError = samples.reduce((sum, row) => sum + row.error, 0);
    const denominator = samples.reduce((sum, row) => sum + Math.abs(row.actual), 0);
    const validHitRows = samples.filter((row) => row.ape != null);
    const wape = denominator === 0 ? null : absoluteError / denominator;
    const bias = denominator === 0 ? null : signedError / denominator;
    return {
      sampleCount: samples.length,
      actual,
      forecast,
      variance: forecast - actual,
      wape,
      accuracy: wape == null ? null : Math.max(0, 1 - wape),
      bias,
      hitRate: validHitRows.length ? validHitRows.filter((row) => row.ape <= hitThreshold).length / validHitRows.length : null,
      hitThreshold,
      zeroActualCount: samples.length - validHitRows.length,
    };
  }

  function analyze(rows, options) {
    const built = buildSamples(rows, options);
    return { ...built, summary: summarize(built.samples, options.hitThreshold || 0.2) };
  }

  function analyzeCategories(rows, options) {
    const categories = ["PV", "ESS", "HP"].filter((category) => rows.some((row) => row.category === category));
    return categories.map((category) => ({ category, ...analyze(rows, { ...options, category, region: "__ALL__" }) }));
  }

  function analyzeRegions(rows, options) {
    const regions = [...new Set(rows.filter((row) => row.category === options.category).map((row) => row.region))].sort();
    return regions.map((region) => ({ region, ...analyze(rows, { ...options, region }) })).filter((item) => item.summary.sampleCount > 0);
  }

  function duplicateGroups(rows) {
    const groups = new Map();
    rows.forEach((row) => {
      const key = [row.series, row.country, row.region, row.category, row.month].join("|");
      const list = groups.get(key) || [];
      list.push(row);
      groups.set(key, list);
    });
    return [...groups.values()].filter((group) => group.length > 1);
  }

  function qualitySummary(rows, invalidRows, now = new Date()) {
    const forecasts = rows.filter((row) => !row.isActual);
    const actuals = rows.filter((row) => row.isActual);
    const negativeHorizonRows = forecasts.filter((row) => {
      const seriesIndex = monthIndex(row.series);
      const targetIndex = monthIndex(row.month);
      return seriesIndex != null && targetIndex != null && targetIndex < seriesIndex;
    });
    const incompleteActualRows = actuals.filter((row) => !isCompleteMonth(row.month, now));
    const duplicates = duplicateGroups(rows);
    return {
      totalRows: rows.length,
      forecastRows: forecasts.length,
      actualRows: actuals.length,
      invalidRows: invalidRows.length,
      negativeHorizonRows: negativeHorizonRows.length,
      incompleteActualRows: incompleteActualRows.length,
      duplicateGroups: duplicates.length,
      duplicateExtraRows: duplicates.reduce((sum, group) => sum + group.length - 1, 0),
      duplicates,
      completeThrough: [...new Set(actuals.filter((row) => isCompleteMonth(row.month, now)).map((row) => row.month))].sort().at(-1) || null,
    };
  }

  return {
    HORIZONS,
    normalizeMonth,
    monthIndex,
    addMonths,
    currentMonthKey,
    isCompleteMonth,
    normalizeRows,
    resolveBasis,
    buildSamples,
    summarize,
    analyze,
    analyzeCategories,
    analyzeRegions,
    duplicateGroups,
    qualitySummary,
  };
});
