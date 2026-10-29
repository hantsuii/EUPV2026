# Reproduction and portability

Serve `assets/original-site` over HTTP and open `/modules/weekly/static-weekly-report.html`. This module is a static bilingual placeholder/download hub. It performs no calculations, reads no workbook, and currently contains no real download links. Reproduction means preserving its page structure, language dictionary, shared theme, and shared `app_lang` local-storage behavior.

Replace placeholders only when real artifacts and link targets are supplied. Run `python scripts/verify_package.py` before redistribution.
