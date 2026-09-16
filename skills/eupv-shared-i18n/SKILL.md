---
name: eupv-shared-i18n
description: Shared bilingual (Chinese/English) i18n infrastructure layer used across all EUPV2026 modules. Provides localStorage-backed language persistence, data-attribute-driven DOM text binding, and a global event system for language changes. Use this pattern when you need a lightweight, dependency-free internationalization system for a multi-page web application with shared language state.
---

# Shared i18n Infrastructure — Generic Pattern

## 1. Architecture

Two-layer i18n system:

```
┌─────────────────────────────────────┐
│ Layer 1: Portal (index.html)        │
│ - Own UI dictionary                  │
│ - localStorage["app_lang"]           │
│ - setLanguage() → re-render all      │
├─────────────────────────────────────┤
│ Layer 2: Module pages (each module)  │
│ - PAGE_I18N dictionary (per-page)   │
│ - Shared module-i18n.js loader       │
│ - data-i18n attributes               │
│ - CustomEvent("app-language-change") │
└─────────────────────────────────────┘
```

## 2. Portal-Level i18n

### State Management
```javascript
const APP_LANG_KEY = "app_lang";
let currentLang = ["zh","en"].includes(localStorage.getItem(APP_LANG_KEY))
  ? localStorage.getItem(APP_LANG_KEY) : "zh";
```

### Dictionary Structure
```javascript
const UI = {
  zh: { key1: "中文文本", key2: "..." },
  en: { key1: "English text", key2: "..." }
};
```

### Text Function
```javascript
function t(key) {
  return UI[currentLang]?.[key] ?? UI.zh[key] ?? key;  // Fallback chain
}
```

### Language Switch
```javascript
function setLanguage(lang) {
  currentLang = lang;
  localStorage.setItem(APP_LANG_KEY, lang);
  applyHomeLanguage();    // Update DOM text
  renderModules();        // Re-render module cards
}
```

### DOM Application
```javascript
function applyHomeLanguage() {
  // Set <html lang="zh-CN"|"en">
  // Update <title>
  // Update elements by ID → textContent
  // Update placeholders
  // Toggle .active class on language buttons
  // Update aria-pressed attributes
}
```

## 3. Module-Level i18n (Shared Loader)

### Page Dictionary
Each module page defines:
```javascript
window.PAGE_I18N = {
  zh: { pageTitle: "...", heading: "...", ... },
  en: { pageTitle: "...", heading: "...", ... }
};
```

### Shared Loader: module-i18n.js

```javascript
(function() {
  const LANG_KEY = "app_lang";
  const supported = new Set(["zh","en"]);
  let lang = supported.has(localStorage.getItem(LANG_KEY))
    ? localStorage.getItem(LANG_KEY) : "zh";

  function text(key, params = {}) {
    const dictionary = window.PAGE_I18N || {};
    const value = dictionary[lang]?.[key]
      ?? dictionary.zh?.[key]
      ?? dictionary.en?.[key]
      ?? key;
    return interpolate(value, params);  // {paramName} replacement
  }

  function apply() {
    // 1. Set <html lang>
    // 2. [data-i18n] → textContent
    // 3. [data-i18n-placeholder] → placeholder
    // 4. [data-i18n-value] → value
    // 5. [data-i18n-title] → title
    // 6. [data-i18n-aria-label] → aria-label
    // 7. data-i18n-title-key on <html> → document.title
    // 8. Toggle [data-lang] button active states
    // 9. Dispatch CustomEvent("app-language-change", {detail: {lang}})
  }

  function setLanguage(next) {
    if (!supported.has(next)) return;
    lang = next;
    localStorage.setItem(LANG_KEY, lang);
    apply();
  }

  // Expose globally
  window.appI18n = { apply, setLanguage, text, get language() { return lang; } };

  // Bind language buttons on DOMContentLoaded
  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-lang]").forEach(el => {
      el.addEventListener("click", () => setLanguage(el.dataset.lang));
    });
    apply();
  });
})();
```

## 4. Data Attribute API

| Attribute | Target Property | Example |
|---|---|---|
| `data-i18n="key"` | `textContent` | `<h1 data-i18n="heading">` |
| `data-i18n-placeholder="key"` | `placeholder` | `<input data-i18n-placeholder="searchHint">` |
| `data-i18n-value="key"` | `value` | `<input data-i18n-value="defaultPath">` |
| `data-i18n-title="key"` | `title` | `<a data-i18n-title="tooltip">` |
| `data-i18n-aria-label="key"` | `aria-label` | `<button data-i18n-aria-label="close">` |
| `data-i18n-title-key` (on `<html>`) | `document.title` | `<html data-i18n-title-key="pageTitle">` |
| `data-lang="zh"` (on button) | Language switch | `<button data-lang="zh">中文</button>` |

## 5. Parameter Interpolation

```javascript
// Dictionary value: "完成：{rows} 行，{errors} 错误。"
// Call: text("doneMsg", { rows: 100, errors: 2 })
// Result: "完成：100 行，2 错误。"
```

## 6. Cross-Module Language Persistence

- All pages read from the same `localStorage["app_lang"]` key.
- When a user switches language on the portal, it persists across all module pages.
- Module pages listen for `app-language-change` event to re-render charts/tables with new labels.

### Module Chart Re-render
```javascript
window.addEventListener("app-language-change", (event) => {
  const { lang } = event.detail;
  // Re-render Plotly charts with new axis labels
  // Re-render HTML tables with new headers
  // Update all dynamic text
});
```

## 7. Fallback Chain

```
1. dictionary[currentLang][key]     → exact match
2. dictionary.zh[key]               → Chinese fallback
3. dictionary.en[key]               → English fallback
4. key                              → return the key itself
```

## 8. Reproduction Checklist

1. [ ] Define `APP_LANG_KEY = "app_lang"` and read from `localStorage`.
2. [ ] Build a `UI` dictionary with `zh` and `en` objects.
3. [ ] Implement `t(key)` with fallback chain.
4. [ ] Implement `applyHomeLanguage()` for portal or `apply()` for modules.
5. [ ] Provide language switch buttons with `data-lang` attribute.
6. [ ] Include `module-i18n.js` on every module page.
7. [ ] Define `PAGE_I18N` on every module page.
8. [ ] Dispatch `app-language-change` event so dynamic content can re-render.
9. [ ] Support `{param}` interpolation in dictionary values.