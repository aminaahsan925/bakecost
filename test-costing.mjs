// Node tests for BakeCost v2 costing.js. Run: node test-costing.mjs
// The expected values come from the verified sample audit
// (BakeCost-Sample-Audit-2026-11-18.html): butter cake ingredient cost
// $7.00 at the old prices, $5.86 at the new prices, margin at a $24 selling
// price from $17.00 (about 71%) to $18.14 (about 76%).

import {
  pricePerBaseUnit, lineCost, recipeCost, margin, priceChangePct,
  latestPoint, earliestPoint, previousPoint, marginStatus, statusLabel,
  biggestMovers, marginAlerts, recentMoves, roundTo, money, pct,
  buildCSV, buildPriceCSV, buildInvoiceCSV
} from "./costing.js";

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

const oldPrices = {
  "Butter": { price: 8.00, factor: 1 },
  "Wheat flour": { price: 2.50, factor: 1 },
  "Eggs": { price: 6.00, factor: 12 },
  "Sugar": { price: 1.80, factor: 1 }
};
const newPrices = {
  "Butter": { price: 6.64, factor: 1 },
  "Wheat flour": { price: 3.10, factor: 1 },
  "Eggs": { price: 3.90, factor: 12 },
  "Sugar": { price: 1.90, factor: 1 }
};

const butterCake = {
  name: "Butter Cake",
  sellPrice: 24.00,
  targetPct: 60,
  ingredients: [
    { name: "Butter", qty: 0.5 },
    { name: "Wheat flour", qty: 0.4 },
    { name: "Eggs", qty: 4 }
  ]
};
const sourdough = {
  name: "Sourdough Loaf",
  sellPrice: 8.00,
  targetPct: 70,
  ingredients: [{ name: "Wheat flour", qty: 0.6 }]
};
const lemonDrizzle = {
  name: "Lemon Drizzle",
  sellPrice: 18.00,
  targetPct: 60,
  ingredients: [
    { name: "Wheat flour", qty: 0.3 },
    { name: "Butter", qty: 0.25 },
    { name: "Eggs", qty: 3 },
    { name: "Sugar", qty: 0.2 }
  ]
};

/* Recipe costs, old and new prices */
check("butter cake cost, old prices", recipeCost(butterCake, oldPrices), 7.00);
check("butter cake cost, new prices", recipeCost(butterCake, newPrices), 5.86);
check("sourdough cost, old prices", recipeCost(sourdough, oldPrices), 1.50);
check("sourdough cost, new prices", recipeCost(sourdough, newPrices), 1.86);
check("lemon drizzle cost, old prices", recipeCost(lemonDrizzle, oldPrices), 4.61);
check("lemon drizzle cost, new prices", recipeCost(lemonDrizzle, newPrices), 3.945);

/* Margins at selling price */
const mOld = margin(7.00, 24.00);
check("butter cake margin $, old", mOld.amount, 17.00);
check("butter cake margin %, old", mOld.pct, 70.833, 0.01);
const mNew = margin(5.86, 24.00);
check("butter cake margin $, new", mNew.amount, 18.14);
check("butter cake margin %, new", mNew.pct, 75.583, 0.01);
check("margin with zero selling price", margin(5, 0).pct, 0);

/* Price changes */
check("eggs change %", priceChangePct(6.00, 3.90), -35.0);
check("butter change %", priceChangePct(8.00, 6.64), -17.0);
check("flour change %", priceChangePct(2.50, 3.10), 24.0);
check("change % with zero old price", priceChangePct(0, 5.00), null);

/* Latest, earliest, previous points */
const points = [
  { date: "2025-09-12", price: 6.00 },
  { date: "2026-09-08", price: 3.90 },
  { date: "2026-03-10", price: 5.10 }
];
check("latest point price", latestPoint(points).price, 3.90);
check("earliest point price", earliestPoint(points).price, 6.00);
check("previous point price", previousPoint(points).price, 5.10);
check("previous point of one point", previousPoint([{ date: "2026-01-01", price: 1 }]), null);
check("latest point of empty list", latestPoint([]), null);

/* Missing ingredient price returns null */
check("recipe cost with missing price", recipeCost(butterCake, {}), null);

/* Margin status bands */
check("status ok at target", marginStatus(60, 60), "ok");
check("status ok above target", marginStatus(75.6, 60), "ok");
check("status watch 3 points below", marginStatus(57, 60), "watch");
check("status watch exactly 5 below", marginStatus(55, 60), "watch");
check("status alert 6 points below", marginStatus(54, 60), "alert");
check("status unknown with null margin", marginStatus(null, 60), "unknown");
check("status label ok", statusLabel("ok"), "On target");
check("status label alert", statusLabel("alert"), "Below target");

/* Biggest movers */
const histories = [
  { name: "Eggs", unit: "per dozen", points: [
    { date: "2025-09-12", price: 6.00 }, { date: "2026-09-08", price: 3.90 } ] },
  { name: "Butter", unit: "per kg", points: [
    { date: "2025-09-12", price: 8.00 }, { date: "2026-09-08", price: 6.64 } ] },
  { name: "Wheat flour", unit: "per kg", points: [
    { date: "2025-09-12", price: 2.50 }, { date: "2026-09-08", price: 3.10 } ] },
  { name: "Vanilla", unit: "per L", points: [
    { date: "2026-09-08", price: 40.00 } ] }
];
const movers = biggestMovers(histories);
check("movers first is eggs", movers[0].name, "Eggs");
check("movers eggs change", movers[0].changePct, -35.0);
check("movers second is flour", movers[1].name, "Wheat flour");
check("movers third is butter", movers[2].name, "Butter");
check("movers single point last with null change", movers[3].changePct, null);

/* Margin alerts */
const alertRows = [
  { name: "Butter Cake", marginPct: 75.6, targetPct: 60, sellPrice: 24, cost: 5.86 },
  { name: "Sourdough Loaf", marginPct: 76.8, targetPct: 70, sellPrice: 8, cost: 1.86 },
  { name: "Tight Cake", marginPct: 52, targetPct: 60, sellPrice: 10, cost: 4.8 },
  { name: "Edge Cake", marginPct: 58, targetPct: 60, sellPrice: 10, cost: 4.2 },
  { name: "No Price Cake", marginPct: null, targetPct: 60, sellPrice: 10, cost: null }
];
const alerts = marginAlerts(alertRows);
check("alerts count", alerts.length, 2);
check("alerts worst first", alerts[0].name, "Tight Cake");
check("alerts worst status", alerts[0].status, "alert");
check("alerts worst shortfall", alerts[0].shortfall, 8);
check("alerts second status", alerts[1].status, "watch");

/* Recent moves above a threshold */
const moveHistories = [
  { name: "Butter", unit: "per kg", points: [
    { date: "2026-03-10", price: 7.40 }, { date: "2026-09-08", price: 6.64 } ] },
  { name: "Sugar", unit: "per kg", points: [
    { date: "2026-03-10", price: 1.85 }, { date: "2026-09-08", price: 1.90 } ] }
];
const moves = recentMoves(moveHistories, 5);
check("recent moves count at 5%", moves.length, 1);
check("recent moves name", moves[0].name, "Butter");
check("recent moves pct", moves[0].changePct, -10.27, 0.01);
check("recent moves count at 1%", recentMoves(moveHistories, 1).length, 2);

/* Formatting */
check("money positive", money(18.14), "$18.14");
check("money negative", money(-1.14), "-$1.14");
check("money null", money(null), "n/a");
check("money rounds float dust up", money(3.9449999999999998), "$3.95");
check("money of exact half cent", money(2.675), "$2.68");
check("roundTo half up", roundTo(3.945, 2), 3.95);
check("pct positive", pct(24.0), "+24.0%");
check("pct negative", pct(-35.0), "-35.0%");
check("pct null", pct(null), "n/a");
check("price per base unit dozen", pricePerBaseUnit(6.00, 12), 0.5);
check("line cost eggs", lineCost(4, 6.00, 12), 2.00);

/* CSV builders */
const csv = buildCSV([
  { recipe: "Butter Cake", costThen: 7.00, costNow: 5.86, sellPrice: 24.00, marginAmount: 18.14, marginPct: 75.6 }
]);
check("recipe CSV header", csv.split("\n")[0], "Recipe,Cost then,Cost now,Change,Selling price,Margin now,Margin now %");
check("recipe CSV row", csv.split("\n")[1], "Butter Cake,7.00,5.86,-1.14,24.00,18.14,75.6");
const csvNull = buildCSV([
  { recipe: "No Price Cake", costThen: null, costNow: null, sellPrice: 10, marginAmount: null, marginPct: null }
]);
check("recipe CSV null row", csvNull.split("\n")[1], "No Price Cake,,,,10.00,,");
const priceCsv = buildPriceCSV([
  { name: "Butter", unit: "per kg", points: [
    { date: "2026-09-08", price: 6.64 }, { date: "2025-09-12", price: 8.00 } ] }
]);
check("price CSV header", priceCsv.split("\n")[0], "Ingredient,Unit,Date,Price");
check("price CSV sorted by date", priceCsv.split("\n")[1], "Butter,per kg,2025-09-12,8.00");
check("price CSV second row", priceCsv.split("\n")[2], "Butter,per kg,2026-09-08,6.64");
const invCsv = buildInvoiceCSV([
  { supplier: "Millbrook Supplies", date: "2026-09-08", lines: [
    { ingredient: "Butter", qty: 20, unit: "kg", price: 6.64 } ] }
]);
check("invoice CSV row", invCsv.split("\n")[1], "Millbrook Supplies,2026-09-08,Butter,20,kg,6.64,132.80");

console.log("\n" + passed + " passed, " + failed + " failed.");
process.exit(failed === 0 ? 0 : 1);
