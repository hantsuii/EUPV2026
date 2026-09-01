const PORT_MAPPING_KEY = "eupv2026_port_mappings_v1";
const byId = (id) => document.getElementById(id);
const fileEl = byId("odpFile");
const stockFileEl = byId("stockFile");
const statusEl = byId("status");
let records = [];
let assumptionRows = [];
let skuModelMatched = 0;
let mainRecordCount = 0;
let quantityZeroCount = 0;
let invalidQuantityCount = 0;
let hasLoadedWorkbook = false;
let mappings = loadMappings();
const modelFilters = { order: null, departure: null, arrival: null };

function t(key, params = {}) { return window.appI18n?.text(key, params) ?? key; }
function copyDefaults() { return (window.DEFAULT_PORT_MAPPINGS || []).map((x) => ({ ...x })); }
function loadMappings() { try { const v = JSON.parse(localStorage.getItem(PORT_MAPPING_KEY)); return Array.isArray(v) ? v : copyDefaults(); } catch (_) { return copyDefaults(); } }
function normalizeText(value) { return String(value ?? "").replace(/\s+/g, " ").trim().toUpperCase(); }
function clean(value) { if (value == null) return null; const text = String(value).replace(/\s+/g, " ").trim(); return !text || ["N/A","NA","-","NONE","NULL"].includes(text.toUpperCase()) ? null : value; }
function toNumber(value) { if (typeof value === "number" && Number.isFinite(value)) return value; if (typeof value === "string" && value.trim()) { const n = Number(value.replace(/,/g,"")); return Number.isFinite(n) ? n : null; } return null; }
function toDate(value) { if (value instanceof Date && !Number.isNaN(value.getTime())) return new Date(value.getFullYear(),value.getMonth(),value.getDate()); if (typeof value === "number" && window.XLSX?.SSF) { const d=XLSX.SSF.parse_date_code(value); if(d)return new Date(d.y,d.m-1,d.d); } if(typeof value==="string"&&value.trim()){const m=value.trim().match(/^(\d{4})[-\/]([01]?\d)[-\/]([0-3]?\d)/);if(m)return new Date(+m[1],+m[2]-1,+m[3]);const d=new Date(value);if(!Number.isNaN(d.getTime()))return new Date(d.getFullYear(),d.getMonth(),d.getDate());} return null; }
function isoDate(value){if(!(value instanceof Date))return "";return `${value.getFullYear()}-${String(value.getMonth()+1).padStart(2,"0")}-${String(value.getDate()).padStart(2,"0")}`;}
function monthKey(value){return value instanceof Date?isoDate(value).slice(0,7):null;}
function headerName(value){return String(value??"").replace(/\s+/g," ").trim();}
function escapeHtml(value){return String(value??"").replace(/[&<>'"]/g,(c)=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));}
function fmtNumber(v,d=0){return Number(v||0).toLocaleString(undefined,{minimumFractionDigits:d,maximumFractionDigits:d});}

function isoWeek(date){
  if(!(date instanceof Date))return null;
  const d=new Date(Date.UTC(date.getFullYear(),date.getMonth(),date.getDate()));
  d.setUTCDate(d.getUTCDate()+4-(d.getUTCDay()||7));
  const y=d.getUTCFullYear(),start=new Date(Date.UTC(y,0,1));
  return `${y}-W${String(Math.ceil((((d-start)/86400000)+1)/7)).padStart(2,"0")}`;
}
function isoWeekMonday(year,week){const jan4=new Date(year,0,4),day=jan4.getDay()||7,monday=new Date(year,0,4-(day-1));monday.setDate(monday.getDate()+(week-1)*7);return monday;}
function weekWithBestYear(week,baseYear,anchor){
  const years=[baseYear-1,baseYear,baseYear+1];
  const chosen=anchor?years.map((year)=>({year,diff:Math.abs(isoWeekMonday(year,week)-anchor)})).sort((a,b)=>a.diff-b.diff)[0].year:baseYear;
  return `${chosen}-W${String(week).padStart(2,"0")}`;
}

const MONTHS={JAN:1,FEB:2,MAR:3,APR:4,MAY:5,JUN:6,JUNE:6,JUL:7,AUG:8,SEP:9,SEPT:9,OCT:10,NOV:11,DEC:12};
function orderMonth(record){
  const match=String(record.reference||"").trim().match(/^(?:(\d{2}))?([A-Za-z]+)/);
  if(!match||!MONTHS[match[2].toUpperCase()])return null;
  const month=MONTHS[match[2].toUpperCase()];
  let year=match[1]?2000+Number(match[1]):null;
  if(!year){const anchor=record.pickupDate||record.etdSO||record.atd||record.etaSO||record.ata;if(!anchor)return null;year=anchor.getFullYear()-(month>anchor.getMonth()+1?1:0);}
  return `${year}-${String(month).padStart(2,"0")}`;
}
function plannedPickupWeek(record){
  const match=String(record.status||"").match(/\bW\s*(\d{1,2})\b/i);
  const order=orderMonth(record),baseYear=order?Number(order.slice(0,4)):(record.etdSO?.getFullYear()||new Date().getFullYear());
  if(match){const anchor=record.etdSO?new Date(record.etdSO.getTime()-7*86400000):(record.pickupDate||record.atd);return weekWithBestYear(Number(match[1]),baseYear,anchor);}
  if(record.etdSO)return isoWeek(new Date(record.etdSO.getTime()-7*86400000));
  return null;
}
function actualPickupWeek(record){if(record.pickupDate)return isoWeek(record.pickupDate);const w=toNumber(record.pickupWeek);if(!w)return null;const order=orderMonth(record);return weekWithBestYear(w,order?Number(order.slice(0,4)):new Date().getFullYear(),record.atd);}
function arrivalInfo(record){if(record.ata)return{date:record.ata,type:"actual"};if(record.etaUpdate)return{date:record.etaUpdate,type:"forecast"};if(record.etaSO)return{date:record.etaSO,type:"forecast"};return{date:null,type:"missing"};}
function departureInfo(record){if(record.atd)return{date:record.atd,type:"actual"};if(record.etdUpdate)return{date:record.etdUpdate,type:"forecast"};if(record.etdSO)return{date:record.etdSO,type:"forecast"};return{date:null,type:"missing"};}
function inMonthRange(value,startId,endId){if(!value)return false;const start=byId(startId).value,end=byId(endId).value;return(!start||value>=start)&&(!end||value<=end);}
function setDefaultMonthRanges(){const current=monthKey(new Date());["order","departure","arrival"].forEach((scope)=>{byId(`${scope}StartMonth`).value=current;byId(`${scope}EndMonth`).value=current;});}
function median(values){if(!values.length)return null;const sorted=[...values].sort((a,b)=>a-b),mid=Math.floor(sorted.length/2);return sorted.length%2?sorted[mid]:(sorted[mid-1]+sorted[mid])/2;}
function percent(count,total){return total?`${(count/total*100).toFixed(1)}%`:"—";}
function modelKey(record){return record.model==null||String(record.model).trim()===""?"__UNKNOWN__":normalizeText(record.model);}
function modelLabel(record){return modelKey(record)==="__UNKNOWN__"?t("unknown"):String(record.model).trim();}
function availableModels(){
  const models=new Map();
  records.filter((r)=>r.source==="PV SUPPLY DATA").forEach((r)=>{const key=modelKey(r);if(!models.has(key))models.set(key,modelLabel(r));});
  return [...models].map(([key,label])=>({key,label})).sort((a,b)=>a.label.localeCompare(b.label,undefined,{numeric:true,sensitivity:"base"}));
}
function matchesModel(record,scope){const selected=modelFilters[scope];return selected===null||selected.has(modelKey(record));}
function commitModelFilter(root){
  if(!root)return;
  const boxes=[...root.querySelectorAll('.model-filter-options input[type="checkbox"]')],chosen=new Set(boxes.filter((x)=>x.checked).map((x)=>x.value));
  modelFilters[root.dataset.scope]=!boxes.length||chosen.size===boxes.length?null:chosen;
}
function renderModelFilters(){
  const options=availableModels();
  document.querySelectorAll(".model-filter").forEach((root)=>{
    const scope=root.dataset.scope,selected=modelFilters[scope],selectedCount=selected===null?options.length:options.filter((x)=>selected.has(x.key)).length;
    const summary=selected===null?t("allModels"):t("selectedModels",{count:selectedCount,total:options.length});
    root.innerHTML=`<label>${escapeHtml(t("modelFilter"))}</label><button class="model-filter-toggle" type="button"><span>${escapeHtml(summary)}</span></button><div class="model-filter-menu"><input class="model-filter-search" type="text" placeholder="${escapeHtml(t("modelSearch"))}"><div class="model-filter-actions"><button class="secondary model-select-all" type="button">${escapeHtml(t("selectAll"))}</button><button class="secondary model-clear-all" type="button">${escapeHtml(t("clearAll"))}</button></div><div class="model-filter-options">${options.map((x)=>`<label class="model-filter-option" data-search="${escapeHtml(normalizeText(x.label))}"><input type="checkbox" value="${escapeHtml(x.key)}"${selected===null||selected.has(x.key)?" checked":""}><span>${escapeHtml(x.label)}</span></label>`).join("")||`<span class="model-filter-option">${escapeHtml(t("noData"))}</span>`}</div><button class="model-filter-apply" type="button">${escapeHtml(t("apply"))}</button></div>`;
  });
}

function saveMappings(){mappings=mappings.map((x)=>({type:x.type==="POL"?"POL":"DEST",raw:normalizeText(x.raw),standard:normalizeText(x.standard),country:String(x.country||"").trim(),note:String(x.note||"").trim()})).filter((x)=>x.raw&&x.standard);localStorage.setItem(PORT_MAPPING_KEY,JSON.stringify(mappings));}
function mappingIndex(){return new Map(mappings.map((x)=>[`${x.type}|${normalizeText(x.raw)}`,x]));}
function resolvePort(raw,type){const normalized=normalizeText(raw);if(!normalized)return null;const mapped=mappingIndex().get(`${type}|${normalized}`);if(mapped)return normalizeText(mapped.standard);if(type==="DEST"&&normalized.includes("-"))return normalizeText(normalized.split("-").at(-1));return normalized;}
function ensureDiscoveredMappings(){const existing=mappingIndex();records.forEach((r)=>[["POL",r.rawPol],["DEST",r.rawDestination]].forEach(([type,raw])=>{const n=normalizeText(raw),key=`${type}|${n}`;if(!n||existing.has(key))return;const item={type,raw:n,standard:type==="DEST"&&n.includes("-")?n.split("-").at(-1):n,country:"",note:"AUTO-DISCOVERED"};mappings.push(item);existing.set(key,item);}));}

function readSheet(workbook,sheetName,headerRow){
  const ws=workbook.Sheets[sheetName];if(!ws)return[];
  const grid=XLSX.utils.sheet_to_json(ws,{header:1,raw:true,defval:null});
  const headers=(grid[headerRow-1]||[]).map(headerName),index=Object.fromEntries(headers.map((h,i)=>[h,i]).filter(([h])=>h));
  const refField=index["TCL REFERENCE"]!=null?"TCL REFERENCE":"TCL REFERENCE NO.",bookingField=index["BOOKING#"]!=null?"BOOKING#":"Booking #";
  return grid.slice(headerRow).flatMap((row)=>{
    const ref=clean(row[index[refField]]);if(ref==null)return[];
    let rawPol=index.POL!=null?clean(row[index.POL]):null;if(rawPol==null&&index["PORT OF LOADING"]!=null)rawPol=clean(row[index["PORT OF LOADING"]]);
    return[{source:sheetName,reference:String(ref).trim(),quantity:toNumber(row[index.QUANTITY]),mw:toNumber(row[index.MW])||0,containers:toNumber(row[index.CONTAINERS])||0,sku:index["New Ark SKU"]!=null?clean(row[index["New Ark SKU"]]):index["PN"]!=null?clean(row[index.PN]):null,model:index.Model!=null?clean(row[index.Model]):index.DESCRIPTION!=null?clean(row[index.DESCRIPTION]):null,factory:index["Factory Location"]!=null?clean(row[index["Factory Location"]]):null,carrier:index.Carrier!=null?clean(row[index.Carrier]):null,status:index.STATUS!=null?String(clean(row[index.STATUS])||""):"",pickupDate:index["Pick-Up Date"]!=null?toDate(row[index["Pick-Up Date"]]):index["PICK-UP DATE"]!=null?toDate(row[index["PICK-UP DATE"]]):null,pickupWeek:index["Pick-Up Week"]!=null?row[index["Pick-Up Week"]]:null,rawPol,rawDestination:clean(row[index["PORT DESTINATION"]]),etdSO:toDate(row[index["ETD On S/O"]]),etdUpdate:toDate(row[index["ETD Update"]]),atd:toDate(row[index["ATD PORT"]]),etaSO:toDate(row[index["ETA On S/O"]]),etaUpdate:toDate(row[index["ETA Update"]]),ata:toDate(row[index["ATA PORT"]]),vessel:index["REFERENCE V.V"]!=null?clean(row[index["REFERENCE V.V"]]):null,booking:index[bookingField]!=null?clean(row[index[bookingField]]):null}];
  });
}

function parseSkuModelMap(workbook){
  const result=new Map(),preferred=["SKU","stock","Legacy Mapping Product"];
  for(const sheetName of [...preferred,...workbook.SheetNames.filter((x)=>!preferred.includes(x))]){
    const ws=workbook.Sheets[sheetName];if(!ws)continue;
    const grid=XLSX.utils.sheet_to_json(ws,{header:1,raw:true,defval:null});
    let headerRow=-1,skuIndex=-1,modelIndex=-1;
    for(let r=0;r<Math.min(10,grid.length);r++){
      const headers=(grid[r]||[]).map(headerName),skuNames=["Sku No","SKU","SKU no.","SKU No","New Ark SKU","SKU no."],modelNames=["Product Model","Model","Item Description"];
      skuIndex=skuNames.map((x)=>headers.indexOf(x)).find((x)=>x>=0)??-1;modelIndex=modelNames.map((x)=>headers.indexOf(x)).find((x)=>x>=0)??-1;
      if(skuIndex>=0&&modelIndex>=0){headerRow=r;break;}
    }
    if(headerRow<0)continue;
    grid.slice(headerRow+1).forEach((row)=>{const sku=normalizeText(row[skuIndex]),model=clean(row[modelIndex]);if(sku&&model&&!result.has(sku))result.set(sku,String(model).trim());});
    if(result.size)break;
  }
  return result;
}

function parseAssumptionRows(workbook){
  const ws=workbook.Sheets["Assumption ATP"];if(!ws)return[];
  const grid=XLSX.utils.sheet_to_json(ws,{header:1,raw:true,defval:null}),headers=(grid[2]||[]).map(headerName);
  const pol=headers.indexOf("PORT OF LOADING"),dest=headers.indexOf("PORT DESTINATION"),wh=headers.indexOf("New Ark WH"),days=headers.indexOf("in Days"),weeks=headers.indexOf("in Weeks"),customs=headers.indexOf("Customs+Leg3"),comments=headers.indexOf("Comments");
  if(pol<0||dest<0)return[];
  return grid.slice(3).flatMap((row)=>clean(row[pol])&&clean(row[dest])?[{rawPol:row[pol],rawDestination:row[dest],warehouse:wh>=0?clean(row[wh]):null,inDays:days>=0?toNumber(row[days]):null,inWeeks:weeks>=0?toNumber(row[weeks]):null,customs:customs>=0?toNumber(row[customs]):null,comments:comments>=0?clean(row[comments]):null}]:[]);
}

async function loadSkuModelMap(){
  let buffer;
  if(stockFileEl.files[0])buffer=await stockFileEl.files[0].arrayBuffer();
  else{const response=await fetch("../../templates/stock_template.xlsx",{cache:"no-store"});if(!response.ok)throw new Error(`Stock template HTTP ${response.status}`);buffer=await response.arrayBuffer();}
  return parseSkuModelMap(XLSX.read(buffer,{type:"array",cellDates:true}));
}

function parseWorkbook(workbook,skuModelMap){
  const sources=[["PV SUPPLY DATA",1],["H2-2025 PV DATA",1],["H1-2025 PV DATA",3]],unique=new Map();quantityZeroCount=0;invalidQuantityCount=0;
  sources.flatMap(([name,row])=>readSheet(workbook,name,row)).forEach((record)=>{if(record.quantity==null){invalidQuantityCount++;return;}if(record.quantity<=0){quantityZeroCount++;return;}if(!unique.has(record.reference))unique.set(record.reference,record);});
  records=[...unique.values()];assumptionRows=parseAssumptionRows(workbook);skuModelMatched=0;
  records.forEach((record)=>{const mapped=skuModelMap.get(normalizeText(record.sku));if(mapped){record.model=mapped;if(record.source==="PV SUPPLY DATA")skuModelMatched++;}});
  const main=records.filter((r)=>r.source==="PV SUPPLY DATA");mainRecordCount=main.length;hasLoadedWorkbook=true;Object.keys(modelFilters).forEach((key)=>{modelFilters[key]=null;});ensureDiscoveredMappings();renderMappingTable();
  setDefaultMonthRanges();
  const dates=records.flatMap((r)=>r.atd?[r.atd]:[]).sort((a,b)=>a-b);if(dates.length){["startDate","performanceStartDate"].forEach((id)=>byId(id).value=isoDate(dates[0]));["endDate","performanceEndDate"].forEach((id)=>byId(id).value=isoDate(dates.at(-1)));}
  renderAll();
}

function groupRows(source,keyFn){const map=new Map();source.forEach((r)=>{const parts=keyFn(r);if(!parts)return;const key=JSON.stringify(parts);if(!map.has(key))map.set(key,{parts,quantity:0,mw:0,containers:0});const x=map.get(key);x.quantity+=r.quantity;x.mw+=r.mw;x.containers+=r.containers;});return[...map.values()];}
function groupOrderRows(source){
  const map=new Map();
  source.forEach((r)=>{
    const month=orderMonth(r);if(!month)return;
    const model=String(r.model||t("unknown")),pol=String(resolvePort(r.rawPol,"POL")||t("unknown")),destination=String(resolvePort(r.rawDestination,"DEST")||t("unknown")),sku=String(r.sku||t("unknown")),parts=[month,model,pol,destination,sku],key=JSON.stringify(parts);
    if(!map.has(key))map.set(key,{parts,mw:0,containers:0,plannedWeeks:new Map(),actualWeeks:new Map()});
    const x=map.get(key),planned=plannedPickupWeek(r),actual=r.atd?isoWeek(r.atd):null;
    x.mw+=r.mw;x.containers+=r.containers;
    if(planned)x.plannedWeeks.set(planned,(x.plannedWeeks.get(planned)||0)+r.containers);else if(r.status.toUpperCase()==="PO FIRM")x.plannedWeeks.set("__NO_PLAN__",(x.plannedWeeks.get("__NO_PLAN__")||0)+r.containers);
    if(actual)x.actualWeeks.set(actual,(x.actualWeeks.get(actual)||0)+r.containers);
  });
  return[...map.values()];
}
function weekBreakdownCell(values,emptyText=""){
  const items=[...values.entries()].sort(([a],[b])=>a==="__NO_PLAN__"?1:b==="__NO_PLAN__"?-1:a.localeCompare(b));if(!items.length)return emptyText;
  const weeks=items.map(([week])=>`<span>${escapeHtml(week==="__NO_PLAN__"?t("statusNoPlan"):week)}</span>`).join(""),containers=items.map(([,count])=>`<span>${escapeHtml(fmtNumber(count,1))} ${escapeHtml(t("containerShort"))}</span>`).join("");
  return{html:`<div class="week-breakdown" style="--week-cols:${items.length}"><div class="week-breakdown-row">${weeks}</div><div class="week-breakdown-row week-containers">${containers}</div></div>`};
}
function renderTable(id,headers,rows){const head=`<thead><tr>${headers.map((h)=>`<th>${escapeHtml(h)}</th>`).join("")}</tr></thead>`,body=rows.length?rows.map((row)=>`<tr>${row.map((v)=>`<td>${v?.html??escapeHtml(v)}</td>`).join("")}</tr>`).join(""):`<tr><td colspan="${headers.length}">${escapeHtml(t("noData"))}</td></tr>`;byId(id).innerHTML=head+`<tbody>${body}</tbody>`;}

function renderBusinessViews(){
  renderModelFilters();
  const allMain=records.filter((r)=>r.source==="PV SUPPLY DATA"),main=allMain.filter((r)=>matchesModel(r,"order")&&inMonthRange(orderMonth(r),"orderStartMonth","orderEndMonth"));
  byId("orderMwKpi").textContent=fmtNumber(main.reduce((s,r)=>s+r.mw,0),3);byId("orderContainerKpi").textContent=fmtNumber(main.reduce((s,r)=>s+r.containers,0),1);
  const orders=groupOrderRows(main).sort((a,b)=>a.parts[1].localeCompare(b.parts[1])||a.parts[3].localeCompare(b.parts[3])||a.parts[2].localeCompare(b.parts[2])||a.parts[0].localeCompare(b.parts[0])||a.parts[4].localeCompare(b.parts[4]));
  renderTable("orderTable",[t("hOrderMonth"),t("hModel"),t("hPol"),t("hDestination"),t("hSku"),t("hPlannedPickup"),t("hActualShip"),t("hMw"),t("hContainers")],orders.map((x)=>[x.parts[0],x.parts[1],x.parts[2],x.parts[3],x.parts[4],weekBreakdownCell(x.plannedWeeks),weekBreakdownCell(x.actualWeeks),fmtNumber(x.mw,3),fmtNumber(x.containers,1)]));
  const departures=groupRows(allMain,(r)=>{const d=departureInfo(r),month=monthKey(d.date);return matchesModel(r,"departure")&&month&&inMonthRange(month,"departureStartMonth","departureEndMonth")?[month,modelLabel(r),String(resolvePort(r.rawDestination,"DEST")||t("unknown")),String(r.sku||t("unknown")),d.type]:null;}).sort((a,b)=>a.parts[0].localeCompare(b.parts[0])||a.parts[1].localeCompare(b.parts[1])||a.parts[2].localeCompare(b.parts[2])||a.parts[3].localeCompare(b.parts[3])||a.parts[4].localeCompare(b.parts[4]));
  renderTable("departureTable",[t("hDepartureMonth"),t("hModel"),t("hDestination"),t("hSku"),t("hDepartureType"),t("hQuantity"),t("hMw"),t("hContainers")],departures.map((x)=>[x.parts[0],x.parts[1],x.parts[2],x.parts[3],x.parts[4]==="actual"?{html:`<span class="actual">${escapeHtml(t("actual"))}</span>`}:{html:`<span class="forecast">${escapeHtml(t("forecast"))}</span>`},fmtNumber(x.quantity),fmtNumber(x.mw,3),fmtNumber(x.containers,1)]));
  const arrivals=groupRows(allMain,(r)=>{const a=arrivalInfo(r),month=monthKey(a.date);return matchesModel(r,"arrival")&&month&&inMonthRange(month,"arrivalStartMonth","arrivalEndMonth")?[month,modelLabel(r),String(resolvePort(r.rawDestination,"DEST")||t("unknown")),String(r.sku||t("unknown")),a.type]:null;}).sort((a,b)=>a.parts[0].localeCompare(b.parts[0])||a.parts[1].localeCompare(b.parts[1])||a.parts[2].localeCompare(b.parts[2])||a.parts[3].localeCompare(b.parts[3])||a.parts[4].localeCompare(b.parts[4]));
  renderTable("arrivalTable",[t("hArrivalMonth"),t("hModel"),t("hDestination"),t("hSku"),t("hArrivalType"),t("hQuantity"),t("hMw"),t("hContainers")],arrivals.map((x)=>[x.parts[0],x.parts[1],x.parts[2],x.parts[3],x.parts[4]==="actual"?{html:`<span class="actual">${escapeHtml(t("actual"))}</span>`}:{html:`<span class="forecast">${escapeHtml(t("forecast"))}</span>`},fmtNumber(x.quantity),fmtNumber(x.mw,3),fmtNumber(x.containers,1)]));
}

function nearestRank(values,rate){if(!values.length)return null;const sorted=[...values].sort((a,b)=>a-b);return sorted[Math.max(0,Math.ceil(rate*sorted.length)-1)];}
function renderRouteFilters(resetDestination=false){
  const polSelect=byId("routePolFilter"),destinationSelect=byId("routeDestinationFilter"),currentPol=polSelect.value,currentDestination=resetDestination?"":destinationSelect.value,pairs=new Map();
  records.forEach((r)=>{if(!r.atd||!r.ata||!r.rawPol||!r.rawDestination)return;const lead=Math.round((r.ata-r.atd)/86400000);if(lead<=0||lead>180)return;const pol=resolvePort(r.rawPol,"POL"),destination=resolvePort(r.rawDestination,"DEST");if(pol&&destination)pairs.set(`${pol}|${destination}`,{pol,destination});});
  const routes=[...pairs.values()],pols=[...new Set(routes.map((x)=>x.pol))].sort((a,b)=>a.localeCompare(b)),selectedPol=pols.includes(currentPol)?currentPol:"";
  polSelect.innerHTML=`<option value="">${escapeHtml(t("allPorts"))}</option>${pols.map((x)=>`<option value="${escapeHtml(x)}">${escapeHtml(x)}</option>`).join("")}`;polSelect.value=selectedPol;
  const destinations=[...new Set(routes.filter((x)=>!selectedPol||x.pol===selectedPol).map((x)=>x.destination))].sort((a,b)=>a.localeCompare(b));
  destinationSelect.innerHTML=`<option value="">${escapeHtml(t("allPorts"))}</option>${destinations.map((x)=>`<option value="${escapeHtml(x)}">${escapeHtml(x)}</option>`).join("")}`;destinationSelect.value=destinations.includes(currentDestination)?currentDestination:"";
}
function buildVoyages(applyRouteFilters=false){const start=byId("startDate").value?new Date(`${byId("startDate").value}T00:00:00`):null,end=byId("endDate").value?new Date(`${byId("endDate").value}T23:59:59`):null,selectedPol=applyRouteFilters?byId("routePolFilter").value:"",selectedDestination=applyRouteFilters?byId("routeDestinationFilter").value:"",voyages=new Map();records.forEach((r)=>{if(!r.atd||!r.ata||!r.rawPol||!r.rawDestination||start&&r.atd<start||end&&r.atd>end)return;const lead=Math.round((r.ata-r.atd)/86400000);if(lead<=0||lead>180)return;const pol=resolvePort(r.rawPol,"POL"),destination=resolvePort(r.rawDestination,"DEST");if(selectedPol&&pol!==selectedPol||selectedDestination&&destination!==selectedDestination)return;const identity=normalizeText(r.vessel)||normalizeText(r.booking)||"NO-ID",key=[pol,destination,isoDate(r.atd),isoDate(r.ata),identity].join("|");if(!voyages.has(key))voyages.set(key,{pol,destination,atd:r.atd,lead,containers:0,references:0});const v=voyages.get(key);v.containers+=r.containers;v.references++;});return[...voyages.values()];}
function routeStats(voyages){const groups=new Map();voyages.forEach((v)=>{const key=`${v.pol}|${v.destination}`;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(v);});const minC=Math.max(1,Number(byId("minContainers").value)||10),minV=Math.max(1,Number(byId("minVoyages").value)||5);return[...groups.values()].map((g)=>{const leads=g.map((x)=>x.lead),containers=g.reduce((s,x)=>s+x.containers,0);return{pol:g[0].pol,destination:g[0].destination,voyages:g.length,references:g.reduce((s,x)=>s+x.references,0),containers,min:Math.min(...leads),average:leads.reduce((s,x)=>s+x,0)/leads.length,max:Math.max(...leads),p90:nearestRank(leads,.9),first:new Date(Math.min(...g.map((x)=>x.atd))),last:new Date(Math.max(...g.map((x)=>x.atd))),eligible:containers>=minC&&g.length>=minV};}).filter((x)=>x.eligible).sort((a,b)=>b.containers-a.containers);}
function renderRouteTrend(voyages){
  const target=byId("routeTrendChart"),pol=byId("routePolFilter").value,destination=byId("routeDestinationFilter").value;
  if(!pol||!destination){target.innerHTML=`<h3>${escapeHtml(t("routeTrendTitle"))}</h3><div class="route-chart-empty">${escapeHtml(t("selectRoutePrompt"))}</div>`;return;}
  const points=[...voyages].sort((a,b)=>a.atd-b.atd||a.lead-b.lead);
  if(!points.length){target.innerHTML=`<h3>${escapeHtml(t("routeTrendTitle"))}: ${escapeHtml(pol)} → ${escapeHtml(destination)}</h3><div class="route-chart-empty">${escapeHtml(t("noRouteHistory"))}</div>`;return;}
  const width=1000,height=330,left=70,right=28,top=22,bottom=52,plotWidth=width-left-right,plotHeight=height-top-bottom,minTime=Math.min(...points.map((x)=>x.atd.getTime())),maxTime=Math.max(...points.map((x)=>x.atd.getTime())),p90=nearestRank(points.map((x)=>x.lead),.9),maxLead=Math.max(p90,...points.map((x)=>x.lead)),yMax=Math.max(10,Math.ceil(maxLead/10)*10),x=(d)=>minTime===maxTime?left+plotWidth/2:left+(d.getTime()-minTime)/(maxTime-minTime)*plotWidth,y=(value)=>top+(1-value/yMax)*plotHeight;
  const yTicks=Array.from({length:6},(_,i)=>Math.round(yMax*i/5)),dateValues=[...new Map(points.map((p)=>[isoDate(p.atd),p.atd])).values()],step=Math.max(1,Math.ceil(dateValues.length/5)),xTicks=dateValues.filter((_,i)=>i%step===0);if(xTicks.at(-1)!==dateValues.at(-1))xTicks.push(dateValues.at(-1));
  const grid=yTicks.map((value)=>`<line class="grid" x1="${left}" y1="${y(value)}" x2="${width-right}" y2="${y(value)}"/><text x="${left-10}" y="${y(value)+4}" text-anchor="end">${value}</text>`).join(""),ticks=xTicks.map((date,i)=>`<line class="axis" x1="${x(date)}" y1="${height-bottom}" x2="${x(date)}" y2="${height-bottom+5}"/><text x="${x(date)}" y="${height-bottom+21}" text-anchor="${i===0?"start":i===xTicks.length-1?"end":"middle"}">${escapeHtml(isoDate(date))}</text>`).join(""),line=points.map((p)=>`${x(p.atd).toFixed(1)},${y(p.lead).toFixed(1)}`).join(" "),marks=points.map((p)=>`<circle class="trend-point" cx="${x(p.atd).toFixed(1)}" cy="${y(p.lead).toFixed(1)}" r="4"><title>${escapeHtml(`${isoDate(p.atd)} | ${p.lead} ${t("days")} | ${fmtNumber(p.containers,1)} ${t("containerShort")}`)}</title></circle>`).join("");
  target.innerHTML=`<h3>${escapeHtml(t("routeTrendTitle"))}: ${escapeHtml(pol)} → ${escapeHtml(destination)}</h3><svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(`${pol} to ${destination}, ${t("routeTrendTitle")}`)}"><line class="axis" x1="${left}" y1="${top}" x2="${left}" y2="${height-bottom}"/><line class="axis" x1="${left}" y1="${height-bottom}" x2="${width-right}" y2="${height-bottom}"/>${grid}${ticks}<line class="p90-line" x1="${left}" y1="${y(p90)}" x2="${width-right}" y2="${y(p90)}"/><text x="${width-right}" y="${Math.max(top+12,y(p90)-7)}" text-anchor="end">${escapeHtml(t("p90Reference"))}: ${p90} ${escapeHtml(t("days"))}</text><polyline class="trend-line" points="${line}"/>${marks}<text class="axis-title" x="${left+plotWidth/2}" y="${height-8}" text-anchor="middle">${escapeHtml(t("atdDate"))}</text><text class="axis-title" transform="translate(18 ${top+plotHeight/2}) rotate(-90)" text-anchor="middle">${escapeHtml(t("leadTimeDays"))}</text></svg>`;
}
function renderRoutes(){const voyages=buildVoyages(true),routes=routeStats(voyages);byId("recordKpi").textContent=fmtNumber(records.length);byId("voyageKpi").textContent=fmtNumber(voyages.length);byId("routeKpi").textContent=fmtNumber(routes.length);byId("zeroKpi").textContent=fmtNumber(quantityZeroCount);renderRouteTrend(voyages);renderTable("routeTable",[t("hPol"),t("hDestination"),t("hVoyages"),t("hReferences"),t("hContainers"),t("hMin"),t("hAverage"),t("hMax"),t("hP90"),t("hHistory")],routes.map((x)=>[x.pol,x.destination,x.voyages,x.references,fmtNumber(x.containers,1),x.min,x.average.toFixed(1),x.max,x.p90,`${isoDate(x.first)} ～ ${isoDate(x.last)}`]));if(hasLoadedWorkbook)statusEl.textContent=t("done",{records:fmtNumber(records.length),zero:quantityZeroCount,invalid:invalidQuantityCount,voyages:fmtNumber(voyages.length),mapped:skuModelMatched,main:mainRecordCount});}

function exportAssumptionATP(){
  const routes=routeStats(buildVoyages()),routeMap=new Map(routes.map((x)=>[`${x.pol}|${x.destination}`,x])),output=new Map();
  assumptionRows.forEach((meta)=>{const pol=resolvePort(meta.rawPol,"POL"),destination=resolvePort(meta.rawDestination,"DEST"),key=`${pol}|${destination}`;if(!pol||!destination||output.has(key))return;const route=routeMap.get(key),weeks=route?Math.ceil(route.p90/7):(meta.inWeeks||Math.ceil((meta.inDays||0)/7)),days=route?weeks*7:(meta.inDays||weeks*7),comment=route?`P90 ${route.p90} days | ${route.voyages} voyages | ${route.containers.toFixed(1)} containers | ATD ${isoDate(route.first)} to ${isoDate(route.last)}`:`${meta.comments||""}${meta.comments?" | ":""}Insufficient P90 sample; existing assumption retained`;output.set(key,{pol,destination,warehouse:meta.warehouse||"",days,weeks,customs:meta.customs??0,comment});});
  routes.forEach((route)=>{const key=`${route.pol}|${route.destination}`;if(output.has(key))return;const weeks=Math.ceil(route.p90/7);output.set(key,{pol:route.pol,destination:route.destination,warehouse:"",days:weeks*7,weeks,customs:0,comment:`P90 ${route.p90} days | ${route.voyages} voyages | ${route.containers.toFixed(1)} containers | ATD ${isoDate(route.first)} to ${isoDate(route.last)}`});});
  if(!output.size)return;
  const rows=[[],[],[null,null,null,null,"Index","PORT OF LOADING","PORT DESTINATION","New Ark WH","in Days","in Weeks","Customs+Leg3","Comments"]];
  [...output.values()].sort((a,b)=>a.pol.localeCompare(b.pol)||a.destination.localeCompare(b.destination)).forEach((x)=>rows.push([null,null,null,null,`${x.pol}${x.destination}`,x.pol,x.destination,x.warehouse,x.days,x.weeks,x.customs,x.comment]));
  const ws=XLSX.utils.aoa_to_sheet(rows);ws["!cols"]=[{wch:3},{wch:3},{wch:3},{wch:3},{wch:28},{wch:18},{wch:24},{wch:24},{wch:12},{wch:12},{wch:16},{wch:70}];ws["!autofilter"]={ref:`E3:L${rows.length}`};
  const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,"Assumption ATP P90");XLSX.writeFile(wb,`Assumption_ATP_P90_${isoDate(new Date()).replaceAll("-","")}.xlsx`);statusEl.textContent=t("assumptionDownloaded");
}

function buildPerformanceVoyages(){
  const start=byId("performanceStartDate").value?new Date(`${byId("performanceStartDate").value}T00:00:00`):null,end=byId("performanceEndDate").value?new Date(`${byId("performanceEndDate").value}T23:59:59`):null,map=new Map();
  records.forEach((r)=>{if(!r.atd||!r.rawPol||!r.rawDestination||start&&r.atd<start||end&&r.atd>end)return;const pol=resolvePort(r.rawPol,"POL"),destination=resolvePort(r.rawDestination,"DEST"),identity=normalizeText(r.vessel)||normalizeText(r.booking)||"NO-ID",key=[pol,destination,isoDate(r.atd),isoDate(r.ata),identity].join("|");if(!map.has(key))map.set(key,{pol,destination,containers:0,ship:[],arrival:[],eta:[],transit:[]});const v=map.get(key);v.containers+=r.containers;if(r.etdSO)v.ship.push(Math.round((r.atd-r.etdSO)/86400000));if(r.ata&&r.etaSO)v.arrival.push(Math.round((r.ata-r.etaSO)/86400000));if(r.ata&&r.etaUpdate)v.eta.push(Math.round((r.ata-r.etaUpdate)/86400000));if(r.ata)v.transit.push(Math.round((r.ata-r.atd)/86400000));});
  return[...map.values()].map((v)=>({...v,shipDelay:median(v.ship),arrivalDelay:median(v.arrival),etaError:median(v.eta),transitDays:median(v.transit)}));
}
function renderPerformance(){
  const voyages=buildPerformanceVoyages(),ship=voyages.map((x)=>x.shipDelay).filter((x)=>x!=null),arrival=voyages.map((x)=>x.arrivalDelay).filter((x)=>x!=null),eta=voyages.map((x)=>x.etaError).filter((x)=>x!=null),transit=voyages.map((x)=>x.transitDays).filter((x)=>x!=null);
  byId("shipOnTimeKpi").textContent=percent(ship.filter((x)=>x<=0).length,ship.length);byId("shipWithin7Kpi").textContent=percent(ship.filter((x)=>x<=7).length,ship.length);byId("arrivalWithin7Kpi").textContent=percent(arrival.filter((x)=>x<=7).length,arrival.length);byId("etaAccuracyKpi").textContent=percent(eta.filter((x)=>Math.abs(x)<=7).length,eta.length);byId("medianTransitKpi").textContent=transit.length?`${median(transit).toFixed(1)} ${t("days")}`:"—";byId("p90TransitKpi").textContent=transit.length?`${nearestRank(transit,.9)} ${t("days")}`:"—";
  const groups=new Map();voyages.forEach((v)=>{const key=`${v.pol}|${v.destination}`;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(v);});
  const rows=[...groups.values()].map((g)=>{const s=g.map((x)=>x.shipDelay).filter((x)=>x!=null),a=g.map((x)=>x.arrivalDelay).filter((x)=>x!=null),e=g.map((x)=>x.etaError).filter((x)=>x!=null),tr=g.map((x)=>x.transitDays).filter((x)=>x!=null);return{pol:g[0].pol,destination:g[0].destination,voyages:g.length,containers:g.reduce((sum,x)=>sum+x.containers,0),shipOn:percent(s.filter((x)=>x<=0).length,s.length),ship7:percent(s.filter((x)=>x<=7).length,s.length),arrival7:percent(a.filter((x)=>x<=7).length,a.length),eta7:percent(e.filter((x)=>Math.abs(x)<=7).length,e.length),median:tr.length?median(tr).toFixed(1):"—",p90:tr.length?nearestRank(tr,.9):"—"};}).sort((a,b)=>b.containers-a.containers);
  renderTable("performanceTable",[t("hPol"),t("hDestination"),t("hVoyages"),t("hContainers"),t("hShipOnTime"),t("hShipWithin7"),t("hArrivalWithin7"),t("hEtaAccuracy"),t("hMedianTransit"),t("hP90")],rows.map((x)=>[x.pol,x.destination,x.voyages,fmtNumber(x.containers,1),x.shipOn,x.ship7,x.arrival7,x.eta7,x.median,x.p90]));
}

function mappingUsage(){const counts=new Map();records.forEach((r)=>[["POL",r.rawPol],["DEST",r.rawDestination]].forEach(([type,raw])=>{const key=`${type}|${normalizeText(raw)}`;counts.set(key,(counts.get(key)||0)+1);}));return counts;}
function renderMappingTable(){const counts=mappingUsage(),sorted=[...mappings].sort((a,b)=>a.type.localeCompare(b.type)||a.raw.localeCompare(b.raw)),head=`<thead><tr>${[t("hType"),t("hRaw"),t("hStandard"),t("hCountry"),t("hNote"),t("hCurrentRows"),t("hAction")].map((x)=>`<th>${escapeHtml(x)}</th>`).join("")}</tr></thead>`,body=sorted.map((item)=>{const i=mappings.indexOf(item),count=counts.get(`${item.type}|${normalizeText(item.raw)}`)||0;return`<tr data-index="${i}"${item.note?.includes("AUTO-DISCOVERED")?' class="warning"':""}><td><select data-field="type"><option value="POL"${item.type==="POL"?" selected":""}>POL</option><option value="DEST"${item.type==="DEST"?" selected":""}>${escapeHtml(t("destination"))}</option></select></td><td><input data-field="raw" value="${escapeHtml(item.raw)}"></td><td><input data-field="standard" value="${escapeHtml(item.standard)}"></td><td><input data-field="country" value="${escapeHtml(item.country)}"></td><td><input data-field="note" value="${escapeHtml(item.note)}"></td><td><span class="pill">${count}</span></td><td><button class="danger delete-mapping" type="button">${escapeHtml(t("delete"))}</button></td></tr>`;}).join("");byId("mappingTable").innerHTML=head+`<tbody>${body}</tbody>`;}
function collectMappingEdits(){byId("mappingTable").querySelectorAll("tbody tr").forEach((row)=>{const i=Number(row.dataset.index);if(!mappings[i])return;row.querySelectorAll("[data-field]").forEach((input)=>{mappings[i][input.dataset.field]=input.value;});});}
function renderAll(){renderBusinessViews();renderRouteFilters();renderRoutes();renderPerformance();renderMappingTable();}

byId("runBtn").addEventListener("click",async()=>{if(!fileEl.files[0]){statusEl.textContent=t("selectFile");return;}try{statusEl.textContent=t("reading");const data=await fileEl.files[0].arrayBuffer(),workbook=XLSX.read(data,{type:"array",cellDates:true});let skuModelMap=new Map();try{skuModelMap=await loadSkuModelMap();}catch(_){skuModelMap=new Map();}parseWorkbook(workbook,skuModelMap);}catch(error){statusEl.textContent=t("readFailed",{error:error.message||error});}});
byId("applyBtn").addEventListener("click",renderRoutes);
byId("routePolFilter").addEventListener("change",()=>{renderRouteFilters(true);renderRoutes();});
byId("routeDestinationFilter").addEventListener("change",renderRoutes);
byId("performanceApplyBtn").addEventListener("click",renderPerformance);
byId("exportAssumptionBtn").addEventListener("click",exportAssumptionATP);
document.querySelectorAll(".month-apply").forEach((button)=>button.addEventListener("click",()=>{commitModelFilter(button.closest(".tab")?.querySelector(".model-filter"));renderBusinessViews();}));
document.addEventListener("click",(event)=>{
  const root=event.target.closest(".model-filter");
  document.querySelectorAll(".model-filter.open").forEach((x)=>{if(x!==root)x.classList.remove("open");});
  if(!root)return;
  if(event.target.closest(".model-filter-toggle")){root.classList.toggle("open");return;}
  if(event.target.closest(".model-select-all")){root.querySelectorAll('.model-filter-options input[type="checkbox"]').forEach((x)=>{x.checked=true;});return;}
  if(event.target.closest(".model-clear-all")){root.querySelectorAll('.model-filter-options input[type="checkbox"]').forEach((x)=>{x.checked=false;});return;}
  if(event.target.closest(".model-filter-apply")){commitModelFilter(root);renderBusinessViews();}
});
document.addEventListener("input",(event)=>{if(!event.target.classList.contains("model-filter-search"))return;const query=normalizeText(event.target.value),root=event.target.closest(".model-filter");root.querySelectorAll(".model-filter-option[data-search]").forEach((x)=>{x.hidden=!x.dataset.search.includes(query);});});
byId("saveMappingBtn").addEventListener("click",()=>{collectMappingEdits();saveMappings();renderAll();});
byId("addMappingBtn").addEventListener("click",()=>{collectMappingEdits();mappings.push({type:"DEST",raw:"",standard:"",country:"",note:""});renderMappingTable();});
byId("resetMappingBtn").addEventListener("click",()=>{if(!confirm(t("resetConfirm")))return;mappings=copyDefaults();saveMappings();ensureDiscoveredMappings();renderAll();});
byId("mappingTable").addEventListener("click",(event)=>{if(!event.target.classList.contains("delete-mapping"))return;collectMappingEdits();mappings.splice(Number(event.target.closest("tr").dataset.index),1);renderMappingTable();});
byId("exportMappingBtn").addEventListener("click",()=>{collectMappingEdits();saveMappings();const blob=new Blob([JSON.stringify(mappings,null,2)],{type:"application/json"}),url=URL.createObjectURL(blob),link=document.createElement("a");link.href=url;link.download=`eupv-port-mapping-${isoDate(new Date())}.json`;link.click();URL.revokeObjectURL(url);});
byId("importMappingBtn").addEventListener("click",()=>byId("importMappingFile").click());
byId("importMappingFile").addEventListener("change",async(event)=>{try{if(!event.target.files[0])return;const incoming=JSON.parse(await event.target.files[0].text());if(!Array.isArray(incoming))throw new Error(t("jsonArray"));mappings=incoming;saveMappings();ensureDiscoveredMappings();renderAll();}catch(error){alert(t("importFailed",{error:error.message||error}));}finally{event.target.value="";}});
document.querySelectorAll(".tab-btn").forEach((button)=>button.addEventListener("click",()=>{document.querySelectorAll(".tab-btn").forEach((x)=>x.classList.toggle("active",x===button));document.querySelectorAll(".tab").forEach((x)=>x.classList.toggle("active",x.id===button.dataset.tab));}));
window.addEventListener("app-language-change",()=>{renderAll();if(!hasLoadedWorkbook)statusEl.textContent=t("statusInitial");});
setDefaultMonthRanges();renderModelFilters();renderRouteFilters();renderRouteTrend([]);renderMappingTable();
