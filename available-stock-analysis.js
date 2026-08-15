const statusEl = document.getElementById("status");
const downloadLinkEl = document.getElementById("downloadLink");

const runBtn = document.getElementById("runBtn");
const resetBtn = document.getElementById("resetBtn");

const inventoryInput = document.getElementById("inventoryFile");
const stockTemplateInput = document.getElementById("stockTemplateFile");
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

  setStatus("正在加载 Python 运行环境（首次约需 20-60 秒）...");
  const script = document.createElement("script");
  script.src = "https://cdn.jsdelivr.net/pyodide/v0.27.2/full/pyodide.js";
  script.async = true;

  await new Promise((resolve, reject) => {
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });

  pyodide = await globalThis.loadPyodide();

  setStatus("正在安装依赖（openpyxl）...");
  await pyodide.loadPackage("micropip");
  await pyodide.runPythonAsync(`
import micropip
await micropip.install("openpyxl")
`);

  setStatus("正在加载库存分析脚本...");
  const pyCode = await fetch("./py/inventory_step1_to_stock.py", { cache: "no-store" }).then((r) => r.text());
  pyodide.FS.mkdirTree("/work");
  pyodide.FS.writeFile("/work/inventory_step1_to_stock.py", pyCode);

  await pyodide.runPythonAsync(`
import sys
if "/work" not in sys.path:
    sys.path.append("/work")
`);

  pyReady = true;
  setStatus("环境准备完成，请上传文件并点击“生成 Stock 文件”。");
}

async function readFileAsBytes(file) {
  const arrayBuffer = await file.arrayBuffer();
  return new Uint8Array(arrayBuffer);
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
  const stockTemplateFile = stockTemplateInput.files?.[0];

  if (!inventoryFile || !stockTemplateFile) {
    setStatus("请先上传必填文件：Inventory Step1 + Stock 模板。");
    return;
  }

  runBtn.disabled = true;
  try {
    await loadPyodideRuntime();

    setStatus("正在写入上传文件...");
    const inventoryBytes = await readFileAsBytes(inventoryFile);
    const stockTemplateBytes = await readFileAsBytes(stockTemplateFile);

    const inventoryPath = "/work/inventory_input.xlsx";
    const templatePath = "/work/stock_template_input.xlsx";
    const outputPath = "/work/stock_output.xlsx";

    pyodide.FS.writeFile(inventoryPath, inventoryBytes);
    pyodide.FS.writeFile(templatePath, stockTemplateBytes);
    pyodide.FS.writeFile(outputPath, stockTemplateBytes);

    const dailySupplyPath = await writeOptionalFile(dailySupplyInput, "/work/daily_supply_plan.xlsx");
    const odpMasterPath = await writeOptionalFile(odpMasterInput, "/work/odp_master.xlsx");
    const orderPath = await writeOptionalFile(orderInput, "/work/order_file.xlsx");

    const startDate = transitStartInput.value || "2026-08-01";
    const endDate = transitEndInput.value || "2026-12-31";

    const dailySupplyPy = dailySupplyPath ? `'${dailySupplyPath}'` : "None";
    const odpMasterPy = odpMasterPath ? `'${odpMasterPath}'` : "None";
    const orderPy = orderPath ? `'${orderPath}'` : "None";

    setStatus("正在执行库存分析，请稍候...");

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
    downloadLinkEl.textContent = `下载 ${fileName}`;
    downloadLinkEl.style.display = "inline-block";

    setStatus("处理完成：已生成 stock 文件，请点击下方下载。\n提示：可重复上传不同文件再次处理。");
  } catch (err) {
    setStatus(`处理失败：${err?.message || err}`);
    console.error(err);
  } finally {
    runBtn.disabled = false;
  }
}

function resetForm() {
  inventoryInput.value = "";
  stockTemplateInput.value = "";
  dailySupplyInput.value = "";
  odpMasterInput.value = "";
  orderInput.value = "";
  transitStartInput.value = "2026-08-01";
  transitEndInput.value = "2026-12-31";
  resetDownloadLink();
  setStatus("已重置。请重新上传文件并执行。");
}

runBtn.addEventListener("click", runAnalysis);
resetBtn.addEventListener("click", resetForm);
