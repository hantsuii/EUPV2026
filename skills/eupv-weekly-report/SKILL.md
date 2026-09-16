---
name: eupv-weekly-report
description: Static weekly report module that serves as a centralized download hub for offline-generated HTML reports, Excel summaries, and CSV trend snapshots. Use this pattern when you need a lightweight file-distribution page with bilingual labels and a back-to-portal link. Platform-agnostic — any static file server can host this.
---

# Static Weekly Report — Generic Pattern

## 1. Purpose

A non-interactive page that provides organized download links for pre-generated report files. It does not process data — it only links to artifacts produced by other processes (scheduled jobs, manual exports, etc.).

## 2. Page Structure

```
┌───────────────────────────────────────┐
│ [语言切换] 静态周报（示例）              │
│ 集中放置离线生成的 HTML/CSV/Excel 链接  │
├───────────────────────────────────────┤
│ 下载                                   │
│ • 示例报告包（占位）                    │
│ • 月度汇总工作簿（占位）                 │
│ • 趋势快照 CSV（占位）                  │
│                                       │
│ [← 返回主页]                           │
└───────────────────────────────────────┘
```

## 3. i18n Dictionary

```javascript
window.PAGE_I18N = {
  zh: {
    pageTitle: "静态周报",
    heading: "静态周报（示例）",
    subtitle: "集中放置离线生成的 HTML、CSV 和 Excel 文件链接，便于快速访问。",
    downloads: "下载",
    item1: "示例报告包（占位）",
    item2: "月度汇总工作簿（占位）",
    item3: "趋势快照 CSV（占位）",
    backHome: "← 返回主页"
  },
  en: {
    pageTitle: "Static Weekly Report",
    heading: "Static Weekly Report (Sample)",
    subtitle: "Place offline-generated HTML, CSV, and Excel links here for quick access.",
    downloads: "Downloads",
    item1: "Sample report package (placeholder)",
    item2: "Monthly summary workbook (placeholder)",
    item3: "Trend snapshot CSV (placeholder)",
    backHome: "← Back to Home"
  }
};
```

## 4. Integration Requirements

- Include `module-i18n.js` for language switching.
- Read `localStorage["app_lang"]` for language state.
- Use `data-i18n` attributes on all user-facing elements.
- Back-to-home link points to `../../index.html` (relative to module folder).

## 5. Reproduction Checklist

1. [ ] Create HTML page with language switch buttons.
2. [ ] Define `PAGE_I18N` with zh/en dictionaries.
3. [ ] Include shared `module-i18n.js`.
4. [ ] List download items as `<li>` elements.
5. [ ] Add back-to-portal link.
6. [ ] Host on any static file server (Cloudflare Pages, GitHub Pages, Nginx).