# Current module packages

One independent skill is provided for every entry in the current `modules.json`.

| Module | Skill folder |
| --- | --- |
| Sales Change Analysis | `eupv-sales-analysis` |
| Sales Forecast Accuracy | `eupv-forecast-analysis` |
| PV Forecast vs Actual Sales | `eupv-forecast-sales-analysis` |
| Stock Analysis | `eupv-stock-analysis` |
| Static Weekly Report | `eupv-weekly-report` |
| Shipment Details Generator | `eupv-shipment-generator` |
| PO Check | `eupv-po-check` |
| ODP Shipping Analysis | `eupv-odp-shipping` |

Each folder contains `SKILL.md`, UI metadata, current source assets, reproduction guidance, a SHA-256 source manifest, and a verifier. Transaction workbooks, generated reports, stock history, and credentials are excluded. Structural/master-data workbooks are included only where required.

Independent ZIP archives are in `dist/modules/`.
