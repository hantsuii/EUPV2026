"use strict";

window.PAGE_I18N = {
  zh: {
    pageTitle:"组件预测与实际销售", pageSubtitle:"按地区和统一产品分类比较FCST、已开票实际、销售速度与需求参考。", backHome:"返回主页",
    sourceTitle:"读取数据", forecastFileLabel:"Country FCST工作簿", salesFileLabel:"EU DG销售工作簿", runButton:"读取并分析", exportButton:"下载分析明细",
    statusInitial:"请选择Country FCST和EU DG销售文件。", statusReading:"正在读取并统一地区、产品和月份……", statusNoFiles:"请同时选择两个工作簿。", statusNoConso:"Country FCST中未找到Conso工作表。", statusNoOrders:"EU DG文件中未找到Order details工作表。", statusNoRows:"没有找到可比较的PV数据。", statusDone:"完成：{forecast}条预测明细，{actual}条销售明细，{products}个聚合产品。", statusFailed:"分析失败：{message}",
    methodNote:"仅分析PV。历史实际只计已开票；当前月与未来月份的confirm单独显示。TCL与SunPower、CFP与非CFP分别统计。",
    scopeTitle:"分析范围", regionLabel:"地区", productLabel:"聚合产品", startMonthLabel:"开始月份", endMonthLabel:"结束月份", velocityWindowLabel:"销售速率窗口", allRegions:"全部地区", allProducts:"全部产品", month1:"1个月", month3:"3个月", month6:"6个月",
    historicalForecast:"历史FCST", historicalActual:"历史实际", accuracy:"准确率", bias:"Bias", runRate:"近期销售速率", suggestedDemand:"建议月均需求", completedMonths:"{count}个完整月份", nextMonths:"未来{count}个月", rateWindow:"最近{count}个月",
    monthlyChartTitle:"月度FCST、已开票与待确认", productMixTitle:"产品组合对比", forecast:"FCST", actual:"已开票实际", confirm:"Confirm", variance:"FCST-实际", month:"月份", status:"月份状态", completed:"完整月份", current:"当前月", future:"未来月份", unavailable:"—",
    monthlyTitle:"月度预测与实际明细", velocityTitle:"各地区产品销售速率", velocityNote:"按完整月份的已开票MW计算；零销售月份计入平均值。“全部地区”为先求和后计算，不是地区平均。", all:"全部地区", product:"聚合产品", mwPerMonth:"MW/月",
    demandTitle:"产品需求参考", demandNote:"将近期实际销售速度与经过历史Bias修正的未来FCST按历史准确率加权；结果为月均MW参考。", priorRate:"前期速率", trend:"速率变化", futureRate:"未来FCST速率", correction:"Bias修正", reliability:"预测可信度", calibrationBasis:"校准层级", direct:"地区×产品", productAll:"全部地区×产品", regionAll:"地区×全部产品", global:"全部PV", actualOnly:"仅实际速度",
    mappingTitle:"产品映射与数据检查", source:"来源", sourceModel:"源型号", mappedProduct:"聚合分类", fcstPvRows:"FCST PV行", salesPvRows:"销售PV行", manualRegions:"人工地区映射", outsideScope:"范围外行", unmapped:"未映射行", qualityWarning:"Solarmarkt与Solexis的6条#N/A地区记录已按确认归入法国及瑞士地区；UPP及非欧洲地区不参与本模块。", mappingRows:"显示{shown}条型号映射，共{total}条。",
    exportFile:"PV_FCST_Actual_Detail.csv"
  },
  en: {
    pageTitle:"PV Forecast vs Actual Sales", pageSubtitle:"Compare forecast, invoiced actuals, sales velocity, and demand reference by region and normalized product group.", backHome:"Back to Home",
    sourceTitle:"Load data", forecastFileLabel:"Country FCST workbook", salesFileLabel:"EU DG sales workbook", runButton:"Read and analyze", exportButton:"Download detail",
    statusInitial:"Select both the Country FCST and EU DG sales workbooks.", statusReading:"Reading and normalizing regions, products, and months…", statusNoFiles:"Select both workbooks.", statusNoConso:"Sheet 'Conso' was not found in Country FCST.", statusNoOrders:"Sheet 'Order details' was not found in the EU DG workbook.", statusNoRows:"No comparable PV data was found.", statusDone:"Done: {forecast} forecast records, {actual} sales records, {products} product groups.", statusFailed:"Analysis failed: {message}",
    methodNote:"PV only. Historical actuals use invoiced sales; current and future confirm orders are shown separately. TCL vs SunPower and CFP vs non-CFP remain separate.",
    scopeTitle:"Analysis scope", regionLabel:"Region", productLabel:"Product group", startMonthLabel:"Start month", endMonthLabel:"End month", velocityWindowLabel:"Sales velocity window", allRegions:"All regions", allProducts:"All products", month1:"1 month", month3:"3 months", month6:"6 months",
    historicalForecast:"Historical FCST", historicalActual:"Historical actual", accuracy:"Accuracy", bias:"Bias", runRate:"Recent sales velocity", suggestedDemand:"Suggested monthly demand", completedMonths:"{count} complete months", nextMonths:"Next {count} months", rateWindow:"Last {count} months",
    monthlyChartTitle:"Monthly FCST, invoiced, and confirmed", productMixTitle:"Product mix comparison", forecast:"FCST", actual:"Invoiced actual", confirm:"Confirm", variance:"FCST - actual", month:"Month", status:"Month status", completed:"Complete", current:"Current month", future:"Future", unavailable:"—",
    monthlyTitle:"Monthly forecast and actual detail", velocityTitle:"Product sales velocity by region", velocityNote:"Calculated from invoiced MW in complete months; zero-sales months remain in the average. All Regions is calculated after summing regions.", all:"All Regions", product:"Product group", mwPerMonth:"MW/month",
    demandTitle:"Product demand reference", demandNote:"Blends recent actual velocity with bias-corrected future FCST using historical accuracy. Results are monthly MW references.", priorRate:"Prior velocity", trend:"Velocity change", futureRate:"Future FCST rate", correction:"Bias correction", reliability:"Forecast confidence", calibrationBasis:"Calibration level", direct:"Region × product", productAll:"All regions × product", regionAll:"Region × all products", global:"All PV", actualOnly:"Actual velocity only",
    mappingTitle:"Product mapping and data checks", source:"Source", sourceModel:"Source model", mappedProduct:"Product group", fcstPvRows:"FCST PV rows", salesPvRows:"Sales PV rows", manualRegions:"Manual region mappings", outsideScope:"Out-of-scope rows", unmapped:"Unmapped rows", qualityWarning:"Six #N/A rows for Solarmarkt and Solexis were assigned to France and Switzerland as confirmed. UPP and non-European regions are excluded.", mappingRows:"Showing {shown} model mappings out of {total}.",
    exportFile:"PV_FCST_Actual_Detail.csv"
  }
};

const Core = window.ForecastSalesCore;
const byId = (id) => document.getElementById(id);
const forecastFile = byId("forecastFile"), salesFile = byId("salesFile"), runBtn = byId("runBtn"), exportBtn = byId("exportBtn");
const dashboard = byId("dashboard"), statusEl = byId("status");
const regionSel = byId("regionSel"), productSel = byId("productSel"), startMonthSel = byId("startMonthSel"), endMonthSel = byId("endMonthSel"), velocityWindowSel = byId("velocityWindowSel");
let data = null;
let lastStatus = { key: "statusInitial", params: {} };

function t(key, params = {}) {
  if (window.appI18n) return window.appI18n.text(key, params);
  let value = window.PAGE_I18N.zh[key] || key;
  Object.entries(params).forEach(([name, replacement]) => { value = value.replace(`{${name}}`, String(replacement)); });
  return value;
}

function setStatus(key, params = {}) {
  lastStatus = { key, params };
  statusEl.textContent = t(key, params);
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[char]));
}

function fmt(value, digits = 1) {
  return Number.isFinite(value) ? new Intl.NumberFormat("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value) : t("unavailable");
}

function pct(value) {
  return Number.isFinite(value) ? `${(value * 100).toFixed(1)}%` : t("unavailable");
}

function fillSelect(select, items, preferred) {
  const previous = preferred ?? select.value;
  select.innerHTML = items.map((item) => `<option value="${escapeHtml(item.value)}">${escapeHtml(item.label)}</option>`).join("");
  if (items.some((item) => item.value === previous)) select.value = previous;
}

function plot(id, traces, layout = {}) {
  const base = {
    paper_bgcolor:"rgba(0,0,0,0)", plot_bgcolor:"#fff", margin:{ l:60, r:24, t:54, b:58 },
    font:{ family:'Inter, "Segoe UI", Arial, sans-serif', color:"#355568", size:11 },
    legend:{ orientation:"h", y:1.12, x:0 }, hovermode:"x unified",
  };
  Plotly.react(id, traces, { ...base, ...layout }, { responsive:true, displaylogo:false, modeBarButtonsToRemove:["lasso2d","select2d"] });
}

function renderTable(id, headers, rows) {
  const table = byId(id);
  table.innerHTML = `<thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${cell == null ? "" : cell}</td>`).join("")}</tr>`).join("")}</tbody>`;
}

function kpi(name, value, detail = "", className = "") {
  return `<div class="kpi-card"><div class="kpi-name">${escapeHtml(name)}</div><div class="kpi-value ${className}">${escapeHtml(value)}</div><div class="kpi-detail">${escapeHtml(detail)}</div></div>`;
}

function currentOptions() {
  return { region:regionSel.value, product:productSel.value, startMonth:startMonthSel.value, endMonth:endMonthSel.value, velocityWindow:Number(velocityWindowSel.value), now:new Date() };
}

function renderKpis(summary) {
  byId("kpiGrid").innerHTML = [
    kpi(t("historicalForecast"), `${fmt(summary.forecastTotal)} MW`, t("completedMonths", { count:summary.comparable.length })),
    kpi(t("historicalActual"), `${fmt(summary.actualTotal)} MW`, t("completedMonths", { count:summary.comparable.length })),
    kpi(t("accuracy"), pct(summary.accuracy), `WAPE ${pct(summary.wape)}`),
    kpi(t("bias"), pct(summary.bias), `${fmt(summary.forecastTotal - summary.actualTotal)} MW`, summary.bias > 0 ? "positive" : "negative"),
    kpi(t("runRate"), `${fmt(summary.runRate)} MW`, t("rateWindow", { count:Number(velocityWindowSel.value) })),
    kpi(t("suggestedDemand"), `${fmt(summary.suggestedDemandRate)} MW`, t("nextMonths", { count:summary.futureMonths.length })),
  ].join("");
}

function monthState(row) {
  const current = Core.currentMonthKey(new Date());
  if (row.month === current) return t("current");
  return row.complete ? t("completed") : t("future");
}

function renderMonthly(summary) {
  plot("monthlyChart", [
    { x:summary.monthly.map((row) => row.month), y:summary.monthly.map((row) => row.actual), type:"bar", name:t("actual"), marker:{ color:"#2c78b7" } },
    { x:summary.monthly.map((row) => row.month), y:summary.monthly.map((row) => row.confirm), type:"bar", name:t("confirm"), marker:{ color:"#e7a34f" } },
    { x:summary.monthly.map((row) => row.month), y:summary.monthly.map((row) => row.forecast), type:"scatter", mode:"lines+markers", name:t("forecast"), line:{ color:"#138b82", width:3 } },
  ], { title:t("monthlyChartTitle"), barmode:"stack", yaxis:{ title:"MW", rangemode:"tozero" }, xaxis:{ type:"category" } });
  renderTable("monthlyTable", [t("month"), t("status"), `${t("forecast")} (MW)`, `${t("actual")} (MW)`, `${t("confirm")} (MW)`, `${t("variance")} (MW)`, t("accuracy")], summary.monthly.map((row) => {
    const accuracy = row.complete && row.forecastCovered && row.actual !== 0 ? Math.max(0, 1 - Math.abs(row.variance) / Math.abs(row.actual)) : null;
    return [escapeHtml(row.month), escapeHtml(monthState(row)), fmt(row.forecast), fmt(row.actual), fmt(row.confirm), fmt(row.variance), pct(accuracy)];
  }));
}

function renderMix(options) {
  const rows = Core.productSummary(data, options).slice(0, 12).reverse();
  plot("mixChart", [
    { y:rows.map((row) => row.product), x:rows.map((row) => row.actualTotal), type:"bar", orientation:"h", name:t("actual"), marker:{ color:"#2c78b7" } },
    { y:rows.map((row) => row.product), x:rows.map((row) => row.forecastTotal), type:"bar", orientation:"h", name:t("forecast"), marker:{ color:"#56b6a9" } },
  ], { title:t("productMixTitle"), barmode:"group", margin:{ l:210, r:20, t:54, b:45 }, xaxis:{ title:"MW", rangemode:"tozero" }, hovermode:"closest" });
}

function renderVelocity() {
  const window = Number(velocityWindowSel.value);
  const matrix = Core.velocityMatrix(data, window, new Date());
  const columns = [...data.regions, "__ALL__"];
  const labels = [...data.regions, t("all")];
  const top = matrix.slice(0, 24);
  plot("velocityHeatmap", [{
    z:top.map((row) => columns.map((column) => row.values[column])), x:labels, y:top.map((row) => row.product),
    type:"heatmap", colorscale:[[0,"#f4f8fa"],[0.35,"#b8ddd6"],[1,"#176f78"]], colorbar:{ title:t("mwPerMonth") }, hovertemplate:"%{y}<br>%{x}: %{z:.2f} MW<extra></extra>",
  }], { title:`${t("velocityTitle")} · ${t(`month${window}`)}`, height:Math.max(420, top.length * 24 + 120), margin:{ l:230, r:40, t:54, b:100 }, hovermode:"closest" });
  renderTable("velocityTable", [t("product"), ...labels], matrix.map((row) => [escapeHtml(row.product), ...columns.map((column) => fmt(row.values[column], 2))]));
}

function usableCalibration(summary) {
  return summary.comparable.length >= 3 && summary.actualTotal > 0 && summary.forecastTotal > 0 && Number.isFinite(summary.accuracy);
}

function calibrationFor(product, region, historyStart, historyEnd) {
  const choices = [
    { key:"direct", region, product },
    { key:"productAll", region:"__ALL__", product },
    { key:"regionAll", region, product:"__ALL__" },
    { key:"global", region:"__ALL__", product:"__ALL__" },
  ];
  for (const choice of choices) {
    const result = Core.summarize(data, { ...choice, startMonth:historyStart, endMonth:historyEnd, velocityWindow:Number(velocityWindowSel.value), now:new Date() });
    if (usableCalibration(result)) return { ...result, basis:choice.key };
  }
  return null;
}

function renderDemand(options) {
  const now = new Date();
  const historyStart = data.forecastMonths[0];
  const historyEnd = data.forecastMonths.filter((month) => Core.isCompleteMonth(month, now)).at(-1) || historyStart;
  const region = options.region;
  const rows = data.products.map((product) => {
    const direct = Core.summarize(data, { region, product, startMonth:historyStart, endMonth:historyEnd, velocityWindow:Number(velocityWindowSel.value), now });
    if (direct.runRate === 0 && direct.futureForecastRate === 0) return null;
    const calibration = calibrationFor(product, region, historyStart, historyEnd);
    const reliability = calibration?.reliability || 0;
    const correction = calibration?.correction || 1;
    const suggested = direct.futureForecastRate || direct.weightedActualRate
      ? reliability * direct.futureForecastRate * correction + (1 - reliability) * direct.weightedActualRate
      : null;
    return { product, direct, calibration, reliability, correction, suggested };
  }).filter(Boolean).sort((a, b) => (b.suggested || 0) - (a.suggested || 0));
  renderTable("demandTable", [t("product"), t("runRate"), t("priorRate"), t("trend"), t("futureRate"), t("accuracy"), t("bias"), t("correction"), t("reliability"), t("calibrationBasis"), t("suggestedDemand")], rows.map((row) => [
    escapeHtml(row.product), fmt(row.direct.runRate, 2), fmt(row.direct.priorRate, 2), pct(row.direct.trend), fmt(row.direct.futureForecastRate, 2),
    pct(row.calibration?.accuracy), pct(row.calibration?.bias), `${fmt(row.correction, 2)}×`, pct(row.reliability), escapeHtml(t(row.calibration?.basis || "actualOnly")), fmt(row.suggested, 2),
  ]));
}

function qualityCard(label, value) {
  return `<div class="quality-item"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
}

function renderQuality() {
  const fq = data.quality.forecast, aq = data.quality.actual;
  byId("qualityGrid").innerHTML = [
    qualityCard(t("fcstPvRows"), fq.pvRows), qualityCard(t("salesPvRows"), aq.pvRows), qualityCard(t("manualRegions"), fq.manualRegionRows),
    qualityCard(t("outsideScope"), fq.outsideScope + aq.outsideScope), qualityCard(t("unmapped"), fq.unmappedRows + aq.unmappedRows),
  ].join("");
  byId("qualityWarning").textContent = t("qualityWarning");
  const unique = [...new Map(data.mappings.map((row) => [`${row.source}|${row.sourceModel}|${row.product}`, row])).values()]
    .sort((a, b) => a.product.localeCompare(b.product) || a.source.localeCompare(b.source) || a.sourceModel.localeCompare(b.sourceModel));
  const shown = unique.slice(0, 300);
  renderTable("mappingTable", [t("source"), t("sourceModel"), t("mappedProduct")], shown.map((row) => [escapeHtml(row.source), escapeHtml(row.sourceModel), escapeHtml(row.product)]));
  byId("qualityWarning").textContent += ` ${t("mappingRows", { shown:shown.length, total:unique.length })}`;
}

function renderAll() {
  if (!data) return;
  const options = currentOptions();
  if (Core.monthIndex(options.startMonth) > Core.monthIndex(options.endMonth)) {
    endMonthSel.value = options.startMonth;
    options.endMonth = options.startMonth;
  }
  const summary = Core.summarize(data, options);
  renderKpis(summary);
  renderMonthly(summary);
  renderMix(options);
  renderVelocity();
  renderDemand(options);
  renderQuality();
}

function initControls() {
  fillSelect(regionSel, [{ value:"__ALL__", label:t("allRegions") }, ...data.regions.map((region) => ({ value:region, label:region }))], "__ALL__");
  fillSelect(productSel, [{ value:"__ALL__", label:t("allProducts") }, ...data.products.map((product) => ({ value:product, label:product }))], "__ALL__");
  fillSelect(startMonthSel, data.months.map((month) => ({ value:month, label:month })), data.forecastMonths[0] || data.months[0]);
  fillSelect(endMonthSel, data.months.map((month) => ({ value:month, label:month })), data.forecastMonths.at(-1) || data.months.at(-1));
  [...velocityWindowSel.options].forEach((option) => { option.textContent = t(`month${option.value}`); });
}

async function sheetRows(file, sheetName, missingKey) {
  const workbook = XLSX.read(await file.arrayBuffer(), { type:"array", cellDates:true });
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) throw new Error(t(missingKey));
  return XLSX.utils.sheet_to_json(sheet, { defval:null, raw:true });
}

async function runAnalysis() {
  if (!forecastFile.files?.[0] || !salesFile.files?.[0]) { setStatus("statusNoFiles"); return; }
  try {
    setStatus("statusReading"); runBtn.disabled = true; exportBtn.disabled = true;
    const [forecastRows, salesRows] = await Promise.all([
      sheetRows(forecastFile.files[0], "Conso", "statusNoConso"),
      sheetRows(salesFile.files[0], "Order details", "statusNoOrders"),
    ]);
    data = Core.prepare(forecastRows, salesRows, new Date());
    if (!data.forecastRecords.length || !data.actualRecords.length) throw new Error(t("statusNoRows"));
    initControls(); dashboard.classList.add("ready"); renderAll(); exportBtn.disabled = false;
    setStatus("statusDone", { forecast:data.forecastRecords.length, actual:data.actualRecords.length, products:data.products.length });
  } catch (error) {
    dashboard.classList.remove("ready");
    setStatus("statusFailed", { message:error?.message || String(error) });
  } finally { runBtn.disabled = false; }
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function exportDetail() {
  if (!data) return;
  const summary = Core.summarize(data, currentOptions());
  const rows = [[t("month"), t("regionLabel"), t("product"), t("forecast"), t("actual"), t("confirm"), t("variance"), t("status")]];
  summary.monthly.forEach((month) => rows.push([month.month, regionSel.value === "__ALL__" ? t("allRegions") : regionSel.value, productSel.value === "__ALL__" ? t("allProducts") : productSel.value, month.forecast, month.actual, month.confirm, month.variance, monthState(month)]));
  const csv = "\ufeff" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type:"text/csv;charset=utf-8" }));
  const link = document.createElement("a"); link.href = url; link.download = t("exportFile"); link.click(); URL.revokeObjectURL(url);
}

runBtn.addEventListener("click", runAnalysis);
exportBtn.addEventListener("click", exportDetail);
[regionSel, productSel, startMonthSel, endMonthSel, velocityWindowSel].forEach((select) => select.addEventListener("change", renderAll));
window.addEventListener("app-language-change", () => {
  setStatus(lastStatus.key, lastStatus.params);
  if (!data) return;
  const selectedRegion = regionSel.value, selectedProduct = productSel.value;
  fillSelect(regionSel, [{ value:"__ALL__", label:t("allRegions") }, ...data.regions.map((region) => ({ value:region, label:region }))], selectedRegion);
  fillSelect(productSel, [{ value:"__ALL__", label:t("allProducts") }, ...data.products.map((product) => ({ value:product, label:product }))], selectedProduct);
  [...velocityWindowSel.options].forEach((option) => { option.textContent = t(`month${option.value}`); });
  renderAll();
});
