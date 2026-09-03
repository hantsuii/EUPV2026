(() => {
  "use strict";

  const purchaseInput = document.getElementById("purchaseFile");
  const odpInput = document.getElementById("odpFile");
  const warehouseInput = document.getElementById("warehouseFile");
  const runBtn = document.getElementById("runBtn");
  const resetBtn = document.getElementById("resetBtn");
  const statusEl = document.getElementById("status");
  const downloadLink = document.getElementById("downloadLink");
  const resultsPanel = document.getElementById("resultsPanel");
  const summaryEl = document.getElementById("summary");
  const resultTableEl = document.getElementById("resultTable");
  const tableNoteEl = document.getElementById("tableNote");
  const scopeFilter = document.getElementById("scopeFilter");
  const resultFilter = document.getElementById("resultFilter");
  const pageSizeEl = document.getElementById("pageSize");
  const prevPageBtn = document.getElementById("prevPageBtn");
  const nextPageBtn = document.getElementById("nextPageBtn");
  const pageInfoEl = document.getElementById("pageInfo");

  let report = null;
  let downloadUrl = null;
  let lastStatus = { key: "waiting", params: {} };
  let currentPage = 1;

  const TYPE_MAP = { "INTERNAL": "Internal", "OFFSHORE": "Offshore purchase", "ONGOING B/L CHANGE": "Internal" };
  const APPROVAL_VALUES = new Set(["APPROVED", "APPROVING"]);

  function text(value) { return value == null ? "" : String(value).trim(); }
  function normalize(value) { return text(value).replace(/\s+/g, " ").toUpperCase(); }
  function escapeHtml(value) { return text(value).replace(/[&<>"']/g, (c) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "\"":"&quot;", "'":"&#39;" }[c])); }
  function unique(values) { return [...new Set(values.filter(Boolean))]; }
  function t(key, params = {}) { return window.appI18n?.text(key, params) ?? key; }
  function setStatus(key, params = {}) { lastStatus = { key, params }; statusEl.textContent = t(key, params); }
  function cellRange(ws) {
    const cells = Object.keys(ws).filter((key) => /^[A-Z]+\d+$/.test(key));
    if (!cells.length) return;
    let minC = Infinity, minR = Infinity, maxC = 0, maxR = 0;
    for (const addr of cells) { const p = XLSX.utils.decode_cell(addr); minC = Math.min(minC, p.c); minR = Math.min(minR, p.r); maxC = Math.max(maxC, p.c); maxR = Math.max(maxR, p.r); }
    ws["!ref"] = XLSX.utils.encode_range({ s:{c:minC,r:minR}, e:{c:maxC,r:maxR} });
  }
  function getRows(wb, name) {
    const ws = wb.Sheets[name];
    if (!ws) throw new Error(t("missingSheet", { name }));
    cellRange(ws);
    return XLSX.utils.sheet_to_json(ws, { header:1, defval:"", raw:false, dateNF:"yyyy-mm-dd" });
  }
  async function loadWorkbook(file) { return XLSX.read(await file.arrayBuffer(), { type:"array", cellDates:true }); }
  async function loadDefaultWarehouseWorkbook() {
    const response = await fetch("../../templates/logical_warehouse_list.xlsx", { cache:"no-store" });
    if (!response.ok) throw new Error(t("warehouseTemplateMissing", { status:response.status }));
    return XLSX.read(await response.arrayBuffer(), { type:"array", cellDates:true });
  }
  function headerIndex(headers, name) { return headers.findIndex((h) => normalize(h) === normalize(name)); }
  function dateIso(value) {
    const v = text(value);
    if (!v) return "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
    const d = new Date(v);
    if (!Number.isNaN(d.valueOf())) return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
    const m = v.match(/(\d{4})[/.](\d{1,2})[/.](\d{1,2})/);
    return m ? `${m[1]}-${m[2].padStart(2,"0")}-${m[3].padStart(2,"0")}` : v;
  }
  function excelDate(value) {
    const iso = dateIso(value);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
    const [year, month, day] = iso.split("-").map(Number);
    return new Date(year, month - 1, day);
  }
  function etaWithinOneDay(left, right) {
    if (!left || !right) return false;
    const days = Math.abs((excelDate(left) - excelDate(right)) / 86400000);
    return Number.isFinite(days) && days <= 1;
  }
  function numbers(value) { const n = Number(String(value ?? "").replace(/,/g, "")); return Number.isFinite(n) ? n : 0; }
  function setEqual(a, b) { return a.length === b.length && a.every((v) => b.includes(v)); }
  function valuesLabel(values) { return values.length ? values.join(" | ") : "（空）"; }
  function chooseApprovalColumn(rows, headers) {
    let best = -1, bestCount = -1;
    const maxCols = Math.max(...rows.slice(0, 100).map((r) => r.length));
    for (let c = 0; c < maxCols; c += 1) {
      const count = rows.reduce((sum, r) => sum + (APPROVAL_VALUES.has(normalize(r[c])) ? 1 : 0), 0);
      if (count > bestCount) { best = c; bestCount = count; }
    }
    if (bestCount < 1) {
      const noteColumn = headerIndex(headers, "Note");
      if (noteColumn >= 0) return noteColumn;
      const approvalHeader = headerIndex(headers, "Approval Status");
      if (approvalHeader >= 0) return approvalHeader + 1;
      throw new Error(t("approvalColumnMissing"));
    }
    return best;
  }
  function referencesFrom(value, knownRefs) {
    const source = normalize(value).replace(/[，、；;|/\\\n\r]+/g, " ");
    const hits = knownRefs.filter((ref) => source.includes(normalize(ref)));
    const generic = source.match(/\b(?:\d{2}[A-Z]{3}\d{3}(?:\.\d{1,3})+|[A-Z]{3,8}\d{3}(?:\.\d{1,3})+)\b/g) || [];
    return unique([...hits, ...generic]).map((v) => v.toUpperCase()).sort();
  }
  function displayValue(value) {
    const exact = {
      "通过":"valuePass", "需复核":"valueReview", "有差异":"valueIssue", "不适用":"valueNA",
      "需定义映射":"valueMappingNeeded", "未在 PO Check 找到":"valuePoMissing", "需人工核对":"valueManualCheck",
      "NewArk ETA PO 不一致":"valueEtaPoMismatch", "需复核：多条 NewArk ETA PO":"valueMultipleEtaPo", "NewArk ETA PO 缺失":"valueEtaPoMissing",
      "ETA 更新不一致":"valueEtaUpdateMismatch", "需复核：多条 ETA 更新":"valueMultipleEtaUpdate", "ETA 更新缺失":"valueEtaUpdateMissing",
      "建议更新 ETA":"valueSuggestEta", "需人工选择 ETA":"valueChooseEta", "无需更新 ETA":"valueNoEtaUpdate", "核对后更新 ETA":"valueReviewThenEta",
      "采购类型不一致":"valueTypeMismatch", "需复核：多种 PO 类型":"valueMultipleTypes", "TCL Reference 不一致":"valueRefMismatch",
      "采购单缺少 SKU":"valuePurchaseSkuMissing", "PO Check 缺少 SKU":"valueOdpSkuMissing", "数量不一致":"valueQtyMismatch", "仓库映射缺失":"valueWarehouseMappingMissing", "仓库不一致":"valueWarehouseMismatch", "（空）":"valueBlank"
    };
    if (exact[value]) return t(exact[value]);
    const skuMatch = text(value).match(/^SKU\/数量有 (\d+) 项差异$/);
    return skuMatch ? t("valueSkuIssues", { count:skuMatch[1] }) : value;
  }
  function resultPriority(row) {
    if (row.overall === "需复核") return 0;
    if (row.etaNeedsAdjustment) return 1;
    if (row.overall === "有差异") return 2;
    return 3;
  }
  function sortedResults(rows) { return [...rows].sort((a, b) => resultPriority(a) - resultPriority(b) || a.po.localeCompare(b.po)); }
  function resultPill(row) {
    const cls = row.overall === "通过" ? "ok" : row.overall === "需复核" ? "review" : row.etaNeedsAdjustment ? "eta" : "issue";
    return `<span class="pill ${cls}">${escapeHtml(displayValue(row.overall))}</span>`;
  }
  function buildWarehouseMap(rows) {
    if (rows.length < 2) throw new Error(t("warehouseNoData"));
    const headers = rows[0];
    const nameCol = headerIndex(headers, "Virtual warehouse name");
    const codeCol = headerIndex(headers, "Virtual warehouse code");
    if (nameCol < 0 || codeCol < 0) throw new Error(t("warehouseColumnsMissing"));
    const map = new Map();
    for (const row of rows.slice(1)) {
      const name = text(row[nameCol]);
      const code = text(row[codeCol]);
      if (name) map.set(normalize(name), name);
      if (code && name) map.set(normalize(code), name);
    }
    return map;
  }
  function buildReport(purchaseWb, odpWb, warehouseWb) {
    const headRows = getRows(purchaseWb, "purchase order head");
    const lineRows = getRows(purchaseWb, "purchase order line");
    const poCheckRows = getRows(odpWb, "PO Check");
    const warehouseMap = buildWarehouseMap(getRows(warehouseWb, "Sheet1"));
    if (headRows.length < 2 || lineRows.length < 2 || poCheckRows.length < 2) throw new Error(t("noData"));

    const headHeaders = headRows[0]; const headData = headRows.slice(1).filter((r) => text(r[1]));
    const lineHeaders = lineRows[0]; const lineData = lineRows.slice(1).filter((r) => text(r[0]));
    const pcHeaders = poCheckRows[0]; const pcData = poCheckRows.slice(1).filter((r) => text(r[0]));
    const headIndex = {
      po:headerIndex(headHeaders,"Purchase order Number"), type:headerIndex(headHeaders,"Purchase Type"), tms:headerIndex(headHeaders,"TMS bill Number / voucher bill Number"),
      customerPo:headerIndex(headHeaders,"Customer Po"), category:headerIndex(headHeaders,"Category"), eta:headerIndex(headHeaders,"Estimated time of arrival"), status:headerIndex(headHeaders,"Status")
    };
    const lineIndex = { po:headerIndex(lineHeaders,"Purchase order Number"), sku:headerIndex(lineHeaders,"Customer Model"), qty:headerIndex(lineHeaders,"Qty"), storage:headerIndex(lineHeaders,"Storage Space") };
    const pcIndex = { ref:headerIndex(pcHeaders,"TCL REFERENCE"), type:headerIndex(pcHeaders,"New Ark PO Type"), wh:headerIndex(pcHeaders,"New Ark WH"), sku:headerIndex(pcHeaders,"New Ark SKU"), model:headerIndex(pcHeaders,"Model"), qty:headerIndex(pcHeaders,"QUANTITY"), po:headerIndex(pcHeaders,"SPTN-PVHK New Ark PO#"), etaPo:headerIndex(pcHeaders,"NewArk ETA PO"), etaUpdate:headerIndex(pcHeaders,"ETA for New Ark update") };
    for (const [group, indexes] of Object.entries({ purchaseHead:headIndex, purchaseLine:lineIndex, poCheck:pcIndex })) if (Object.values(indexes).some((i) => i < 0)) throw new Error(t("missingColumns", { group:t(group) }));
    const approvalCol = chooseApprovalColumn(headData, headHeaders);
    const xCol = approvalCol + 1;
    const poCheckByPo = new Map();
    for (const row of pcData) { const po = text(row[pcIndex.po]); if (!po) continue; if (!poCheckByPo.has(po)) poCheckByPo.set(po, []); poCheckByPo.get(po).push(row); }
    const linesByPo = new Map();
    for (const row of lineData) { const po = text(row[lineIndex.po]); if (!po) continue; if (!linesByPo.has(po)) linesByPo.set(po, []); linesByPo.get(po).push(row); }

    const results = []; const skuResults = []; const poOutputRows = [];
    const makeOutputRow = (row, eta) => [text(row[headIndex.po]), text(row[headIndex.type]), text(row[headIndex.tms]), text(row[headIndex.customerPo]), text(row[headIndex.category]), dateIso(eta), text(row[headIndex.status]), text(row[approvalCol]), text(row[xCol])];
    for (const row of headData) {
      const po = text(row[headIndex.po]); const approval = text(row[approvalCol]); const purchaseStatus = text(row[headIndex.status]);
      const originalEta = dateIso(row[headIndex.eta]);

      const odp = poCheckByPo.get(po) || [];
      const poEta = dateIso(row[headIndex.eta]);
      const isApproving = normalize(approval) === "APPROVING";
      const odpTypes = unique(odp.map((r) => text(r[pcIndex.type])));
      const expectedTypes = unique(odpTypes.map((v) => TYPE_MAP[normalize(v)] || "需定义映射"));
      const etaPo = unique(odp.map((r) => dateIso(r[pcIndex.etaPo])));
      const etaUpdate = unique(odp.map((r) => dateIso(r[pcIndex.etaUpdate])));
      const odpRefs = unique(odp.map((r) => normalize(r[pcIndex.ref]))).sort();
      const skus = unique(odp.map((r) => text(r[pcIndex.sku]))).sort();
      const models = unique(odp.map((r) => text(r[pcIndex.model]))).sort();
      const customerRefs = referencesFrom(row[headIndex.customerPo], odpRefs);
      const xRefs = referencesFrom(row[xCol], odpRefs);
      const sourceRefs = unique([...customerRefs, ...xRefs]).sort();
      let typeResult = "不适用", etaPoResult = "不适用", etaUpdateResult = "不适用", refResult = "不适用", skuResult = "不适用", warehouseResult = "不适用", suggestedEta = "", action = "不适用";
      const notes = [];
      if (!odp.length) {
        typeResult = etaPoResult = etaUpdateResult = refResult = skuResult = warehouseResult = "未在 PO Check 找到";
        action = "需人工核对"; notes.push("采购单号未在 PO Check 找到。");
      } else {
        typeResult = expectedTypes.length === 1 ? (text(row[headIndex.type]) === expectedTypes[0] ? "通过" : "采购类型不一致") : "需复核：多种 PO 类型";
        etaPoResult = isApproving ? "不适用" : etaPo.length === 1 ? (etaWithinOneDay(etaPo[0], poEta) ? "通过" : "NewArk ETA PO 不一致") : (etaPo.length ? "需复核：多条 NewArk ETA PO" : "NewArk ETA PO 缺失");
        const etaUpdateIsNormal = etaUpdate.length === 1 && (etaWithinOneDay(etaUpdate[0], poEta) || (etaPo.length === 1 && etaWithinOneDay(etaUpdate[0], etaPo[0])));
        etaUpdateResult = etaUpdate.length === 1 ? (etaUpdateIsNormal ? "通过" : "ETA 更新不一致") : (etaUpdate.length ? "需复核：多条 ETA 更新" : "ETA 更新缺失");
        refResult = setEqual(sourceRefs, odpRefs) ? "通过" : "TCL Reference 不一致";
        const purchaseWarehouses = unique((linesByPo.get(po) || []).map((line) => {
          const storage = text(line[lineIndex.storage]);
          return warehouseMap.get(normalize(storage)) || (storage ? `未映射：${storage}` : "");
        })).sort();
        const odpWarehouses = unique(odp.map((check) => text(check[pcIndex.wh]))).sort();
        warehouseResult = purchaseWarehouses.length && !purchaseWarehouses.some((value) => value.startsWith("未映射：")) && odpWarehouses.length && setEqual(purchaseWarehouses.map(normalize), odpWarehouses.map(normalize)) ? "通过" : purchaseWarehouses.some((value) => value.startsWith("未映射：")) ? "仓库映射缺失" : "仓库不一致";
        if (etaUpdate.length === 1 && etaUpdateResult === "ETA 更新不一致") { suggestedEta = etaUpdate[0]; action = "建议更新 ETA"; }
        else if (etaUpdate.length > 1) action = "需人工选择 ETA";
        else action = etaUpdateResult === "通过" ? "无需更新 ETA" : "需人工核对";
        const purchaseSku = new Map(); const odpSku = new Map();
        for (const line of linesByPo.get(po) || []) { const sku = text(line[lineIndex.sku]); if (sku) purchaseSku.set(sku, (purchaseSku.get(sku) || 0) + numbers(line[lineIndex.qty])); }
        for (const check of odp) { const sku = text(check[pcIndex.sku]); if (sku) odpSku.set(sku, (odpSku.get(sku) || 0) + numbers(check[pcIndex.qty])); }
        const allSku = unique([...purchaseSku.keys(), ...odpSku.keys()]).sort(); let skuIssues = 0;
        for (const sku of allSku) { const inPurchase = purchaseSku.has(sku), inOdp = odpSku.has(sku); const left = purchaseSku.get(sku) || 0, right = odpSku.get(sku) || 0; const result = !inPurchase ? "采购单缺少 SKU" : !inOdp ? "PO Check 缺少 SKU" : Math.abs(left-right) < 0.000001 ? "通过" : "数量不一致"; if (result !== "通过") skuIssues += 1; skuResults.push({ po, sku, purchaseQty:left, odpQty:right, result }); }
        skuResult = skuIssues ? `SKU/数量有 ${skuIssues} 项差异` : "通过";
      }
      const checks = [typeResult, etaPoResult, etaUpdateResult, refResult, skuResult, warehouseResult];
      const overall = checks.every((v) => v === "通过" || v === "不适用") ? "通过" : checks.some((v) => v.includes("需复核") || v.includes("未在")) ? "需复核" : "有差异";
      const etaNeedsAdjustment = etaUpdateResult === "ETA 更新不一致" && overall === "有差异";
      const poSkuDetails = skuResults.filter((item) => item.po === po).map((item) => `${item.sku}: ${item.purchaseQty} / ${item.odpQty} (${displayValue(item.result)})`).join("\n");
      const purchaseWarehouses = unique((linesByPo.get(po) || []).map((line) => warehouseMap.get(normalize(text(line[lineIndex.storage]))) || (text(line[lineIndex.storage]) ? `未映射：${text(line[lineIndex.storage])}` : ""))).sort();
      const odpWarehouses = unique(odp.map((check) => text(check[pcIndex.wh]))).sort();
      results.push({ po, approval, purchaseStatus, skus:valuesLabel(skus), models:valuesLabel(models), purchaseType:text(row[headIndex.type]), expectedType:valuesLabel(expectedTypes), odpTypes:valuesLabel(odpTypes), purchaseEta:poEta, etaPo:valuesLabel(etaPo), etaUpdate:valuesLabel(etaUpdate), typeResult, etaPoResult, etaUpdateResult, customerRefs:valuesLabel(customerRefs), xRefs:valuesLabel(xRefs), odpRefs:valuesLabel(odpRefs), refResult, skuResult, skuQtyDetail:poSkuDetails || "（空）", purchaseWarehouses:valuesLabel(purchaseWarehouses), odpWarehouses:valuesLabel(odpWarehouses), warehouseResult, suggestedEta, action, overall, etaNeedsAdjustment, notes:notes.join(" ") });
      poOutputRows.push(makeOutputRow(row, originalEta));
    }
    return { results:sortedResults(results), skuResults, poOutputRows, sourceRows:headData.length };
  }
  function renderSummary() {
    const all = report.results; const visible = all.filter((r) => normalize(r.purchaseStatus) !== "IN STOCK"); const hiddenInStock = all.length - visible.length; const approved = all.filter((r) => normalize(r.approval) === "APPROVED"); const approving = all.filter((r) => normalize(r.approval) === "APPROVING"); const issues = all.filter((r) => r.overall !== "通过"); const etaUpdates = all.filter((r) => r.etaNeedsAdjustment);
    summaryEl.innerHTML = [[t("checkedPo"),all.length],[t("visiblePo"),visible.length],[t("hiddenInStock"),hiddenInStock],["Approved",approved.length],["Approving",approving.length],[t("issuesReview"),issues.length],[t("etaAdjustments"),etaUpdates.length]].map(([label,value]) => `<div class="metric"><span>${escapeHtml(label)}</span><b>${value}</b></div>`).join("");
  }
  function filteredResults() {
    const rows = report.results.filter((r) => normalize(r.purchaseStatus) !== "IN STOCK").filter((r) => (scopeFilter.value === "all" || scopeFilter.value === "issue" ? (scopeFilter.value !== "issue" || r.overall !== "通过") : normalize(r.approval) === normalize(scopeFilter.value)) && (resultFilter.value === "all" || (resultFilter.value === "ok" ? r.overall === "通过" : r.overall !== "通过")));
    return sortedResults(rows);
  }
  function renderResults() {
    if (!report) return;
    const rows = filteredResults();
    const pageSize = Math.max(10, Number(pageSizeEl?.value || 50));
    const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
    currentPage = Math.min(Math.max(1, currentPage), totalPages);
    const start = (currentPage - 1) * pageSize;
    const pageRows = rows.slice(start, start + pageSize);
    const shownStart = rows.length ? start + 1 : 0; const shownEnd = start + pageRows.length;
    const hiddenInStock = report.results.filter((r) => normalize(r.purchaseStatus) === "IN STOCK").length;
    tableNoteEl.textContent = t("tableNote", { start:shownStart, end:shownEnd, filtered:rows.length, total:report.results.length, hidden:hiddenInStock });
    pageInfoEl.textContent = t("pageInfo", { page:currentPage, pages:totalPages });
    prevPageBtn.disabled = currentPage <= 1; nextPageBtn.disabled = currentPage >= totalPages;
    const cols = [["colPo","po"],["colApproval","approval"],["colOverall","overall"],["colPurchaseStatus","purchaseStatus"],["colSku","skus"],["colModel","models"],["colPurchaseType","purchaseType"],["colExpectedType","expectedType"],["colTypeCheck","typeResult"],["colPurchaseEta","purchaseEta"],["colNewArkEtaPo","etaPo"],["colNewArkEtaCheck","etaPoResult"],["colEtaUpdate","etaUpdate"],["colEtaUpdateCheck","etaUpdateResult"],["colCustomerRefs","customerRefs"],["colXRefs","xRefs"],["colOdpRefs","odpRefs"],["colRefCheck","refResult"],["colSkuCheck","skuResult"],["colSkuQtyDetail","skuQtyDetail"],["colPurchaseWarehouse","purchaseWarehouses"],["colOdpWarehouse","odpWarehouses"],["colWarehouseCheck","warehouseResult"],["colAction","action"]];
    const body = pageRows.map((r) => {
      const cls = r.overall === "需复核" ? "row-review" : r.etaNeedsAdjustment ? "row-eta-diff" : r.overall === "有差异" ? "row-issue" : "";
      return `<tr class="${cls}">${cols.map(([,key]) => `<td class="${key === "skuQtyDetail" ? "multiline" : ""}">${key === "overall" ? resultPill(r) : escapeHtml(displayValue(r[key]))}</td>`).join("")}</tr>`;
    }).join("");
    resultTableEl.innerHTML = `<table><thead><tr>${cols.map(([key]) => `<th>${escapeHtml(t(key))}</th>`).join("")}</tr></thead><tbody>${body}</tbody></table>`;
  }
  function reportSheets(data) {
    const firstHeaders = ["Purchase order Number","Purchase Type","TMS bill Number / voucher bill Number","Customer Po","Category","Estimated time of arrival","Status","Approval Status","Note"];
    const ordered = sortedResults(data.results);
    const summary = [["Metric","Value"],["Checked POs",data.results.length],["Approved",data.results.filter((r)=>normalize(r.approval)==="APPROVED").length],["Approving",data.results.filter((r)=>normalize(r.approval)==="APPROVING").length],["Other approval status",data.results.filter((r)=>!APPROVAL_VALUES.has(normalize(r.approval))).length],["Issues / Review",data.results.filter((r)=>r.overall!=="通过").length],["ETA adjustments",data.results.filter((r)=>r.etaNeedsAdjustment).length],["Check scope","All PO statuses; all checks enabled"],["PO Details ETA","Original purchase-order ETA"],["Type mapping","Internal → Internal"],["Type mapping","Offshore → Offshore purchase"],["Type mapping","ongoing B/L change → Internal"]];
    const poRows = [["PO","Approval status","Overall result","Purchase Status","SKU","Model","Purchase Type","Expected Purchase Type","ODP PO Type","Purchase ETA","NewArk ETA PO","NewArk ETA PO check","ETA for New Ark update","Update ETA check","Customer Po TCL Ref","X column TCL Ref","PO Check TCL Ref","TCL Ref check","SKU / Qty check","SKU / Qty detail","Purchase warehouse","PO Check New Ark WH","Warehouse check","Suggested ETA","ETA action","Notes"], ...ordered.map((r) => [r.po,r.approval,displayValue(r.overall),r.purchaseStatus,r.skus,r.models,r.purchaseType,r.expectedType,r.odpTypes,r.purchaseEta,r.etaPo,displayValue(r.etaPoResult),r.etaUpdate,displayValue(r.etaUpdateResult),r.customerRefs,r.xRefs,r.odpRefs,displayValue(r.refResult),displayValue(r.skuResult),r.skuQtyDetail,r.purchaseWarehouses,r.odpWarehouses,displayValue(r.warehouseResult),r.suggestedEta,displayValue(r.action),r.notes])];
    const skuRows = [["PO","SKU","Purchase Qty","PO Check Qty","Result"], ...data.skuResults.map((r) => [r.po,r.sku,r.purchaseQty,r.odpQty,displayValue(r.result)])];
    return { "PO Details":[firstHeaders, ...data.poOutputRows], "PO Check Results":poRows, "SKU Qty Results":skuRows, "Summary":summary };
  }
  async function buildOutputWorkbook(data) {
    if (!globalThis.ExcelJS) throw new Error(t("excelJsMissing"));
    const wb = new ExcelJS.Workbook();
    wb.creator = "EUPV2026 PO Check"; wb.created = new Date();
    const sheets = reportSheets(data);
    const headerFill = { type:"pattern", pattern:"solid", fgColor:{ argb:"FF2F75B5" } };
    const headerFont = { bold:true, color:{ argb:"FFFFFFFF" } };
    const reviewFill = { type:"pattern", pattern:"solid", fgColor:{ argb:"FFE4D9F6" } };
    const etaFill = { type:"pattern", pattern:"solid", fgColor:{ argb:"FFC6EFCE" } };
    const issueFill = { type:"pattern", pattern:"solid", fgColor:{ argb:"FFFFE9CC" } };
    for (const [name, rows] of Object.entries(sheets)) {
      const ws = wb.addWorksheet(name, { views:[{ state:"frozen", ySplit:1 }] });
      ws.addRows(rows);
      ws.getRow(1).eachCell((cell) => { cell.fill = headerFill; cell.font = headerFont; cell.alignment = { vertical:"middle", horizontal:"center", wrapText:true }; });
      ws.getRow(1).height = 32;
      ws.autoFilter = { from:{ row:1, column:1 }, to:{ row:Math.max(1, rows.length), column:rows[0].length } };
      ws.columns.forEach((column, idx) => { const values = rows.slice(0, 100).map((r) => text(r[idx]).length + 2); column.width = Math.min(42, Math.max(12, ...values)); });
      ws.eachRow((row, rowNumber) => { if (rowNumber > 1) row.alignment = { vertical:"top" }; });
      if (name === "PO Details") {
        ws.getColumn(6).numFmt = "yyyy-mm-dd";
        for (let rowNumber = 2; rowNumber <= ws.rowCount; rowNumber += 1) {
          const iso = ws.getCell(rowNumber, 6).value; if (iso) ws.getCell(rowNumber, 6).value = excelDate(iso);
          const po = text(ws.getCell(rowNumber, 1).value); const result = data.results.find((r) => r.po === po);
          if (result?.etaNeedsAdjustment) ws.getCell(rowNumber, 6).fill = etaFill;
        }
      }
      if (name === "PO Check Results") {
        for (let i = 0; i < orderedResultRows(data).length; i += 1) {
          const result = orderedResultRows(data)[i]; const row = ws.getRow(i + 2);
          const fill = result.overall === "需复核" ? reviewFill : result.etaNeedsAdjustment ? etaFill : result.overall === "有差异" ? issueFill : null;
          if (fill) row.eachCell((cell) => { cell.fill = fill; });
        }
      }
    }
    return wb;
  }
  function orderedResultRows(data) { return sortedResults(data.results); }
  async function downloadReport() {
    const wb = await buildOutputWorkbook(report);
    const output = await wb.xlsx.writeBuffer();
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    downloadUrl = URL.createObjectURL(new Blob([output], { type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
    const date = new Date(); const filename = `PO_Check_Result_${date.getFullYear()}${String(date.getMonth()+1).padStart(2,"0")}${String(date.getDate()).padStart(2,"0")}.xlsx`;
    downloadLink.href = downloadUrl; downloadLink.download = filename; downloadLink.textContent = t("downloadFile", { file:filename }); downloadLink.style.display = "inline-block";
  }
  async function run() {
    if (!purchaseInput.files[0] || !odpInput.files[0]) { setStatus("selectBothFiles"); return; }
    runBtn.disabled = true; downloadLink.style.display = "none"; setStatus("running");
    try {
      const [purchaseWb, odpWb, warehouseWb] = await Promise.all([loadWorkbook(purchaseInput.files[0]), loadWorkbook(odpInput.files[0]), warehouseInput.files[0] ? loadWorkbook(warehouseInput.files[0]) : loadDefaultWarehouseWorkbook()]);
      report = buildReport(purchaseWb, odpWb, warehouseWb); renderSummary(); renderResults(); resultsPanel.style.display = "block"; await downloadReport();
      setStatus("done", { checked:report.results.length, issues:report.results.filter((r)=>r.overall!=="通过").length });
    } catch (err) { console.error(err); setStatus("failed", { message:err?.message || err }); }
    finally { runBtn.disabled = false; }
  }
  function reset() { purchaseInput.value = ""; odpInput.value = ""; warehouseInput.value = ""; report = null; currentPage = 1; resultsPanel.style.display = "none"; downloadLink.style.display = "none"; if (downloadUrl) URL.revokeObjectURL(downloadUrl); downloadUrl = null; setStatus("waiting"); }
  runBtn.addEventListener("click", run); resetBtn.addEventListener("click", reset);
  scopeFilter.addEventListener("change", () => { currentPage = 1; renderResults(); });
  resultFilter.addEventListener("change", () => { currentPage = 1; renderResults(); });
  pageSizeEl.addEventListener("change", () => { currentPage = 1; renderResults(); });
  prevPageBtn.addEventListener("click", () => { currentPage -= 1; renderResults(); });
  nextPageBtn.addEventListener("click", () => { currentPage += 1; renderResults(); });
  window.addEventListener("app-language-change", () => { statusEl.textContent = t(lastStatus.key, lastStatus.params); if (report) { renderSummary(); renderResults(); } if (downloadLink.download) downloadLink.textContent = t("downloadFile", { file:downloadLink.download }); });
})();
