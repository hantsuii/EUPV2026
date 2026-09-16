# EUPV2026 Skills Index

This directory contains reusable, platform-agnostic skill files for each EUPV2026 module. Each skill describes the complete business logic, input/output schema, and computation rules needed to reproduce the module on any platform or in any AI assistant.

## Skill List

| # | Skill Name | Module | Description |
|---|---|---|---|
| 1 | `eupv-portal` | Portal (index.html) | Bilingual module aggregation portal with JSON manifest, shared i18n, and feedback system |
| 2 | `eupv-sales-analysis` | Sales Change Analysis | Sales KPI dashboard: revenue, target achievement, ASP, product-mix trends from Order details |
| 3 | `eupv-forecast-analysis` | Sales Forecast Accuracy | M+1/M+3/M+6 forecast accuracy with WAPE, bias, hit rate, MW vs weighted comparison |
| 4 | `eupv-stock-analysis` | Available Stock Analysis | Multi-source stock merge (Inventory + DSP + ODP + Orders) with daily transit and MW conversion |
| 5 | `eupv-po-check` | PO Check | Purchase order vs ODP MASTER validation: ETA, type, TCL Ref, SKU, quantity |
| 6 | `eupv-odp-shipping` | ODP Shipping Analysis | Voyage lead time P90, route performance, three monthly views, POPV merge detection |
| 7 | `eupv-shipment-generator` | Shipment Details Generator | Shipment × PICKUP 4-key match with Pcs expansion and Processed_TCL output |
| 8 | `eupv-weekly-report` | Static Weekly Report | Lightweight download hub for offline-generated report files |
| 9 | `eupv-shared-i18n` | Shared i18n (cross-module) | Two-layer bilingual i18n infrastructure with localStorage persistence |

## How to Use

Each `SKILL.md` file is self-contained and follows this structure:

1. **Frontmatter** — name, description, and trigger conditions.
2. **Input Schema** — required sheets, fields, aliases, and types.
3. **Processing Logic** — step-by-step extraction, normalization, and computation rules.
4. **Output Schema** — column layout, sheet names, download format.
5. **Visualization** — chart types, filter cascade, display rules.
6. **Reproduction Checklist** — ordered steps to reimplement on any platform.

## Reproduction Notes

- All modules are **browser-first** (vanilla JS + SheetJS/ExcelJS/Plotly).
- Python fallback exists for stock analysis (openpyxl via Pyodide).
- Business logic is **platform-neutral**: any language (Python, JS, Go) can reproduce it.
- Each skill file contains enough detail to hand to another AI or developer for complete reimplementation.
- The `eupv-po-check` skill also includes a working Python implementation (`scripts/po_check.py`) and tests.