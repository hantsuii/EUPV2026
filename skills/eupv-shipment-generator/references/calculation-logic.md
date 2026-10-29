# Shipment generator calculation logic

The source repository exposes this specification but not its referenced Python script.

1. Read the Shipment Details workbook with headers on row 1.
2. Read every applicable PICKUP workbook from the supplied folder. Detect the header by trying candidate rows beginning with 6, 5, and 7, then other plausible rows until the required aliases are recognized.
3. Resolve aliases for TCL Reference, B/L, SKU/item number, product name, Pcs, pickup date, departure port, final destination, ETD, ETA, container number, quantity, and pallets.
4. For a positive integer Shipment `Pcs = N`, emit N rows with split sequence 1..N. Preserve N in `Container Nos`. The source page says each expanded row represents one piece.
5. Match each expanded row to a PICKUP row using the composite key TCL Reference + B/L + SKU + Product Name. Trim text; the prior module description specifies SKU uppercasing while other key components remain content-sensitive. Each PICKUP row can be consumed at most once.
6. On match, fill Container no, Quantity, and Pallets from PICKUP. Leave them blank when unmatched.
7. Replace any existing `Processed_TCL` sheet and write columns in this exact order: TCL REFERENCE NO.; Pick Up Date; Item no; Product name; Departure port; Final Destination; B/L no.; Container no; ETD date; ETA date; Quantity; Pallets; Container Nos; `??`.
8. Apply borders, centered alignment, date format `YYYY-MM-DD`, and content-based column widths, then save back to the Shipment Details workbook.

Because the executable source is missing, validate aliases, file glob/order, candidate header-row exhaustion, non-integer/blank Pcs behavior, and duplicate-key consumption order on representative files before relying on a reimplementation.
