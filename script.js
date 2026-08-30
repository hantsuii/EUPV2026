const APP_LANG_KEY = "app_lang";
const FEEDBACK_EMAIL = "nan02020@qq.com";
let currentLang = ["zh", "en"].includes(localStorage.getItem(APP_LANG_KEY)) ? localStorage.getItem(APP_LANG_KEY) : "zh";

const UI = {
  zh: {
    portalTitle: "EUPV2026 业务工作台", portalSubtitle: "把日常运营数据、核验工具与业务分析集中在一个清晰、快速的入口。", eyebrow: "EUPV 运营工作空间", moduleTitle: "业务模块", moduleSubtitle: "选择一个模块开始工作。文件默认在浏览器中处理，适合日常快速核验与分析。",
    chipLocal: "本地数据处理", chipBilingual: "中英文界面", chipExcel: "Excel 工作流", usageTitle: "使用提示", usageSubtitle: "更少的步骤，更清晰的结果。", usage1: "模块页都可以一键返回工作台。", usage2: "中英文选择会在各页面间保持。", usage3: "处理前请确认使用最新业务文件。",
    openModule: "打开模块", loadError: "模块加载失败：", pageTitle: "EUPV2026 业务工作台", feedbackEyebrow: "反馈", feedbackTitle: "留言与反馈", feedbackDesc: "发现数据问题、希望增加功能，或只是有一个改进建议，都可以直接告诉我。", feedbackName: "姓名", feedbackEmail: "邮箱（便于回复）", feedbackModule: "相关模块", feedbackModulePortal: "EUPV2026 主页", feedbackModuleSales: "销售分析", feedbackModuleStock: "可用库存", feedbackModuleShipment: "Shipment Details", feedbackModulePo: "PO 核验", feedbackModuleOdp: "ODP 发运分析", feedbackModuleWeekly: "静态周报", feedbackCategory: "反馈类型", feedbackIdea: "功能建议", feedbackBug: "问题反馈", feedbackData: "数据问题", feedbackOther: "其他", feedbackMessage: "留言内容", feedbackPlaceholder: "请描述你遇到的问题或建议……", feedbackSubmit: "提交反馈", feedbackSending: "正在提交……", feedbackSuccess: "谢谢，反馈已成功发送。", feedbackRequired: "请先填写留言内容。", feedbackFallback: "在线提交暂不可用，请点击这里通过邮件发送。", feedbackFailed: "提交失败，请稍后重试。", footerNote: "为日常业务清晰而设计。"
  },
  en: {
    portalTitle: "EUPV2026 Operations Workspace", portalSubtitle: "A clear, fast home for daily operational data, validation tools, and business analytics.", eyebrow: "EUPV OPERATIONS WORKSPACE", moduleTitle: "Business Modules", moduleSubtitle: "Choose a module to begin. Files are processed in the browser by default for fast everyday analysis.",
    chipLocal: "Local data processing", chipBilingual: "Chinese & English", chipExcel: "Excel workflows", usageTitle: "Helpful Notes", usageSubtitle: "Fewer steps, clearer results.", usage1: "Every module includes a direct route back to the workspace.", usage2: "Your language choice is retained across pages.", usage3: "Confirm that source files are current before processing.",
    openModule: "Open module", loadError: "Failed to load modules: ", pageTitle: "EUPV2026 Operations Workspace", feedbackEyebrow: "FEEDBACK", feedbackTitle: "Feedback & Suggestions", feedbackDesc: "Report a data issue, request a feature, or share an idea for improving the workspace.", feedbackName: "Name", feedbackEmail: "Email (for a reply)", feedbackModule: "Related module", feedbackModulePortal: "EUPV2026 Home", feedbackModuleSales: "Sales Analytics", feedbackModuleStock: "Available Stock", feedbackModuleShipment: "Shipment Details", feedbackModulePo: "PO Check", feedbackModuleOdp: "ODP Shipping Analysis", feedbackModuleWeekly: "Static Weekly Report", feedbackCategory: "Feedback type", feedbackIdea: "Feature suggestion", feedbackBug: "Issue / bug", feedbackData: "Data issue", feedbackOther: "Other", feedbackMessage: "Message", feedbackPlaceholder: "Describe the issue or suggestion…", feedbackSubmit: "Send feedback", feedbackSending: "Sending…", feedbackSuccess: "Thank you. Your feedback was sent successfully.", feedbackRequired: "Enter a message before submitting.", feedbackFallback: "Online submission is unavailable. Click here to send by email.", feedbackFailed: "Submission failed. Please try again later.", footerNote: "Designed for everyday clarity."
  },
};

const MODULE_I18N = {
  "./modules/sales/sales-change-analysis.html": {
    zh: { name:"销售分析看板", desc:"追踪销售、目标达成、ASP 与产品结构趋势。", badge:"交互分析" },
    en: { name:"Sales Analytics", desc:"Track sales, target achievement, ASP, and product-mix trends.", badge:"Interactive" }, icon:"chart", accent:"blue"
  },
  "./modules/stock/available-stock-analysis.html": {
    zh: { name:"可用库存分析", desc:"整合库存、在途和待分配数据，生成可下载工作簿。", badge:"运营工具" },
    en: { name:"Available Stock", desc:"Combine stock, in-transit, and allocation data in a downloadable workbook.", badge:"Operations" }, icon:"boxes", accent:"teal"
  },
  "./modules/weekly/static-weekly-report.html": {
    zh: { name:"静态周报", desc:"集中访问离线报告、Excel 汇总和趋势快照。", badge:"报告" },
    en: { name:"Static Weekly Report", desc:"Access offline reports, Excel summaries, and trend snapshots.", badge:"Reporting" }, icon:"report", accent:"violet"
  },
  "./modules/shipment/shipment-details-generator.html": {
    zh: { name:"Shipment Details 生成", desc:"依据 Shipment Details 与 PICKUP 数据整理 Processed_TCL。", badge:"物流工具" },
    en: { name:"Shipment Details Generator", desc:"Build Processed_TCL from Shipment Details and PICKUP data.", badge:"Logistics" }, icon:"ship", accent:"amber"
  },
  "./modules/po-check/po-check.html": {
    zh: { name:"PO 核验", desc:"核对 ETA、采购类型、TCL Reference、SKU 与数量。", badge:"核验工具" },
    en: { name:"PO Check", desc:"Validate ETA, purchase type, TCL Reference, SKU, and quantity.", badge:"Validation" }, icon:"check", accent:"teal"
  }
  ,
  "./modules/odp/odp-shipping-analysis.html": {
    zh: { name:"ODP 发运分析", desc:"按订单、发货和到货月份分析产品，并评估航线 P90 与运营绩效。", badge:"物流分析" },
    en: { name:"ODP Shipping Analysis", desc:"Analyze products by order, departure and arrival month, route P90, and operational performance.", badge:"Logistics" }, icon:"ship", accent:"blue"
  }
};

const ICONS = {
  chart:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19V9m6 10V5m6 14v-7m4 7H2"/></svg>',
  boxes:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 8 4-8 4-8-4 8-4Z"/><path d="m4 12 8 4 8-4M4 17l8 4 8-4"/></svg>',
  report:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h9l3 3v15H6z"/><path d="M15 3v4h4M9 11h6M9 15h6"/></svg>',
  ship:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 15h16l-2 5H6l-2-5Z"/><path d="M8 15V7h8v8M10 7V4h4v3"/></svg>',
  check:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11a8 8 0 1 1-4-6.9"/><path d="m9 11 2 2 7-7"/></svg>',
  plus:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>'
};

function t(key) { return UI[currentLang]?.[key] ?? UI.zh[key] ?? key; }
function escapeHtml(value) { return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c])); }

function applyHomeLanguage() {
  document.documentElement.lang = currentLang === "zh" ? "zh-CN" : "en";
  document.title = t("pageTitle");
  const values = {
    "portal-title":"portalTitle", "portal-subtitle":"portalSubtitle", "portal-eyebrow":"eyebrow", "module-title":"moduleTitle", "module-subtitle":"moduleSubtitle", "chip-local":"chipLocal", "chip-bilingual":"chipBilingual", "chip-excel":"chipExcel",
    "usage-title":"usageTitle", "usage-subtitle":"usageSubtitle", "usage-1":"usage1", "usage-2":"usage2", "usage-3":"usage3", "feedback-eyebrow":"feedbackEyebrow", "feedback-title":"feedbackTitle", "feedback-desc":"feedbackDesc", "feedback-name-label":"feedbackName", "feedback-email-label":"feedbackEmail", "feedback-module-label":"feedbackModule", "feedback-module-portal":"feedbackModulePortal", "feedback-module-sales":"feedbackModuleSales", "feedback-module-stock":"feedbackModuleStock", "feedback-module-shipment":"feedbackModuleShipment", "feedback-module-po":"feedbackModulePo", "feedback-module-odp":"feedbackModuleOdp", "feedback-module-weekly":"feedbackModuleWeekly", "feedback-category-label":"feedbackCategory", "feedback-category-idea":"feedbackIdea", "feedback-category-bug":"feedbackBug", "feedback-category-data":"feedbackData", "feedback-category-other":"feedbackOther", "feedback-message-label":"feedbackMessage", "feedback-submit":"feedbackSubmit", "footer-note":"footerNote"
  };
  Object.entries(values).forEach(([id, key]) => { const el = document.getElementById(id); if (el) el.textContent = t(key); });
  document.getElementById("feedback-message").placeholder = t("feedbackPlaceholder");
  document.getElementById("langZh").classList.toggle("active", currentLang === "zh");
  document.getElementById("langEn").classList.toggle("active", currentLang === "en");
  document.getElementById("langZh").setAttribute("aria-pressed", String(currentLang === "zh"));
  document.getElementById("langEn").setAttribute("aria-pressed", String(currentLang === "en"));
}

function localizeModule(module) {
  const entry = MODULE_I18N[module.url]; const text = entry?.[currentLang] || { name:module.name, desc:module.desc, badge:module.badge };
  return { ...text, icon:entry?.icon || "plus", accent:entry?.accent || "slate" };
}

async function renderModules() {
  const grid = document.getElementById("module-grid");
  const resp = await fetch("./modules.json", { cache:"no-store" });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const config = await resp.json();
  grid.innerHTML = config.modules.map((module) => {
    const item = localizeModule(module); const disabled = module.url === "#";
    return `<article class="card module-card" data-accent="${escapeHtml(item.accent)}"><div class="module-icon">${ICONS[item.icon] || ICONS.plus}</div><span class="badge">${escapeHtml(item.badge)}</span><h3>${escapeHtml(item.name)}</h3><p>${escapeHtml(item.desc)}</p><a href="${escapeHtml(module.url)}" ${module.url.startsWith("http") ? 'target="_blank" rel="noopener"' : ""} ${disabled ? 'aria-disabled="true" class="is-disabled"' : ""}>${escapeHtml(t("openModule"))} <span aria-hidden="true">→</span></a></article>`;
  }).join("");
  grid.querySelectorAll('a[aria-disabled="true"]').forEach((link) => link.addEventListener("click", (event) => event.preventDefault()));
}

function setLanguage(lang) {
  currentLang = lang; localStorage.setItem(APP_LANG_KEY, lang); applyHomeLanguage();
  renderModules().catch((err) => { document.getElementById("module-grid").innerHTML = `<p>${escapeHtml(t("loadError") + err)}</p>`; });
}

function feedbackMailto(payload) {
  const subject = `[EUPV2026] ${payload.category} · ${payload.module}`;
  const body = [`Name: ${payload.name || "-"}`, `Reply email: ${payload.email || "-"}`, `Module: ${payload.module}`, `Category: ${payload.category}`, "", payload.message].join("\n");
  return `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

async function submitFeedback(event) {
  event.preventDefault();
  const form = event.currentTarget; const status = document.getElementById("feedback-status"); const button = document.getElementById("feedback-submit");
  const payload = Object.fromEntries(new FormData(form).entries());
  if (!String(payload.message || "").trim()) { status.className = "feedback-status error"; status.textContent = t("feedbackRequired"); return; }
  button.disabled = true; button.textContent = t("feedbackSending"); status.className = "feedback-status"; status.textContent = t("feedbackSending");
  try {
    const response = await fetch("./api/feedback", { method:"POST", headers:{ "Content-Type":"application/json" }, body:JSON.stringify({ ...payload, page:location.href, language:currentLang }) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    form.reset(); status.className = "feedback-status success"; status.textContent = t("feedbackSuccess");
  } catch (error) {
    status.className = "feedback-status error"; status.innerHTML = `<a href="${escapeHtml(feedbackMailto(payload))}">${escapeHtml(t("feedbackFallback"))}</a>`;
  } finally { button.disabled = false; button.textContent = t("feedbackSubmit"); }
}

document.getElementById("langZh").addEventListener("click", () => setLanguage("zh"));
document.getElementById("langEn").addEventListener("click", () => setLanguage("en"));
document.getElementById("feedback-form").addEventListener("submit", submitFeedback);
document.getElementById("feedback-email-link").href = `mailto:${FEEDBACK_EMAIL}`;
applyHomeLanguage();
renderModules().catch((err) => { document.getElementById("module-grid").innerHTML = `<p>${escapeHtml(t("loadError") + err)}</p>`; });
