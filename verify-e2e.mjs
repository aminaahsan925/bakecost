// BakeCost v2 end to end smoke test (logic chain, no browser).
// Simulates the guest demo flow in Node: load the sample state, paste
// an invoice, add it, check the price history and recipe costs update,
// force a price spike, check an alert fires, and build every CSV.
// Also checks the chart output and the Gemini result normaliser.
// Run: node verify-e2e.mjs

import { sampleState, SAMPLE_INVOICE_TEXT } from "./sample-data.js";
import { parseInvoiceText } from "./invoice-parser.js";
import {
  trueCost, margin, latestPoint, earliestPoint, marginStatus,
  biggestMovers, marginAlerts, recentMoves,
  buildCSV, buildPriceCSV, buildInvoiceCSV
} from "./costing.js";
import { lineChartSVG, sparklineSVG } from "./charts.js";
import { normaliseGeminiResult } from "./ai.js";
import {
  orderMoney, orderStatus, outstandingBalance, aggregateBakeDay,
  dozensToBuy, supplierComparison, isPriceJump,
  wasteSummary, purchasesTotal, inventoryStatus, expiryStatus,
  inventoryAlerts, addInvoiceToInventory, deductBakeFromInventory
} from "./features.js";

let passed = 0;
let failed = 0;

function check(name, actual, expected, tolerance) {
  tolerance = tolerance === undefined ? 0.001 : tolerance;
  const ok = typeof expected === "number"
    ? typeof actual === "number" && Math.abs(actual - expected) <= tolerance
    : actual === expected;
  if (ok) {
    passed++;
    console.log("PASS " + name);
  } else {
    failed++;
    console.log("FAIL " + name + " (expected " + JSON.stringify(expected) + ", got " + JSON.stringify(actual) + ")");
  }
}

// The app's own derived-data helpers, copied in miniature so this script
// tests the same logic the app runs (price points from invoices, price
// sets, costing rows).
function pricePoints(state, name) {
  const points = [];
  state.invoices.forEach((inv) => {
    inv.lines.forEach((line) => {
      if (line.ingredient === name) points.push({ date: inv.date, price: line.price });
    });
  });
  points.sort((a, b) => (a.date < b.date ? -1 : 1));
  return points;
}

function priceSet(state, which) {
  const set = {};
  state.ingredients.forEach((ing) => {
    const points = pricePoints(state, ing.name);
    const point = which === "earliest" ? earliestPoint(points) : latestPoint(points);
    if (point) set[ing.name] = { price: point.price, factor: ing.factor };
  });
  return set;
}

function costingRows(state) {
  const thenPrices = priceSet(state, "earliest");
  const nowPrices = priceSet(state, "latest");
  const rate = state.settings && typeof state.settings.laborRate === "number"
    ? state.settings.laborRate : 12;
  return state.recipes.map((recipe) => {
    const thenParts = trueCost(recipe, thenPrices, rate);
    const nowParts = trueCost(recipe, nowPrices, rate);
    const costThen = thenParts === null ? null : thenParts.total;
    const costNow = nowParts === null ? null : nowParts.total;
    const m = costNow === null ? { amount: null, pct: null } : margin(costNow, recipe.sellPrice);
    return { recipe, costThen, costNow, marginPct: m.pct, status: marginStatus(m.pct, recipe.targetPct) };
  });
}

function histories(state) {
  return state.ingredients.map((ing) => ({
    name: ing.name, unit: ing.unit, points: pricePoints(state, ing.name)
  }));
}

/* Step 1: sample state loads. Baseline costs are TRUE costs
   (ingredients + labor + packaging + overhead), so all three
   sample recipes sit below their targets at baseline. That is the
   honest consequence of the v12 costing change: the bakery thought
   its margins were around 76%, they are really 19-47%. */
const state = sampleState();
check("sample invoices", state.invoices.length, 3);
check("sample recipes", state.recipes.length, 3);
check("sample labor rate", state.settings.laborRate, 12);
const base = costingRows(state);
check("baseline butter cake true cost", base[0].costNow, 12.76);
check("baseline butter cake margin", base[0].marginPct, 46.833, 0.01);
check("baseline sourdough margin", base[1].marginPct, 18.625, 0.01);
check("baseline lemon drizzle margin", base[2].marginPct, 45.556, 0.01);
check("baseline biggest mover is eggs", biggestMovers(histories(state))[0].name, "Eggs");
check("baseline three alerts (true cost below target)", marginAlerts(base.map((r) => ({
  name: r.recipe.name, marginPct: r.marginPct, targetPct: r.recipe.targetPct,
  sellPrice: r.recipe.sellPrice, cost: r.costNow
}))).length, 3);

/* Step 1b (v5): orders, bake day, suppliers on the pristine sample state. */
check("sample orders", state.orders.length, 3);
check("sample bake days", state.bakeDays.length, 1);
const todayE2e = new Date().toISOString().slice(0, 10);
const [oMaya, oLena, oNoor] = state.orders;
check("Maya order total", orderMoney(oMaya, state.recipes).total, 40.00);
check("Maya balance due", orderStatus(oMaya, state.recipes, todayE2e).status, "balance due");
check("Maya not overdue", orderStatus(oMaya, state.recipes, todayE2e).overdue, false);
check("Lena total", orderMoney(oLena, state.recipes).total, 54.00);
check("Lena deposit due", orderStatus(oLena, state.recipes, todayE2e).status, "deposit due");
check("Lena overdue", orderStatus(oLena, state.recipes, todayE2e).overdue, true);
check("Noor paid", orderStatus(oNoor, state.recipes, todayE2e).status, "paid");
check("Noor not overdue", orderStatus(oNoor, state.recipes, todayE2e).overdue, false);
check("outstanding balance", outstandingBalance(state.orders, state.recipes), 74.00);
const planAgg = aggregateBakeDay(state.bakeDays[0].items, state.recipes);
check("bake day butter 2 kg", planAgg.find((a) => a.name === "Butter").qty, 2.0);
check("bake day flour 8.8 kg", planAgg.find((a) => a.name === "Wheat flour").qty, 8.8);
check("bake day eggs 16 singles", planAgg.find((a) => a.name === "Eggs").qty, 16);
check("16 eggs means 2 dozen", dozensToBuy(16), 2);
const suppliers = supplierComparison(state.invoices, state.ingredients);
check("flour cheapest is City Mills",
  suppliers.find((c) => c.name === "Wheat flour").cheapest, "City Mills");
check("butter cheapest is Millbrook",
  suppliers.find((c) => c.name === "Butter").cheapest, "Millbrook Supplies");
check("Millbrook flour jumped",
  isPriceJump(suppliers.find((c) => c.name === "Wheat flour")
    .suppliers.find((s) => s.supplier === "Millbrook Supplies").changePct), true);

/* Step 1c (v12): waste log and inventory on the pristine sample state. */
check("sample waste entries", state.waste.length, 3);
check("sample inventory rows", state.inventory.length, 4);
const weekWaste = wasteSummary(state.waste, state.recipes, priceSet(state, "latest"),
  state.settings.laborRate, purchasesTotal(state.invoices));
check("sample waste week total", weekWaste.totalValue, 48.34);
check("sample waste week pct of purchases", weekWaste.pctOfPurchases, 4.2, 0.05);
check("sample waste worst product", weekWaste.worst.name, "Butter Cake");
check("sample butter stock is low",
  inventoryStatus(state.inventory.find((r) => r.ingredient === "Butter")), "low");
check("sample eggs expire soon",
  expiryStatus(state.inventory.find((r) => r.ingredient === "Eggs"), todayE2e), "soon");
check("sample inventory alerts", inventoryAlerts(state.inventory, todayE2e).length, 2);
const afterBake = deductBakeFromInventory(state.inventory,
  aggregateBakeDay(state.bakeDays[0].items, state.recipes), state.ingredients);
check("bake deducts butter to 6.5 kg",
  afterBake.find((r) => r.ingredient === "Butter").qty, 6.5);
check("bake deducts flour to 33.2 kg",
  afterBake.find((r) => r.ingredient === "Wheat flour").qty, 33.2);
check("bake deducts eggs to 4.667 dozen",
  afterBake.find((r) => r.ingredient === "Eggs").qty, 4.667);

/* Step 2: paste the sample invoice text, parse it, save it. */
const parsed = parseInvoiceText(SAMPLE_INVOICE_TEXT, state.ingredients);
check("pasted invoice supplier", parsed.supplier, "Millbrook Supplies");
check("pasted invoice date", parsed.date, "2026-11-02");
check("pasted invoice lines", parsed.lines.length, 4);
state.invoices.push({
  id: "e2e-1", supplier: parsed.supplier, date: parsed.date, lines: parsed.lines
});
const afterInvoice = addInvoiceToInventory(state.inventory, parsed.lines);
check("saving an invoice adds butter to stock",
  afterInvoice.find((r) => r.ingredient === "Butter").qty, 28.5);
check("saving an invoice adds eggs to stock",
  afterInvoice.find((r) => r.ingredient === "Eggs").qty, 16);

/* Step 3: price history updated. */
const flourPoints = pricePoints(state, "Wheat flour");
check("flour now has 4 points", flourPoints.length, 4);
check("flour latest price", latestPoint(flourPoints).price, 3.45);
const movers = biggestMovers(histories(state));
check("biggest mover after paste is flour", movers[0].name, "Wheat flour");
check("flour move now 38%", movers.find((m) => m.name === "Wheat flour").changePct, 38.0);

/* Step 4: recipes recosted at the new prices (true cost). */
const after = costingRows(state);
check("butter cake recosted", after[0].costNow, 13.23);
check("sourdough recosted", after[1].costNow, 6.72);
check("lemon drizzle recosted", after[2].costNow, 10.10);

/* Step 5: a flour price spike fires a real alert. */
state.invoices.push({
  id: "e2e-2", supplier: "Millbrook Supplies", date: "2026-11-15",
  lines: [{ ingredient: "Wheat flour", qty: 50, unit: "kg", price: 6.00 }]
});
const spiked = costingRows(state);
const alerts = marginAlerts(spiked.map((r) => ({
  name: r.recipe.name, marginPct: r.marginPct, targetPct: r.recipe.targetPct,
  sellPrice: r.recipe.sellPrice, cost: r.costNow
})));
check("three alerts after spike", alerts.length, 3);
check("worst alert is sourdough", alerts[0].name, "Sourdough Loaf");
check("alert status", alerts[0].status, "alert");
check("sourdough margin after spike", spiked[1].marginPct, -3.125, 0.01);
const moves = recentMoves(histories(state), 5);
check("flour move flagged over 5%", moves.some((m) => m.name === "Wheat flour"), true);

/* Step 6: every CSV builds and carries the new data. */
const recipeCsv = buildCSV(spiked.map((r) => ({
  recipe: r.recipe.name, costThen: r.costThen, costNow: r.costNow,
  sellPrice: r.recipe.sellPrice,
  marginAmount: r.costNow === null ? null : r.recipe.sellPrice - r.costNow,
  marginPct: r.marginPct
})));
check("recipe CSV has header and 3 rows", recipeCsv.trim().split("\n").length, 4);
check("recipe CSV carries sourdough true cost", recipeCsv.includes("Sourdough Loaf,6.15,8.25"), true);
const priceCsv = buildPriceCSV(histories(state));
check("price CSV carries the spike", priceCsv.includes("Wheat flour,per kg,2026-11-15,6.00"), true);
const invoiceCsv = buildInvoiceCSV(state.invoices);
check("invoice CSV has 5 invoices worth of lines",
  invoiceCsv.trim().split("\n").length, 1 + 4 + 4 + 4 + 4 + 1);

/* Step 7: charts render SVG with a line path. */
const chart = lineChartSVG(pricePoints(state, "Wheat flour"), { label: "Wheat flour" });
check("chart is an svg", chart.startsWith("<svg"), true);
check("chart has a line path", chart.includes("<path"), true);
check("chart has 5 dots", (chart.match(/<circle/g) || []).length, 5);
const spark = sparklineSVG(pricePoints(state, "Butter"), {});
check("sparkline is an svg", spark.startsWith("<svg"), true);
check("empty chart is an empty state", lineChartSVG([], {}).includes("chart-empty"), true);

/* Step 8: a fake Gemini payload normalises into app lines. */
const gemini = normaliseGeminiResult({
  supplier: "City Mills",
  date: "2026-11-20",
  lines: [
    { ingredient: "Butter", quantity: 20, unit: "kg", unitPrice: 7.10 },
    { ingredient: "Sugar", quantity: 25, unit: "kg", totalPrice: 48.75 },
    { ingredient: "Flour", quantity: 50, unit: "kg" }
  ]
});
check("gemini supplier", gemini.supplier, "City Mills");
check("gemini lines (no-price line dropped)", gemini.lines.length, 2);
check("gemini unit price kept", gemini.lines[0].price, 7.10);
check("gemini total converted to unit price", gemini.lines[1].price, 1.95);

console.log("\n" + passed + " passed, " + failed + " failed.");
process.exit(failed === 0 ? 0 : 1);
