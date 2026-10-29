# Reproduction and portability

The preserved page at `assets/original-site/modules/shipment/shipment-details-generator.html` is documentation, not an interactive execution engine. Serve `assets/original-site` over HTTP to view it.

The original local Python implementation referenced by the page is not present in the EUPV2026 repository. Therefore this package does not claim byte-for-byte executable parity beyond the documented algorithm. `calculation-logic.md` records every rule available in the source page: alias detection, candidate header rows, Pcs expansion, four-key one-use matching, output layout, formatting, and in-place sheet replacement. An implementer must confirm any additional aliases and PICKUP file-selection rules against representative files before production use. No transaction data is included.

Run `python scripts/verify_package.py` before redistribution.
