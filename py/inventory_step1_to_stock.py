from __future__ import annotations

import argparse
from collections import defaultdict
from datetime import date, datetime, timedelta

# Default: start = today, end = today + 6 months (used only if no explicit dates passed)

def _default_start():
    return date.today()

def _default_end():
    today = date.today()
    # add 6 months
    m = today.month + 6
    y = today.year + (m - 1) // 12
    m = ((m - 1) % 12) + 1
    return date(y, m, today.day)
from pathlib import Path
from typing import Any

from openpyxl import load_workbook
from openpyxl.styles import PatternFill
from openpyxl.worksheet.table import Table, TableStyleInfo


PV_STOCK_COUNTRIES = ["NL", "FR", "UK", "ES", "IT"]
OUTPUT_SHEET_NAMES = [*[f"{country}_PV" for country in PV_STOCK_COUNTRIES], "ESS+HP Stock"]
SKU_SHEET_CANDIDATES = ["Legacy Mapping Product", "SKU", "SKU Mapping"]
TRANSIT_START_DATE = None  # resolved dynamically via _default_start()
TRANSIT_END_DATE = None    # resolved dynamically via _default_end()
ALLOC_SHEET_NAME = "To be allocated"
TRANSIT_SOURCE_SHEET_NAME = "_Transit Source Map"
UNMATCHED_SHEET_NAME = "Unmatched SKU"
DOMESTIC_DETAIL_SHEET_NAMES = ["Domestic Stock PV", "Domestic Stock ESS"]

SOURCE_INV_DSP = "INV_DSP"
SOURCE_ODP = "ODP"
SOURCE_MIXED = "MIXED"
UNMATCHED_SKU_MARK = "SKU not matched"
DOMESTIC_WH = "CN"

CELL_FILL_BY_SOURCE = {
    SOURCE_INV_DSP: PatternFill(fill_type="solid", fgColor="DDEBFF"),
    SOURCE_ODP: PatternFill(fill_type="solid", fgColor="FFE8CC"),
    SOURCE_MIXED: PatternFill(fill_type="solid", fgColor="EBDCFF"),
}

WH_CODE_MAP = {
    "SPNL": "NL",
    "SPFR": "FR",
    "SPTN": "FR",
    "SPUK": "UK",
    "SPIT": "IT",
    "SPES": "ES",
}


def normalize_text(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def normalize_lower(value: Any) -> str:
    return normalize_text(value).lower()


def normalize_sku_key(value: Any) -> str:
    return normalize_text(value).upper()


def safe_float(value: Any) -> float:
    if value in (None, ""):
        return 0.0
    if isinstance(value, (int, float)):
        return float(value)
    text = normalize_text(value).replace(",", "")
    if not text:
        return 0.0
    try:
        return float(text)
    except ValueError:
        return 0.0


def add_light_blue_table(ws: Any, table_name: str) -> None:
    if ws.max_row < 2:
        return
    table = Table(displayName=table_name, ref=ws.dimensions)
    table.tableStyleInfo = TableStyleInfo(
        name="TableStyleLight2",
        showFirstColumn=False,
        showLastColumn=False,
        showRowStripes=True,
        showColumnStripes=False,
    )
    ws.add_table(table)


def build_header_index(headers: list[Any]) -> dict[str, int]:
    out: dict[str, int] = {}
    for idx, header in enumerate(headers):
        key = normalize_lower(header)
        if key and key not in out:
            out[key] = idx
    return out


def map_country_code(sales_org_name: str) -> str:
    name = normalize_lower(sales_org_name)
    if "netherland" in name or "netherlands" in name:
        return "NL"
    if "france" in name:
        return "FR"
    if "united kingdom" in name or name == "uk" or name.endswith(" uk"):
        return "UK"
    if "italy" in name:
        return "IT"
    if "spain" in name:
        return "ES"
    return normalize_text(sales_org_name)[:2].upper()


def resolve_output_category(source_category: Any, family: Any) -> str:
    category_text = normalize_upper_category(source_category)

    # Keep category from source tables when valid
    if category_text in {"PV", "ESS", "HP"}:
        return category_text

    # For rows whose category needs to be inferred from SKU-side info
    family_text = normalize_lower(family)
    if family_text in {"reserve", "non-pv", "ess - gen2"}:
        return "ESS"

    return "PV"


def normalize_upper_category(value: Any) -> str:
    text = normalize_text(value).upper()
    normalized = text.replace("_", "-").replace(" ", "")

    # Exact/normalized category recognition only, avoid false-positive from strings like NON-PV
    if normalized in {"HP", "HEATPUMP", "HEATPUMPS"}:
        return "HP"
    if normalized in {"ESS", "ESSGEN2", "ESS-GEN2"}:
        return "ESS"
    if normalized == "PV":
        return "PV"

    return text


def map_transit_wh_code(in_transit_code: Any) -> str | None:
    text = normalize_text(in_transit_code).upper()
    if not text:
        return None

    for code, wh in WH_CODE_MAP.items():
        if code in text:
            return wh
    return None


def map_transit_virtual_warehouse(in_transit_code: Any) -> str | None:
    raw_text = normalize_text(in_transit_code)
    text = raw_text.upper()
    if not text:
        return None
    for code in WH_CODE_MAP:
        if code not in text:
            continue
        if "ARRIVAL PLAN" in text:
            return f"Arrival Plan-{code}"
        return code
    return None


def normalize_output_virtual_warehouse(value: Any) -> str:
    raw_text = normalize_text(value)
    if not raw_text:
        return ""
    transit_name = map_transit_virtual_warehouse(raw_text)
    if transit_name and "arrival plan" in normalize_lower(raw_text):
        return transit_name
    if raw_text.endswith(")") and "(" in raw_text:
        return raw_text[:raw_text.rfind("(")].strip()
    return raw_text


def excluded_row(sales_org_name: Any, physical_warehouse_name: Any, virtual_warehouse_name: Any) -> bool:
    sales_org = normalize_lower(sales_org_name)
    sales_org_compact = " ".join(sales_org.split())
    if (
        sales_org_compact == "china"
        or "business planning department" in sales_org_compact
    ):
        return True

    physical_warehouse = " ".join(normalize_lower(physical_warehouse_name).split())
    if physical_warehouse == "sptn china ftz(w73)":
        return True

    virtual_warehouse = normalize_lower(virtual_warehouse_name).strip()
    if virtual_warehouse.startswith(("fru", "hold", "market material", "scrap", "spec")):
        return True
    if virtual_warehouse == "natec sunenergy b.v. consignment wh":
        return True

    return False


def pick_sku_sheet_name(workbook_sheet_names: list[str], explicit_name: str | None) -> str:
    if explicit_name:
        if explicit_name in workbook_sheet_names:
            return explicit_name
        raise ValueError(f"SKU sheet not found: {explicit_name}")

    lowered = {name.lower(): name for name in workbook_sheet_names}
    for candidate in SKU_SHEET_CANDIDATES:
        if candidate.lower() in lowered:
            return lowered[candidate.lower()]
    return workbook_sheet_names[0]


def iter_dates(start_date: date, end_date: date) -> list[date]:
    days: list[date] = []
    d = start_date
    while d <= end_date:
        days.append(d)
        d += timedelta(days=1)
    return days


def date_header(d: date) -> str:
    return f"{d.year}.{d.month}.{d.day}"


def parse_supply_date(value: Any) -> date | None:
    if value in (None, ""):
        return None

    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value

    text = normalize_text(value)
    if not text:
        return None

    for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%Y-%m-%d %H:%M:%S", "%Y/%m/%d %H:%M:%S"):
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            continue

    text = text.replace(".", "-").replace("/", "-")
    parts = text.split("-")
    if len(parts) >= 3 and all(p.isdigit() for p in parts[:3]):
        return date(int(parts[0]), int(parts[1]), int(parts[2]))

    return None


def merge_transit_payload(
    base_qty: dict[tuple[str, str, str, str, str, str], float],
    base_category: dict[tuple[str, str], str],
    add_qty: dict[tuple[str, str, str, str, str, str], float],
    add_category: dict[tuple[str, str], str],
) -> None:
    for key, qty in add_qty.items():
        base_qty[key] += qty
    for key, category in add_category.items():
        if key not in base_category and category:
            base_category[key] = category


def normalize_source_tag(value: str) -> str:
    text = normalize_text(value).upper()
    if text == SOURCE_ODP:
        return SOURCE_ODP
    if text == SOURCE_MIXED:
        return SOURCE_MIXED
    return SOURCE_INV_DSP


def merge_source_tag(curr: str, incoming: str) -> str:
    if not incoming:
        return normalize_source_tag(curr) if curr else ""
    if not curr:
        return normalize_source_tag(incoming)

    curr_norm = normalize_source_tag(curr)
    incoming_norm = normalize_source_tag(incoming)
    if curr_norm == incoming_norm:
        return curr_norm
    return SOURCE_MIXED


def extract_inventory_rows(inventory_path: Path, stock_mode: str = "available") -> list[dict[str, Any]]:
    wb = load_workbook(inventory_path, data_only=True, read_only=True)
    ws = wb[wb.sheetnames[0]]

    headers = [cell.value for cell in ws[1]]
    idx = build_header_index(headers)

    required = [
        "customer model",
        "product model",
        "category",
        "actual stock" if stock_mode == "total" else "available stock",
        "sales organization name",
        "virtual warehouse name",
        "physical warehouse name",
    ]
    missing = [h for h in required if h not in idx]
    if missing:
        wb.close()
        raise ValueError(f"Inventory Detail missing columns: {missing}")

    stock_column = "actual stock" if stock_mode == "total" else "available stock"
    grouped: dict[tuple[str, str, str, str, str], float] = defaultdict(float)
    for row in ws.iter_rows(min_row=2, values_only=True):
        sales_org_name = row[idx["sales organization name"]]
        virtual_warehouse_name = row[idx["virtual warehouse name"]]
        physical_warehouse_name = row[idx["physical warehouse name"]]
        if excluded_row(sales_org_name, physical_warehouse_name, virtual_warehouse_name):
            continue

        sku = normalize_text(row[idx["customer model"]])
        category = normalize_text(row[idx["category"]])
        product_model = normalize_text(row[idx["product model"]])
        sales_org = normalize_text(sales_org_name)
        virtual_warehouse = normalize_output_virtual_warehouse(virtual_warehouse_name)
        if not sku:
            continue

        stock = safe_float(row[idx[stock_column]])
        grouped[(sales_org, virtual_warehouse, category, sku, product_model)] += stock

    wb.close()

    out: list[dict[str, Any]] = []
    for (sales_org, virtual_warehouse, category, sku, product_model), stock in sorted(grouped.items()):
        out.append(
            {
                "SKU": sku,
                "Category": category,
                "ProductModel": product_model,
                "VirtualWarehouse": virtual_warehouse,
                "Stock": round(stock, 3),
                "WH": map_country_code(sales_org),
            }
        )
    return out


def infer_legacy_category(family: Any, brand: Any, fallback_category: Any = "") -> str:
    normalized_family = normalize_lower(family)
    if normalized_family == "hp":
        prefix = "HP"
    elif "ess" in normalized_family or any(
        normalized_family.startswith(value) for value in ("ac charger", "other", "tcl blueark")
    ):
        prefix = "ESS"
    else:
        prefix = "PV"
    fallback = normalize_text(fallback_category)
    if fallback.upper().startswith(prefix):
        return fallback
    normalized_brand = normalize_text(brand)
    return f"{prefix} - {normalized_brand}" if normalized_brand else prefix


def build_sku_lookup(stock_wb_path: Path, sku_sheet_name: str | None = None) -> dict[str, dict[str, Any]]:
    wb = load_workbook(stock_wb_path, data_only=True)
    lookup: dict[str, dict[str, Any]] = {}
    lowered_names = {name.lower(): name for name in wb.sheetnames}
    sku_name = lowered_names.get("sku") or lowered_names.get("sku mapping")
    legacy_name = lowered_names.get("legacy mapping product")
    if sku_sheet_name and sku_sheet_name in wb.sheetnames:
        if sku_sheet_name.lower() == "legacy mapping product":
            legacy_name = sku_sheet_name
        else:
            sku_name = sku_sheet_name
    if not sku_name and not legacy_name:
        wb.close()
        raise ValueError("Stock template is missing Legacy Mapping Product / SKU sheets")

    if sku_name:
        ws = wb[sku_name]
        idx = build_header_index([cell.value for cell in ws[1]])
        required = [
            "sku no", "product model", "category", "brand", "level2", "level3",
            "billable watts(w)", "connector", "total pcs per 40hq container",
        ]
        missing = [h for h in required if h not in idx]
        if missing:
            wb.close()
            raise ValueError(f"SKU sheet missing columns: {missing}")
        for row in ws.iter_rows(min_row=2, values_only=True):
            sku_key = normalize_sku_key(row[idx["sku no"]])
            if not sku_key or sku_key in lookup:
                continue
            lookup[sku_key] = {
                "Category": normalize_text(row[idx["category"]]),
                "Brand": normalize_text(row[idx["brand"]]),
                "Product TCL Report": normalize_text(row[idx["level2"]]),
                "Family": normalize_text(row[idx["level3"]]),
                "Model": normalize_text(row[idx["product model"]]),
                "Connector": normalize_text(row[idx["connector"]]),
                "Bin": safe_float(row[idx["billable watts(w)"]]),
                "MOQ": safe_float(row[idx["total pcs per 40hq container"]]),
            }

    if legacy_name:
        ws = wb[legacy_name]
        idx = build_header_index([cell.value for cell in ws[1]])
        required = ["sku no.", "anaplan pl6", "brand", "family", "product tcl report", "bins", "container loading"]
        missing = [h for h in required if h not in idx]
        if missing:
            wb.close()
            raise ValueError(f"Legacy Mapping Product sheet missing columns: {missing}")
        legacy_rows: dict[str, tuple[Any, ...]] = {}
        for row in ws.iter_rows(min_row=2, values_only=True):
            sku_key = normalize_sku_key(row[idx["sku no."]])
            if sku_key and sku_key not in legacy_rows:
                legacy_rows[sku_key] = row
        for sku_key, row in legacy_rows.items():
            fallback = lookup.get(sku_key, {})
            family = normalize_text(row[idx["family"]])
            brand = normalize_text(row[idx["brand"]])
            lookup[sku_key] = {
                "Category": infer_legacy_category(family, brand, fallback.get("Category")),
                "Brand": brand or fallback.get("Brand", ""),
                "Product TCL Report": normalize_text(row[idx["product tcl report"]]) or fallback.get("Product TCL Report", ""),
                "Family": family or fallback.get("Family", ""),
                "Model": normalize_text(row[idx["anaplan pl6"]]) or fallback.get("Model", ""),
                "Connector": fallback.get("Connector", ""),
                "Bin": safe_float(row[idx["bins"]]) or safe_float(fallback.get("Bin")),
                "MOQ": safe_float(row[idx["container loading"]]) or safe_float(fallback.get("MOQ")),
            }

    wb.close()
    return lookup


def extract_transit_data(
    daily_supply_plan_path: Path,
    start_date: date,
    end_date: date,
    stock_mode: str = "available",
) -> tuple[dict[tuple[str, str, str, str, str, str], float], dict[tuple[str, str], str]]:
    wb = load_workbook(daily_supply_plan_path, data_only=True, read_only=True)
    ws = wb[wb.sheetnames[0]]

    headers = [cell.value for cell in ws[1]]
    idx = build_header_index(headers)
    quantity_column = "scheduled quantity" if stock_mode == "total" else "available quantity"
    required = ["in-transit warehouse(code)", "customer model", "product model", "category", "supply date", quantity_column]
    missing = [h for h in required if h not in idx]
    if missing:
        wb.close()
        raise ValueError(f"DailySupplyPlan missing columns: {missing}")

    transit_qty: dict[tuple[str, str, str, str, str, str], float] = defaultdict(float)
    transit_category: dict[tuple[str, str], str] = {}

    for row in ws.iter_rows(min_row=2, values_only=True):
        sku = normalize_text(row[idx["customer model"]])
        if not sku:
            continue

        raw_warehouse = row[idx["in-transit warehouse(code)"]]
        wh = map_transit_wh_code(raw_warehouse)
        virtual_warehouse = map_transit_virtual_warehouse(raw_warehouse)
        if not wh or not virtual_warehouse:
            continue

        supply_date = parse_supply_date(row[idx["supply date"]])
        if supply_date is None or supply_date < start_date or supply_date > end_date:
            continue

        qty = safe_float(row[idx[quantity_column]])
        d_header = date_header(supply_date)
        category_val = normalize_text(row[idx["category"]])
        product_model = normalize_text(row[idx["product model"]])
        transit_qty[(sku, wh, virtual_warehouse, category_val, product_model, d_header)] += qty

    wb.close()
    return transit_qty, transit_category


def extract_odp_transit_data(
    odp_master_path: Path,
    start_date: date,
    end_date: date,
) -> tuple[dict[tuple[str, str, str, str, str, str], float], dict[tuple[str, str], str], dict[str, float], list[dict[str, Any]]]:
    wb = load_workbook(odp_master_path, data_only=True, read_only=True)
    transit_qty: dict[tuple[str, str, str, str, str, str], float] = defaultdict(float)
    transit_category: dict[tuple[str, str], str] = {}
    domestic_qty: dict[str, float] = defaultdict(float)
    domestic_detail_map: dict[tuple[str, str, str, str], dict[str, Any]] = {}
    blocked_destinations = {
        "piraeus", "gdansk", "cork", "yangon", "limassol", "douala", "manila north",
        "karachi", "dar es salaam", "laem chabang", "pointe des galets", "davao", "thessaloniki",
    }
    sheet_specs = (("PV SUPPLY DATA", "PV"), ("ESS SUPPLY DATA", "ESS"))

    for sheet_name, source_category in sheet_specs:
        if sheet_name not in wb.sheetnames:
            wb.close()
            raise ValueError(f"ODP file missing `{sheet_name}` sheet")
        ws = wb[sheet_name]
        headers = [cell.value for cell in ws[1]]
        idx = build_header_index(headers)
        required = [
            "sptn-pvhk new ark po#", "new ark po type", "allocation planning", "port destination", "new ark wh",
            "new ark sku", "model", "quantity", "eta for new ark update",
        ]
        missing = [h for h in required if h not in idx]
        if missing:
            wb.close()
            raise ValueError(f"{sheet_name} missing columns: {missing}")

        for row in ws.iter_rows(min_row=2, values_only=True):
            if normalize_text(row[idx["sptn-pvhk new ark po#"]]):
                continue
            if normalize_lower(row[idx["new ark po type"]]) == "offshore":
                continue
            if normalize_lower(row[idx["allocation planning"]]) == "non-eu":
                continue
            if normalize_lower(row[idx["port destination"]]) in blocked_destinations:
                continue

            sku = normalize_text(row[idx["new ark sku"]])
            if not sku:
                continue
            raw_wh = row[idx["new ark wh"]]
            wh = map_transit_wh_code(raw_wh)
            virtual_warehouse = map_transit_virtual_warehouse(raw_wh) or ""
            qty = safe_float(row[idx["quantity"]])
            model = normalize_text(row[idx["model"]])
            is_arrival_plan_warehouse = "arrival plan" in normalize_lower(raw_wh) and bool(wh)
            if not is_arrival_plan_warehouse:
                domestic_qty[sku] += qty
                factory = normalize_text(row[idx["factory location"]]) if "factory location" in idx else ""
                mw = safe_float(row[idx["mw"]]) if "mw" in idx else 0.0
                detail_key = (source_category, sku, model, factory)
                detail = domestic_detail_map.setdefault(
                    detail_key,
                    {"SKU": sku, "Model": model, "Factory": factory, "Category": source_category, "Quantity": 0.0, "MW": 0.0},
                )
                detail["Quantity"] += qty
                detail["MW"] += mw
                continue

            raw_eta = row[idx["eta for new ark update"]]
            if normalize_lower(raw_eta) in {"", "n/a", "na", "none", "null"}:
                continue
            eta_date = parse_supply_date(raw_eta)
            if eta_date is None or eta_date.year <= 1900:
                continue
            if eta_date < start_date or eta_date > end_date:
                continue

            d_header = date_header(eta_date)
            transit_qty[(sku, wh, virtual_warehouse, source_category, model, d_header)] += qty
            if (sku, wh) not in transit_category:
                transit_category[(sku, wh)] = source_category

    wb.close()
    domestic_details = [
        {
            **item,
            "Quantity": round(safe_float(item["Quantity"]), 3),
            "MW": round(safe_float(item["MW"]), 6),
        }
        for _, item in sorted(domestic_detail_map.items())
        if safe_float(item["Quantity"]) != 0
    ]
    return transit_qty, transit_category, domestic_qty, domestic_details


def extract_to_be_allocated_orders(
    order_file_path: Path,
) -> tuple[list[dict[str, Any]], dict[tuple[str, str], float]]:
    wb = load_workbook(order_file_path, data_only=True, read_only=False)
    ws = wb[wb.sheetnames[0]]

    header_row = 2
    headers = [ws.cell(header_row, c).value for c in range(1, ws.max_column + 1)]
    idx = build_header_index(headers)

    required = [
        "allocation status",
        "material",
        "ordered qty",
        "crd",
        "customer level 6 name",
        "so no.",
        "so line",
        "model",
        "factory",
    ]
    missing = [h for h in required if h not in idx]
    if missing:
        wb.close()
        raise ValueError(f"Order file missing columns: {missing}")

    orders: list[dict[str, Any]] = []
    agg_by_sku_wh: dict[tuple[str, str], float] = defaultdict(float)

    max_row = ws.max_row
    for r in range(header_row + 1, max_row + 1):
        status = normalize_lower(ws.cell(r, idx["allocation status"] + 1).value)
        if status != "to be allocated":
            continue

        sku = normalize_text(ws.cell(r, idx["material"] + 1).value)
        qty = safe_float(ws.cell(r, idx["ordered qty"] + 1).value)
        crd = ws.cell(r, idx["crd"] + 1).value
        customer_name = ws.cell(r, idx["customer level 6 name"] + 1).value
        so_no = ws.cell(r, idx["so no."] + 1).value
        so_line = ws.cell(r, idx["so line"] + 1).value
        model = ws.cell(r, idx["model"] + 1).value
        factory = ws.cell(r, idx["factory"] + 1).value
        wh = map_transit_wh_code(factory) or ""

        orders.append(
            {
                "SKU": sku,
                "Ordered Qty": round(qty, 3),
                "CRD": crd,
                "Customer Name": customer_name,
                "SO No.": so_no,
                "SO Line": so_line,
                "Model": model,
                "Factory": factory,
                "WH": wh,
            }
        )

        if sku and wh:
            agg_by_sku_wh[(sku, wh)] += qty

    wb.close()
    return orders, agg_by_sku_wh


def write_output_sheet(
    stock_wb_path: Path,
    rows: list[dict[str, Any]],
    sku_lookup: dict[str, dict[str, Any]],
    transit_qty: dict[tuple[str, str, str, str, str, str], float] | None = None,
    transit_category: dict[tuple[str, str], str] | None = None,
    transit_source_tag: dict[tuple[str, str, str, str, str, str], str] | None = None,
    daily_transit_qty: dict[tuple[str, str, str, str, str, str], float] | None = None,
    odp_transit_qty: dict[tuple[str, str, str, str, str, str], float] | None = None,
    domestic_qty: dict[str, float] | None = None,
    domestic_details: list[dict[str, Any]] | None = None,
    allocated_orders: list[dict[str, Any]] | None = None,
    allocated_need: dict[tuple[str, str], float] | None = None,
    start_date: date = None,
    end_date: date = None,
) -> dict[str, Any]:
    if start_date is None:
        start_date = _default_start()
    if end_date is None:
        end_date = _default_end()
    wb = load_workbook(stock_wb_path)

    legacy_output_names = [f"PV Stock {country}" for country in PV_STOCK_COUNTRIES]
    for old_name in ["stock", "PV Stock", UNMATCHED_SHEET_NAME, "_stock_build", *legacy_output_names, *OUTPUT_SHEET_NAMES]:
        if old_name in wb.sheetnames:
            wb.remove(wb[old_name])
    if ALLOC_SHEET_NAME in wb.sheetnames:
        alloc_old = wb[ALLOC_SHEET_NAME]
        wb.remove(alloc_old)
    if TRANSIT_SOURCE_SHEET_NAME in wb.sheetnames:
        source_old = wb[TRANSIT_SOURCE_SHEET_NAME]
        wb.remove(source_old)
    for old_name in ["Domestic Stock", *DOMESTIC_DETAIL_SHEET_NAMES]:
        if old_name in wb.sheetnames:
            wb.remove(wb[old_name])
    ws = wb.create_sheet("_stock_build")

    base_headers = [
        "WH",
        "Virtual Warehouse",
        "Category",
        "Brand",
        "Product TCL Report",
        "Family",
        "SKU",
        "Model",
        "Connector",
        "Bin",
        "MOQ",
        "To be allocated",
        "Total QTY",
        "Total MW",
        "MW",
        "Stock",
        "Domestic Stock",
    ]
    transit_dates = iter_dates(start_date, end_date)
    transit_headers = [date_header(d) for d in transit_dates]
    headers = base_headers + transit_headers
    ws.append(headers)

    marked_rows_info: list[dict[str, str]] = []

    def resolve_sku_mapping(sku: str) -> tuple[dict[str, Any], bool]:
        mapped = sku_lookup.get(normalize_sku_key(sku))
        if mapped:
            return mapped, False
        return {
            "Category": UNMATCHED_SKU_MARK,
            "Brand": UNMATCHED_SKU_MARK,
            "Product TCL Report": UNMATCHED_SKU_MARK,
            "Family": UNMATCHED_SKU_MARK,
            "Model": UNMATCHED_SKU_MARK,
            "Connector": UNMATCHED_SKU_MARK,
            "Bin": 0,
            "MOQ": 0,
        }, True

    def append_stock_row(
        wh: str,
        sku: str,
        mapped: dict[str, Any],
        stock: float,
        domestic_stock: float = 0,
        virtual_warehouse: str = "",
        source_category: str = "",
        source_product_model: str = "",
    ) -> None:
        ws.append(
            [
                wh,
                virtual_warehouse,
                source_category or mapped.get("Category"),
                mapped.get("Brand"),
                mapped.get("Product TCL Report"),
                mapped.get("Family"),
                sku,
                source_product_model or mapped.get("Model"),
                mapped.get("Connector"),
                mapped.get("Bin"),
                mapped.get("MOQ"),
                0,
                0,
                0,
                0,
                stock,
                domestic_stock,
            ]
            + [None] * len(transit_headers)
        )

    transit_qty = transit_qty or {}
    transit_category = transit_category or {}
    transit_source_tag = transit_source_tag or {}
    daily_transit_qty = daily_transit_qty or {}
    odp_transit_qty = odp_transit_qty or {}
    domestic_qty = domestic_qty or {}
    domestic_details = domestic_details or []
    allocated_orders = allocated_orders or []
    allocated_need = allocated_need or {}

    active_sku_keys: set[str] = set()
    for item in rows:
        if safe_float(item.get("Stock")) != 0:
            active_sku_keys.add(normalize_sku_key(item.get("SKU")))
    for (sku, _wh, _virtual_warehouse, _category, _product_model, _d_header), qty in transit_qty.items():
        if safe_float(qty) != 0:
            active_sku_keys.add(normalize_sku_key(sku))
    for (sku, _wh), qty in allocated_need.items():
        if safe_float(qty) != 0:
            active_sku_keys.add(normalize_sku_key(sku))
    for sku, qty in domestic_qty.items():
        if safe_float(qty) != 0:
            active_sku_keys.add(normalize_sku_key(sku))

    for item in rows:
        if normalize_sku_key(item["SKU"]) not in active_sku_keys:
            continue
        mapped, unmatched = resolve_sku_mapping(item["SKU"])
        if unmatched:
            marked_rows_info.append({"SKU": item["SKU"], "WH": item["WH"], "Reason": UNMATCHED_SKU_MARK})
        append_stock_row(
            item["WH"],
            item["SKU"],
            mapped,
            item["Stock"],
            virtual_warehouse=item.get("VirtualWarehouse", ""),
            source_category=item.get("Category", ""),
            source_product_model=item.get("ProductModel", ""),
        )

    header_col = {h: i + 1 for i, h in enumerate(headers)}

    def is_unmatched_row(row_num: int) -> bool:
        marker = UNMATCHED_SKU_MARK.lower()
        return any(
            normalize_lower(ws.cell(row_num, header_col[header]).value) == marker
            for header in ("Category", "Brand", "Product TCL Report", "Family", "Model")
        )
    row_by_key: dict[tuple[str, str], int] = {}
    transit_row_by_key: dict[tuple[str, str, str, str, str], int] = {}
    for r in range(2, ws.max_row + 1):
        sku = normalize_text(ws.cell(r, header_col["SKU"]).value)
        wh = normalize_text(ws.cell(r, header_col["WH"]).value)
        virtual_warehouse = normalize_text(ws.cell(r, header_col["Virtual Warehouse"]).value)
        if sku and wh and not virtual_warehouse and (sku, wh) not in row_by_key:
            row_by_key[(sku, wh)] = r

    for (sku, wh), need_qty in sorted(allocated_need.items()):
        if not sku or not wh or safe_float(need_qty) == 0:
            continue
        key = (sku, wh)
        if key in row_by_key:
            continue
        mapped, unmatched = resolve_sku_mapping(sku)
        if unmatched:
            marked_rows_info.append({"SKU": sku, "WH": wh, "Reason": UNMATCHED_SKU_MARK})
        append_stock_row(wh, sku, mapped, 0)
        row_by_key[key] = ws.max_row

    for sku, qty in sorted(domestic_qty.items()):
        if not sku or safe_float(qty) == 0:
            continue
        key = (sku, DOMESTIC_WH)
        if key not in row_by_key:
            mapped, unmatched = resolve_sku_mapping(sku)
            if unmatched:
                marked_rows_info.append({"SKU": sku, "WH": DOMESTIC_WH, "Reason": UNMATCHED_SKU_MARK})
            append_stock_row(DOMESTIC_WH, sku, mapped, 0, 0)
            row_by_key[key] = ws.max_row
        row_num = row_by_key[key]
        current = safe_float(ws.cell(row_num, header_col["Domestic Stock"]).value)
        ws.cell(row_num, header_col["Domestic Stock"]).value = round(current + qty, 3)

    stock_col = header_col["Stock"]
    domestic_stock_col = header_col["Domestic Stock"]
    ws.cell(1, stock_col).fill = CELL_FILL_BY_SOURCE[SOURCE_INV_DSP]
    ws.cell(1, domestic_stock_col).fill = CELL_FILL_BY_SOURCE[SOURCE_ODP]
    for r in range(2, ws.max_row + 1):
        ws.cell(r, stock_col).fill = CELL_FILL_BY_SOURCE[SOURCE_INV_DSP]
        if safe_float(ws.cell(r, domestic_stock_col).value) != 0:
            ws.cell(r, domestic_stock_col).fill = CELL_FILL_BY_SOURCE[SOURCE_ODP]

    date_source_summary: dict[str, str] = {}
    for (_, _, _, _, _, d_header), src in transit_source_tag.items():
        if d_header not in header_col:
            continue
        date_source_summary[d_header] = merge_source_tag(date_source_summary.get(d_header, ""), src)

    for d_header, src in date_source_summary.items():
        ws.cell(1, header_col[d_header]).fill = CELL_FILL_BY_SOURCE.get(normalize_source_tag(src), CELL_FILL_BY_SOURCE[SOURCE_INV_DSP])

    for (sku, wh, virtual_warehouse, source_category, source_product_model, d_header), qty in transit_qty.items():
        if d_header not in header_col:
            continue
        if safe_float(qty) == 0 or normalize_sku_key(sku) not in active_sku_keys:
            continue

        mapped, unmatched = resolve_sku_mapping(sku)
        category_value = source_category or normalize_text(mapped.get("Category"))
        product_model_value = source_product_model or normalize_text(mapped.get("Model"))
        transit_key = (sku, wh, virtual_warehouse, category_value, product_model_value)
        if transit_key not in transit_row_by_key:
            if unmatched:
                marked_rows_info.append({"SKU": sku, "WH": wh, "Reason": UNMATCHED_SKU_MARK})
            append_stock_row(
                wh,
                sku,
                mapped,
                0,
                virtual_warehouse=virtual_warehouse,
                source_category=category_value,
                source_product_model=product_model_value,
            )
            transit_row_by_key[transit_key] = ws.max_row

        row_num = transit_row_by_key[transit_key]
        col_num = header_col[d_header]
        current = safe_float(ws.cell(row_num, col_num).value)
        ws.cell(row_num, col_num).value = round(current + qty, 3)
        source_key = (sku, wh, virtual_warehouse, source_category, source_product_model, d_header)
        source_tag = normalize_source_tag(transit_source_tag.get(source_key, SOURCE_INV_DSP))
        ws.cell(row_num, col_num).fill = CELL_FILL_BY_SOURCE.get(source_tag, CELL_FILL_BY_SOURCE[SOURCE_INV_DSP])

    for r in range(2, ws.max_row + 1):
        sku_val = normalize_text(ws.cell(r, header_col["SKU"]).value)
        wh_val = normalize_text(ws.cell(r, header_col["WH"]).value)
        virtual_warehouse_val = normalize_text(ws.cell(r, header_col["Virtual Warehouse"]).value)
        need_qty = 0 if virtual_warehouse_val else safe_float(allocated_need.get((sku_val, wh_val), 0))
        ws.cell(r, header_col["To be allocated"]).value = round(need_qty, 3)

        bin_qty = safe_float(ws.cell(r, header_col["Bin"]).value)
        stock_qty = safe_float(ws.cell(r, header_col["Stock"]).value)
        domestic_stock_qty = safe_float(ws.cell(r, header_col["Domestic Stock"]).value)
        category_value = normalize_text(ws.cell(r, header_col["Category"]).value).upper()
        is_pv = category_value.startswith("PV")

        transit_total = 0.0
        for d_col_name in transit_headers:
            transit_total += safe_float(ws.cell(r, header_col[d_col_name]).value)

        total_qty = stock_qty + domestic_stock_qty + transit_total
        mw = (stock_qty * bin_qty) / 1_000_000 if is_pv else None
        total_mw = (total_qty * bin_qty) / 1_000_000 if is_pv else None

        ws.cell(r, header_col["Total QTY"]).value = round(total_qty, 3)
        ws.cell(r, header_col["MW"]).value = round(mw, 3) if mw is not None else None
        ws.cell(r, header_col["Total MW"]).value = round(total_mw, 3) if total_mw is not None else None

    total_rows = ws.max_row - 1

    dedup_marked: list[dict[str, str]] = []
    seen_marked: set[tuple[str, str]] = set()
    for item in marked_rows_info:
        key = (item.get("SKU", ""), item.get("WH", ""))
        if key in seen_marked:
            continue
        seen_marked.add(key)
        dedup_marked.append(item)

    ws_alloc = wb.create_sheet(ALLOC_SHEET_NAME)
    ws_alloc.append(["SKU", "Connector", "Ordered Qty", "CRD", "Customer Name", "SO No.", "SO Line", "Model", "Factory", "WH"])
    for order in allocated_orders:
        if safe_float(order.get("Ordered Qty")) == 0:
            continue
        mapped, _ = resolve_sku_mapping(order.get("SKU", ""))
        ws_alloc.append(
            [
                order.get("SKU"),
                mapped.get("Connector"),
                order.get("Ordered Qty"),
                order.get("CRD"),
                order.get("Customer Name"),
                order.get("SO No."),
                order.get("SO Line"),
                order.get("Model"),
                order.get("Factory"),
                order.get("WH"),
            ]
        )

    ws_source = wb.create_sheet(TRANSIT_SOURCE_SHEET_NAME)
    ws_source.append(["SKU", "WH", "Virtual Warehouse", "Category", "Model", "Date", "Source", "Daily Supply Plan Qty", "ODP Qty"])
    source_keys = set(transit_source_tag) | set(daily_transit_qty) | set(odp_transit_qty)
    for sku, wh, virtual_warehouse, category_value, product_model_value, d_header in sorted(source_keys):
        if d_header not in header_col:
            continue
        source_key = (sku, wh, virtual_warehouse, category_value, product_model_value, d_header)
        src = transit_source_tag.get(source_key, SOURCE_INV_DSP)
        mapped, _ = resolve_sku_mapping(sku)
        resolved_category = category_value or normalize_text(mapped.get("Category"))
        resolved_product_model = product_model_value or normalize_text(mapped.get("Model"))
        ws_source.append([
            sku,
            wh,
            virtual_warehouse,
            resolved_category,
            resolved_product_model,
            d_header,
            normalize_source_tag(src),
            round(safe_float(daily_transit_qty.get(source_key, 0)), 3),
            round(safe_float(odp_transit_qty.get(source_key, 0)), 3),
        ])

    for sheet_name, category_name in zip(DOMESTIC_DETAIL_SHEET_NAMES, ("PV", "ESS")):
        ws_domestic = wb.create_sheet(sheet_name)
        ws_domestic.append(["SKU", "Model", "Factory", "Quantity", "MW"])
        for item in domestic_details:
            quantity = safe_float(item.get("Quantity"))
            if quantity == 0 or normalize_text(item.get("Category")).upper() != category_name:
                continue
            ws_domestic.append([
                item.get("SKU"),
                item.get("Model"),
                item.get("Factory"),
                round(quantity, 3),
                round(safe_float(item.get("MW")), 6),
            ])
        ws_domestic.freeze_panes = "A2"
        ws_domestic.auto_filter.ref = ws_domestic.dimensions

    category_col = header_col["Category"]
    wh_col = header_col["WH"]
    sku_col = header_col["SKU"]
    virtual_warehouse_col = header_col["Virtual Warehouse"]
    sum_headers = ["To be allocated", "Stock", "Domestic Stock", *transit_headers]

    for country in PV_STOCK_COUNTRIES:
        output_ws = wb.copy_worksheet(ws)
        output_ws.title = f"{country}_PV"
        if output_ws.max_row > 1:
            output_ws.delete_rows(2, output_ws.max_row - 1)

        grouped_rows: dict[str, dict[str, Any]] = {}
        for row_num in range(2, ws.max_row + 1):
            if is_unmatched_row(row_num):
                continue
            if not normalize_text(ws.cell(row_num, category_col).value).upper().startswith("PV"):
                continue
            if normalize_text(ws.cell(row_num, wh_col).value).upper() != country:
                continue
            sku_key = normalize_sku_key(ws.cell(row_num, sku_col).value)
            if not sku_key:
                continue
            values = [ws.cell(row_num, col_num).value for col_num in range(1, len(headers) + 1)]
            grouped = grouped_rows.setdefault(sku_key, {"values": values, "virtual_warehouses": set()})
            if grouped["values"] is not values:
                for header in sum_headers:
                    col_index = header_col[header] - 1
                    grouped["values"][col_index] = safe_float(grouped["values"][col_index]) + safe_float(values[col_index])
            virtual_warehouse = normalize_output_virtual_warehouse(ws.cell(row_num, virtual_warehouse_col).value)
            if virtual_warehouse:
                grouped["virtual_warehouses"].add(virtual_warehouse)

        for sku_key in sorted(grouped_rows):
            grouped = grouped_rows[sku_key]
            values = grouped["values"]
            values[virtual_warehouse_col - 1] = " / ".join(sorted(grouped["virtual_warehouses"]))
            stock_qty = safe_float(values[header_col["Stock"] - 1])
            domestic_stock_qty = safe_float(values[header_col["Domestic Stock"] - 1])
            transit_total = sum(safe_float(values[header_col[header] - 1]) for header in transit_headers)
            total_qty = stock_qty + domestic_stock_qty + transit_total
            bin_qty = safe_float(values[header_col["Bin"] - 1])
            values[header_col["Total QTY"] - 1] = round(total_qty, 3)
            values[header_col["MW"] - 1] = round((stock_qty * bin_qty) / 1_000_000, 3)
            values[header_col["Total MW"] - 1] = round((total_qty * bin_qty) / 1_000_000, 3)
            output_ws.append(values)
            output_row = output_ws.max_row
            output_ws.cell(output_row, header_col["Stock"]).fill = CELL_FILL_BY_SOURCE[SOURCE_INV_DSP]
            if domestic_stock_qty:
                output_ws.cell(output_row, header_col["Domestic Stock"]).fill = CELL_FILL_BY_SOURCE[SOURCE_ODP]
            for header in transit_headers:
                if safe_float(values[header_col[header] - 1]) == 0:
                    continue
                source = normalize_source_tag(date_source_summary.get(header, SOURCE_INV_DSP))
                output_ws.cell(output_row, header_col[header]).fill = CELL_FILL_BY_SOURCE.get(source, CELL_FILL_BY_SOURCE[SOURCE_INV_DSP])
            for col_num in range(10, len(headers) + 1):
                output_ws.cell(output_row, col_num).number_format = "#,##0.###"
        output_ws.freeze_panes = "A2"
        output_ws.auto_filter.ref = output_ws.dimensions
        add_light_blue_table(output_ws, f"Tbl_PV_Stock_{country}")

    output_ws = wb.copy_worksheet(ws)
    output_ws.title = "ESS+HP Stock"
    for row_num in range(output_ws.max_row, 1, -1):
        marker = UNMATCHED_SKU_MARK.lower()
        row_is_unmatched = any(
            normalize_lower(output_ws.cell(row_num, header_col[header]).value) == marker
            for header in ("Category", "Brand", "Product TCL Report", "Family", "Model")
        )
        if row_is_unmatched or normalize_text(output_ws.cell(row_num, category_col).value).upper().startswith("PV"):
            output_ws.delete_rows(row_num)
    output_ws.freeze_panes = "A2"
    output_ws.auto_filter.ref = output_ws.dimensions

    add_light_blue_table(output_ws, "Tbl_ESS_HP_Stock")

    unmatched_ws = wb.copy_worksheet(ws)
    unmatched_ws.title = UNMATCHED_SHEET_NAME
    for row_num in range(unmatched_ws.max_row, 1, -1):
        marker = UNMATCHED_SKU_MARK.lower()
        row_is_unmatched = any(
            normalize_lower(unmatched_ws.cell(row_num, header_col[header]).value) == marker
            for header in ("Category", "Brand", "Product TCL Report", "Family", "Model")
        )
        if not row_is_unmatched:
            unmatched_ws.delete_rows(row_num)
    unmatched_ws.freeze_panes = "A2"
    unmatched_ws.auto_filter.ref = unmatched_ws.dimensions
    add_light_blue_table(unmatched_ws, "Tbl_Unmatched_SKU")
    wb.remove(ws)

    mapping_sheet_names = {"legacy mapping product", "sku", "sku mapping"}
    for sheet_name in list(wb.sheetnames):
        if sheet_name.lower() in mapping_sheet_names:
            wb.remove(wb[sheet_name])

    wb.save(stock_wb_path)
    wb.close()

    return {
        "total_rows": total_rows,
        "marked_unmatched_sku_rows": len(dedup_marked),
        "marked_row_samples": dedup_marked[:20],
    }


def run(
    inventory_path: Path,
    stock_path: Path,
    sku_sheet_name: str | None = None,
    daily_supply_plan_path: Path | None = None,
    odp_master_path: Path | None = None,
    order_file_path: Path | None = None,
    transit_start_date: date = None,
    transit_end_date: date = None,
    stock_mode: str = "available",
) -> None:
    if transit_start_date is None:
        transit_start_date = _default_start()
    if transit_end_date is None:
        transit_end_date = _default_end()
    normalized_stock_mode = "total" if stock_mode == "total" else "available"
    inventory_rows = extract_inventory_rows(inventory_path, normalized_stock_mode)

    wb_probe = load_workbook(stock_path, read_only=True)
    resolved_sku_sheet = pick_sku_sheet_name(wb_probe.sheetnames, sku_sheet_name)
    wb_probe.close()

    sku_lookup = build_sku_lookup(stock_path, resolved_sku_sheet)

    transit_qty: dict[tuple[str, str, str, str, str, str], float] = defaultdict(float)
    transit_category: dict[tuple[str, str], str] = {}
    transit_source_tag: dict[tuple[str, str, str, str, str, str], str] = {}
    daily_transit_qty: dict[tuple[str, str, str, str, str, str], float] = defaultdict(float)
    odp_transit_qty: dict[tuple[str, str, str, str, str, str], float] = defaultdict(float)
    domestic_qty: dict[str, float] = defaultdict(float)
    domestic_details: list[dict[str, Any]] = []

    if daily_supply_plan_path:
        d_qty, d_category = extract_transit_data(
            daily_supply_plan_path,
            start_date=transit_start_date,
            end_date=transit_end_date,
            stock_mode=normalized_stock_mode,
        )
        merge_transit_payload(transit_qty, transit_category, d_qty, d_category)
        daily_transit_qty.update(d_qty)
        for key in d_qty:
            transit_source_tag[key] = merge_source_tag(transit_source_tag.get(key, ""), SOURCE_INV_DSP)

    if odp_master_path:
        o_qty, o_category, o_domestic_qty, domestic_details = extract_odp_transit_data(
            odp_master_path,
            start_date=transit_start_date,
            end_date=transit_end_date,
        )
        merge_transit_payload(transit_qty, transit_category, o_qty, o_category)
        odp_transit_qty.update(o_qty)
        domestic_qty.update(o_domestic_qty)
        for key in o_qty:
            transit_source_tag[key] = merge_source_tag(transit_source_tag.get(key, ""), SOURCE_ODP)

    allocated_orders: list[dict[str, Any]] = []
    allocated_need: dict[tuple[str, str], float] = defaultdict(float)
    if order_file_path:
        allocated_orders, allocated_need = extract_to_be_allocated_orders(order_file_path)

    run_summary = write_output_sheet(
        stock_path,
        inventory_rows,
        sku_lookup,
        transit_qty=transit_qty,
        transit_category=transit_category,
        transit_source_tag=transit_source_tag,
        daily_transit_qty=daily_transit_qty,
        odp_transit_qty=odp_transit_qty,
        domestic_qty=domestic_qty,
        domestic_details=domestic_details,
        allocated_orders=allocated_orders,
        allocated_need=allocated_need,
        start_date=transit_start_date,
        end_date=transit_end_date,
    )

    print(f"Done: wrote {stock_path} -> sheets {', '.join(OUTPUT_SHEET_NAMES)}")
    print(f"Inventory grouped rows: {len(inventory_rows)}")
    print(f"SKU mapping sheet: {resolved_sku_sheet}")
    if daily_supply_plan_path:
        print(f"Transit source (DailySupplyPlan): {daily_supply_plan_path}")
    if odp_master_path:
        print(f"Transit source (ODP PV/ESS SUPPLY DATA): {odp_master_path}")
    if order_file_path:
        print(f"Order source (To be allocated): {order_file_path}")
    if daily_supply_plan_path or odp_master_path:
        print(f"Transit date columns: {date_header(transit_start_date)} ~ {date_header(transit_end_date)}")

    print(
        "Rows marked in stock sheet: "
        f"sku_unmatched={run_summary['marked_unmatched_sku_rows']}"
    )

    log_lines: list[str] = [
        f"Run time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        f"Output workbook: {stock_path}",
        f"Output sheets: {', '.join(OUTPUT_SHEET_NAMES)}",
        f"Inventory grouped rows: {len(inventory_rows)}",
        f"SKU mapping sheet: {resolved_sku_sheet}",
        f"Rows in stock sheet: {run_summary['total_rows']}",
        f"Rows marked (SKU unmatched): {run_summary['marked_unmatched_sku_rows']}",
    ]

    if daily_supply_plan_path:
        log_lines.append(f"Transit source (DailySupplyPlan): {daily_supply_plan_path}")
    if odp_master_path:
        log_lines.append(f"Transit source (ODP PV/ESS SUPPLY DATA): {odp_master_path}")
    if order_file_path:
        log_lines.append(f"Order source (To be allocated): {order_file_path}")
    if daily_supply_plan_path or odp_master_path:
        log_lines.append(f"Transit date columns: {date_header(transit_start_date)} ~ {date_header(transit_end_date)}")

    samples = run_summary.get("marked_row_samples", [])
    if samples:
        log_lines.append("Marked row samples (max 20):")
        for idx, sample in enumerate(samples, start=1):
            log_lines.append(
                f"  {idx}. SKU={sample.get('SKU', '')}, WH={sample.get('WH', '')}, Reason={sample.get('Reason', '')}"
            )
    else:
        log_lines.append("Marked row samples: none")

    log_path = stock_path.with_name(
        f"{stock_path.stem}_run_log_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
    )
    log_path.write_text("\n".join(log_lines), encoding="utf-8")
    print(f"Run log written: {log_path}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build stock sheet from Inventory Details + transit plan")
    parser.add_argument("--inventory", required=True, type=Path, help="Inventory Details path")
    parser.add_argument("--stock", required=True, type=Path, help="Stock workbook path")
    parser.add_argument("--sku-sheet", default=None, help="SKU mapping sheet name (optional)")
    parser.add_argument("--daily-supply-plan", default=None, type=Path, help="DailySupplyPlan path (optional)")
    parser.add_argument("--odp-master", default=None, type=Path, help="EUPV_ODP_MASTER path (optional)")
    parser.add_argument("--order-file", default=None, type=Path, help="Orderfile_Base_Realtime path (optional)")
    parser.add_argument("--transit-start", default=None, help="Transit start date YYYY-MM-DD (default: today)")
    parser.add_argument("--transit-end", default=None, help="Transit end date YYYY-MM-DD (default: today + 6 months)")
    parser.add_argument("--stock-mode", choices=("available", "total"), default="available", help="Stock calculation mode")
    return parser.parse_args()


def _parse_cli_date(text: str) -> date:
    try:
        return datetime.strptime(text.strip(), "%Y-%m-%d").date()
    except ValueError as exc:
        raise ValueError(f"Invalid date: {text}, expected YYYY-MM-DD") from exc


if __name__ == "__main__":
    args = parse_args()
    run(
        inventory_path=args.inventory,
        stock_path=args.stock,
        sku_sheet_name=args.sku_sheet,
        daily_supply_plan_path=args.daily_supply_plan,
        odp_master_path=args.odp_master,
        order_file_path=args.order_file,
        transit_start_date=_parse_cli_date(args.transit_start) if args.transit_start else None,
        transit_end_date=_parse_cli_date(args.transit_end) if args.transit_end else None,
        stock_mode=args.stock_mode,
    )
