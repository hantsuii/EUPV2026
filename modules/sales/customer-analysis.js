/* Regional customer analytics extension for the Sales dashboard. */
const customerRegionSel = byId("customerRegionSel");
const customerYearSel = byId("customerYearSel");
const customerProductSel = byId("customerProductSel");
const customerSearchEl = byId("customerSearch");

const CUSTOMER_TEXT = {
  zh: {
    allRegions:"全球总览", customers:"下单客户数", active:"近3个月活跃客户", activeRate:"活跃率", newCustomers:"新增客户", repeat:"复购客户 / 复购率", orders:"订单数", avgOrders:"客户平均下单次数",
    trend:"客户数量月度变化", monthly:"当月下单客户", newMonthly:"当月新增客户", activeMonthly:"滚动3个月活跃客户", regionRanking:"地区客户数", region:"地区", countries:"覆盖国家", revenue:"销售额(万€)", qty:"销售数量", pvCustomers:"PV客户", essCustomers:"ESS客户", hpCustomers:"HP客户", growth:"客户同比", status:"客户状态", sleeping:"沉睡", risk:"风险", lastOrder:"最近下单", customer:"客户", country:"国家", orderCount:"下单次数", pvQty:"PV数量(MW)", essQty:"ESS数量(Sets)", hpQty:"HP数量", products:"产品线", firstOrder:"首次下单", avgOrderValue:"平均订单额(万€)", segment:"价值分层", highValue:"高价值", frequent:"高频复购", potential:"潜力", newLabel:"新客户", maintain:"需要维护", concentration:"Top 10客户销售贡献", valueRank:"客户价值排名", productCustomers:"各产品线客户数", productMix:"客户产品组合", only:"仅", cross:"跨产品线", regionRequired:"请选择一个地区查看该分析。", noCustomerField:"源表未识别客户字段，当前按“Unknown Customer”汇总；请确认客户列名。"
  },
  en: {
    allRegions:"Global Overview", customers:"Ordering Customers", active:"Active in Last 3 Months", activeRate:"Active Rate", newCustomers:"New Customers", repeat:"Repeat Customers / Rate", orders:"Orders", avgOrders:"Avg. Orders per Customer",
    trend:"Monthly Customer Change", monthly:"Monthly Ordering Customers", newMonthly:"New Customers", activeMonthly:"Rolling 3-Month Active", regionRanking:"Customers by Region", region:"Region", countries:"Countries", revenue:"Revenue (10k €)", qty:"Sales Quantity", pvCustomers:"PV Customers", essCustomers:"ESS Customers", hpCustomers:"HP Customers", growth:"Customer YoY", status:"Status", sleeping:"Sleeping", risk:"At Risk", lastOrder:"Last Order", customer:"Customer", country:"Country", orderCount:"Order Count", pvQty:"PV Qty (MW)", essQty:"ESS Qty (Sets)", hpQty:"HP Qty", products:"Product Lines", firstOrder:"First Order", avgOrderValue:"Avg. Order Value (10k €)", segment:"Value Segment", highValue:"High Value", frequent:"Frequent", potential:"Potential", newLabel:"New", maintain:"Maintain", concentration:"Top 10 Revenue Contribution", valueRank:"Customer Value Ranking", productCustomers:"Customers by Product Line", productMix:"Customer Product Mix", only:"Only", cross:"Cross-sell", regionRequired:"Choose a region to view this analysis.", noCustomerField:"No customer field was detected; rows are grouped as 'Unknown Customer'. Please confirm the customer column name."
  }
};
function ct(key) { return CUSTOMER_TEXT[currentLang]?.[key] || CUSTOMER_TEXT.zh[key] || key; }
function customerKey(row) { return `${row.region}\u0001${row.country}\u0001${row.customer}`; }
function monthIndex(month) { return Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7)) - 1; }
function customerProductRows(rows, product) { return product === "__ALL__" ? rows : rows.filter((r) => r.category === product); }
function customerScopeRows() {
  const year = Number(customerYearSel.value || TARGET_YEAR);
  let rows = allRows.filter((r) => r.year === year);
  if (customerRegionSel.value && customerRegionSel.value !== "__ALL__") rows = rows.filter((r) => r.region === customerRegionSel.value);
  rows = customerProductRows(rows, customerProductSel.value || "__ALL__");
  const query = customerSearchEl.value.trim().toLowerCase();
  if (query) rows = rows.filter((r) => `${r.customer} ${r.country}`.toLowerCase().includes(query));
  return rows;
}
function customerHistoryRows() {
  const year = Number(customerYearSel.value || TARGET_YEAR);
  let rows = allRows.filter((r) => r.year <= year);
  if (customerRegionSel.value && customerRegionSel.value !== "__ALL__") rows = rows.filter((r) => r.region === customerRegionSel.value);
  rows = customerProductRows(rows, customerProductSel.value || "__ALL__");
  const query = customerSearchEl.value.trim().toLowerCase();
  if (query) rows = rows.filter((r) => `${r.customer} ${r.country}`.toLowerCase().includes(query));
  return rows;
}
function uniqueCount(rows, picker) { return new Set(rows.map(picker)).size; }
function customerEntities(periodRows, historyRows, referenceMonth) {
  const periodKeys = new Set(periodRows.map(customerKey));
  const groups = new Map();
  historyRows.forEach((row) => {
    const key = customerKey(row);
    if (!periodKeys.has(key)) return;
    if (!groups.has(key)) groups.set(key, { key, customer:row.customer, country:row.country, region:row.region, rows:[], periodRows:[] });
    groups.get(key).rows.push(row);
  });
  periodRows.forEach((row) => { const group = groups.get(customerKey(row)); if (group) group.periodRows.push(row); });
  return [...groups.values()].map((group) => {
    const months = group.rows.map((r) => r.month).sort();
    const lastMonth = months[months.length - 1], firstMonth = months[0];
    const gap = referenceMonth ? monthIndex(referenceMonth) - monthIndex(lastMonth) : 999;
    const orderIds = new Set(group.periodRows.map((r) => r.orderId));
    const historyOrders = new Set(group.rows.map((r) => r.orderId));
    const revenue = group.periodRows.reduce((s, r) => s + r.revenue, 0);
    const products = [...new Set(group.periodRows.map((r) => r.category))].sort();
    return { ...group, firstMonth, lastMonth, active:gap <= 2, status:gap <= 2 ? "active" : gap <= 5 ? "sleeping" : "risk", orderCount:orderIds.size, historyOrderCount:historyOrders.size, revenue, pvQty:group.periodRows.reduce((s,r)=>s+r.pvQty,0), essQty:group.periodRows.reduce((s,r)=>s+r.essQty,0), hpQty:group.periodRows.reduce((s,r)=>s+(r.hpQty||0),0), products };
  });
}
function customerReferenceMonth() {
  const year = Number(customerYearSel.value || TARGET_YEAR);
  return allRows.filter((r) => r.year <= year).map((r) => r.month).sort().at(-1) || `${year}-12`;
}
function pct(part, total) { return total ? part / total * 100 : null; }
function customerEmptyPlot(id, title) { renderPlot(id, [], { title, annotations:[{text:t("noData"),showarrow:false,font:{color:"#6883a8"}}] }); }
function regionSummary(rows, history, referenceMonth) {
  const regions = [...new Set(rows.map((r) => r.region))];
  return regions.map((region) => {
    const regionRows = rows.filter((r) => r.region === region), regionHistory = history.filter((r) => r.region === region);
    const entities = customerEntities(regionRows, regionHistory, referenceMonth);
    const previousYear = Number(customerYearSel.value) - 1;
    const previous = customerProductRows(allRows.filter((r) => r.region === region && r.year === previousYear), customerProductSel.value || "__ALL__");
    const currentCount = entities.length, previousCount = uniqueCount(previous, customerKey);
    return { region, entities, customers:currentCount, countries:uniqueCount(regionRows,(r)=>r.country), active:entities.filter((x)=>x.active).length, newCustomers:entities.filter((x)=>x.firstMonth.startsWith(String(customerYearSel.value))).length, orders:uniqueCount(regionRows,(r)=>r.orderId), revenue:regionRows.reduce((s,r)=>s+r.revenue,0), pv:uniqueCount(regionRows.filter((r)=>r.isPV),customerKey), ess:uniqueCount(regionRows.filter((r)=>r.isESS),customerKey), hp:uniqueCount(regionRows.filter((r)=>r.isHP),customerKey), growth:previousCount ? (currentCount / previousCount - 1) * 100 : null };
  }).sort((a,b)=>b.customers-a.customers);
}
function renderCustomerOverview(rows, history, entities, referenceMonth) {
  const active = entities.filter((x)=>x.active).length;
  const newCount = entities.filter((x)=>x.firstMonth.startsWith(String(customerYearSel.value))).length;
  const repeat = entities.filter((x)=>x.historyOrderCount >= 2).length;
  const orderCount = uniqueCount(rows,(r)=>r.orderId);
  byId("customerOverviewKpis").innerHTML = [
    card(ct("customers"),fmtInt(entities.length)), card(ct("active"),fmtInt(active),`${ct("activeRate")} ${fmtPct(pct(active,entities.length))}`), card(ct("newCustomers"),fmtInt(newCount)), card(ct("repeat"),`${fmtInt(repeat)} / ${fmtPct(pct(repeat,entities.length))}`), card(ct("orders"),fmtInt(orderCount)), card(ct("avgOrders"),entities.length ? (orderCount/entities.length).toFixed(1) : "-")
  ].join("");
  const year = Number(customerYearSel.value), months = Array.from({length:12},(_,i)=>`${year}-${String(i+1).padStart(2,"0")}`);
  const monthly = months.map((month)=>uniqueCount(rows.filter((r)=>r.month===month),customerKey));
  const newMonthly = months.map((month)=>entities.filter((x)=>x.firstMonth===month).length);
  const activeMonthly = months.map((month)=>uniqueCount(history.filter((r)=>r.month<=month && monthIndex(month)-monthIndex(r.month)>=0 && monthIndex(month)-monthIndex(r.month)<=2),customerKey));
  renderPlot("customerTrendChart",[{x:months,y:monthly,type:"bar",name:ct("monthly"),marker:{color:"#8bbcff"}},{x:months,y:newMonthly,type:"bar",name:ct("newMonthly"),marker:{color:"#75d9c3"}},{x:months,y:activeMonthly,type:"scatter",mode:"lines+markers",name:ct("activeMonthly"),line:{color:"#245fbd",width:3}}],{title:ct("trend"),barmode:"group",yaxis:{title:ct("customers")}});
  const summary = regionSummary(rows,history,referenceMonth);
  if (summary.length) renderPlot("customerRegionChart",[{x:summary.map(x=>x.customers),y:summary.map(x=>x.region),type:"bar",orientation:"h",marker:{color:"#5c98ef"},text:summary.map(x=>x.customers),textposition:"auto"}],{title:ct("regionRanking"),margin:{l:155,r:30,t:52,b:55},yaxis:{autorange:"reversed"}}); else customerEmptyPlot("customerRegionChart",ct("regionRanking"));
}
function renderCustomerRegion(rows, history, referenceMonth) {
  const summary = regionSummary(rows,history,referenceMonth);
  table("customerRegionTable",[ct("region"),ct("customers"),ct("countries"),ct("active"),ct("activeRate"),ct("newCustomers"),ct("orders"),ct("revenue"),ct("pvCustomers"),ct("essCustomers"),ct("hpCustomers"),ct("growth")],summary.map(x=>[x.region,fmtInt(x.customers),fmtInt(x.countries),fmtInt(x.active),fmtPct(pct(x.active,x.customers)),fmtInt(x.newCustomers),fmtInt(x.orders),fmtWanInt(x.revenue),fmtInt(x.pv),fmtInt(x.ess),fmtInt(x.hp),fmtPct(x.growth)]));
}
function renderCustomerProduct(rows, entities) {
  if (!rows.length) {
    customerEmptyPlot("customerProductChart",ct("regionRequired"));customerEmptyPlot("customerMixChart",ct("regionRequired"));
    table("customerProductTable",[ct("products"),ct("customers"),ct("revenue"),ct("orders"),ct("pvQty"),ct("essQty"),ct("hpQty")],[]);return;
  }
  const categories = ["PV","ESS","HP"], counts = categories.map(c=>uniqueCount(rows.filter(r=>r.category===c),customerKey));
  renderPlot("customerProductChart",[{x:categories,y:counts,type:"bar",marker:{color:["#4a91f2","#956fe8","#f2aa4c"]},text:counts,textposition:"auto"}],{title:ct("productCustomers"),yaxis:{title:ct("customers")}});
  const combos = new Map(); entities.forEach(x=>{const key=x.products.join(" + ")||t("noData");combos.set(key,(combos.get(key)||0)+1);});
  const comboList=[...combos.entries()].sort((a,b)=>b[1]-a[1]);
  if(comboList.length) renderPlot("customerMixChart",[{labels:comboList.map(x=>x[0]),values:comboList.map(x=>x[1]),type:"pie",hole:.5,textinfo:"label+percent"}],{title:ct("productMix"),margin:{l:25,r:25,t:52,b:70}}); else customerEmptyPlot("customerMixChart",ct("productMix"));
  table("customerProductTable",[ct("products"),ct("customers"),ct("revenue"),ct("orders"),ct("pvQty"),ct("essQty"),ct("hpQty")],categories.map(c=>{const r=rows.filter(x=>x.category===c);return[c,fmtInt(uniqueCount(r,customerKey)),fmtWanInt(r.reduce((s,x)=>s+x.revenue,0)),fmtInt(uniqueCount(r,x=>x.orderId)),fmtOne(r.reduce((s,x)=>s+x.pvQty,0)),fmtInt(r.reduce((s,x)=>s+x.essQty,0)),fmtInt(r.reduce((s,x)=>s+(x.hpQty||0),0))];}));
}
function renderCustomerActivity(entities) {
  if (!entities.length) {
    customerEmptyPlot("customerActivityChart",ct("regionRequired"));customerEmptyPlot("customerStatusChart",ct("regionRequired"));
    table("customerActivityTable",[ct("customer"),ct("country"),ct("status"),ct("lastOrder"),ct("orderCount"),ct("revenue")],[]);return;
  }
  const states=[{key:"active",label:ct("active")},{key:"sleeping",label:ct("sleeping")},{key:"risk",label:ct("risk")}],values=states.map(s=>entities.filter(x=>x.status===s.key).length);
  renderPlot("customerStatusChart",[{labels:states.map(x=>x.label),values,type:"pie",hole:.55,marker:{colors:["#54c9a9","#f1be55","#ec746b"]},textinfo:"label+percent"}],{title:ct("status"),margin:{l:25,r:25,t:52,b:60}});
  const sorted=[...entities].sort((a,b)=>a.lastMonth.localeCompare(b.lastMonth));
  renderPlot("customerActivityChart",[{x:states.map(x=>x.label),y:values,type:"bar",marker:{color:["#54c9a9","#f1be55","#ec746b"]},text:values,textposition:"auto"}],{title:ct("status"),yaxis:{title:ct("customers")}});
  table("customerActivityTable",[ct("customer"),ct("country"),ct("status"),ct("lastOrder"),ct("orderCount"),ct("revenue")],sorted.map(x=>[x.customer,x.country,x.status==="active"?ct("active"):x.status==="sleeping"?ct("sleeping"):ct("risk"),x.lastMonth,fmtInt(x.orderCount),fmtWanInt(x.revenue)]));
}
function valueSegment(entity, revenueCutoff, year) {
  if(entity.status==="risk") return ct("maintain");
  if(entity.revenue>=revenueCutoff&&entity.revenue>0) return ct("highValue");
  if(entity.orderCount>=3) return ct("frequent");
  if(entity.firstMonth.startsWith(String(year))) return ct("newLabel");
  return ct("potential");
}
function renderCustomerValue(entities) {
  if (!entities.length) {
    customerEmptyPlot("customerValueChart",ct("regionRequired"));customerEmptyPlot("customerConcentrationChart",ct("regionRequired"));
    table("customerValueTable",[ct("customer"),ct("country"),ct("segment"),ct("revenue"),ct("orderCount"),ct("avgOrderValue"),ct("lastOrder")],[]);return;
  }
  const sorted=[...entities].sort((a,b)=>b.revenue-a.revenue), total=sorted.reduce((s,x)=>s+x.revenue,0), cutoff=sorted[Math.max(0,Math.ceil(sorted.length*.2)-1)]?.revenue||Infinity;
  const segmentMap=new Map();sorted.forEach(x=>{const s=valueSegment(x,cutoff,customerYearSel.value);segmentMap.set(s,(segmentMap.get(s)||0)+1);});const segments=[...segmentMap.entries()];
  renderPlot("customerValueChart",[{x:segments.map(x=>x[0]),y:segments.map(x=>x[1]),type:"bar",marker:{color:"#6c8fe8"},text:segments.map(x=>x[1]),textposition:"auto"}],{title:ct("segment"),yaxis:{title:ct("customers")}});
  const cumulative=sorted.slice(0,10).reduce((s,x)=>s+x.revenue,0);renderPlot("customerConcentrationChart",[{labels:["Top 10",ct("other")],values:[cumulative,Math.max(0,total-cumulative)],type:"pie",hole:.62,marker:{colors:["#245fbd","#dce8f8"]},textinfo:"label+percent"}],{title:ct("concentration"),margin:{l:25,r:25,t:52,b:60}});
  table("customerValueTable",[ct("customer"),ct("country"),ct("segment"),ct("revenue"),ct("orderCount"),ct("avgOrderValue"),ct("lastOrder")],sorted.map(x=>[x.customer,x.country,valueSegment(x,cutoff,customerYearSel.value),fmtWanInt(x.revenue),fmtInt(x.orderCount),fmtWanInt(x.orderCount?x.revenue/x.orderCount:0),x.lastMonth]));
}
function renderCustomerDetail(entities) {
  const query=customerSearchEl.value.trim().toLowerCase(), filtered=query?entities.filter(x=>`${x.customer} ${x.country}`.toLowerCase().includes(query)):entities;
  table("customerDetailTable",[ct("customer"),ct("region"),ct("country"),ct("products"),ct("firstOrder"),ct("lastOrder"),ct("orderCount"),ct("revenue"),ct("pvQty"),ct("essQty"),ct("hpQty"),ct("status")],filtered.sort((a,b)=>b.revenue-a.revenue).map(x=>[x.customer,x.region,x.country,x.products.join(" + "),x.firstMonth,x.lastMonth,fmtInt(x.orderCount),fmtWanInt(x.revenue),fmtOne(x.pvQty),fmtInt(x.essQty),fmtInt(x.hpQty),x.status==="active"?ct("active"):x.status==="sleeping"?ct("sleeping"):ct("risk")]));
}
function renderCustomerAnalysis(resetFilters = false) {
  if (!allRows.length) return;
  if (resetFilters) {
    const regions=[...new Set(allRows.map(r=>r.region))].sort(), years=[...new Set(allRows.map(r=>r.year))].sort((a,b)=>b-a);
    fillSelect(customerRegionSel,[{value:"__ALL__",label:ct("allRegions")},...regions.map(v=>({value:v,label:v}))],["__ALL__"]);
    fillSelect(customerYearSel,years.map(v=>({value:String(v),label:String(v)})),[String(years.includes(TARGET_YEAR)?TARGET_YEAR:years[0])]);
    customerProductSel.value="__ALL__";customerSearchEl.value="";
  } else {
    const allOption=customerRegionSel.querySelector('option[value="__ALL__"]');if(allOption)allOption.textContent=ct("allRegions");
  }
  const rows=customerScopeRows(),history=customerHistoryRows(),referenceMonth=customerReferenceMonth(),entities=customerEntities(rows,history,referenceMonth);
  byId("customerScopeLabel").textContent=`${customerRegionSel.value==="__ALL__"?ct("allRegions"):customerRegionSel.value} · ${customerYearSel.value} · ${customerProductSel.value==="__ALL__"?t("all"):customerProductSel.value}`;
  renderCustomerOverview(rows,history,entities,referenceMonth);renderCustomerRegion(rows,history,referenceMonth);
  const regionalRows=customerRegionSel.value==="__ALL__"?[]:rows, regionalEntities=customerRegionSel.value==="__ALL__"?[]:entities;
  renderCustomerProduct(regionalRows,regionalEntities);renderCustomerActivity(regionalEntities);renderCustomerValue(regionalEntities);renderCustomerDetail(regionalEntities);
}
function initCustomerAnalysis() { renderCustomerAnalysis(true); }

[customerRegionSel,customerYearSel,customerProductSel].forEach(el=>el.addEventListener("change",()=>renderCustomerAnalysis(false)));
customerSearchEl.addEventListener("input",()=>renderCustomerAnalysis(false));
byId("customerSubnav").addEventListener("click",(event)=>{const btn=event.target.closest("button[data-customer-view]");if(!btn)return;byId("customerSubnav").querySelectorAll("button").forEach(x=>x.classList.toggle("active",x===btn));document.querySelectorAll(".customer-view").forEach(x=>x.classList.toggle("active",x.id===`customer-view-${btn.dataset.customerView}`));window.dispatchEvent(new Event("resize"));});
