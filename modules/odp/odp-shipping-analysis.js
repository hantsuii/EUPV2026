const PORT_MAPPING_KEY = "eupv2026_port_mappings_v1";
const byId = (id) => document.getElementById(id);
const fileEl = byId("odpFile");
const statusEl = byId("status");
let records = [];
let quantityZeroCount = 0;
let invalidQuantityCount = 0;
let hasLoadedWorkbook = false;
let mappings = loadMappings();

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
    return[{source:sheetName,reference:String(ref).trim(),quantity:toNumber(row[index.QUANTITY]),mw:toNumber(row[index.MW])||0,containers:toNumber(row[index.CONTAINERS])||0,model:index.Model!=null?clean(row[index.Model]):index.DESCRIPTION!=null?clean(row[index.DESCRIPTION]):null,status:index.STATUS!=null?String(clean(row[index.STATUS])||""):"",pickupDate:index["Pick-Up Date"]!=null?toDate(row[index["Pick-Up Date"]]):index["PICK-UP DATE"]!=null?toDate(row[index["PICK-UP DATE"]]):null,pickupWeek:index["Pick-Up Week"]!=null?row[index["Pick-Up Week"]]:null,rawPol,rawDestination:clean(row[index["PORT DESTINATION"]]),etdSO:toDate(row[index["ETD On S/O"]]),etdUpdate:toDate(row[index["ETD Update"]]),atd:toDate(row[index["ATD PORT"]]),etaSO:toDate(row[index["ETA On S/O"]]),etaUpdate:toDate(row[index["ETA Update"]]),ata:toDate(row[index["ATA PORT"]]),vessel:index["REFERENCE V.V"]!=null?clean(row[index["REFERENCE V.V"]]):null,booking:index[bookingField]!=null?clean(row[index[bookingField]]):null}];
  });
}

function parseWorkbook(workbook){
  const sources=[["PV SUPPLY DATA",1],["H2-2025 PV DATA",1],["H1-2025 PV DATA",3]],unique=new Map();quantityZeroCount=0;invalidQuantityCount=0;
  sources.flatMap(([name,row])=>readSheet(workbook,name,row)).forEach((record)=>{if(record.quantity==null){invalidQuantityCount++;return;}if(record.quantity<=0){quantityZeroCount++;return;}if(!unique.has(record.reference))unique.set(record.reference,record);});
  records=[...unique.values()];hasLoadedWorkbook=true;ensureDiscoveredMappings();renderMappingTable();
  const dates=records.flatMap((r)=>r.atd?[r.atd]:[]).sort((a,b)=>a-b);if(dates.length){byId("startDate").value=isoDate(dates[0]);byId("endDate").value=isoDate(dates.at(-1));}
  renderAll();
}

function groupRows(source,keyFn){const map=new Map();source.forEach((r)=>{const parts=keyFn(r);if(!parts)return;const key=JSON.stringify(parts);if(!map.has(key))map.set(key,{parts,quantity:0,mw:0,containers:0,lines:0});const x=map.get(key);x.quantity+=r.quantity;x.mw+=r.mw;x.containers+=r.containers;x.lines++;});return[...map.values()];}
function renderTable(id,headers,rows){const head=`<thead><tr>${headers.map((h)=>`<th>${escapeHtml(h)}</th>`).join("")}</tr></thead>`,body=rows.length?rows.map((row)=>`<tr>${row.map((v)=>`<td>${v?.html??escapeHtml(v)}</td>`).join("")}</tr>`).join(""):`<tr><td colspan="${headers.length}">${escapeHtml(t("noData"))}</td></tr>`;byId(id).innerHTML=head+`<tbody>${body}</tbody>`;}

function renderBusinessViews(){
  const main=records.filter((r)=>r.source==="PV SUPPLY DATA");
  byId("orderQtyKpi").textContent=fmtNumber(main.reduce((s,r)=>s+r.quantity,0));byId("orderMwKpi").textContent=fmtNumber(main.reduce((s,r)=>s+r.mw,0),3);byId("orderContainerKpi").textContent=fmtNumber(main.reduce((s,r)=>s+r.containers,0),1);byId("orderLineKpi").textContent=fmtNumber(main.length);
  const orders=groupRows(main,(r)=>{const om=orderMonth(r);if(!om)return null;const arrival=arrivalInfo(r);return[om,String(r.model||t("unknown")),plannedPickupWeek(r),actualPickupWeek(r),r.atd?isoWeek(r.atd):null,arrival.date?isoWeek(arrival.date):null,arrival.type,r.status];}).sort((a,b)=>a.parts[0].localeCompare(b.parts[0])||a.parts[1].localeCompare(b.parts[1]));
  renderTable("orderTable",[t("hOrderMonth"),t("hModel"),t("hPlannedPickup"),t("hActualPickup"),t("hActualShip"),t("hArrivalWeek"),t("hArrivalType"),t("hQuantity"),t("hMw"),t("hContainers"),t("hLines")],orders.map((x)=>{const[p0,p1,p2,p3,p4,p5,p6,status]=x.parts;const noPlan=!p2&&status.toUpperCase()==="PO FIRM";return[p0,p1,p2||t(noPlan?"statusNoPlan":"unknown"),p3||"—",p4||"—",p5||"—",p6==="actual"?{html:`<span class="actual">${escapeHtml(t("actual"))}</span>`}:p6==="forecast"?{html:`<span class="forecast">${escapeHtml(t("forecast"))}</span>`}:"—",fmtNumber(x.quantity),fmtNumber(x.mw,3),fmtNumber(x.containers,1),x.lines];}));
  const departures=groupRows(main.filter((r)=>r.atd),(r)=>[monthKey(r.atd),String(r.model||t("unknown"))]).sort((a,b)=>a.parts[0].localeCompare(b.parts[0])||a.parts[1].localeCompare(b.parts[1]));
  renderTable("departureTable",[t("hDepartureMonth"),t("hModel"),t("hQuantity"),t("hMw"),t("hContainers"),t("hLines")],departures.map((x)=>[...x.parts,fmtNumber(x.quantity),fmtNumber(x.mw,3),fmtNumber(x.containers,1),x.lines]));
  const arrivals=groupRows(main,(r)=>{const a=arrivalInfo(r);return a.date?[monthKey(a.date),String(r.model||t("unknown")),a.type]:null;}).sort((a,b)=>a.parts[0].localeCompare(b.parts[0])||a.parts[2].localeCompare(b.parts[2])||a.parts[1].localeCompare(b.parts[1]));
  renderTable("arrivalTable",[t("hArrivalMonth"),t("hModel"),t("hArrivalType"),t("hQuantity"),t("hMw"),t("hContainers"),t("hLines")],arrivals.map((x)=>[x.parts[0],x.parts[1],x.parts[2]==="actual"?{html:`<span class="actual">${escapeHtml(t("actual"))}</span>`}:{html:`<span class="forecast">${escapeHtml(t("forecast"))}</span>`},fmtNumber(x.quantity),fmtNumber(x.mw,3),fmtNumber(x.containers,1),x.lines]));
}

function nearestRank(values,rate){if(!values.length)return null;const sorted=[...values].sort((a,b)=>a-b);return sorted[Math.max(0,Math.ceil(rate*sorted.length)-1)];}
function buildVoyages(){const start=byId("startDate").value?new Date(`${byId("startDate").value}T00:00:00`):null,end=byId("endDate").value?new Date(`${byId("endDate").value}T23:59:59`):null,voyages=new Map();records.forEach((r)=>{if(!r.atd||!r.ata||!r.rawPol||!r.rawDestination||start&&r.atd<start||end&&r.atd>end)return;const lead=Math.round((r.ata-r.atd)/86400000);if(lead<=0||lead>180)return;const pol=resolvePort(r.rawPol,"POL"),destination=resolvePort(r.rawDestination,"DEST"),identity=normalizeText(r.vessel)||normalizeText(r.booking)||"NO-ID",key=[pol,destination,isoDate(r.atd),isoDate(r.ata),identity].join("|");if(!voyages.has(key))voyages.set(key,{pol,destination,atd:r.atd,lead,containers:0,references:0});const v=voyages.get(key);v.containers+=r.containers;v.references++;});return[...voyages.values()];}
function routeStats(voyages){const groups=new Map();voyages.forEach((v)=>{const key=`${v.pol}|${v.destination}`;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(v);});const minC=Math.max(1,Number(byId("minContainers").value)||10),minV=Math.max(1,Number(byId("minVoyages").value)||5);return[...groups.values()].map((g)=>{const leads=g.map((x)=>x.lead),containers=g.reduce((s,x)=>s+x.containers,0);return{pol:g[0].pol,destination:g[0].destination,voyages:g.length,references:g.reduce((s,x)=>s+x.references,0),containers,min:Math.min(...leads),average:leads.reduce((s,x)=>s+x,0)/leads.length,max:Math.max(...leads),p90:nearestRank(leads,.9),first:new Date(Math.min(...g.map((x)=>x.atd))),last:new Date(Math.max(...g.map((x)=>x.atd))),eligible:containers>=minC&&g.length>=minV};}).filter((x)=>x.eligible).sort((a,b)=>b.containers-a.containers);}
function renderRoutes(){const voyages=buildVoyages(),routes=routeStats(voyages);byId("recordKpi").textContent=fmtNumber(records.length);byId("voyageKpi").textContent=fmtNumber(voyages.length);byId("routeKpi").textContent=fmtNumber(routes.length);byId("zeroKpi").textContent=fmtNumber(quantityZeroCount);renderTable("routeTable",[t("hPol"),t("hDestination"),t("hVoyages"),t("hReferences"),t("hContainers"),t("hMin"),t("hAverage"),t("hMax"),t("hP90"),t("hHistory")],routes.map((x)=>[x.pol,x.destination,x.voyages,x.references,fmtNumber(x.containers,1),x.min,x.average.toFixed(1),x.max,x.p90,`${isoDate(x.first)} ～ ${isoDate(x.last)}`]));if(hasLoadedWorkbook)statusEl.textContent=t("done",{records:fmtNumber(records.length),zero:quantityZeroCount,invalid:invalidQuantityCount,voyages:fmtNumber(voyages.length)});}

function mappingUsage(){const counts=new Map();records.forEach((r)=>[["POL",r.rawPol],["DEST",r.rawDestination]].forEach(([type,raw])=>{const key=`${type}|${normalizeText(raw)}`;counts.set(key,(counts.get(key)||0)+1);}));return counts;}
function renderMappingTable(){const counts=mappingUsage(),sorted=[...mappings].sort((a,b)=>a.type.localeCompare(b.type)||a.raw.localeCompare(b.raw)),head=`<thead><tr>${[t("hType"),t("hRaw"),t("hStandard"),t("hCountry"),t("hNote"),t("hCurrentRows"),t("hAction")].map((x)=>`<th>${escapeHtml(x)}</th>`).join("")}</tr></thead>`,body=sorted.map((item)=>{const i=mappings.indexOf(item),count=counts.get(`${item.type}|${normalizeText(item.raw)}`)||0;return`<tr data-index="${i}"${item.note?.includes("AUTO-DISCOVERED")?' class="warning"':""}><td><select data-field="type"><option value="POL"${item.type==="POL"?" selected":""}>POL</option><option value="DEST"${item.type==="DEST"?" selected":""}>${escapeHtml(t("destination"))}</option></select></td><td><input data-field="raw" value="${escapeHtml(item.raw)}"></td><td><input data-field="standard" value="${escapeHtml(item.standard)}"></td><td><input data-field="country" value="${escapeHtml(item.country)}"></td><td><input data-field="note" value="${escapeHtml(item.note)}"></td><td><span class="pill">${count}</span></td><td><button class="danger delete-mapping" type="button">${escapeHtml(t("delete"))}</button></td></tr>`;}).join("");byId("mappingTable").innerHTML=head+`<tbody>${body}</tbody>`;}
function collectMappingEdits(){byId("mappingTable").querySelectorAll("tbody tr").forEach((row)=>{const i=Number(row.dataset.index);if(!mappings[i])return;row.querySelectorAll("[data-field]").forEach((input)=>{mappings[i][input.dataset.field]=input.value;});});}
function renderAll(){renderBusinessViews();renderRoutes();renderMappingTable();}

byId("runBtn").addEventListener("click",async()=>{if(!fileEl.files[0]){statusEl.textContent=t("selectFile");return;}try{statusEl.textContent=t("reading");const data=await fileEl.files[0].arrayBuffer(),workbook=XLSX.read(data,{type:"array",cellDates:true});parseWorkbook(workbook);}catch(error){statusEl.textContent=t("readFailed",{error:error.message||error});}});
byId("applyBtn").addEventListener("click",renderRoutes);
byId("saveMappingBtn").addEventListener("click",()=>{collectMappingEdits();saveMappings();renderAll();});
byId("addMappingBtn").addEventListener("click",()=>{collectMappingEdits();mappings.push({type:"DEST",raw:"",standard:"",country:"",note:""});renderMappingTable();});
byId("resetMappingBtn").addEventListener("click",()=>{if(!confirm(t("resetConfirm")))return;mappings=copyDefaults();saveMappings();ensureDiscoveredMappings();renderAll();});
byId("mappingTable").addEventListener("click",(event)=>{if(!event.target.classList.contains("delete-mapping"))return;collectMappingEdits();mappings.splice(Number(event.target.closest("tr").dataset.index),1);renderMappingTable();});
byId("exportMappingBtn").addEventListener("click",()=>{collectMappingEdits();saveMappings();const blob=new Blob([JSON.stringify(mappings,null,2)],{type:"application/json"}),url=URL.createObjectURL(blob),link=document.createElement("a");link.href=url;link.download=`eupv-port-mapping-${isoDate(new Date())}.json`;link.click();URL.revokeObjectURL(url);});
byId("importMappingBtn").addEventListener("click",()=>byId("importMappingFile").click());
byId("importMappingFile").addEventListener("change",async(event)=>{try{if(!event.target.files[0])return;const incoming=JSON.parse(await event.target.files[0].text());if(!Array.isArray(incoming))throw new Error(t("jsonArray"));mappings=incoming;saveMappings();ensureDiscoveredMappings();renderAll();}catch(error){alert(t("importFailed",{error:error.message||error}));}finally{event.target.value="";}});
document.querySelectorAll(".tab-btn").forEach((button)=>button.addEventListener("click",()=>{document.querySelectorAll(".tab-btn").forEach((x)=>x.classList.toggle("active",x===button));document.querySelectorAll(".tab").forEach((x)=>x.classList.toggle("active",x.id===button.dataset.tab));}));
window.addEventListener("app-language-change",()=>{renderAll();if(!hasLoadedWorkbook)statusEl.textContent=t("statusInitial");});
renderMappingTable();
