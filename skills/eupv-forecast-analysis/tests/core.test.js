"use strict";
const assert = require("assert");
const core = require("../assets/original-site/modules/forecast/forecast-core.js");

assert.strictEqual(core.addMonths("2026-01", 2), "2026-03");
const samples = [{ actual: 100, forecast: 120, error: 20, ape: 0.2 }, { actual: 50, forecast: 40, error: -10, ape: 0.2 }];
const summary = core.summarize(samples, 0.2);
assert.strictEqual(summary.actual, 150);
assert.strictEqual(summary.forecast, 160);
assert.ok(Math.abs(summary.wape - 0.2) < 1e-12);
assert.ok(Math.abs(summary.accuracy - 0.8) < 1e-12);
assert.ok(Math.abs(summary.bias - (10 / 150)) < 1e-12);
assert.strictEqual(summary.hitRate, 1);
console.log("forecast core smoke test passed");
