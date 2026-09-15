(function () {
  const LANG_KEY = "app_lang";
  const supported = new Set(["zh", "en"]);
  let lang = supported.has(localStorage.getItem(LANG_KEY)) ? localStorage.getItem(LANG_KEY) : "zh";

  function interpolate(value, params) {
    return String(value).replace(/\{(\w+)\}/g, (_, key) => params[key] ?? `{${key}}`);
  }

  function text(key, params = {}) {
    const dictionary = window.PAGE_I18N || {};
    const value = dictionary[lang]?.[key] ?? dictionary.zh?.[key] ?? dictionary.en?.[key] ?? key;
    return interpolate(value, params);
  }

  function apply() {
    document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      el.textContent = text(el.dataset.i18n);
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
      el.placeholder = text(el.dataset.i18nPlaceholder);
    });
    document.querySelectorAll("[data-i18n-value]").forEach((el) => {
      el.value = text(el.dataset.i18nValue);
    });
    document.querySelectorAll("[data-i18n-title]").forEach((el) => {
      el.title = text(el.dataset.i18nTitle);
    });
    document.querySelectorAll("[data-i18n-aria-label]").forEach((el) => {
      el.setAttribute("aria-label", text(el.dataset.i18nAriaLabel));
    });
    const titleKey = document.documentElement.dataset.i18nTitleKey;
    if (titleKey) document.title = text(titleKey);
    document.querySelectorAll("[data-lang]").forEach((el) => {
      const active = el.dataset.lang === lang;
      el.classList.toggle("active", active);
      el.setAttribute("aria-pressed", String(active));
    });
    window.dispatchEvent(new CustomEvent("app-language-change", { detail: { lang } }));
  }

  function setLanguage(next) {
    if (!supported.has(next)) return;
    lang = next;
    localStorage.setItem(LANG_KEY, lang);
    apply();
  }

  window.appI18n = { apply, setLanguage, text, get language() { return lang; } };
  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-lang]").forEach((el) => {
      el.addEventListener("click", () => setLanguage(el.dataset.lang));
    });
    apply();
  });
})();
