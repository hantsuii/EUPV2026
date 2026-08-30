window.PAGE_I18N = {
  zh: {
    pageTitle:"ODP 发运与航线分析", pageSubtitle:"按订单月、发货月、到货月和航线 P90 分析发运计划。", backHome:"← 返回主页", fileLabel:"EUPV ODP 工作簿", run:"读取并分析", statusInitial:"请选择 ODP 文件。",
    tabOrder:"订单月分析", tabDeparture:"发货月分析", tabArrival:"到货月分析", tabRoute:"航线 P90", tabMapping:"港口映射",
    orderTitle:"订单月份 × 产品", orderNote:"计划提货周优先读取 Status 中的 W周；无法读取时使用 ETD On S/O 减7天。实际发货周取 ATD。", orderQty:"订单数量", orderMw:"订单 MW", orderContainers:"订单柜量", orderLines:"订单记录",
    departureTitle:"实际发货日历月 × 产品", departureNote:"仅统计已有 ATD PORT 的记录。", arrivalTitle:"到货日历月 × 产品", arrivalNote:"优先使用 ATA；尚未到港时使用 ETA Update，其次使用 ETA On S/O，并区分实际与预测。",
    routeTitle:"历史航线 P90", startDate:"ATD 开始日期", endDate:"ATD 结束日期", minContainers:"最低累计柜量", minVoyages:"最低独立航次数", apply:"应用筛选", positiveRecords:"正数量历史记录", validVoyages:"有效实际航次", eligibleRoutes:"达标航线", excludedZero:"排除 Quantity≤0", routeNote:"P90 表示约90%的历史独立航次在该天数内到港。",
    mappingTitle:"港口映射维护", mappingNote:"修改保存在当前浏览器，可通过 JSON 导入导出。", add:"新增映射", save:"保存并重新计算", export:"导出 JSON", import:"导入 JSON", reset:"恢复初始映射",
    reading:"正在读取工作簿…", selectFile:"请先选择 ODP 工作簿。", readFailed:"读取失败：{error}", done:"完成：{records} 条正数量记录；排除 {zero} 条 Quantity≤0；{invalid} 条 Quantity 空白/无效；{voyages} 个实际航次。", noData:"暂无数据", unknown:"未填写", actual:"实际", forecast:"预测", statusNoPlan:"无发运计划",
    hOrderMonth:"订单月份", hModel:"Model", hPlannedPickup:"计划提货周", hActualPickup:"实际提货周", hActualShip:"实际发货周", hArrivalWeek:"到达周", hArrivalType:"到达类型", hQuantity:"Quantity", hMw:"MW", hContainers:"Containers", hLines:"记录数",
    hDepartureMonth:"发货月份", hArrivalMonth:"到货月份", hPol:"POL", hDestination:"目的港", hVoyages:"独立航次", hReferences:"TCL记录", hMin:"最小天数", hAverage:"平均天数", hMax:"最大天数", hP90:"P90天数", hHistory:"历史ATD范围",
    hType:"类型", hRaw:"原始名称", hStandard:"标准港口", hCountry:"国家/地区", hNote:"备注", hCurrentRows:"当前记录数", hAction:"操作", destination:"目的港", delete:"删除", resetConfirm:"确认恢复仓库内置的初始港口映射？当前浏览器修改将被覆盖。", importFailed:"导入失败：{error}", jsonArray:"JSON 顶层必须是数组"
  },
  en: {
    pageTitle:"ODP Shipping & Route Analysis", pageSubtitle:"Analyze shipment plans by order month, departure month, arrival month, and route P90.", backHome:"← Back to Home", fileLabel:"EUPV ODP workbook", run:"Load & Analyze", statusInitial:"Select an ODP workbook.",
    tabOrder:"Order Month", tabDeparture:"Departure Month", tabArrival:"Arrival Month", tabRoute:"Route P90", tabMapping:"Port Mapping",
    orderTitle:"Order Month × Product", orderNote:"Planned pickup week is read from Wxx in Status; if unavailable, use ETD On S/O minus 7 days. Actual shipment week uses ATD.", orderQty:"Order Quantity", orderMw:"Order MW", orderContainers:"Order Containers", orderLines:"Order Lines",
    departureTitle:"Actual Departure Calendar Month × Product", departureNote:"Only records with ATD PORT are included.", arrivalTitle:"Arrival Calendar Month × Product", arrivalNote:"Use ATA first; for cargo not yet arrived, use ETA Update and then ETA On S/O. Actual and forecast are shown separately.",
    routeTitle:"Historical Route P90", startDate:"ATD Start Date", endDate:"ATD End Date", minContainers:"Minimum Total Containers", minVoyages:"Minimum Unique Voyages", apply:"Apply", positiveRecords:"Positive-Quantity Records", validVoyages:"Valid Actual Voyages", eligibleRoutes:"Eligible Routes", excludedZero:"Excluded Quantity≤0", routeNote:"P90 means approximately 90% of historical unique voyages arrived within this number of days.",
    mappingTitle:"Port Mapping Maintenance", mappingNote:"Changes are stored in this browser and can be imported or exported as JSON.", add:"Add Mapping", save:"Save & Recalculate", export:"Export JSON", import:"Import JSON", reset:"Reset Defaults",
    reading:"Reading workbook…", selectFile:"Select an ODP workbook first.", readFailed:"Failed to read workbook: {error}", done:"Done: {records} positive-quantity records; {zero} Quantity≤0 excluded; {invalid} blank/invalid quantities; {voyages} actual voyages.", noData:"No data", unknown:"Missing", actual:"Actual", forecast:"Forecast", statusNoPlan:"No shipment plan",
    hOrderMonth:"Order Month", hModel:"Model", hPlannedPickup:"Planned Pickup Week", hActualPickup:"Actual Pickup Week", hActualShip:"Actual Shipment Week", hArrivalWeek:"Arrival Week", hArrivalType:"Arrival Type", hQuantity:"Quantity", hMw:"MW", hContainers:"Containers", hLines:"Lines",
    hDepartureMonth:"Departure Month", hArrivalMonth:"Arrival Month", hPol:"POL", hDestination:"Destination", hVoyages:"Unique Voyages", hReferences:"TCL Records", hMin:"Min Days", hAverage:"Average Days", hMax:"Max Days", hP90:"P90 Days", hHistory:"Historical ATD Range",
    hType:"Type", hRaw:"Raw Name", hStandard:"Standard Port", hCountry:"Country/Region", hNote:"Note", hCurrentRows:"Current Records", hAction:"Action", destination:"Destination", delete:"Delete", resetConfirm:"Reset to the repository's default port mappings? Browser changes will be overwritten.", importFailed:"Import failed: {error}", jsonArray:"The JSON root must be an array"
  }
};
