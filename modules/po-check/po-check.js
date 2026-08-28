(() => {
  "use strict";

  const purchaseInput = document.getElementById("purchaseFile");
  const odpInput = document.getElementById("odpFile");
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

  let report = null;
  let downloadUrl = null;

  const TYPE_MAP = { "INTERNAL": "Internal", "OFFSHORE": "Offshore purchase", "ONGOING B/L CHANGE": "Internal" };
  const APPROVAL_VALUES = new Set(["APPROVED", "APPROVING"]);

  function text(value) { return value == null ? "" : String(value).trim(); }
  function normalize(value) { return text(value).replace(/\s+/g, " ").toUpperCase(); }
  function escapeHtml(value) { return text(value).replace(/[&<>"']/g, (c) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "\"":"&quot;", "'":"&#39;" }[c])); }
  function unique(values) { return [...new Set(values.filter(Boolean))]; }
  function cellRange(ws) {
    const cells = Object.keys(ws).filter((key) => /^[A-Z]+\d+$/.test(key));
    if (!cells.length) return;
    let minC = Infinity, minR = Infinity, maxC = 0, maxR = 0;
    for (const addr of cells) { const p = XLSX.utils.decode_cell(addr); minC = Math.min(minC, p.c); minR = Math.min(minR, p.r); maxC = Math.max(maxC, p.c); maxR = Math.max(maxR, p.r); }
    ws["!ref"] = XLSX.utils.encode_range({ s:{c:minC,r:minR}, e:{c:maxC,r:maxR} });
  }
  function getRows(wb, name) {
    const ws = wb.Sheets[name];
    if (!ws) throw new Error(`未找到工作表：${name}`);
    cellRange(ws); // The export used in the sample contains an incomplete Excel !ref; rebuild it from real cells.
    return XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: false, dateNF: "yyyy-mm-dd" });
  }
  async function loadWorkbook(file) { return XLSX.read(await file.arrayBuffer(), { type:"array", cellDates:true }); }
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
  function numbers(value) { const n = Number(String(value ?? "").replace(/,/g, "")); return Number.isFinite(n) ? n : 0; }
  function setEqual(a, b) { return a.length === b.length && a.every((v) => b.includes(v)); }
  function valuesLabel(values) { return values.length ? values.join(" | ") : "（空）"; }
  function chooseApprovalColumn(rows) {
    let best = -1, bestCount = -1;
    const maxCols = Math.max(...rows.slice(0, 100).map((r) => r.length));
    for (let c = 0; c < maxCols; c += 1) {
      const count = rows.reduce((sum, r) => sum + (APPROVAL_VALUES.has(normalize(r[c])) ? 1 : 0), 0);
      if (count > bestCount) { best = c; bestCount = count; }
    }
    if (bestCount < 1) throw new Error("无法识别采购单的 Approved / Approving 状态列。");
    return best;
  }
  function referencesFrom(value, knownRefs) {
    const source = normalize(value).replace(/[，、；;|/\\\n\r]+/g, " ");
    const hits = knownRefs.filter((ref) => source.includes(normalize(ref)));
    const generic = source.match(/\b(?:\d{2}[A-Z]{3}\d{3}(?:\.\d{1,3})+|[A-Z]{3,8}\d{3}(?:\.\d{1,3})+)\b/g) || [];
    return unique([...hits, ...generic]).map((v) => v.toUpperCase()).sort();
  }
  function resultPill(result) {
    const label = result === "通过" ? "ok" : result.includes("需复核") ? "review" : "issue";
    return `<span class="pill ${label}">${escapeHtml(result)}</span>`;
  }
  function buildReport(purchaseWb, odpWb) {
    const headRows = getRows(purchaseWb, "purchase order head");
    const lineRows = getRows(purchaseWb, "purchase order line");
    const poCheckRows = getRows(odpWb, "PO Check");
    if (headRows.length < 2 || lineRows.length < 2 || poCheckRows.length < 2) throw new Error("上传的工作表没有可核验的数据。");

    const headHeaders = headRows[0]; const headData = headRows.slice(1).filter((r) => text(r[1]));
    const lineHeaders = lineRows[0]; const lineData = lineRows.slice(1).filter((r) => text(r[0]));
    const pcHeaders = poCheckRows[0]; const pcData = poCheckRows.slice(1).filter((r) => text(r[0]));
    const headIndex = { po: headerIndex(headHeaders,"Purchase order Number"), type: headerIndex(headHeaders,"Purchase Type"), customerPo: headerIndex(headHeaders,"Customer Po"), eta: headerIndex(headHeaders,"Estimated time of arrival") };
    const lineIndex = { po: headerIndex(lineHeaders,"Purchase order Number"), sku: headerIndex(lineHeaders,"Customer Model"), qty: headerIndex(lineHeaders,"Qty") };
    const pcIndex = { ref: headerIndex(pcHeaders,"TCL REFERENCE"), type: headerIndex(pcHeaders,"New Ark PO Type"), sku: headerIndex(pcHeaders,"New Ark SKU"), qty: headerIndex(pcHeaders,"QUANTITY"), po: headerIndex(pcHeaders,"SPTN-PVHK New Ark PO#"), etaPo: headerIndex(pcHeaders,"NewArk ETA PO"), etaUpdate: headerIndex(pcHeaders,"ETA for New Ark update") };
    for (const [group, indexes] of Object.entries({ "采购单抬头":headIndex, "采购单行":lineIndex, "PO Check":pcIndex })) if (Object.values(indexes).some((i) => i < 0)) throw new Error(`${group}缺少必需列，请使用标准导出文件。`);
    const approvalCol = chooseApprovalColumn(headData);
    const xCol = approvalCol + 1;
    const poCheckByPo = new Map();
    for (const row of pcData) { const po = text(row[pcIndex.po]); if (!po) continue; if (!poCheckByPo.has(po)) poCheckByPo.set(po, []); poCheckByPo.get(po).push(row); }
    const linesByPo = new Map();
    for (const row of lineData) { const po = text(row[lineIndex.po]); if (!po) continue; if (!linesByPo.has(po)) linesByPo.set(po, []); linesByPo.get(po).push(row); }
    const updatedHeaders = [...headHeaders]; while (updatedHeaders.length <= xCol) updatedHeaders.push("");
    updatedHeaders[approvalCol] = "Approval Status (detected)";
    updatedHeaders[xCol] = "TCL Reference (X)";
    updatedHeaders.push("Original Estimated time of arrival", "Suggested ETA", "ETA update action");
    const results = []; const skuResults = []; const updatedHeads = [];
    for (const row of headData) {
      const po = text(row[headIndex.po]); const approval = text(row[approvalCol]);
      const copied = [...row]; while (copied.length <= xCol) copied.push("");
      let suggestedEta = "", action = "不适用";
      if (!APPROVAL_VALUES.has(normalize(approval))) { updatedHeads.push([...copied, dateIso(row[headIndex.eta]), "", action]); continue; }
      const odp = poCheckByPo.get(po) || [];
      const poEta = dateIso(row[headIndex.eta]);
      const odpTypes = unique(odp.map((r) => text(r[pcIndex.type])));
      const expectedTypes = unique(odpTypes.map((v) => TYPE_MAP[normalize(v)] || "需定义映射"));
      const etaPo = unique(odp.map((r) => dateIso(r[pcIndex.etaPo])));
      const etaUpdate = unique(odp.map((r) => dateIso(r[pcIndex.etaUpdate])));
      const odpRefs = unique(odp.map((r) => normalize(r[pcIndex.ref]))).sort();
      const customerRefs = referencesFrom(row[headIndex.customerPo], odpRefs);
      const xRefs = referencesFrom(row[xCol], odpRefs);
      const sourceRefs = unique([...customerRefs, ...xRefs]).sort();
      let typeResult = "不适用", etaPoResult = "不适用", etaUpdateResult = "不适用", refResult = "不适用", skuResult = "不适用", notes = [];
      if (!odp.length) { typeResult = etaPoResult = etaUpdateResult = refResult = skuResult = "未在 PO Check 找到"; action = "需人工核对"; notes.push("采购单号未在 PO Check 找到。"); }
      else if (approval === "Approved") {
        etaPoResult = etaPo.length === 1 ? (etaPo[0] === poEta ? "通过" : "NewArk ETA PO 不一致") : (etaPo.length ? "需复核：多条 NewArk ETA PO" : "NewArk ETA PO 缺失");
        etaUpdateResult = etaUpdate.length === 1 ? (etaUpdate[0] === poEta ? "通过" : "ETA 更新不一致") : (etaUpdate.length ? "需复核：多条 ETA 更新" : "ETA 更新缺失");
        if (etaUpdate.length === 1 && etaUpdate[0] !== poEta) { suggestedEta = etaUpdate[0]; action = "建议更新 ETA"; copied[headIndex.eta] = suggestedEta; }
        else if (etaUpdate.length > 1) action = "需人工选择 ETA";
        else action = "无需更新 ETA";
      } else {
        typeResult = expectedTypes.length === 1 ? (text(row[headIndex.type]) === expectedTypes[0] ? "通过" : "采购类型不一致") : "需复核：多种 PO 类型";
        etaUpdateResult = etaUpdate.length === 1 ? (etaUpdate[0] === poEta ? "通过" : "ETA 更新不一致") : (etaUpdate.length ? "需复核：多条 ETA 更新" : "ETA 更新缺失");
        refResult = setEqual(sourceRefs, odpRefs) ? "通过" : "TCL Reference 不一致";
        action = etaUpdateResult === "通过" ? "无需更新 ETA" : "核对后更新 ETA";
        const purchaseSku = new Map(); const odpSku = new Map();
        for (const line of linesByPo.get(po) || []) { const sku = text(line[lineIndex.sku]); if (sku) purchaseSku.set(sku, (purchaseSku.get(sku) || 0) + numbers(line[lineIndex.qty])); }
        for (const check of odp) { const sku = text(check[pcIndex.sku]); if (sku) odpSku.set(sku, (odpSku.get(sku) || 0) + numbers(check[pcIndex.qty])); }
        const allSku = unique([...purchaseSku.keys(), ...odpSku.keys()]).sort(); let skuIssues = 0;
        for (const sku of allSku) { const inPurchase = purchaseSku.has(sku), inOdp = odpSku.has(sku); const left = purchaseSku.get(sku) || 0, right = odpSku.get(sku) || 0; const result = !inPurchase ? "采购单缺少 SKU" : !inOdp ? "PO Check 缺少 SKU" : Math.abs(left-right) < 0.000001 ? "通过" : "数量不一致"; if (result !== "通过") skuIssues += 1; skuResults.push({ po, sku, purchaseQty:left, odpQty:right, result }); }
        skuResult = skuIssues ? `SKU/数量有 ${skuIssues} 项差异` : "通过";
      }
      const checks = approval === "Approved" ? [etaPoResult, etaUpdateResult] : [typeResult, etaUpdateResult, refResult, skuResult];
      const overall = checks.every((v) => v === "通过" || v === "不适用") ? "通过" : checks.some((v) => v.includes("需复核") || v.includes("未在")) ? "需复核" : "有差异";
      results.push({ po, approval, purchaseType:text(row[headIndex.type]), expectedType:valuesLabel(expectedTypes), odpTypes:valuesLabel(odpTypes), purchaseEta:poEta, etaPo:valuesLabel(etaPo), etaUpdate:valuesLabel(etaUpdate), typeResult, etaPoResult, etaUpdateResult, customerRefs:valuesLabel(customerRefs), xRefs:valuesLabel(xRefs), odpRefs:valuesLabel(odpRefs), refResult, skuResult, suggestedEta, action, overall, notes:notes.join(" ") });
      updatedHeads.push([...copied, poEta, suggestedEta, action]);
    }
    return { results, skuResults, updatedHeaders, updatedHeads, approvalCol, xCol, unmatched:results.filter((r) => r.overall === "需复核" && r.notes).length };
  }
  function renderSummary() {
    const all = report.results; const approved = all.filter((r) => r.approval === "Approved"); const approving = all.filter((r) => r.approval === "Approving"); const issues = all.filter((r) => r.overall !== "通过"); const etaUpdates = approved.filter((r) => r.action === "建议更新 ETA");
    summaryEl.innerHTML = [["已核验 PO",all.length],["Approved",approved.length],["Approving",approving.length],["差异 / 需复核",issues.length],["建议更新 ETA",etaUpdates.length]].map(([label,value]) => `<div class="metric"><span>${label}</span><b>${value}</b></div>`).join("");
  }
  function filteredResults() {
    return report.results.filter((r) => (scopeFilter.value === "all" || scopeFilter.value === "issue" ? (scopeFilter.value !== "issue" || r.overall !== "通过") : r.approval === scopeFilter.value) && (resultFilter.value === "all" || (resultFilter.value === "ok" ? r.overall === "通过" : r.overall !== "通过")));
  }
  function renderResults() {
    if (!report) return; const rows = filteredResults();
    tableNoteEl.textContent = `显示 ${rows.length} / ${report.results.length} 个已核验 PO。Reference 核验使用 Customer Po 与 Note 后的 X 列。`;
    const cols = [["PO","po"],["状态","approval"],["总体结果","overall"],["采购类型","purchaseType"],["期望类型","expectedType"],["类型核验","typeResult"],["采购单 ETA","purchaseEta"],["NewArk ETA PO","etaPo"],["NewArk ETA 核验","etaPoResult"],["ETA for New Ark update","etaUpdate"],["更新 ETA 核验","etaUpdateResult"],["Customer Po 清洗值","customerRefs"],["X 列清洗值","xRefs"],["PO Check TCL Ref","odpRefs"],["Reference 核验","refResult"],["SKU/数量核验","skuResult"],["建议","action"]];
    const body = rows.map((r) => `<tr class="${r.overall === "通过" ? "" : "row-issue"}">${cols.map(([label,key]) => `<td>${key === "overall" ? resultPill(r[key]) : escapeHtml(r[key])}</td>`).join("")}</tr>`).join("");
    resultTableEl.innerHTML = `<table><thead><tr>${cols.map(([label]) => `<th>${escapeHtml(label)}</th>`).join("")}</tr></thead><tbody>${body}</tbody></table>`;
  }
  function reportSheets(data) {
    const summary = [["Metric","Value"],["Checked POs",data.results.length],["Approved",data.results.filter((r)=>r.approval==="Approved").length],["Approving",data.results.filter((r)=>r.approval==="Approving").length],["Issues / Review",data.results.filter((r)=>r.overall!=="通过").length],["ETA update suggestions",data.results.filter((r)=>r.action==="建议更新 ETA").length],["Type mapping","Internal → Internal"],["Type mapping","Offshore → Offshore purchase"],["Type mapping","ongoing B/L change → Internal"]];
    const poRows = [["PO","Approval status","Overall result","Purchase Type","Expected Purchase Type","ODP PO Type","Purchase ETA","NewArk ETA PO","NewArk ETA PO check","ETA for New Ark update","Update ETA check","Customer Po TCL Ref","X column TCL Ref","PO Check TCL Ref","TCL Ref check","SKU / Qty check","Suggested ETA","ETA action","Notes"], ...data.results.map((r) => [r.po,r.approval,r.overall,r.purchaseType,r.expectedType,r.odpTypes,r.purchaseEta,r.etaPo,r.etaPoResult,r.etaUpdate,r.etaUpdateResult,r.customerRefs,r.xRefs,r.odpRefs,r.refResult,r.skuResult,r.suggestedEta,r.action,r.notes])];
    const skuRows = [["PO","SKU","Purchase Qty","PO Check Qty","Result"], ...data.skuResults.map((r) => [r.po,r.sku,r.purchaseQty,r.odpQty,r.result])];
    return { "Summary":summary, "PO Check Results":poRows, "SKU Qty Results":skuRows, "purchase order head - updated": [data.updatedHeaders, ...data.updatedHeads] };
  }
  function downloadReport() {
    const wb = XLSX.utils.book_new();
    for (const [name, rows] of Object.entries(reportSheets(report))) { const ws = XLSX.utils.aoa_to_sheet(rows); ws["!freeze"] = { xSplit:0, ySplit:1 }; ws["!cols"] = rows[0].map((_, i) => ({ wch: Math.min(42, Math.max(12, ...rows.slice(0,50).map((r) => text(r[i]).length + 2))) })); XLSX.utils.book_append_sheet(wb, ws, name); }
    const output = XLSX.write(wb, { bookType:"xlsx", type:"array" });
    if (downloadUrl) URL.revokeObjectURL(downloadUrl); downloadUrl = URL.createObjectURL(new Blob([output], { type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
    const date = new Date(); const filename = `PO_Check_Result_${date.getFullYear()}${String(date.getMonth()+1).padStart(2,"0")}${String(date.getDate()).padStart(2,"0")}.xlsx`;
    downloadLink.href = downloadUrl; downloadLink.download = filename; downloadLink.textContent = `下载核验结果：${filename}`; downloadLink.style.display = "inline-block";
  }
  async function run() {
    if (!purchaseInput.files[0] || !odpInput.files[0]) { statusEl.textContent = "请先上传采购单详情和 EUPV ODP MASTER 两个文件。"; return; }
    runBtn.disabled = true; downloadLink.style.display = "none"; statusEl.textContent = "正在读取工作簿并按 PO 核验……";
    try { const [purchaseWb, odpWb] = await Promise.all([loadWorkbook(purchaseInput.files[0]), loadWorkbook(odpInput.files[0])]); report = buildReport(purchaseWb, odpWb); renderSummary(); renderResults(); resultsPanel.style.display = "block"; downloadReport(); statusEl.textContent = `核验完成：${report.results.length} 个 Approved / Approving PO，${report.results.filter((r)=>r.overall!=="通过").length} 个有差异或需复核。`; }
    catch (err) { console.error(err); statusEl.textContent = `核验失败：${err?.message || err}`; }
    finally { runBtn.disabled = false; }
  }
  function reset() { purchaseInput.value = ""; odpInput.value = ""; report = null; resultsPanel.style.display = "none"; downloadLink.style.display = "none"; statusEl.textContent = "等待上传文件。"; if (downloadUrl) URL.revokeObjectURL(downloadUrl); downloadUrl = null; }
  runBtn.addEventListener("click", run); resetBtn.addEventListener("click", reset); scopeFilter.addEventListener("change", renderResults); resultFilter.addEventListener("change", renderResults);
})();
