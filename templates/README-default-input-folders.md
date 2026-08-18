# Default input folders

Place default workbooks under these folders:

- `templates/inventory/`
- `templates/daily-supply-plan/`
- `templates/odp/`
- `templates/orderfile-base/`

Filename is not restricted. The app auto-discovers the first `.xlsx` / `.xlsm` in each folder when "Use repository default file" is checked.

Notes:
- Uploaded files still have higher priority than repository defaults.
- `inventory` and `daily-supply-plan` are required sources.
- `odp` and `orderfile-base` are optional sources.
- If your static host does not expose folder listing, add an `index.json` in that folder, for example:
  - `["YourFileName.xlsx"]`
