"use strict";
const assert = require("assert");
const core = require("../assets/original-site/modules/forecast-sales/forecast-sales-core.js");

assert.strictEqual(core.normalizeStage("6 - Finalize contract"), "6 - Won");
assert.strictEqual(core.normalizeStage(""), "Unspecified");
assert.strictEqual(core.addMonths("2026-01", 2), "2026-03");
assert.strictEqual(core.classifyPvProduct({ Model: "HSM-ND54-AA-500", Brand: "TCL" }, "actual"), "TCL · ND54-AA");
console.log("forecast-sales core smoke test passed");
