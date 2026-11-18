/* Node tests for BakeCost costing.js. Run: node test-demo.cjs
   The expected values come from the verified sample audit
   (BakeCost-Sample-Audit-2026-11-18.html): butter cake ingredient cost
   $7.00 at the old prices, $5.86 at the new prices, margin at a $24 selling
   price from $17.00 (about 71%) to $18.14 (about 76%). */

const C = require("./costing.js");

let passed = 0;
let failed = 0;

function check(name, actual, expected, tolerance) {
  tolerance = tolerance === undefined ? 0.001 : tolerance;
  const ok = typeof expected === "number"
    ? Math.abs(actual - expected) <= tolerance
    : actual === expected;
  if (ok) {
    passed++;
    console.log("PASS " + name);
  } else {
    failed++;
    console.log("FAIL " + name + " (expected " + expected + ", got " + actual + ")");
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
  ingredients: [
    { name: "Butter", qty: 0.5 },
    { name: "Wheat flour", qty: 0.4 },
    { name: "Eggs", qty: 4 }
  ]
};
const sourdough = {
  name: "Sourdough Loaf",
  sellPrice: 8.00,
  ingredients: [{ name: "Wheat flour", qty: 0.6 }]
};
const lemonDrizzle = {
  name: "Lemon Drizzle",
  sellPrice: 18.00,
  ingredients: [
    { name: "Wheat flour", qty: 0.3 },
    { name: "Butter", qty: 0.25 },
    { name: "Eggs", qty: 3 },
    { name: "Sugar", qty: 0.2 }
  ]
};

/* Recipe costs, old and new prices */
check("butter cake cost, old prices", C.recipeCost(butterCake, oldPrices), 7.00);
check("butter cake cost, new prices", C.recipeCost(butterCake, newPrices), 5.86);
check("sourdough cost, old prices", C.recipeCost(sourdough, oldPrices), 1.50);
check("sourdough cost, new prices", C.recipeCost(sourdough, newPrices), 1.86);
check("lemon drizzle cost, old prices", C.recipeCost(lemonDrizzle, oldPrices), 4.61);
check("lemon drizzle cost, new prices", C.recipeCost(lemonDrizzle, newPrices), 3.945);

/* Margins at selling price */
const mOld = C.margin(7.00, 24.00);
check("butter cake margin $, old", mOld.amount, 17.00);
check("butter cake margin %, old", mOld.pct, 70.833, 0.01);
const mNew = C.margin(5.86, 24.00);
check("butter cake margin $, new", mNew.amount, 18.14);
check("butter cake margin %, new", mNew.pct, 75.583, 0.01);

/* Price changes */
check("eggs change %", C.priceChangePct(6.00, 3.90), -35.0);
check("butter change %", C.priceChangePct(8.00, 6.64), -17.0);
check("flour change %", C.priceChangePct(2.50, 3.10), 24.0);
check("change % with zero old price", C.priceChangePct(0, 5.00), null);

/* Latest and earliest points */
const points = [
  { date: "2025-09-12", price: 6.00 },
  { date: "2026-09-08", price: 3.90 },
  { date: "2026-03-10", price: 5.10 }
];
check("latest point price", C.latestPoint(points).price, 3.90);
check("earliest point price", C.earliestPoint(points).price, 6.00);
check("latest point of empty list", C.latestPoint([]), null);

/* Missing ingredient price returns null */
check("recipe cost with missing price", C.recipeCost(butterCake, {}), null);

/* Formatting */
check("money positive", C.money(18.14), "$18.14");
check("money negative", C.money(-1.14), "-$1.14");
check("money rounds float dust up", C.money(3.9449999999999998), "$3.95");
check("money of exact half cent", C.money(2.675), "$2.68");
check("roundTo half up", C.roundTo(3.945, 2), 3.95);
check("pct positive", C.pct(24.0), "+24.0%");
check("pct negative", C.pct(-35.0), "-35.0%");
check("pct null", C.pct(null), "n/a");

/* CSV build */
const csv = C.buildCSV([
  { recipe: "Butter Cake", costThen: 7.00, costNow: 5.86, sellPrice: 24.00, marginAmount: 18.14, marginPct: 75.6 }
]);
check("CSV header", csv.split("\n")[0], "Recipe,Cost then,Cost now,Change,Selling price,Margin now,Margin now %");
check("CSV row", csv.split("\n")[1], "Butter Cake,7.00,5.86,-1.14,24.00,18.14,75.6");

console.log("\n" + passed + " passed, " + failed + " failed.");
process.exit(failed === 0 ? 0 : 1);
