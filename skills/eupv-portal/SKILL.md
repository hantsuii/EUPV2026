---
name: eupv-portal
description: A bilingual (Chinese/English) operational analytics portal that aggregates independent business modules through a single JSON manifest and a shared i18n layer. Use this pattern when you need to build a multi-module internal tools portal with language switching, module cards, and a feedback channel. The portal itself does not do data processing — it is a launchpad and a shared infrastructure layer.
---

# EUPV2026 Portal — Module Aggregation Pattern

This skill describes the generic architecture for building a portal that hosts multiple independent interactive analysis modules. It is platform- and language-agnostic; any framework (vanilla JS, React, Vue, Python/Flask) can reproduce it.

## 1. Core Concepts

The portal is a **single-page launcher** that:
- Reads a `modules.json` manifest to render module cards.
- Provides shared bilingual (zh/en) language switching persisted in `localStorage`.
- Delegates all actual data processing to each module page.
- Includes a feedback form that posts to a serverless function (or falls back to mailto).

Each module is a **standalone HTML page** with its own JS logic. Modules share:
- A common CSS theme (`style.css` + `theme.css`).
- A common i18n loader (`module-i18n.js`) for per-page language switching.
- A common `localStorage` key (`app_lang`) for language persistence.

## 2. modules.json Manifest Format

```json
{
  "portal_title": "Business Analytics Portal",
  "portal_subtitle": "Choose a module to open the analysis page.",
  "modules": [
    {
      "name": "Module Display Name",
      "desc": "One-line description of what the module does.",
      "url": "./modules/category/module-page.html",
      "badge": "Interactive"
    }
  ]
}
```

**Rules:**
- `url` can be relative (same-origin) or absolute (external link).
- `badge` is a free-text tag: "Interactive", "Static", "Validation", etc.
- The portal fetches this file at runtime with `cache: "no-store"`.

## 3. i18n Architecture (Two Layers)

### Layer 1: Portal-level i18n (index.html)

The portal page has its own `UI` dictionary object with `zh` and `en` keys. Language state is stored in `localStorage["app_lang"]`.

```
UI = { zh: { ... }, en: { ... } }
t(key) → UI[currentLang][key] || UI.zh[key] || key
```

A `setLanguage(lang)` function:
1. Updates `currentLang`.
2. Writes to `localStorage`.
3. Re-renders all text via `applyHomeLanguage()`.
4. Re-renders module cards.

### Layer 2: Module-level i18n (module-i18n.js)

Each module page defines `window.PAGE_I18N = { zh: {...}, en: {...} }`.

The shared `module-i18n.js` script:
- Reads `localStorage["app_lang"]` on load.
- Scans all `[data-i18n]` elements and sets `textContent`.
- Scans `[data-i18n-placeholder]`, `[data-i18n-value]`, `[data-i18n-title]`, `[data-i18n-aria-label]`.
- Dispatches a `CustomEvent("app-language-change")` so module JS can re-render charts/tables.
- Exposes `window.appI18n = { apply, setLanguage, text, get language() }`.

**Reproduction rule:** Any new module page must define `PAGE_I18N` and include `module-i18n.js`. Language buttons use `data-lang="zh"` / `data-lang="en"`.

## 4. Module Card Rendering

```javascript
async function renderModules() {
  const config = await fetch("./modules.json").then(r => r.json());
  grid.innerHTML = config.modules.map(module => {
    const item = localizeModule(module); // merges i18n name/desc/badge
    return `<article class="card module-card" data-accent="${item.accent}">
      <div class="module-icon">${ICONS[item.icon]}</div>
      <span class="badge">${item.badge}</span>
      <h3>${item.name}</h3>
      <p>${item.desc}</p>
      <a href="${module.url}">${t("openModule")} →</a>
    </article>`;
  }).join("");
}
```

Each module entry in the i18n map also carries `icon` (SVG key) and `accent` (color theme key).

## 5. Feedback System

A form on the portal collects:
- `name`, `email`, `module` (select), `category` (select), `message` (textarea, required).

**Submission flow:**
1. POST JSON to `./api/feedback` (serverless function).
2. On failure, generate a `mailto:` fallback link with pre-filled subject and body.
3. Serverless function tries: webhook → Resend email → always returns JSON `{ ok: boolean }`.

## 6. File Structure Convention

```
project-root/
├── index.html              # Portal entry
├── modules.json            # Module manifest
├── script.js               # Portal logic + i18n
├── style.css               # Shared layout
├── theme.css               # Light/dark theme variables
├── module-i18n.js          # Shared module i18n loader
├── functions/api/feedback.js  # Serverless feedback handler
├── modules/
│   ├── sales/              # One folder per module
│   ├── forecast/
│   ├── stock/
│   ├── po-check/
│   ├── odp/
│   ├── shipment/
│   └── weekly/
├── templates/              # Default warehouse files for modules
├── py/                     # Python fallback scripts
└── logic/                  # Business-logic documentation (.md)
```

## 7. Reproduction Checklist

To reproduce this portal pattern on any platform:

1. [ ] Create a JSON manifest listing all modules with name/desc/url/badge.
2. [ ] Build a portal page that fetches the manifest and renders clickable cards.
3. [ ] Implement `localStorage`-backed language switching with zh/en dictionaries.
4. [ ] Each module page includes its own i18n dictionary and shares a common loader.
5. [ ] Modules are standalone — no cross-module runtime dependencies except shared CSS.
6. [ ] Add a feedback form with serverless backend + mailto fallback.
7. [ ] Document each module's business logic in a `logic/` folder.

## 8. Design Principles

- **Local-first:** All data processing happens in the browser; no server-side computation except feedback.
- **Bilingual by default:** Every user-facing string flows through the i18n layer.
- **Module isolation:** Each module is independently deployable and testable.
- **Progressive enhancement:** Upload files → process → visualize → download results.