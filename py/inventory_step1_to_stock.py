from __future__ import annotations

import argparse
import json
from calendar import monthrange
from collections import defaultdict
from copy import copy, deepcopy
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
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side


PV_STOCK_COUNTRIES = ["NL", "FR", "UK", "ES", "IT"]
MW_SHEET_NAME = "MW"
SUNPOWER_MW_SHEET_NAME = "SunPower MW"
TCL_MW_SHEET_NAME = "TCL MW"
ALLOCATION_DEDUCTION_SHEET_NAME = "Allocation Deduction"
OUTPUT_SHEET_NAMES = [*[f"{country}_PV" for country in PV_STOCK_COUNTRIES], "ESS+HP Stock", MW_SHEET_NAME]
CURRENT_OUTPUT_SHEET_NAMES = [
    *[f"{country}_PV" for country in PV_STOCK_COUNTRIES], TCL_MW_SHEET_NAME, SUNPOWER_MW_SHEET_NAME,
    "ESS+HP Stock", "PV Stock in CN", "ESS Stock in CN", "Allocation Deduction", "To be allocated", "Removed SKU",
]
EXCLUDED_ESS_HP_FAMILIES = {"AC CHARGER", "CELLS", "MARKETING"}
ALLOCATION_EXPORT_COLUMNS = [
    "Category", "Month", "SO Create Date", "CRD", "Customer Level 6 Name", "Sub Type", "SO No.", "SO Line",
    "Brand", "Material", "Model", "Ordered Qty", "Total KW", "Warehouse Name",
]
SKU_SHEET_CANDIDATES = ["SKU", "SKU Mapping", "Legacy Mapping Product"]
TRANSIT_START_DATE = None  # resolved dynamically via _default_start()
TRANSIT_END_DATE = None    # resolved dynamically via _default_end()
ALLOC_SHEET_NAME = "To be allocated"
TRANSIT_SOURCE_SHEET_NAME = "_Transit Source Map"
UNMATCHED_SHEET_NAME = "Removed SKU"
DOMESTIC_DETAIL_SHEET_NAMES = ["PV Stock in CN", "ESS Stock in CN"]
LEGACY_DOMESTIC_DETAIL_SHEET_NAMES = ["Domestic Stock PV", "Domestic Stock ESS"]

SOURCE_INV_DSP = "INV_DSP"
SOURCE_ODP = "ODP"
SOURCE_MIXED = "MIXED"
UNMATCHED_SKU_MARK = "SKU not matched"
REMOVED_SKU_MARK = "Removed list"
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

ORDER_WAREHOUSE_NAME_MAP = {
    "store-fr(w74)": "FR",
    "store-fr(w40)": "FR",
    "store-fr(w75)": "FR",
    "gca store": "FR",
    "fos port direct delivery wh": "FR",
    "fru-nl(w72)": "NL",
    "store-vdh-bot": "NL",
    "store w72 nl battery": "NL",
    "store-it(w81)-haihang": "IT",
    "store-it(w82)-haihang": "IT",
    "store-uk(w80)-worldex": "UK",
    "felixstowe port direct delivery wh": "UK",
    "valencia port direct delivery wh": "ES",
}


def normalize_text(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def normalize_lower(value: Any) -> str:
    return normalize_text(value).lower()


def canonical_brand(value: Any) -> str:
    brand = normalize_text(value)
    return "SunPower" if brand.upper() == "SUNPOWER" else brand


def add_calendar_months(value: date, months: int) -> date:
    month_index = value.month - 1 + months
    year = value.year + month_index // 12
    month = month_index % 12 + 1
    return date(year, month, min(value.day, monthrange(year, month)[1]))


def normalize_sku_key(value: Any) -> str:
    return normalize_text(value).upper()


def map_order_warehouse_name(value: Any) -> str | None:
    return ORDER_WAREHOUSE_NAME_MAP.get(normalize_lower(value))


def is_excluded_ess_hp_family(value: Any) -> bool:
    return normalize_text(value).upper() in EXCLUDED_ESS_HP_FAMILIES


def is_excluded_inventory_family(value: Any) -> bool:
    return normalize_text(value).upper() == "MARKETING"


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
        virtual_warehouse = normalize_text(virtual_warehouse_name)
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
                "Brand": canonical_brand(row[idx["brand"]]),
                "Family": normalize_text(row[idx["level2"]]),
                "Size": normalize_text(row[idx["level3"]]),
                "Model": normalize_text(row[idx["product model"]]),
                "Connector": normalize_text(row[idx["connector"]]),
                "CableLength": normalize_text(row[idx["cable length"]]) if "cable length" in idx else "",
                "Bin": safe_float(row[idx["billable watts(w)"]]),
                "MOQ": safe_float(row[idx["total pcs per 40hq container"]]),
                "MappingSource": "SKU",
            }

    if legacy_name:
        ws = wb[legacy_name]
        idx = build_header_index([cell.value for cell in ws[1]])
        sku_key = idx.get("sku no.", idx.get("sku no"))
        required = ["anaplan pl6", "brand", "family", "bins", "container loading"]
        if sku_key is None:
            required.insert(0, "sku no.")
        missing = [h for h in required if h not in idx]
        if missing:
            wb.close()
            raise ValueError(f"Legacy Mapping Product sheet missing columns: {missing}")
        legacy_rows: dict[str, tuple[Any, ...]] = {}
        for row in ws.iter_rows(min_row=2, values_only=True):
            row_sku_key = normalize_sku_key(row[sku_key])
            if row_sku_key and row_sku_key not in legacy_rows:
                legacy_rows[row_sku_key] = row
        for row_sku_key, row in legacy_rows.items():
            if row_sku_key in lookup:
                continue
            family = normalize_text(row[idx["family"]])
            size = normalize_text(row[idx["size"]]) if "size" in idx else ""
            brand = canonical_brand(row[idx["brand"]])
            lookup[row_sku_key] = {
                "Category": infer_legacy_category(family, brand),
                "Brand": brand,
                "Family": family,
                "Size": size,
                "Model": normalize_text(row[idx["anaplan pl6"]]),
                "Connector": "",
                "CableLength": "",
                "Bin": safe_float(row[idx["bins"]]),
                "MOQ": safe_float(row[idx["container loading"]]),
                "MappingSource": "Legacy Mapping Product",
            }

    wb.close()
    return lookup


def load_removed_skus(stock_wb_path: Path) -> set[str]:
    wb = load_workbook(stock_wb_path, data_only=True, read_only=True)
    remove_name = next((name for name in wb.sheetnames if name.lower() == "remove-list"), None)
    removed: set[str] = set()
    if remove_name:
        ws = wb[remove_name]
        for row in ws.iter_rows(min_row=2, values_only=True):
            key = normalize_sku_key(row[0] if row else None)
            if key:
                removed.add(key)
    wb.close()
    return removed


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
) -> tuple[list[Any], list[dict[str, Any]], dict[tuple[str, str], float]]:
    wb = load_workbook(order_file_path, data_only=True, read_only=False)
    ws = wb[wb.sheetnames[0]]

    header_row = 2
    headers = [ws.cell(header_row, c).value for c in range(1, ws.max_column + 1)]
    idx = build_header_index(headers)

    required = ["allocation status", *[normalize_lower(column) for column in ALLOCATION_EXPORT_COLUMNS]]
    missing = [h for h in required if h not in idx]
    if missing:
        wb.close()
        raise ValueError(f"Order file missing columns: {missing}")

    orders: list[dict[str, Any]] = []
    agg_by_sku_wh: dict[tuple[str, str], float] = defaultdict(float)
    deduction_cutoff = add_calendar_months(date.today(), 3)

    max_row = ws.max_row
    for r in range(header_row + 1, max_row + 1):
        status = normalize_lower(ws.cell(r, idx["allocation status"] + 1).value)
        if status != "to be allocated":
            continue
        if "sub type" in idx and normalize_lower(ws.cell(r, idx["sub type"] + 1).value) == "offshore":
            continue

        sku = normalize_text(ws.cell(r, idx["material"] + 1).value)
        qty = safe_float(ws.cell(r, idx["ordered qty"] + 1).value)
        crd = ws.cell(r, idx["crd"] + 1).value
        model = ws.cell(r, idx["model"] + 1).value
        warehouse_name = ws.cell(r, idx["warehouse name"] + 1).value
        wh = map_order_warehouse_name(warehouse_name) or ""
        crd_date = parse_supply_date(crd)
        eligible_for_deduction = crd_date is not None and crd_date <= deduction_cutoff
        if sku and qty != 0 and not wh:
            wb.close()
            raise ValueError(f"Unknown Warehouse Name in To be allocated: {normalize_text(warehouse_name) or '(blank)'}")
        raw_row = [ws.cell(r, idx[normalize_lower(column)] + 1).value for column in ALLOCATION_EXPORT_COLUMNS]

        orders.append(
            {
                "SKU": sku,
                "Ordered Qty": round(qty, 3),
                "CRD": crd,
                "Model": model,
                "Warehouse Name": warehouse_name,
                "WH": wh,
                "Order Index": r,
                "Eligible For Deduction": eligible_for_deduction,
                "Raw Row": raw_row,
            }
        )

        if sku and wh and eligible_for_deduction:
            agg_by_sku_wh[(sku, wh)] += qty

    wb.close()
    return ALLOCATION_EXPORT_COLUMNS, orders, agg_by_sku_wh


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
    allocated_headers: list[Any] | None = None,
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
    for old_name in [
        "stock", "PV Stock", UNMATCHED_SHEET_NAME, "_stock_build", *legacy_output_names, *OUTPUT_SHEET_NAMES,
        "MW Summary", SUNPOWER_MW_SHEET_NAME, TCL_MW_SHEET_NAME, ALLOCATION_DEDUCTION_SHEET_NAME,
    ]:
        if old_name in wb.sheetnames:
            wb.remove(wb[old_name])
    if ALLOC_SHEET_NAME in wb.sheetnames:
        alloc_old = wb[ALLOC_SHEET_NAME]
        wb.remove(alloc_old)
    if TRANSIT_SOURCE_SHEET_NAME in wb.sheetnames:
        source_old = wb[TRANSIT_SOURCE_SHEET_NAME]
        wb.remove(source_old)
    for old_name in ["Domestic Stock", *DOMESTIC_DETAIL_SHEET_NAMES, *LEGACY_DOMESTIC_DETAIL_SHEET_NAMES]:
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
    allocated_headers = allocated_headers or []
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
    ws_alloc.append(allocated_headers or ["No order source"])
    for order in allocated_orders:
        if safe_float(order.get("Ordered Qty")) == 0:
            continue
        ws_alloc.append(order.get("Raw Row", []))

    ws_source = wb.create_sheet(TRANSIT_SOURCE_SHEET_NAME)
    ws_source.append(["SKU", "WH", "Category", "Model", "Date", "Source", "Daily Supply Plan Qty", "ODP Qty"])
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
            if total_qty == 0:
                continue
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

    output_ws = wb.copy_worksheet(ws)
    output_ws.title = "ESS+HP Stock"
    for row_num in range(output_ws.max_row, 1, -1):
        marker = UNMATCHED_SKU_MARK.lower()
        row_is_unmatched = any(
            normalize_lower(output_ws.cell(row_num, header_col[header]).value) == marker
            for header in ("Category", "Brand", "Product TCL Report", "Family", "Model")
        )
        row_is_cn = normalize_text(output_ws.cell(row_num, wh_col).value).upper() == DOMESTIC_WH
        total_qty_is_zero = safe_float(output_ws.cell(row_num, header_col["Total QTY"]).value) == 0
        if row_is_unmatched or row_is_cn or total_qty_is_zero or normalize_text(output_ws.cell(row_num, category_col).value).upper().startswith("PV"):
            output_ws.delete_rows(row_num)

    unmatched_ws = wb.copy_worksheet(ws)
    unmatched_ws.title = UNMATCHED_SHEET_NAME
    for row_num in range(unmatched_ws.max_row, 1, -1):
        marker = UNMATCHED_SKU_MARK.lower()
        row_is_unmatched = any(
            normalize_lower(unmatched_ws.cell(row_num, header_col[header]).value) == marker
            for header in ("Category", "Brand", "Product TCL Report", "Family", "Model")
        )
        total_qty_is_zero = safe_float(unmatched_ws.cell(row_num, header_col["Total QTY"]).value) == 0
        if not row_is_unmatched or total_qty_is_zero:
            unmatched_ws.delete_rows(row_num)
    wb.remove(ws)

    mapping_sheet_names = {"legacy mapping product", "sku", "sku mapping"}
    for sheet_name in list(wb.sheetnames):
        if sheet_name.lower() in mapping_sheet_names:
            wb.remove(wb[sheet_name])

    for sheet_name in [*OUTPUT_SHEET_NAMES, UNMATCHED_SHEET_NAME]:
        output_sheet = wb[sheet_name]
        output_headers = [cell.value for cell in output_sheet[1]]
        if "Virtual Warehouse" in output_headers:
            output_sheet.delete_cols(output_headers.index("Virtual Warehouse") + 1)

    normal_style = wb._named_styles["Normal"]._style if "Normal" in wb._named_styles else None
    for output_sheet in wb.worksheets:
        output_sheet.freeze_panes = None
        output_sheet.auto_filter.ref = None
        for table_name in list(output_sheet.tables):
            del output_sheet.tables[table_name]
        if normal_style is not None:
            for row in output_sheet.iter_rows():
                for cell in row:
                    cell._style = copy(normal_style)

    wb.save(stock_wb_path)
    wb.close()

    return {
        "total_rows": total_rows,
        "marked_unmatched_sku_rows": len(dedup_marked),
        "marked_row_samples": dedup_marked[:20],
    }


def write_output_sheet_v2(
    stock_wb_path: Path,
    rows: list[dict[str, Any]],
    sku_lookup: dict[str, dict[str, Any]],
    removed_skus: set[str] | None = None,
    transit_qty: dict[tuple[str, str, str, str, str, str], float] | None = None,
    transit_category: dict[tuple[str, str], str] | None = None,
    transit_source_tag: dict[tuple[str, str, str, str, str, str], str] | None = None,
    daily_transit_qty: dict[tuple[str, str, str, str, str, str], float] | None = None,
    odp_transit_qty: dict[tuple[str, str, str, str, str, str], float] | None = None,
    domestic_qty: dict[str, float] | None = None,
    domestic_details: list[dict[str, Any]] | None = None,
    allocated_headers: list[Any] | None = None,
    allocated_orders: list[dict[str, Any]] | None = None,
    allocated_need: dict[tuple[str, str], float] | None = None,
    start_date: date = None,
    end_date: date = None,
) -> dict[str, Any]:
    """Write the current output contract.

    ODP remains in the in-memory payload for visualization/source tracing, but
    normal inventory sheets use only Inventory and Daily Supply Plan quantities.
    """
    if start_date is None:
        start_date = _default_start()
    if end_date is None:
        end_date = _default_end()

    transit_qty = transit_qty or {}
    transit_source_tag = transit_source_tag or {}
    daily_transit_qty = daily_transit_qty or {}
    odp_transit_qty = odp_transit_qty or {}
    domestic_qty = domestic_qty or {}
    domestic_details = domestic_details or []
    allocated_headers = allocated_headers or []
    allocated_orders = allocated_orders or []
    allocated_need = allocated_need or {}
    removed_skus = removed_skus or set()

    wb = load_workbook(stock_wb_path)
    old_names = {
        "stock", "PV Stock", UNMATCHED_SHEET_NAME, "_stock_build",
        *OUTPUT_SHEET_NAMES, MW_SHEET_NAME, "MW Summary", SUNPOWER_MW_SHEET_NAME, TCL_MW_SHEET_NAME,
        ALLOCATION_DEDUCTION_SHEET_NAME, *[f"PV Stock {country}" for country in PV_STOCK_COUNTRIES],
        ALLOC_SHEET_NAME, TRANSIT_SOURCE_SHEET_NAME, "Domestic Stock",
        *DOMESTIC_DETAIL_SHEET_NAMES, *LEGACY_DOMESTIC_DETAIL_SHEET_NAMES,
    }
    for name in list(wb.sheetnames):
        if name in old_names:
            wb.remove(wb[name])

    def unmatched_mapping(reason: str = UNMATCHED_SKU_MARK) -> dict[str, Any]:
        return {
            "Category": reason,
            "Brand": reason,
            "Family": reason,
            "Size": reason,
            "Model": reason,
            "Connector": reason,
            "CableLength": reason,
            "Bin": 0,
            "MOQ": 0,
        }

    def resolve(sku: Any) -> tuple[dict[str, Any], bool, str]:
        sku_key = normalize_sku_key(sku)
        if sku_key in removed_skus:
            mapped = sku_lookup.get(sku_key)
            return mapped or unmatched_mapping(REMOVED_SKU_MARK), mapped is None, REMOVED_SKU_MARK
        mapped = sku_lookup.get(sku_key)
        return (mapped, False, "") if mapped else (unmatched_mapping(), True, UNMATCHED_SKU_MARK)

    def make_record(wh: str, sku: str, mapped: dict[str, Any], stock: float = 0.0,
                    virtual_warehouse: str = "", category: str = "", model: str = "", source: str = "") -> dict[str, Any]:
        return {
            "Source": source,
            "WH": wh,
            "VirtualWarehouse": virtual_warehouse,
            "SKU": sku,
            "Category": category or mapped.get("Category", ""),
            "Brand": mapped.get("Brand", ""),
            "Family": mapped.get("Family", ""),
            "Size": mapped.get("Size", ""),
            "Model": mapped.get("Model", ""),
            "Connector": mapped.get("Connector", ""),
            "CableLength": mapped.get("CableLength", ""),
            "Bin": safe_float(mapped.get("Bin")),
            "MOQ": safe_float(mapped.get("MOQ")),
            "Stock": safe_float(stock),
            "DomesticStock": 0.0,
            "ToBeAllocated": 0.0,
            "Transit": defaultdict(float),
            "StockTransit": defaultdict(float),
            "TransitSource": {},
            "StatusQuantity": {"Inventory": safe_float(stock), "DailySupplyPlan": 0.0, "ODP": 0.0},
        }

    records: list[dict[str, Any]] = []
    row_by_key: dict[tuple[str, str], dict[str, Any]] = {}
    transit_rows: dict[tuple[str, str, str, str, str], dict[str, Any]] = {}
    active_sku_keys: set[str] = set()
    marked_rows: set[tuple[str, str, str]] = set()

    for item in rows:
        if safe_float(item.get("Stock")) != 0:
            active_sku_keys.add(normalize_sku_key(item.get("SKU")))
    for key, qty in transit_qty.items():
        if safe_float(qty) != 0:
            active_sku_keys.add(normalize_sku_key(key[0]))
    for sku, qty in domestic_qty.items():
        if safe_float(qty) != 0:
            active_sku_keys.add(normalize_sku_key(sku))

    def add_record(record: dict[str, Any]) -> dict[str, Any]:
        records.append(record)
        if not record["VirtualWarehouse"]:
            row_by_key.setdefault((record["SKU"], record["WH"]), record)
        return record

    for item in rows:
        if normalize_sku_key(item.get("SKU")) not in active_sku_keys:
            continue
        mapped, unmatched, reason = resolve(item.get("SKU"))
        if reason:
            marked_rows.add((normalize_text(item.get("SKU")), normalize_text(item.get("WH")), reason))
        add_record(make_record(
            normalize_text(item.get("WH")), normalize_text(item.get("SKU")), mapped,
            stock=safe_float(item.get("Stock")),
            virtual_warehouse=normalize_text(item.get("VirtualWarehouse")),
            category=normalize_text(item.get("Category")),
            model=normalize_text(item.get("ProductModel")),
            source=reason,
        ))

    for sku, qty in sorted(domestic_qty.items()):
        if not sku or safe_float(qty) == 0:
            continue
        key = (normalize_text(sku), DOMESTIC_WH)
        record = row_by_key.get(key)
        if record is None:
            mapped, unmatched, reason = resolve(sku)
            if reason:
                marked_rows.add((normalize_text(sku), DOMESTIC_WH, reason))
            record = add_record(make_record(DOMESTIC_WH, normalize_text(sku), mapped, source=reason))
            row_by_key[key] = record
        record["DomesticStock"] += safe_float(qty)
        record["StatusQuantity"]["ODP"] += safe_float(qty)

    for key, qty in sorted(transit_qty.items()):
        if safe_float(qty) == 0 or normalize_sku_key(key[0]) not in active_sku_keys:
            continue
        sku, wh, virtual_warehouse, source_category, source_model, d_header = key
        mapped, unmatched, reason = resolve(sku)
        category = normalize_text(source_category) or normalize_text(mapped.get("Category"))
        model = normalize_text(source_model) or normalize_text(mapped.get("Model"))
        transit_key = (normalize_text(sku), normalize_text(wh), normalize_text(virtual_warehouse), category, model)
        record = transit_rows.get(transit_key)
        if record is None:
            if reason:
                marked_rows.add((normalize_text(sku), normalize_text(wh), reason))
            record = make_record(normalize_text(wh), normalize_text(sku), mapped, virtual_warehouse=normalize_text(virtual_warehouse), category=category, model=model, source=reason)
            records.append(record)
            transit_rows[transit_key] = record
        record["Transit"][d_header] += safe_float(qty)
        daily_qty = safe_float(daily_transit_qty.get(key))
        record["StockTransit"][d_header] += daily_qty
        record["StatusQuantity"]["DailySupplyPlan"] += daily_qty
        record["StatusQuantity"]["ODP"] += safe_float(odp_transit_qty.get(key))
        record["TransitSource"][d_header] = normalize_source_tag(transit_source_tag.get(key, SOURCE_INV_DSP))

    for record in records:
        if not record["VirtualWarehouse"]:
            record["ToBeAllocated"] = safe_float(allocated_need.get((record["SKU"], record["WH"]), 0))

    def is_unmatched(record: dict[str, Any]) -> bool:
        markers = {UNMATCHED_SKU_MARK.lower(), REMOVED_SKU_MARK.lower()}
        if normalize_lower(record.get("Source")) in markers:
            return True
        return any(normalize_lower(record.get(field)) in markers for field in ("Category", "Brand", "Family", "Size", "Model"))

    def aggregate_pv(source_records: list[dict[str, Any]]) -> list[dict[str, Any]]:
        grouped: dict[str, dict[str, Any]] = {}
        for source in source_records:
            sku_key = normalize_sku_key(source.get("SKU"))
            if not sku_key:
                continue
            if sku_key not in grouped:
                target = dict(source)
                target["Stock"] = safe_float(source.get("Stock"))
                target["StockTransit"] = defaultdict(float, source.get("StockTransit", {}))
                target["Locations"] = set()
                grouped[sku_key] = target
            else:
                target = grouped[sku_key]
                target["Stock"] += safe_float(source.get("Stock"))
                for d_header, qty in source.get("StockTransit", {}).items():
                    target["StockTransit"][d_header] += safe_float(qty)
            has_inventory_or_dsp = safe_float(source.get("Stock")) != 0 or any(
                safe_float(qty) != 0 for qty in source.get("StockTransit", {}).values()
            )
            if has_inventory_or_dsp:
                for location in normalize_text(source.get("VirtualWarehouse")).split(" / "):
                    if location.strip():
                        target["Locations"].add(location.strip())
        for target in grouped.values():
            target["VirtualWarehouse"] = " / ".join(sorted(target["Locations"]))
        return list(grouped.values())

    visualization_records = deepcopy(records)
    transit_dates = iter_dates(start_date, end_date)
    transit_headers = [date_header(d) for d in transit_dates]

    def is_export_inventory_record(record: dict[str, Any]) -> bool:
        if is_excluded_inventory_family(record.get("Family")):
            return False
        wh = normalize_text(record.get("WH")).upper()
        if normalize_upper_category(record.get("Category")).startswith("PV"):
            return wh in PV_STOCK_COUNTRIES
        return wh != DOMESTIC_WH and not is_excluded_ess_hp_family(record.get("Family"))

    records_by_key: dict[tuple[str, str], list[dict[str, Any]]] = defaultdict(list)
    initial_available_by_key: dict[tuple[str, str], float] = defaultdict(float)
    for record in records:
        if not is_export_inventory_record(record):
            continue
        key = (normalize_sku_key(record.get("SKU")), normalize_text(record.get("WH")).upper())
        records_by_key[key].append(record)
        initial_available_by_key[key] += safe_float(record.get("Stock")) + sum(
            safe_float(record.get("StockTransit", {}).get(d_header)) for d_header in transit_headers
        )

    eligible_orders = sorted(
        [order for order in allocated_orders if order.get("Eligible For Deduction") and safe_float(order.get("Ordered Qty")) > 0],
        key=lambda order: (
            parse_supply_date(order.get("CRD")) or date.max,
            int(safe_float(order.get("Order Index"))),
        ),
    )
    allocation_deductions: list[dict[str, Any]] = []
    for order in eligible_orders:
        key = (normalize_sku_key(order.get("SKU")), normalize_text(order.get("WH")).upper())
        if initial_available_by_key.get(key, 0.0) <= 0:
            continue
        candidates = records_by_key.get(key, [])
        remaining = safe_float(order.get("Ordered Qty"))
        stock_deducted = 0.0
        transit_deducted = 0.0
        deduction_detail: list[str] = []

        crd_date = parse_supply_date(order.get("CRD"))
        transit_cutoff = crd_date - timedelta(days=10)
        preferred_transit_headers = [date_header(d) for d in sorted(
            (d for d in transit_dates if d <= transit_cutoff), reverse=True,
        )]
        later_transit_headers = [date_header(d) for d in transit_dates if d > transit_cutoff]

        for d_header in preferred_transit_headers:
            if remaining <= 0:
                break
            date_deducted = 0.0
            for record in candidates:
                if remaining <= 0:
                    break
                available = max(0.0, safe_float(record.get("StockTransit", {}).get(d_header)))
                deducted = min(available, remaining)
                if deducted <= 0:
                    continue
                record["StockTransit"][d_header] = safe_float(record["StockTransit"].get(d_header)) - deducted
                record["StatusQuantity"]["DailySupplyPlan"] = max(
                    0.0, safe_float(record["StatusQuantity"].get("DailySupplyPlan")) - deducted
                )
                date_deducted += deducted
                transit_deducted += deducted
                remaining -= deducted
            if date_deducted > 0:
                deduction_detail.append(f"{d_header}: {round(date_deducted, 3)}")

        for record in candidates:
            if remaining <= 0:
                break
            available = max(0.0, safe_float(record.get("Stock")))
            deducted = min(available, remaining)
            if deducted <= 0:
                continue
            record["Stock"] = safe_float(record.get("Stock")) - deducted
            record["StatusQuantity"]["Inventory"] = max(0.0, safe_float(record["StatusQuantity"].get("Inventory")) - deducted)
            stock_deducted += deducted
            remaining -= deducted
        if stock_deducted > 0:
            deduction_detail.append(f"Stock: {round(stock_deducted, 3)}")

        for d_header in later_transit_headers:
            if remaining <= 0:
                break
            date_deducted = 0.0
            for record in candidates:
                if remaining <= 0:
                    break
                available = max(0.0, safe_float(record.get("StockTransit", {}).get(d_header)))
                deducted = min(available, remaining)
                if deducted <= 0:
                    continue
                record["StockTransit"][d_header] = safe_float(record["StockTransit"].get(d_header)) - deducted
                record["StatusQuantity"]["DailySupplyPlan"] = max(
                    0.0, safe_float(record["StatusQuantity"].get("DailySupplyPlan")) - deducted
                )
                date_deducted += deducted
                transit_deducted += deducted
                remaining -= deducted
            if date_deducted > 0:
                deduction_detail.append(f"{d_header}: {round(date_deducted, 3)}")

        allocation_deductions.append({
            **order,
            "Stock Deducted": round(stock_deducted, 3),
            "Transit Deducted": round(transit_deducted, 3),
            "Deducted Qty": round(stock_deducted + transit_deducted, 3),
            "Remaining Qty": round(max(0.0, remaining), 3),
            "Deduction Detail": " / ".join(deduction_detail),
        })

    base_headers = ["Source", "WH", "Location", "Brand", "Family", "Bin", "Model", "SKU", "Connector", "Cable Length", "MOQ", "Available QTY", "MW", "Stock"]
    headers = base_headers + transit_headers

    stock_output_sheets: list[Any] = []

    def write_stock_sheet(name: str, source_records: list[dict[str, Any]], include_technical_fields: bool = True, include_location: bool = True) -> None:
        ws = wb.create_sheet(name)
        compact_transit = name in {*[f"{country}_PV" for country in PV_STOCK_COUNTRIES], "ESS+HP Stock"}
        stock_output_sheets.append(ws)
        output_transit_headers = (
            [d_header for d_header in transit_headers if any(
                safe_float(record.get("StockTransit", {}).get(d_header)) != 0 for record in source_records
            )]
            if compact_transit else transit_headers
        )
        month_order_for_sheet: list[str] = []
        for d_header in output_transit_headers:
            parts = d_header.split(".")
            month = f"{int(parts[0]):04d}-{int(parts[1]):02d}"
            if month not in month_order_for_sheet:
                month_order_for_sheet.append(month)
        month_headers = [f"{month} Total" for month in month_order_for_sheet]
        location_headers = ["Location"] if include_location else []
        sheet_headers = (["Source", "WH", *location_headers, "Brand", "Family", "Bin", "Model", "SKU", "Connector", "Cable Length", "MOQ", "Available QTY", "MW", "Stock", *output_transit_headers, *month_headers]
                         if include_technical_fields else ["Source", "WH", *location_headers, "Brand", "Family", "Model", "SKU", "MOQ", "Available QTY", "Stock", *output_transit_headers, *month_headers])
        ws.append(sheet_headers)
        for column_number, header in enumerate(sheet_headers, start=1):
            if header == "Source":
                width = 18
            elif header == "WH":
                width = 10
            elif header == "Location":
                width = 26
            elif header == "Model":
                width = 30
            elif header == "SKU":
                width = 20
            elif header in {"Connector", "Cable Length"}:
                width = 18
            elif header in output_transit_headers:
                width = 12
            elif header in month_headers:
                width = 14
            else:
                width = 14
            ws.column_dimensions[ws.cell(row=1, column=column_number).column_letter].width = width
        for record in source_records:
            stock_transit = record.get("StockTransit", {})
            transit_total = sum(safe_float(stock_transit.get(d_header)) for d_header in transit_headers)
            available_qty = safe_float(record.get("Stock")) + transit_total
            if available_qty == 0:
                continue
            is_pv = normalize_upper_category(record.get("Category")).startswith("PV")
            total_mw = (available_qty * safe_float(record.get("Bin"))) / 1_000_000 if is_pv else None
            location_values = [record.get("VirtualWarehouse", "")] if include_location else []
            row = [
                record.get("Source", ""), record.get("WH"), *location_values, record.get("Brand"), record.get("Family"), record.get("Bin"), record.get("Model"),
                record.get("SKU"), record.get("Connector"), record.get("CableLength"), record.get("MOQ"),
                round(available_qty, 3), round(total_mw, 3) if total_mw is not None else None, record.get("Stock"),
            ] if include_technical_fields else [
                record.get("Source", ""), record.get("WH"), *location_values, record.get("Brand"), record.get("Family"), record.get("Model"), record.get("SKU"),
                record.get("MOQ"), round(available_qty, 3), record.get("Stock"),
            ]
            monthly_totals = []
            for month in month_order_for_sheet:
                monthly_totals.append(round(sum(
                    safe_float(stock_transit.get(d_header))
                    for d_header in output_transit_headers
                    if f"{int(d_header.split('.')[0]):04d}-{int(d_header.split('.')[1]):02d}" == month
                ), 3))
            ws.append([
                *row,
                *[stock_transit.get(d_header) or None for d_header in output_transit_headers],
                *monthly_totals,
            ])

    matched = records
    unmatched = [record for record in records if normalize_text(record.get("Source"))]
    for country in PV_STOCK_COUNTRIES:
        country_records = aggregate_pv([
            record for record in matched
            if normalize_upper_category(record.get("Category")).startswith("PV")
            and normalize_text(record.get("WH")).upper() == country
            and not is_excluded_inventory_family(record.get("Family"))
        ])
        country_records.sort(key=lambda record: (
            normalize_text(record.get("Model")).casefold(),
            normalize_sku_key(record.get("SKU")),
            normalize_text(record.get("Source")).casefold(),
        ))
        write_stock_sheet(f"{country}_PV", country_records)
    ess_records = [
        record for record in matched
        if not normalize_upper_category(record.get("Category")).startswith("PV")
        and normalize_text(record.get("WH")).upper() != DOMESTIC_WH
        and not is_excluded_ess_hp_family(record.get("Family"))
    ]
    ess_records.sort(key=lambda record: (
        normalize_text(record.get("WH")).casefold(),
        normalize_text(record.get("Model")).casefold(),
        normalize_sku_key(record.get("SKU")),
        normalize_text(record.get("Source")).casefold(),
    ))
    write_stock_sheet("ESS+HP Stock", ess_records, include_technical_fields=False)

    mw_groups: dict[tuple[str, str], dict[str, Any]] = {}
    week_order: list[str] = []
    month_order: list[str] = []
    seen_weeks: set[str] = set()
    seen_months: set[str] = set()
    for record in matched:
        country = normalize_text(record.get("WH")).upper()
        if not country or not normalize_upper_category(record.get("Category")).startswith("PV"):
            continue
        if is_excluded_inventory_family(record.get("Family")):
            continue
        key = (country, normalize_sku_key(record.get("SKU")), normalize_text(record.get("Source")))
        if key not in mw_groups:
            mw_groups[key] = {
                "Source": record.get("Source", ""),
                "WH": country,
                "Brand": record.get("Brand"),
                "Family": record.get("Family"),
                "Bin": safe_float(record.get("Bin")),
                "Model": record.get("Model"),
                "SKU": record.get("SKU"),
                "Connector": record.get("Connector"),
                "CableLength": record.get("CableLength"),
                "MOQ": safe_float(record.get("MOQ")),
                "Locations": set(),
                "StockMW": 0.0,
                "Daily": defaultdict(float),
                "Weekly": defaultdict(float),
                "Monthly": defaultdict(float),
            }
        summary = mw_groups[key]
        has_inventory_or_dsp = safe_float(record.get("Stock")) != 0 or any(
            safe_float(qty) != 0 for qty in record.get("StockTransit", {}).values()
        )
        if has_inventory_or_dsp:
            for location in normalize_text(record.get("VirtualWarehouse")).split(" / "):
                if location.strip():
                    summary["Locations"].add(location.strip())
        summary["StockMW"] += safe_float(record.get("Stock")) * safe_float(record.get("Bin")) / 1_000_000
        for transit_date in transit_dates:
            d_header = date_header(transit_date)
            qty = safe_float(record.get("StockTransit", {}).get(d_header))
            if qty == 0:
                continue
            arrival_mw = qty * safe_float(record.get("Bin")) / 1_000_000
            iso = transit_date.isocalendar()
            week = f"{iso.year % 100:02d}-W{iso.week:02d}"
            month = f"{transit_date.year}-{transit_date.month:02d}"
            summary["Daily"][d_header] += arrival_mw
            summary["Weekly"][week] += arrival_mw
            summary["Monthly"][month] += arrival_mw
            if week not in seen_weeks:
                seen_weeks.add(week)
                week_order.append(week)
            if month not in seen_months:
                seen_months.add(month)
                month_order.append(month)

    week_order.sort()
    month_order.sort()
    ws_mw = wb.create_sheet(MW_SHEET_NAME)
    mw_headers = [
        "Source", "WH", "Location", "Brand", "Family", "Bin", "Model", "SKU", "Connector", "Cable Length", "MOQ", "Total MW", "Stock MW",
        *transit_headers, *week_order, *month_order,
    ]
    ws_mw.append(mw_headers)
    for summary in sorted(mw_groups.values(), key=lambda item: (item["WH"], normalize_sku_key(item["SKU"]))):
        transit_mw = sum(safe_float(value) for value in summary["Daily"].values())
        total_mw = summary["StockMW"] + transit_mw
        displayed_total_mw = round(total_mw, 3)
        if displayed_total_mw == 0:
            continue
        ws_mw.append([
            summary.get("Source", ""), summary["WH"], " / ".join(sorted(summary["Locations"])), summary["Brand"], summary["Family"], summary["Bin"], summary["Model"], summary["SKU"],
            summary["Connector"], summary["CableLength"], summary["MOQ"],
            displayed_total_mw,
            round(summary["StockMW"], 3),
            *[round(summary["Daily"].get(d_header, 0.0), 3) for d_header in transit_headers],
            *[round(summary["Weekly"].get(period, 0.0), 3) for period in week_order],
            *[round(summary["Monthly"].get(period, 0.0), 3) for period in month_order],
        ])

    def aggregate_mw_summary(brand_name: str) -> list[dict[str, Any]]:
        grouped_summary: dict[tuple[str, ...], dict[str, Any]] = {}
        for source in mw_groups.values():
            if normalize_text(source.get("Brand")).upper() != brand_name.upper():
                continue
            total_mw = safe_float(source.get("StockMW")) + sum(safe_float(value) for value in source["Daily"].values())
            if round(total_mw, 3) == 0:
                continue
            key_fields = ("Source", "WH", "Model", "Connector", "CableLength")
            key = tuple(normalize_text(source.get(field)) for field in key_fields)
            if key not in grouped_summary:
                grouped_summary[key] = {
                    **{field: source.get(field, "") for field in key_fields},
                    "StockMW": 0.0,
                    "TotalMW": 0.0,
                    "Monthly": defaultdict(float),
                }
            target = grouped_summary[key]
            target["StockMW"] += safe_float(source.get("StockMW"))
            target["TotalMW"] += total_mw
            for month in month_order:
                target["Monthly"][month] += safe_float(source["Monthly"].get(month))
        return sorted(grouped_summary.values(), key=lambda item: tuple(normalize_text(item.get(field)) for field in key_fields))

    mw_summary_layouts: list[tuple[Any, list[int], int]] = []
    for brand_name, sheet_name in (("TCL", TCL_MW_SHEET_NAME), ("SunPower", SUNPOWER_MW_SHEET_NAME)):
        ws_brand = wb.create_sheet(sheet_name)
        ws_brand.append([f"{brand_name} MW Detail"])
        ws_brand.append(["Source", "WH", "Model", "Connector", "Cable Length", "Stock MW", *month_order, "Total MW"])
        subtotal_rows: list[int] = []
        by_warehouse: dict[str, list[dict[str, Any]]] = defaultdict(list)
        for item in aggregate_mw_summary(brand_name):
            by_warehouse[normalize_text(item["WH"])].append(item)
        sorted_warehouses = sorted(
            by_warehouse.items(),
            key=lambda pair: (-sum(safe_float(item.get("TotalMW")) for item in pair[1]), pair[0]),
        )
        warehouse_summaries: list[tuple[str, list[dict[str, Any]], float, float, dict[str, float]]] = []
        grand_stock = 0.0
        grand_total = 0.0
        grand_monthly: dict[str, float] = defaultdict(float)
        for warehouse, items in sorted_warehouses:
            subtotal_stock = 0.0
            subtotal_total = 0.0
            subtotal_monthly: dict[str, float] = defaultdict(float)
            for item in items:
                subtotal_stock += round(item["StockMW"], 3)
                subtotal_total += round(item["TotalMW"], 3)
                for month in month_order:
                    subtotal_monthly[month] += round(safe_float(item["Monthly"].get(month)), 3)
            warehouse_summaries.append((warehouse, items, subtotal_stock, subtotal_total, dict(subtotal_monthly)))
            grand_stock += round(subtotal_stock, 3)
            grand_total += round(subtotal_total, 3)
            for month in month_order:
                grand_monthly[month] += round(subtotal_monthly.get(month, 0.0), 3)
        ws_brand.append([
            "", "All WH Total", "", "", "", round(grand_stock, 3),
            *[round(grand_monthly.get(month, 0.0), 3) for month in month_order], round(grand_total, 3),
        ])
        grand_total_row = ws_brand.max_row
        for warehouse, items, subtotal_stock, subtotal_total, subtotal_monthly in warehouse_summaries:
            ws_brand.append([
                "", f"{warehouse} Total", "", "", "", round(subtotal_stock, 3),
                *[round(subtotal_monthly.get(month, 0.0), 3) for month in month_order], round(subtotal_total, 3),
            ])
            subtotal_rows.append(ws_brand.max_row)
            for item in items:
                ws_brand.append([
                    item.get("Source", ""), item["WH"], item["Model"], item["Connector"], item["CableLength"], round(item["StockMW"], 3),
                    *[round(item["Monthly"].get(month, 0.0), 3) for month in month_order], round(item["TotalMW"], 3),
                ])
        mw_summary_layouts.append((ws_brand, subtotal_rows, grand_total_row))

    write_stock_sheet(UNMATCHED_SHEET_NAME, unmatched, include_location=False)

    ws_alloc = wb.create_sheet(ALLOC_SHEET_NAME)
    ws_alloc.append(allocated_headers or ["No order source"])
    for order in allocated_orders:
        if safe_float(order.get("Ordered Qty")) == 0:
            continue
        ws_alloc.append(order.get("Raw Row", []))

    ws_deduction = wb.create_sheet(ALLOCATION_DEDUCTION_SHEET_NAME)
    ws_deduction.append([
        *ALLOCATION_EXPORT_COLUMNS, "WH", "Stock Deducted", "Transit Deducted", "Deducted Qty", "Remaining Qty", "Deduction Detail",
    ])
    for item in allocation_deductions:
        ws_deduction.append([
            *item.get("Raw Row", []), item.get("WH"), item.get("Stock Deducted"), item.get("Transit Deducted"),
            item.get("Deducted Qty"), item.get("Remaining Qty"), item.get("Deduction Detail"),
        ])

    ws_source = wb.create_sheet(TRANSIT_SOURCE_SHEET_NAME)
    ws_source.append(["SKU", "WH", "Category", "Model", "Date", "Source", "Daily Supply Plan Qty", "ODP Qty"])
    source_keys = set(transit_source_tag) | set(daily_transit_qty) | set(odp_transit_qty)
    for key in sorted(source_keys):
        sku, wh, _virtual_warehouse, category, model, d_header = key
        mapped, _, _ = resolve(sku)
        ws_source.append([
            sku, wh, category or mapped.get("Category", ""), model or mapped.get("Model", ""), d_header,
            normalize_source_tag(transit_source_tag.get(key, SOURCE_INV_DSP)),
            round(safe_float(daily_transit_qty.get(key)), 3), round(safe_float(odp_transit_qty.get(key)), 3),
        ])

    for sheet_name in DOMESTIC_DETAIL_SHEET_NAMES:
        ws_domestic = wb.create_sheet(sheet_name)
        ws_domestic.append(["SKU", "Model", "Factory", "Quantity", "MW"])

    for name in list(wb.sheetnames):
        if name.lower() in {"legacy mapping product", "sku", "sku mapping", "remove-list"}:
            wb.remove(wb[name])

    normal_style = wb._named_styles["Normal"]._style if "Normal" in wb._named_styles else None
    for output_sheet in wb.worksheets:
        output_sheet.freeze_panes = None
        output_sheet.auto_filter.ref = None
        for table_name in list(output_sheet.tables):
            del output_sheet.tables[table_name]
        if normal_style is not None:
            for row in output_sheet.iter_rows():
                for cell in row:
                    cell._style = copy(normal_style)

    header_fill = PatternFill(fill_type="solid", fgColor="D9EAF7")
    subtotal_fill = PatternFill(fill_type="solid", fgColor="EAF2F8")
    grand_total_fill = PatternFill(fill_type="solid", fgColor="B4C7E7")
    stock_band_fill = PatternFill(fill_type="solid", fgColor="F5FAFD")
    blue_line = Side(style="thin", color="5B9BD5")
    strong_blue_line = Side(style="medium", color="4472C4")

    for ws_stock in stock_output_sheets:
        for cell in ws_stock[1]:
            cell.fill = header_fill
            cell.font = Font(bold=True)
            cell.alignment = Alignment(horizontal="center", vertical="center")
            cell.border = Border(bottom=blue_line)
        for row_number in range(2, ws_stock.max_row + 1, 2):
            for cell in ws_stock[row_number]:
                cell.fill = stock_band_fill
        ws_stock.auto_filter.ref = f"A1:{ws_stock.cell(row=ws_stock.max_row, column=ws_stock.max_column).coordinate}"
        ws_stock.freeze_panes = "A2"
        widths_by_header = {
            "Source": 18, "WH": 10, "Location": 26, "Model": 30, "SKU": 20,
            "Connector": 18, "Cable Length": 18,
        }
        numeric_headers = {"Bin", "MOQ", "Available QTY", "MW", "Stock", *transit_headers}
        for column_number in range(1, ws_stock.max_column + 1):
            header = normalize_text(ws_stock.cell(row=1, column=column_number).value)
            column_letter = ws_stock.cell(row=1, column=column_number).column_letter
            ws_stock.column_dimensions[column_letter].width = widths_by_header.get(
                header, 12 if header in transit_headers else 14,
            )
            if header in numeric_headers:
                for row_number in range(2, ws_stock.max_row + 1):
                    ws_stock.cell(row=row_number, column=column_number).number_format = "0.000"

    for ws_brand, subtotal_rows, grand_total_row in mw_summary_layouts:
        for cell in ws_brand[2]:
            cell.fill = header_fill
            cell.font = Font(bold=True)
            cell.alignment = Alignment(horizontal="center", vertical="center")
            cell.border = Border(bottom=blue_line)
        ws_brand.cell(row=1, column=1).font = Font(bold=True, size=13, color="1F4E78")
        for row_number in subtotal_rows:
            for cell in ws_brand[row_number]:
                cell.fill = subtotal_fill
                cell.font = Font(bold=True)
                cell.border = Border(top=blue_line)
        for cell in ws_brand[grand_total_row]:
            cell.fill = grand_total_fill
            cell.font = Font(bold=True, color="1F1F1F")
            cell.border = Border(top=strong_blue_line)
        for row_number in range(3, ws_brand.max_row + 1):
            for column_number in range(6, ws_brand.max_column + 1):
                ws_brand.cell(row=row_number, column=column_number).number_format = "0.000"
        for column_letter, width in {"A": 14, "B": 30, "C": 18, "D": 18}.items():
            ws_brand.column_dimensions[column_letter].width = width
        for column_number in range(6, ws_brand.max_column + 1):
            column_letter = ws_brand.cell(row=2, column=column_number).column_letter
            ws_brand.column_dimensions[column_letter].width = 13
        ws_brand.auto_filter.ref = f"A2:{ws_brand.cell(row=ws_brand.max_row, column=ws_brand.max_column).coordinate}"
        ws_brand.freeze_panes = "A3"

    for cell in ws_deduction[1]:
        cell.fill = header_fill
        cell.font = Font(bold=True)
        cell.alignment = Alignment(horizontal="center", vertical="center")
    ws_deduction.auto_filter.ref = f"A1:{ws_deduction.cell(row=ws_deduction.max_row, column=ws_deduction.max_column).coordinate}"
    ws_deduction.freeze_panes = "A2"
    for column_number in range(1, ws_deduction.max_column + 1):
        column_letter = ws_deduction.cell(row=1, column=column_number).column_letter
        ws_deduction.column_dimensions[column_letter].width = 36 if column_number == ws_deduction.max_column else 16

    for cell in ws_alloc[1]:
        cell.fill = header_fill
        cell.font = Font(bold=True)
        cell.alignment = Alignment(horizontal="center", vertical="center")
        cell.border = Border(bottom=blue_line)
    for row_number in range(2, ws_alloc.max_row + 1, 2):
        for cell in ws_alloc[row_number]:
            cell.fill = stock_band_fill
    ws_alloc.auto_filter.ref = f"A1:{ws_alloc.cell(row=ws_alloc.max_row, column=ws_alloc.max_column).coordinate}"
    ws_alloc.freeze_panes = "A2"
    allocation_numeric_headers = {"Ordered Qty", "Total KW"}
    allocation_widths = {
        "Customer Level 6 Name": 28, "Warehouse Name": 28,
        "SO Create Date": 14, "CRD": 14, "Ordered Qty": 14, "Total KW": 14,
    }
    for column_number in range(1, ws_alloc.max_column + 1):
        header = normalize_text(ws_alloc.cell(row=1, column=column_number).value)
        column_letter = ws_alloc.cell(row=1, column=column_number).column_letter
        ws_alloc.column_dimensions[column_letter].width = allocation_widths.get(header, 16)
        if header in allocation_numeric_headers:
            for row_number in range(2, ws_alloc.max_row + 1):
                ws_alloc.cell(row=row_number, column=column_number).number_format = "0.000"

    visible_sheet_order = [
        *[f"{country}_PV" for country in PV_STOCK_COUNTRIES],
        TCL_MW_SHEET_NAME,
        SUNPOWER_MW_SHEET_NAME,
        "ESS+HP Stock",
        *DOMESTIC_DETAIL_SHEET_NAMES,
        ALLOCATION_DEDUCTION_SHEET_NAME,
        ALLOC_SHEET_NAME,
        UNMATCHED_SHEET_NAME,
    ]
    hidden_sheet_order = [MW_SHEET_NAME, TRANSIT_SOURCE_SHEET_NAME]
    sheet_by_name = {sheet.title: sheet for sheet in wb.worksheets}
    for sheet_name in visible_sheet_order:
        if sheet_name in sheet_by_name:
            sheet_by_name[sheet_name].sheet_state = "visible"
    for sheet_name in hidden_sheet_order:
        if sheet_name in sheet_by_name:
            sheet_by_name[sheet_name].sheet_state = "hidden"
    ordered_names = [*visible_sheet_order, *hidden_sheet_order]
    ordered_sheets = [sheet_by_name[name] for name in ordered_names if name in sheet_by_name]
    ordered_sheets.extend(sheet for sheet in wb.worksheets if sheet.title not in ordered_names)
    wb._sheets = ordered_sheets

    wb.save(stock_wb_path)
    wb.close()

    visualization_rows = []
    date_source_tags: dict[str, str] = {}
    key_meta = {}
    for record in visualization_records:
        accessory = " + ".join(normalize_text(record.get(field)) for field in ("Connector", "CableLength") if normalize_text(record.get(field)))
        product_label = " | ".join(value for value in (normalize_text(record.get("Model")), accessory) if value) or normalize_text(record.get("SKU"))
        transit = {}
        transit_source = {}
        for d_header in transit_headers:
            qty = safe_float(record.get("Transit", {}).get(d_header))
            if qty == 0:
                continue
            source = normalize_source_tag(record.get("TransitSource", {}).get(d_header, SOURCE_INV_DSP))
            transit[d_header] = qty
            transit_source[d_header] = source
            date_source_tags[d_header] = merge_source_tag(date_source_tags.get(d_header, ""), source)
        item = {
            "Source": record.get("Source", ""),
            "WH": record.get("WH"),
            "VirtualWarehouse": record.get("VirtualWarehouse", ""),
            "Category": record.get("Category", ""),
            "Brand": record.get("Brand", ""),
            "Family": record.get("Family", ""),
            "Size": record.get("Size", ""),
            "SKU": record.get("SKU"),
            "Model": record.get("Model", ""),
            "Connector": record.get("Connector", ""),
            "CableLength": record.get("CableLength", ""),
            "ProductKey": f"{record.get('SKU')}||{record.get('Model', '')}",
            "ProductKeyLabel": product_label,
            "Bin": safe_float(record.get("Bin")),
            "StockMW": (safe_float(record.get("Stock")) * safe_float(record.get("Bin")) / 1_000_000)
                if normalize_upper_category(record.get("Category")).startswith("PV") else 0,
            "Stock": safe_float(record.get("Stock")),
            "DomesticStock": safe_float(record.get("DomesticStock")),
            "ToBeAllocated": safe_float(record.get("ToBeAllocated")),
            "StatusQuantity": {
                "Inventory": safe_float(record.get("StatusQuantity", {}).get("Inventory")),
                "DailySupplyPlan": safe_float(record.get("StatusQuantity", {}).get("DailySupplyPlan")),
                "ODP": safe_float(record.get("StatusQuantity", {}).get("ODP")),
            },
            "Transit": transit,
            "TransitSource": transit_source,
        }
        visualization_rows.append(item)
        key_meta[f"{record.get('SKU')}||{record.get('WH')}"] = {
            "WH": item["WH"], "Category": item["Category"], "Brand": item["Brand"],
            "Family": item["Family"], "Size": item["Size"], "Connector": item["Connector"],
            "CableLength": item["CableLength"], "ProductKey": item["ProductKey"],
        }

    visualization = {
        "dateHeaders": transit_headers,
        "rows": visualization_rows,
        "allocations": [
            {
                "SKU": normalize_text(order.get("SKU")), "WH": normalize_text(order.get("WH")),
                "Model": normalize_text(order.get("Model")), "OrderedQty": safe_float(order.get("Ordered Qty")),
                "CRDDate": (parse_supply_date(order.get("CRD")).isoformat() if parse_supply_date(order.get("CRD")) else ""),
            }
            for order in allocated_orders
            if normalize_text(order.get("SKU")) and normalize_text(order.get("WH")) and safe_float(order.get("Ordered Qty")) != 0
        ],
        "keyMeta": key_meta,
        "dateSourceTags": date_source_tags,
        "domesticDetails": domestic_details,
        "stockMode": "total" if stock_wb_path.name.endswith("total_output.xlsx") else "available",
    }
    return {
        "total_rows": len(records),
        "marked_unmatched_sku_rows": len(marked_rows),
        "marked_row_samples": [{"SKU": sku, "WH": wh, "Reason": reason} for sku, wh, reason in sorted(marked_rows)[:20]],
        "visualization": visualization,
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
    removed_skus = load_removed_skus(stock_path)

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

    allocated_headers: list[Any] = []
    allocated_orders: list[dict[str, Any]] = []
    allocated_need: dict[tuple[str, str], float] = defaultdict(float)
    if order_file_path:
        allocated_headers, allocated_orders, allocated_need = extract_to_be_allocated_orders(order_file_path)

    run_summary = write_output_sheet_v2(
        stock_path,
        inventory_rows,
        sku_lookup,
        removed_skus=removed_skus,
        transit_qty=transit_qty,
        transit_category=transit_category,
        transit_source_tag=transit_source_tag,
        daily_transit_qty=daily_transit_qty,
        odp_transit_qty=odp_transit_qty,
        domestic_qty=domestic_qty,
        domestic_details=domestic_details,
        allocated_headers=allocated_headers,
        allocated_orders=allocated_orders,
        allocated_need=allocated_need,
        start_date=transit_start_date,
        end_date=transit_end_date,
    )
    visualization_path = stock_path.with_name(
        "stock_vis_total.json" if normalized_stock_mode == "total" else "stock_vis_available.json"
    )
    visualization_path.write_text(
        json.dumps(run_summary.get("visualization", {}), ensure_ascii=False),
        encoding="utf-8",
    )

    print(f"Done: wrote {stock_path} -> sheets {', '.join(CURRENT_OUTPUT_SHEET_NAMES)}")
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
        f"Output sheets: {', '.join(CURRENT_OUTPUT_SHEET_NAMES)}",
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
