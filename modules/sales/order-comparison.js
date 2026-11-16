/* Two-snapshot daily-order comparison for the Sales dashboard. */
const ocOldFileEl = byId("compareOldFile");
const ocNewFileEl = byId("compareNewFile");
const ocRunBtn = byId("runOrderCompareBtn");
const ocStatusEl = byId("orderCompareStatus");
const ocResultsEl = byId("orderCompareResults");
const ocRegionSel = byId("compareRegionSel");
const ocMonthSel = byId("compareMonthSel");
const ocProductSel = byId("compareProductSel");

const ORDER_COMPARE_TEXT = {
  zh: {
    title:"日报变化对比", subtitle:"上传上期和本期日报，按 SO No. + SO Line 对比订单变化。当前月份和季度按处理当天计算。",
    oldFile:"上期日报", newFile:"本期日报", run:"运行对比", statusInit:"请选择两份日报。", loading:"正在读取并对比两份日报…",
    region:"地区", month:"月份", product:"产品线", all:"全部", regionChange:"地区当月订单变化", statusChange:"Order Status 对比",
    statusTransition:"状态迁移", customerQuarter:"当前季度客户订单变化", detail:"订单变化明细", duplicates:"重复键核查",
    duplicateNote:"同一日报中重复的 SO No. + SO Line 不参与自动判定。", missingFiles:"请同时选择上期和本期日报。",
    missingSheet:"{file} 中未找到 Order details 工作表。", done:"完成：上期 {oldCount} 个有效订单行，本期 {newCount} 个有效订单行；{reviewCount} 个键需要核查。处理日期：{date}。",
    failed:"对比失败：{message}", previous:"上期", current:"本期", delta:"变化", pvMw:"PV MW", essQty:"ESS Ordered Qty", orderLines:"订单行数",
    currentMonthPv:"所选月份 PV MW", currentMonthEss:"所选月份 ESS Ordered Qty", currentQuarterPv:"当前季度 PV MW", currentQuarterEss:"当前季度 ESS Ordered Qty",
    added:"新增", cancelled:"取消", delayed:"延迟", advanced:"提前", qtyUp:"数量增加", qtyDown:"数量减少", statusChanged:"状态变化", unchanged:"无变化",
    soNo:"SO No.", soLine:"SO Line", customer:"客户", model:"Model", changeType:"变化类型", previousMonth:"上期月份", currentMonth:"本期月份",
    previousStatus:"上期状态", currentStatus:"本期状态", status:"Order Status", transition:"状态迁移", reason:"核查原因", source:"日报", count:"行数", months:"月份",
    duplicateKey:"重复 SO + SO Line", missingKey:"缺少 SO No. 或 SO Line", notAvailable:"—", quarter:"季度"
  },
  en: {
    title:"Daily Report Comparison", subtitle:"Upload the previous and current daily reports. Orders are matched by SO No. + SO Line. Current month and quarter follow the processing date.",
    oldFile:"Previous Report", newFile:"Current Report", run:"Compare", statusInit:"Select both daily reports.", loading:"Reading and comparing both reports…",
    region:"Region", month:"Month", product:"Product Line", all:"All", regionChange:"Monthly Orders by Region", statusChange:"Order Status Comparison",
    statusTransition:"Status Transitions", customerQuarter:"Current-quarter Customer Changes", detail:"Order Change Details", duplicates:"Duplicate-key Review",
    duplicateNote:"Duplicate SO No. + SO Line keys within one report are excluded from automatic classification.", missingFiles:"Select both the previous and current reports.",
    missingSheet:"Sheet 'Order details' was not found in {file}.", done:"Done: {oldCount} valid previous lines, {newCount} valid current lines; {reviewCount} keys require review. Processing date: {date}.",
    failed:"Comparison failed: {message}", previous:"Previous", current:"Current", delta:"Change", pvMw:"PV MW", essQty:"ESS Ordered Qty", orderLines:"Order Lines",
    currentMonthPv:"Selected-month PV MW", currentMonthEss:"Selected-month ESS Ordered Qty", currentQuarterPv:"Current-quarter PV MW", currentQuarterEss:"Current-quarter ESS Ordered Qty",
    added:"Added", cancelled:"Cancelled", delayed:"Delayed", advanced:"Pulled Forward", qtyUp:"Quantity Increased", qtyDown:"Quantity Decreased", statusChanged:"Status Changed", unchanged:"Unchanged",
    soNo:"SO No.", soLine:"SO Line", customer:"Customer", model:"Model", changeType:"Change Type", previousMonth:"Previous Month", currentMonth:"Current Month",
    previousStatus:"Previous Status", currentStatus:"Current Status", status:"Order Status", transition:"Status Transition", reason:"Review Reason", source:"Report", count:"Rows", months:"Months",
    duplicateKey:"Duplicate SO + SO Line", missingKey:"Missing SO No. or SO Line", notAvailable:"—", quarter:"Quarter"
  }
};

let orderComparisonState = null;

function ocText(key, vars = {}) {
  let value = ORDER_COMPARE_TEXT[currentLang]?.[key] || ORDER_COMPARE_TEXT.zh[key] || key;
  Object.entries(vars).forEach(([name, replacement]) => { value = value.replaceAll(`{${name}}`, String(replacement)); });
  return value;
}
function ocDateLabel(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function ocCurrentPeriod() {
  const now = new Date(), year = now.getFullYear(), monthNumber = now.getMonth() + 1;
  return { date: ocDateLabel(now), year, month: `${year}-${String(monthNumber).padStart(2, "0")}`, quarter: `Q${Math.floor((monthNumber - 1) / 3) + 1}` };
}
function ocNumber(value, digits = 1) {
  const number = Number(value) || 0;
  return number.toLocaleString(currentLang === "zh" ? "zh-CN" : "en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}
function ocSigned(value, digits = 1) {
  const number = Number(value) || 0;
  return `${number > 0 ? "+" : ""}${ocNumber(number, digits)}`;
}
function ocFillSingleSelect(element, values, selectedValue) {
  element.innerHTML = values.map(({ value, label }) => `<option value="${esc(value)}">${esc(label)}</option>`).join("");
  element.value = values.some((item) => item.value === selectedValue) ? selectedValue : (values[0]?.value || "");
}
async function ocReadOrderRows(file) {
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const sheet = workbook.Sheets["Order details"];
  if (!sheet) throw new Error(ocText("missingSheet", { file: file.name }));
  return normalizeRows(XLSX.utils.sheet_to_json(sheet, { defval: null }));
}
function ocBuildSnapshot(rows, label) {
  const groups = new Map(), missing = [];
  rows.forEach((row) => {
    if (!row.orderKey) { missing.push(row); return; }
    if (!groups.has(row.orderKey)) groups.set(row.orderKey, []);
    groups.get(row.orderKey).push(row);
  });
  const unique = new Map(), duplicateGroups = [];
  groups.forEach((groupRows, key) => {
    if (groupRows.length === 1) unique.set(key, groupRows[0]);
    else duplicateGroups.push({ label, key, rows: groupRows });
  });
  return { label, groups, unique, validRows: [...unique.values()], duplicateGroups, missing };
}
function ocMetrics(row) {
  if (!row) return { pv: 0, ess: 0, lines: 0 };
  return { pv: row.category === "PV" ? row.totalMw : 0, ess: row.category === "ESS" ? row.essQty : 0, lines: 1 };
}
function ocAddMetrics(target, metrics) {
  target.pv += metrics.pv; target.ess += metrics.ess; target.lines += metrics.lines; return target;
}
function ocAggregate(rows) {
  return rows.reduce((total, row) => ocAddMetrics(total, ocMetrics(row)), { pv: 0, ess: 0, lines: 0 });
}
function ocChangeTypes(oldRow, newRow) {
  if (!oldRow) return ["added"];
  if (!newRow) return ["cancelled"];
  const types = [];
  if (newRow.month > oldRow.month) types.push("delayed");
  if (newRow.month < oldRow.month) types.push("advanced");
  const oldMetrics = ocMetrics(oldRow), newMetrics = ocMetrics(newRow), quantityDelta = (newMetrics.pv - oldMetrics.pv) + (newMetrics.ess - oldMetrics.ess);
  if (quantityDelta > 1e-9) types.push("qtyUp");
  if (quantityDelta < -1e-9) types.push("qtyDown");
  if (newRow.orderStatus !== oldRow.orderStatus) types.push("statusChanged");
  return types.length ? types : ["unchanged"];
}
function ocBuildComparison(oldSnapshot, newSnapshot) {
  const keys = new Set([...oldSnapshot.groups.keys(), ...newSnapshot.groups.keys()]), records = [], reviewKeys = new Set();
  keys.forEach((key) => {
    const oldGroup = oldSnapshot.groups.get(key) || [], newGroup = newSnapshot.groups.get(key) || [];
    if (oldGroup.length > 1 || newGroup.length > 1) { reviewKeys.add(key); return; }
    const oldRow = oldGroup[0] || null, newRow = newGroup[0] || null;
    records.push({ key, oldRow, newRow, types: ocChangeTypes(oldRow, newRow) });
  });
  return { records, reviewKeys };
}
function ocProductMatches(row) {
  const product = ocProductSel.value || "__ALL__";
  return product === "__ALL__" || row.category === product;
}
function ocRegionMatches(row) {
  const region = ocRegionSel.value || "__ALL__";
  return region === "__ALL__" || row.region === region;
}
function ocMonthlyRowMatches(row) {
  return row && row.month === ocMonthSel.value && ocRegionMatches(row) && ocProductMatches(row);
}
function ocQuarterRowMatches(row) {
  const period = ocCurrentPeriod();
  return row && row.year === period.year && row.quarter === period.quarter && ocRegionMatches(row) && ocProductMatches(row);
}
function ocMonthlyRows(snapshot) { return snapshot.validRows.filter(ocMonthlyRowMatches); }
function ocQuarterRows(snapshot) { return snapshot.validRows.filter(ocQuarterRowMatches); }
function ocRecordMatchesMonthly(record) { return ocMonthlyRowMatches(record.oldRow) || ocMonthlyRowMatches(record.newRow); }
function ocRecordRegion(record) { return record.newRow?.region || record.oldRow?.region || "Unknown"; }
function ocStatusLabel(rows, status) {
  return rows.find((row) => row.orderStatus === status)?.orderStatusLabel || status || ocText("notAvailable");
}
function ocRenderKpis() {
  const oldMonth = ocAggregate(ocMonthlyRows(orderComparisonState.oldSnapshot)), newMonth = ocAggregate(ocMonthlyRows(orderComparisonState.newSnapshot));
  const oldQuarter = ocAggregate(ocQuarterRows(orderComparisonState.oldSnapshot)), newQuarter = ocAggregate(ocQuarterRows(orderComparisonState.newSnapshot));
  byId("orderCompareKpis").innerHTML = [
    card(ocText("currentMonthPv"), `${ocNumber(oldMonth.pv)} → ${ocNumber(newMonth.pv)}`, `${ocText("delta")} ${ocSigned(newMonth.pv - oldMonth.pv)} MW`),
    card(ocText("currentMonthEss"), `${ocNumber(oldMonth.ess, 0)} → ${ocNumber(newMonth.ess, 0)}`, `${ocText("delta")} ${ocSigned(newMonth.ess - oldMonth.ess, 0)}`),
    card(`${ocText("currentQuarterPv")} (${ocCurrentPeriod().quarter})`, `${ocNumber(oldQuarter.pv)} → ${ocNumber(newQuarter.pv)}`, `${ocText("delta")} ${ocSigned(newQuarter.pv - oldQuarter.pv)} MW`),
    card(`${ocText("currentQuarterEss")} (${ocCurrentPeriod().quarter})`, `${ocNumber(oldQuarter.ess, 0)} → ${ocNumber(newQuarter.ess, 0)}`, `${ocText("delta")} ${ocSigned(newQuarter.ess - oldQuarter.ess, 0)}`)
  ].join("");
}
function ocRenderRegionTable() {
  const oldRows = ocMonthlyRows(orderComparisonState.oldSnapshot), newRows = ocMonthlyRows(orderComparisonState.newSnapshot);
  const regions = [...new Set([...oldRows, ...newRows].map((row) => row.region))].sort();
  const changeRecords = orderComparisonState.comparison.records.filter(ocRecordMatchesMonthly);
  const values = regions.map((region) => {
    const oldAgg = ocAggregate(oldRows.filter((row) => row.region === region)), newAgg = ocAggregate(newRows.filter((row) => row.region === region));
    const regionChanges = changeRecords.filter((record) => ocRecordRegion(record) === region);
    const countType = (type) => regionChanges.filter((record) => record.types.includes(type)).length;
    return [region, ocNumber(oldAgg.pv), ocNumber(newAgg.pv), ocSigned(newAgg.pv - oldAgg.pv), ocNumber(oldAgg.ess, 0), ocNumber(newAgg.ess, 0), ocSigned(newAgg.ess - oldAgg.ess, 0), countType("added"), countType("cancelled"), countType("delayed"), countType("advanced")];
  });
  table("orderCompareRegionTable", [ocText("region"), `${ocText("previous")} ${ocText("pvMw")}`, `${ocText("current")} ${ocText("pvMw")}`, `${ocText("delta")} ${ocText("pvMw")}`, `${ocText("previous")} ${ocText("essQty")}`, `${ocText("current")} ${ocText("essQty")}`, `${ocText("delta")} ${ocText("essQty")}`, ocText("added"), ocText("cancelled"), ocText("delayed"), ocText("advanced")], values);
}
function ocRenderStatusTable() {
  const oldRows = ocMonthlyRows(orderComparisonState.oldSnapshot), newRows = ocMonthlyRows(orderComparisonState.newSnapshot), allRowsForLabels = [...oldRows, ...newRows];
  const statuses = [...new Set(allRowsForLabels.map((row) => row.orderStatus))].sort();
  const values = statuses.map((status) => {
    const oldAgg = ocAggregate(oldRows.filter((row) => row.orderStatus === status)), newAgg = ocAggregate(newRows.filter((row) => row.orderStatus === status));
    return [ocStatusLabel(allRowsForLabels, status), oldAgg.lines, newAgg.lines, newAgg.lines - oldAgg.lines, ocNumber(oldAgg.pv), ocNumber(newAgg.pv), ocSigned(newAgg.pv - oldAgg.pv), ocNumber(oldAgg.ess, 0), ocNumber(newAgg.ess, 0), ocSigned(newAgg.ess - oldAgg.ess, 0)];
  });
  table("orderCompareStatusTable", [ocText("status"), `${ocText("previous")} ${ocText("orderLines")}`, `${ocText("current")} ${ocText("orderLines")}`, ocText("delta"), `${ocText("previous")} ${ocText("pvMw")}`, `${ocText("current")} ${ocText("pvMw")}`, `${ocText("delta")} ${ocText("pvMw")}`, `${ocText("previous")} ${ocText("essQty")}`, `${ocText("current")} ${ocText("essQty")}`, `${ocText("delta")} ${ocText("essQty")}`], values);
}
function ocRenderTransitions() {
  const groups = new Map(), records = orderComparisonState.comparison.records.filter(ocRecordMatchesMonthly);
  records.forEach((record) => {
    const oldStatus = record.oldRow ? record.oldRow.orderStatusLabel : ocText("added"), newStatus = record.newRow ? record.newRow.orderStatusLabel : ocText("cancelled");
    if (record.oldRow && record.newRow && record.oldRow.orderStatus === record.newRow.orderStatus) return;
    const key = `${oldStatus}\u0001${newStatus}`;
    if (!groups.has(key)) groups.set(key, { oldStatus, newStatus, count: 0, pv: 0, ess: 0 });
    const group = groups.get(key), oldMetrics = ocMetrics(record.oldRow), newMetrics = ocMetrics(record.newRow);
    group.count += 1; group.pv += newMetrics.pv - oldMetrics.pv; group.ess += newMetrics.ess - oldMetrics.ess;
  });
  const values = [...groups.values()].sort((a, b) => b.count - a.count).map((group) => [`${group.oldStatus} → ${group.newStatus}`, group.count, ocSigned(group.pv), ocSigned(group.ess, 0)]);
  table("orderCompareTransitionTable", [ocText("transition"), ocText("orderLines"), `${ocText("delta")} ${ocText("pvMw")}`, `${ocText("delta")} ${ocText("essQty")}`], values);
}
function ocRenderCustomerQuarter() {
  const oldRows = ocQuarterRows(orderComparisonState.oldSnapshot), newRows = ocQuarterRows(orderComparisonState.newSnapshot);
  const customers = [...new Set([...oldRows, ...newRows].map((row) => row.customer))].sort();
  const values = customers.map((customer) => {
    const oldAgg = ocAggregate(oldRows.filter((row) => row.customer === customer)), newAgg = ocAggregate(newRows.filter((row) => row.customer === customer));
    return { sortValue:Math.abs(newAgg.pv - oldAgg.pv) + Math.abs(newAgg.ess - oldAgg.ess), values:[customer, oldAgg.lines, newAgg.lines, newAgg.lines - oldAgg.lines, ocNumber(oldAgg.pv), ocNumber(newAgg.pv), ocSigned(newAgg.pv - oldAgg.pv), ocNumber(oldAgg.ess, 0), ocNumber(newAgg.ess, 0), ocSigned(newAgg.ess - oldAgg.ess, 0)] };
  }).sort((a, b) => b.sortValue - a.sortValue).map((item) => item.values);
  table("orderCompareCustomerTable", [ocText("customer"), `${ocText("previous")} ${ocText("orderLines")}`, `${ocText("current")} ${ocText("orderLines")}`, ocText("delta"), `${ocText("previous")} ${ocText("pvMw")}`, `${ocText("current")} ${ocText("pvMw")}`, `${ocText("delta")} ${ocText("pvMw")}`, `${ocText("previous")} ${ocText("essQty")}`, `${ocText("current")} ${ocText("essQty")}`, `${ocText("delta")} ${ocText("essQty")}`], values);
}
function ocRenderDetails() {
  const values = orderComparisonState.comparison.records.filter((record) => ocRecordMatchesMonthly(record) && !record.types.includes("unchanged")).map((record) => {
    const oldRow = record.oldRow, newRow = record.newRow, row = newRow || oldRow, oldMetrics = ocMetrics(oldRow), newMetrics = ocMetrics(newRow);
    return [row.orderId, row.orderLine, row.region, row.customer, row.model, record.types.map((type) => ocText(type)).join(" / "), oldRow?.month || ocText("notAvailable"), newRow?.month || ocText("notAvailable"), oldRow?.orderStatusLabel || ocText("notAvailable"), newRow?.orderStatusLabel || ocText("notAvailable"), ocNumber(oldMetrics.pv), ocNumber(newMetrics.pv), ocSigned(newMetrics.pv - oldMetrics.pv), ocNumber(oldMetrics.ess, 0), ocNumber(newMetrics.ess, 0), ocSigned(newMetrics.ess - oldMetrics.ess, 0)];
  });
  table("orderCompareDetailTable", [ocText("soNo"), ocText("soLine"), ocText("region"), ocText("customer"), ocText("model"), ocText("changeType"), ocText("previousMonth"), ocText("currentMonth"), ocText("previousStatus"), ocText("currentStatus"), `${ocText("previous")} ${ocText("pvMw")}`, `${ocText("current")} ${ocText("pvMw")}`, `${ocText("delta")} ${ocText("pvMw")}`, `${ocText("previous")} ${ocText("essQty")}`, `${ocText("current")} ${ocText("essQty")}`, `${ocText("delta")} ${ocText("essQty")}`], values);
}
function ocReviewRows(snapshot) {
  const duplicateRows = snapshot.duplicateGroups.map((group) => {
    const first = group.rows[0], aggregate = ocAggregate(group.rows);
    return [snapshot.label, ocText("duplicateKey"), first.orderId, first.orderLine, group.rows.length, [...new Set(group.rows.map((row) => row.month))].sort().join(", "), first.region, first.customer, first.model, ocNumber(aggregate.pv), ocNumber(aggregate.ess, 0)];
  });
  const missingRows = snapshot.missing.map((row) => [snapshot.label, ocText("missingKey"), row.orderId || ocText("notAvailable"), row.orderLine || ocText("notAvailable"), 1, row.month, row.region, row.customer, row.model, ocNumber(ocMetrics(row).pv), ocNumber(ocMetrics(row).ess, 0)]);
  return [...duplicateRows, ...missingRows];
}
function ocRenderReview() {
  table("orderCompareDuplicateTable", [ocText("source"), ocText("reason"), ocText("soNo"), ocText("soLine"), ocText("count"), ocText("months"), ocText("region"), ocText("customer"), ocText("model"), ocText("pvMw"), ocText("essQty")], [...ocReviewRows(orderComparisonState.oldSnapshot), ...ocReviewRows(orderComparisonState.newSnapshot)]);
}
function ocRenderAll() {
  if (!orderComparisonState) return;
  ocRenderKpis(); ocRenderRegionTable(); ocRenderStatusTable(); ocRenderTransitions(); ocRenderCustomerQuarter(); ocRenderDetails(); ocRenderReview();
}
function ocPopulateFilters() {
  const allRowsForFilters = [...orderComparisonState.oldSnapshot.validRows, ...orderComparisonState.newSnapshot.validRows], currentPeriod = ocCurrentPeriod();
  const regions = [...new Set(allRowsForFilters.map((row) => row.region))].sort(), months = [...new Set([...allRowsForFilters.map((row) => row.month), currentPeriod.month])].sort();
  ocFillSingleSelect(ocRegionSel, [{ value:"__ALL__", label:ocText("all") }, ...regions.map((value) => ({ value, label:value }))], "__ALL__");
  ocFillSingleSelect(ocMonthSel, months.map((value) => ({ value, label:value })), currentPeriod.month);
  ocFillSingleSelect(ocProductSel, [{ value:"__ALL__", label:ocText("all") }, { value:"PV", label:"PV" }, { value:"ESS", label:"ESS" }], "__ALL__");
}
function ocDoneStatus() {
  const reviewCount = orderComparisonState.oldSnapshot.duplicateGroups.length + orderComparisonState.newSnapshot.duplicateGroups.length + orderComparisonState.oldSnapshot.missing.length + orderComparisonState.newSnapshot.missing.length;
  ocStatusEl.textContent = ocText("done", { oldCount:orderComparisonState.oldSnapshot.validRows.length, newCount:orderComparisonState.newSnapshot.validRows.length, reviewCount, date:ocCurrentPeriod().date });
}
async function ocRunComparison() {
  const oldFile = ocOldFileEl.files?.[0], newFile = ocNewFileEl.files?.[0];
  if (!oldFile || !newFile) { ocStatusEl.textContent = ocText("missingFiles"); return; }
  ocRunBtn.disabled = true; ocStatusEl.textContent = ocText("loading");
  try {
    const [oldRows, newRows] = await Promise.all([ocReadOrderRows(oldFile), ocReadOrderRows(newFile)]);
    const oldSnapshot = ocBuildSnapshot(oldRows, ocText("previous")), newSnapshot = ocBuildSnapshot(newRows, ocText("current"));
    orderComparisonState = { oldSnapshot, newSnapshot, comparison:ocBuildComparison(oldSnapshot, newSnapshot) };
    ocPopulateFilters(); ocResultsEl.hidden = false; ocRenderAll(); ocDoneStatus();
  } catch (error) {
    ocStatusEl.textContent = ocText("failed", { message:error.message || error });
  } finally { ocRunBtn.disabled = false; }
}
function refreshOrderComparisonLanguage() {
  const previousSelection = { region:ocRegionSel.value, month:ocMonthSel.value, product:ocProductSel.value };
  document.querySelectorAll("[data-order-compare-text]").forEach((element) => { element.textContent = ocText(element.dataset.orderCompareText); });
  if (orderComparisonState) {
    orderComparisonState.oldSnapshot.label = ocText("previous"); orderComparisonState.newSnapshot.label = ocText("current");
    ocPopulateFilters();
    if ([...ocRegionSel.options].some((option) => option.value === previousSelection.region)) ocRegionSel.value = previousSelection.region;
    if ([...ocMonthSel.options].some((option) => option.value === previousSelection.month)) ocMonthSel.value = previousSelection.month;
    if ([...ocProductSel.options].some((option) => option.value === previousSelection.product)) ocProductSel.value = previousSelection.product;
    ocRenderAll(); ocDoneStatus();
  }
}

ocRunBtn.addEventListener("click", ocRunComparison);
[ocRegionSel, ocMonthSel, ocProductSel].forEach((element) => element.addEventListener("change", ocRenderAll));
refreshOrderComparisonLanguage();
