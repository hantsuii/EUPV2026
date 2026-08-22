const APP_LANG_KEY = "app_lang";
let currentLang = localStorage.getItem(APP_LANG_KEY) || "zh";

const UI = {
  zh: {
    portalTitle: "业务分析门户",
    portalSubtitle: "选择模块进入分析页面。",
    moduleTitle: "模块",
    usageTitle: "使用说明",
    usage1: "点击外部模块会在新标签页打开网站。",
    usage2: "内部模块页面内置“返回主页”按钮。",
    usage3: "需要新增或调整模块时，编辑 modules.json。",
    openModule: "打开模块",
    loadError: "模块加载失败：",
  },
  en: {
    portalTitle: "Business Analytics Portal",
    portalSubtitle: "Choose a module to open the analysis page.",
    moduleTitle: "Modules",
    usageTitle: "Usage Notes",
    usage1: "Clicking an external module opens another website.",
    usage2: "Internal modules include a \"Back to Home\" button.",
    usage3: "To add or update modules, edit modules.json.",
    openModule: "Open Module",
    loadError: "Failed to load modules: ",
  },
};

const MODULE_I18N = {
  "./sales-change-analysis.html": {
    zh: { name: "销售变化分析（Web）", desc: "上传 Order details，查看销售总览与区域看板。", badge: "交互" },
    en: { name: "Sales Change Analysis (Web)", desc: "Upload Order details and view sales overview + regional dashboard.", badge: "Interactive" },
  },
  "https://eu-sales-dashboard.streamlit.app/": {
    zh: { name: "销售 Dashboard", desc: "按 PV / ESS / HP 多维筛选，查看月度与区域分析。", badge: "交互" },
    en: { name: "Sales Dashboard", desc: "Multi-dimensional filters for PV / ESS / HP with monthly and regional analysis.", badge: "Interactive" },
  },
  "./available-stock-analysis.html": {
    zh: { name: "可用库存分析", desc: "上传源文件并生成可下载库存工作簿。", badge: "交互" },
    en: { name: "Available Stock Analysis", desc: "Upload source files and generate a downloadable stock workbook.", badge: "Interactive" },
  },
  "./static-weekly-report.html": {
    zh: { name: "静态周报", desc: "直接托管的静态报告页面。", badge: "静态" },
    en: { name: "Static Weekly Report", desc: "Static report page hosted directly on Cloudflare Pages.", badge: "Static" },
  },
  "#": {
    zh: { name: "更多模块", desc: "预留后续模块。", badge: "即将上线" },
    en: { name: "More Modules", desc: "Reserved placeholder for future modules.", badge: "Coming Soon" },
  },
};

function t(key) {
  return UI[currentLang]?.[key] ?? UI.zh[key] ?? key;
}

function applyHomeLanguage() {
  document.documentElement.lang = currentLang === "zh" ? "zh-CN" : "en";
  document.getElementById("portal-title").textContent = t("portalTitle");
  document.getElementById("portal-subtitle").textContent = t("portalSubtitle");
  document.getElementById("module-title").textContent = t("moduleTitle");
  document.getElementById("usage-title").textContent = t("usageTitle");
  document.getElementById("usage-1").textContent = t("usage1");
  document.getElementById("usage-2").textContent = t("usage2");
  document.getElementById("usage-3").textContent = t("usage3");
  document.getElementById("langZh").classList.toggle("active", currentLang === "zh");
  document.getElementById("langEn").classList.toggle("active", currentLang === "en");
}

function localizeModule(module) {
  const custom = MODULE_I18N[module.url]?.[currentLang];
  if (custom) return custom;
  return { name: module.name, desc: module.desc, badge: module.badge };
}

async function renderModules() {
  const grid = document.getElementById("module-grid");
  const resp = await fetch("./modules.json", { cache: "no-store" });
  const config = await resp.json();

  const cards = config.modules
    .map((m) => {
      const text = localizeModule(m);
      return `
      <article class="card">
        <span class="badge">${text.badge}</span>
        <h3>${text.name}</h3>
        <p>${text.desc}</p>
        <a href="${m.url}" ${m.url.startsWith("http") ? 'target="_blank" rel="noopener"' : ""}>${t("openModule")}</a>
      </article>
    `;
    })
    .join("");

  grid.innerHTML = cards;
}

function setLanguage(lang) {
  currentLang = lang;
  localStorage.setItem(APP_LANG_KEY, lang);
  applyHomeLanguage();
  renderModules().catch((err) => {
    document.getElementById("module-grid").innerHTML = `<p>${t("loadError")}${err}</p>`;
  });
}

document.getElementById("langZh").addEventListener("click", () => setLanguage("zh"));
document.getElementById("langEn").addEventListener("click", () => setLanguage("en"));

applyHomeLanguage();
renderModules().catch((err) => {
  document.getElementById("module-grid").innerHTML = `<p>${t("loadError")}${err}</p>`;
});
