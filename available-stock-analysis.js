const statusEl = document.getElementById("status");
const downloadLinkEl = document.getElementById("downloadLink");

const runBtn = document.getElementById("runBtn");
const resetBtn = document.getElementById("resetBtn");

const inventoryInput = document.getElementById("inventoryFile");
const dailySupplyInput = document.getElementById("dailySupplyFile");
const odpMasterInput = document.getElementById("odpMasterFile");
const orderInput = document.getElementById("orderFile");
const transitStartInput = document.getElementById("transitStart");
const transitEndInput = document.getElementById("transitEnd");

let pyodide = null;
let pyReady = false;

function setStatus(text) {
  statusEl.textContent = text;
}

function resetDownloadLink() {
  downloadLinkEl.style.display = "none";
  downloadLinkEl.removeAttribute("href");
  downloadLinkEl.removeAttribute("download");
}

async function loadPyodideRuntime() {
  if (pyReady) return;

  setStatus("Loading Python runtime (first run may take 20-60 seconds)...");
  const script = document.createElement("script");
  script.src = "https://cdn.jsdelivr.net/pyodide/v0.27.2/full/pyodide.js";
  script.async = true;

  await new Promise((resolve, reject) => {
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });

  pyodide = await globalThis.loadPyodide();

  setStatus("Installing dependency: openpyxl...");
  await pyodide.loadPackage("micropip");
  await pyodide.runPythonAsync(`
import micropip
await micropip.install("openpyxl")
`);

  setStatus("Loading stock analysis script...");
  const pyCode = await fetch("./py/inventory_step1_to_stock.py", { cache: "no-store" }).then((r) => r.text());
  pyodide.FS.mkdirTree("/work");
  pyodide.FS.writeFile("/work/inventory_step1_to_stock.py", pyCode);

  await pyodide.runPythonAsync(`
import sys
if "/work" not in sys.path:
    sys.path.append("/work")
`);

  pyReady = true;
  setStatus("Environment ready. Upload files and click Generate Stock File.");
}

async function readFileAsBytes(file) {
  const arrayBuffer = await file.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}

async function fetchTemplateBytes() {
  const resp = await fetch("./templates/stock_template.xlsx", { cache: "no-store" });
  if (!resp.ok) {
    throw new Error(`Template file not found: ./templates/stock_template.xlsx (HTTP ${resp.status})`);
  }
  const buffer = await resp.arrayBuffer();
  return new Uint8Array(buffer);
}

async function writeOptionalFile(fileInput, targetPath) {
  const file = fileInput.files?.[0];
  if (!file) return null;
  const bytes = await readFileAsBytes(file);
  pyodide.FS.writeFile(targetPath, bytes);
  return targetPath;
}

async function runAnalysis() {
  resetDownloadLink();

  const inventoryFile = inventoryInput.files?.[0];
  if (!inventoryFile) {
    setStatus("Please upload required file: Inventory Step1.");
    return;
  }

  runBtn.disabled = true;
  try {
    await loadPyodideRuntime();

    setStatus("Writing uploaded files...");
    const inventoryBytes = await readFileAsBytes(inventoryFile);
    const stockTemplateBytes = await fetchTemplateBytes();

    const inventoryPath = "/work/inventory_input.xlsx";
    const outputPath = "/work/stock_output.xlsx";

    pyodide.FS.writeFile(inventoryPath, inventoryBytes);
    pyodide.FS.writeFile(outputPath, stockTemplateBytes);

    const dailySupplyPath = await writeOptionalFile(dailySupplyInput, "/work/daily_supply_plan.xlsx");
    const odpMasterPath = await writeOptionalFile(odpMasterInput, "/work/odp_master.xlsx");
    const orderPath = await writeOptionalFile(orderInput, "/work/order_file.xlsx");

    const startDate = transitStartInput.value || "2026-08-01";
    const endDate = transitEndInput.value || "2026-12-31";

    const dailySupplyPy = dailySupplyPath ? `'${dailySupplyPath}'` : "None";
    const odpMasterPy = odpMasterPath ? `'${odpMasterPath}'` : "None";
    const orderPy = orderPath ? `'${orderPath}'` : "None";

    setStatus("Running available stock analysis...");

    await pyodide.runPythonAsync(`
from pathlib import Path
from inventory_step1_to_stock import run, _parse_cli_date

run(
    inventory_path=Path("${inventoryPath}"),
    stock_path=Path("${outputPath}"),
    sku_sheet_name=None,
    daily_supply_plan_path=Path(${dailySupplyPy}) if ${dailySupplyPy} is not None else None,
    odp_master_path=Path(${odpMasterPy}) if ${odpMasterPy} is not None else None,
    order_file_path=Path(${orderPy}) if ${orderPy} is not None else None,
    transit_start_date=_parse_cli_date("${startDate}"),
    transit_end_date=_parse_cli_date("${endDate}"),
)
`);

    const outputBytes = pyodide.FS.readFile(outputPath);
    const blob = new Blob([outputBytes], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const objectUrl = URL.createObjectURL(blob);

    const now = new Date();
    const fileName = `stock_output_${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}.xlsx`;

    downloadLinkEl.href = objectUrl;
    downloadLinkEl.download = fileName;
    downloadLinkEl.textContent = `Download ${fileName}`;
    downloadLinkEl.style.display = "inline-block";

    setStatus("Done: stock file generated. Click the download link below.");
  } catch (err) {
    setStatus(`Failed: ${err?.message || err}`);
    console.error(err);
  } finally {
    runBtn.disabled = false;
  }
}

function resetForm() {
  inventoryInput.value = "";
  dailySupplyInput.value = "";
  odpMasterInput.value = "";
  orderInput.value = "";
  transitStartInput.value = "2026-08-01";
  transitEndInput.value = "2026-12-31";
  resetDownloadLink();
  setStatus("Reset complete. Upload files and run again.");
}

runBtn.addEventListener("click", runAnalysis);
resetBtn.addEventListener("click", resetForm);