# Default input folders

Place one default workbook in each folder under `templates` with the exact filename:

- `templates/inventory/inventory_step1.xlsx`
- `templates/daily-supply-plan/daily_supply_plan.xlsx`
- `templates/odp/eupv_odp_master.xlsx`
- `templates/orderfile-base/orderfile_base.xlsx`

Rules:
- Uploaded files still have higher priority than repository defaults.
- `inventory_step1.xlsx` and `daily_supply_plan.xlsx` are required defaults (if users choose default mode).
- `eupv_odp_master.xlsx` and `orderfile_base.xlsx` are optional defaults.
