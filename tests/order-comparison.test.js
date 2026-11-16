const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
global.assert = assert;

const elements = new Map();
function fakeElement() {
  return { value:"", files:[], hidden:true, disabled:false, textContent:"", innerHTML:"", dataset:{}, options:[], addEventListener() {}, querySelectorAll() { return []; } };
}
global.byId = (id) => {
  if (!elements.has(id)) elements.set(id, fakeElement());
  return elements.get(id);
};
global.document = { querySelectorAll() { return []; } };
global.currentLang = "zh";
global.XLSX = {};
global.esc = (value) => String(value);
global.card = () => "";
global.table = () => {};
global.normalizeRows = (rows) => rows;

const source = fs.readFileSync(path.join(__dirname, "..", "modules", "sales", "order-comparison.js"), "utf8");
const tests = `
  function testRow(key, overrides = {}) {
    const [orderId, orderLine] = key.split("\\u0001");
    return { orderKey:key, orderId, orderLine, month:"2026-11", year:2026, quarter:"Q4", region:"DACH Region", customer:"Customer A", model:"Model A", category:"PV", totalMw:10, essQty:0, orderStatus:"created", orderStatusLabel:"Created", ...overrides };
  }
  const oldRows = [
    testRow("A\\u00011"),
    testRow("B\\u00011"),
    testRow("C\\u00011"),
    testRow("C\\u00011", { totalMw:2 }),
    testRow("E\\u00011", { category:"ESS", totalMw:0, essQty:5 })
  ];
  const newRows = [
    testRow("A\\u00011", { month:"2026-12", orderStatus:"prepare truck", orderStatusLabel:"Prepare Truck" }),
    testRow("C\\u00011"),
    testRow("D\\u00011"),
    testRow("E\\u00011", { category:"ESS", totalMw:0, essQty:8 })
  ];
  const oldSnapshot = ocBuildSnapshot(oldRows, "old"), newSnapshot = ocBuildSnapshot(newRows, "new");
  const comparison = ocBuildComparison(oldSnapshot, newSnapshot);
  assert.equal(oldSnapshot.duplicateGroups.length, 1);
  assert.equal(comparison.reviewKeys.has("C\\u00011"), true);
  assert.deepEqual(comparison.records.find((record) => record.key === "A\\u00011").types, ["delayed", "statusChanged"]);
  assert.deepEqual(comparison.records.find((record) => record.key === "B\\u00011").types, ["cancelled"]);
  assert.deepEqual(comparison.records.find((record) => record.key === "D\\u00011").types, ["added"]);
  assert.deepEqual(comparison.records.find((record) => record.key === "E\\u00011").types, ["qtyUp"]);
  assert.equal(comparison.records.length, 4);
`;

vm.runInThisContext(`${source}\n${tests}`, { filename:"order-comparison.test.bundle.js" });
console.log("order-comparison tests passed");
