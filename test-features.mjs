// Node tests for BakeCost v5/v12 features.js: orders, bake-day
// planner, supplier comparison, waste log, inventory. Run:
// node test-features.mjs

import {
  recipeById, orderTotal, orderMoney, orderStatus, orderStatusLabel,
  outstandingBalance, aggregateBakeDay, dozensToBuy,
  supplierComparison, isPriceJump,
  wastedQty, wasteEntryValue, purchasesTotal, wasteSummary,
  inventoryStatus, inventoryStatusLabel, expiryStatus, daysToExpiry,
  inventoryAlerts, addInvoiceToInventory, deductBakeFromInventory,
  inventoryFromInvoices
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

const recipes = [
  { id: "r1", name: "Butter Cake", sellPrice: 24.00, targetPct: 60,
    ingredients: [
      { name: "Butter", qty: 0.5 },
      { name: "Wheat flour", qty: 0.4 },
      { name: "Eggs", qty: 4 }
    ] },
  { id: "r2", name: "Sourdough Loaf", sellPrice: 8.00, targetPct: 70,
    ingredients: [{ name: "Wheat flour", qty: 0.6 }] },
  { id: "r3", name: "Lemon Drizzle", sellPrice: 18.00, targetPct: 60,
    ingredients: [
      { name: "Wheat flour", qty: 0.3 },
      { name: "Butter", qty: 0.25 },
      { name: "Eggs", qty: 3 },
      { name: "Sugar", qty: 0.2 }
    ] }
];

const TODAY = "2026-11-18";

/* Order totals */
const orderA = {
  id: "o1", customer: "Maya", dueDate: "2026-11-23",
  items: [{ recipeId: "r1", qty: 1 }, { recipeId: "r2", qty: 2 }],
  depositPaid: 20.00
};
check("order total 1 cake + 2 loaves", orderTotal(orderA, recipes), 40.00);
check("order total empty items", orderTotal({ items: [] }, recipes), 0);
check("order total missing recipe is null",
  orderTotal({ items: [{ recipeId: "gone", qty: 1 }] }, recipes), null);
check("order total zero qty contributes nothing",
  orderTotal({ items: [{ recipeId: "r1", qty: 0 }] }, recipes), 0);
check("recipeById finds sourdough", recipeById(recipes, "r2").name, "Sourdough Loaf");
check("recipeById missing returns null", recipeById(recipes, "nope"), null);

/* Order money: deposit and balance */
const moneyA = orderMoney(orderA, recipes);
check("order money total", moneyA.total, 40.00);
check("order money deposit", moneyA.deposit, 20.00);
check("order money balance", moneyA.balance, 20.00);
const moneyPaid = orderMoney(
  { items: [{ recipeId: "r2", qty: 1 }], depositPaid: 8.00 }, recipes);
check("paid order balance is zero", moneyPaid.balance, 0);
const moneyOver = orderMoney(
  { items: [{ recipeId: "r2", qty: 1 }], depositPaid: 10.00 }, recipes);
check("overpaid balance goes negative", moneyOver.balance, -2.00);
check("order money null total gives null balance",
  orderMoney({ items: [{ recipeId: "gone", qty: 1 }], depositPaid: 0 }, recipes).balance, null);

/* Order status */
check("status balance due", orderStatus(orderA, recipes, TODAY).status, "balance due");
check("balance due order not overdue", orderStatus(orderA, recipes, TODAY).overdue, false);
const orderOverdue = {
  id: "o2", customer: "Lena", dueDate: "2026-11-10",
  items: [{ recipeId: "r3", qty: 3 }], depositPaid: 0
};
check("status deposit due with no deposit",
  orderStatus(orderOverdue, recipes, TODAY).status, "deposit due");
check("unpaid past-due order is overdue",
  orderStatus(orderOverdue, recipes, TODAY).overdue, true);
const orderPaid = {
  id: "o3", customer: "Noor", dueDate: "2026-11-15",
  items: [{ recipeId: "r2", qty: 1 }], depositPaid: 8.00
};
check("status paid", orderStatus(orderPaid, recipes, TODAY).status, "paid");
check("paid order never overdue", orderStatus(orderPaid, recipes, TODAY).overdue, false);
const orderDueToday = {
  id: "o4", customer: "Sam", dueDate: "2026-11-18",
  items: [{ recipeId: "r2", qty: 1 }], depositPaid: 0
};
check("due today is not overdue", orderStatus(orderDueToday, recipes, TODAY).overdue, false);
check("status unknown with missing recipe",
  orderStatus({ items: [{ recipeId: "gone", qty: 1 }], dueDate: "2026-11-01", depositPaid: 0 },
    recipes, TODAY).status, "unknown");
check("status label paid", orderStatusLabel("paid"), "Paid");
check("status label balance due", orderStatusLabel("balance due"), "Balance due");
check("status label deposit due", orderStatusLabel("deposit due"), "Deposit due");

/* Outstanding balance across orders */
check("outstanding across three orders",
  outstandingBalance([orderA, orderOverdue, orderPaid], recipes), 74.00);
check("outstanding empty list", outstandingBalance([], recipes), 0);

/* Bake-day aggregation */
const plan = [
  { recipeId: "r1", qty: 4 },
  { recipeId: "r2", qty: 12 }
];
const agg = aggregateBakeDay(plan, recipes);
check("aggregation has 3 ingredients", agg.length, 3);
check("aggregation butter 2 kg", agg.find((a) => a.name === "Butter").qty, 2.0);
check("aggregation flour 8.8 kg", agg.find((a) => a.name === "Wheat flour").qty, 8.8);
check("aggregation eggs 16 singles", agg.find((a) => a.name === "Eggs").qty, 16);
const planMixed = [
  { recipeId: "r1", qty: 2 },
  { recipeId: "r3", qty: 2 },
  { recipeId: "gone", qty: 5 },
  { recipeId: "r2", qty: 0 }
];
const aggMixed = aggregateBakeDay(planMixed, recipes);
check("aggregation skips missing recipes and zero qty", aggMixed.length, 4);
check("aggregation eggs across two recipes",
  aggMixed.find((a) => a.name === "Eggs").qty, 14);
check("aggregation sugar from lemon drizzle only",
  aggMixed.find((a) => a.name === "Sugar").qty, 0.4);
check("aggregation empty plan", aggregateBakeDay([], recipes).length, 0);
check("dozens to buy for 16 singles", dozensToBuy(16), 2);
check("dozens to buy for exactly 12", dozensToBuy(12), 1);
check("dozens to buy for 13", dozensToBuy(13), 2);

/* Supplier comparison */
const ingredients = [
  { name: "Eggs", unit: "per dozen", factor: 12 },
  { name: "Butter", unit: "per kg", factor: 1 },
  { name: "Wheat flour", unit: "per kg", factor: 1 },
  { name: "Sugar", unit: "per kg", factor: 1 },
  { name: "Vanilla", unit: "per L", factor: 1 }
];
const invoices = [
  { supplier: "Millbrook Supplies", date: "2025-09-12", lines: [
    { ingredient: "Eggs", qty: 10, unit: "dozen", price: 6.00 },
    { ingredient: "Butter", qty: 20, unit: "kg", price: 8.00 },
    { ingredient: "Wheat flour", qty: 50, unit: "kg", price: 2.50 },
    { ingredient: "Sugar", qty: 25, unit: "kg", price: 1.80 }
  ] },
  { supplier: "City Mills", date: "2026-03-10", lines: [
    { ingredient: "Eggs", qty: 10, unit: "dozen", price: 5.10 },
    { ingredient: "Butter", qty: 20, unit: "kg", price: 7.40 },
    { ingredient: "Wheat flour", qty: 50, unit: "kg", price: 2.80 },
    { ingredient: "Sugar", qty: 25, unit: "kg", price: 1.85 }
  ] },
  { supplier: "Millbrook Supplies", date: "2026-09-08", lines: [
    { ingredient: "Eggs", qty: 10, unit: "dozen", price: 3.90 },
    { ingredient: "Butter", qty: 20, unit: "kg", price: 6.64 },
    { ingredient: "Wheat flour", qty: 50, unit: "kg", price: 3.10 },
    { ingredient: "Sugar", qty: 25, unit: "kg", price: 1.90 }
  ] }
];
const comparison = supplierComparison(invoices, ingredients);
check("comparison covers all 5 ingredients", comparison.length, 5);
const butter = comparison.find((c) => c.name === "Butter");
check("butter has 2 suppliers", butter.suppliers.length, 2);
check("butter cheapest is Millbrook", butter.cheapest, "Millbrook Supplies");
check("butter sorted cheapest first", butter.suppliers[0].supplier, "Millbrook Supplies");
check("butter Millbrook latest price", butter.suppliers[0].latestPrice, 6.64);
check("butter Millbrook change -17%", butter.suppliers[0].changePct, -17.0);
const flour = comparison.find((c) => c.name === "Wheat flour");
check("flour cheapest is City Mills", flour.cheapest, "City Mills");
check("flour Millbrook jumped 24%",
  flour.suppliers.find((s) => s.supplier === "Millbrook Supplies").changePct, 24.0);
check("flour City Mills has no previous price",
  flour.suppliers.find((s) => s.supplier === "City Mills").changePct, null);
const vanilla = comparison.find((c) => c.name === "Vanilla");
check("ingredient with no invoices has no suppliers", vanilla.suppliers.length, 0);
check("ingredient with no invoices has no cheapest", vanilla.cheapest, null);
const single = supplierComparison(
  [{ supplier: "Only Co", date: "2026-01-01", lines: [
    { ingredient: "Butter", qty: 1, unit: "kg", price: 7.00 } ] }],
  [{ name: "Butter", unit: "per kg", factor: 1 }]);
check("single supplier is the cheapest", single[0].cheapest, "Only Co");
check("single supplier first price has null change", single[0].suppliers[0].changePct, null);
check("comparison with no invoices is empty per ingredient",
  supplierComparison([], ingredients).every((c) => c.suppliers.length === 0), true);

/* Price jumps */
check("jump at exactly 5%", isPriceJump(5), true);
check("jump at 24%", isPriceJump(24.0), true);
check("no jump below 5%", isPriceJump(4.9), false);
check("a drop is not a jump", isPriceJump(-35.0), false);
check("null change is not a jump", isPriceJump(null), false);
check("custom threshold 10%", isPriceJump(8, 10), false);
check("custom threshold 10% met", isPriceJump(12, 10), true);

/* Waste log (v12): values come from the true cost, not ingredients
   alone. Demo figures: $12 an hour, Butter Cake 30 min, Sourdough
   20 min, Lemon Drizzle 25 min; packaging $0.40/$0.15/$0.35;
   overhead $0.50 a unit. */
const newPrices = {
  "Butter": { price: 6.64, factor: 1 },
  "Wheat flour": { price: 3.10, factor: 1 },
  "Eggs": { price: 3.90, factor: 12 },
  "Sugar": { price: 1.90, factor: 1 }
};
const recipesTrue = [
  { id: "r1", name: "Butter Cake", sellPrice: 24.00, targetPct: 60,
    laborMinutes: 30, packaging: 0.40, overhead: 0.50,
    ingredients: recipes[0].ingredients },
  { id: "r2", name: "Sourdough Loaf", sellPrice: 8.00, targetPct: 70,
    laborMinutes: 20, packaging: 0.15, overhead: 0.50,
    ingredients: recipes[1].ingredients },
  { id: "r3", name: "Lemon Drizzle", sellPrice: 18.00, targetPct: 60,
    laborMinutes: 25, packaging: 0.35, overhead: 0.50,
    ingredients: recipes[2].ingredients }
];
const wasteWeek = [
  { id: "w1", date: "2026-11-12", recipeId: "r1", made: 4, sold: 2 },
  { id: "w2", date: "2026-11-15", recipeId: "r2", made: 12, sold: 10 },
  { id: "w3", date: "2026-11-17", recipeId: "r3", made: 3, sold: 2 }
];
check("wasted qty made 4 sold 2", wastedQty(wasteWeek[0]), 2);
check("wasted qty never negative", wastedQty({ made: 2, sold: 4 }), 0);
check("waste value 2 butter cakes", wasteEntryValue(wasteWeek[0], recipesTrue, newPrices, 12), 25.52);
check("waste value 2 sourdough", wasteEntryValue(wasteWeek[1], recipesTrue, newPrices, 12), 13.02);
check("waste value 1 lemon drizzle", wasteEntryValue(wasteWeek[2], recipesTrue, newPrices, 12), 9.80);
check("waste value missing recipe is null",
  wasteEntryValue({ recipeId: "gone", made: 2, sold: 0 }, recipesTrue, newPrices, 12), null);
check("purchases total over 3 invoices", purchasesTotal(invoices), 1149.55);
const weekSummary = wasteSummary(wasteWeek, recipesTrue, newPrices, 12, purchasesTotal(invoices));
check("waste week total", weekSummary.totalValue, 48.34);
check("waste week pct of purchases", weekSummary.pctOfPurchases, 4.2, 0.05);
check("waste week worst product", weekSummary.worst.name, "Butter Cake");
check("waste week worst value", weekSummary.worst.value, 25.52);
check("waste week has 3 days", weekSummary.byDay.length, 3);
check("waste week first day sorted", weekSummary.byDay[0].date, "2026-11-12");
const emptySummary = wasteSummary([], recipesTrue, newPrices, 12, 1149.55);
check("waste summary empty total", emptySummary.totalValue, 0);
check("waste summary empty worst", emptySummary.worst, null);
check("waste summary no purchases pct is null",
  wasteSummary(wasteWeek, recipesTrue, newPrices, 12, 0).pctOfPurchases, null);

/* Inventory (v12) */
check("stock low below par", inventoryStatus({ qty: 8.5, par: 10 }), "low");
check("stock out at zero", inventoryStatus({ qty: 0, par: 5 }), "out");
check("stock ok above par", inventoryStatus({ qty: 42, par: 20 }), "ok");
check("stock ok at par", inventoryStatus({ qty: 5, par: 5 }), "ok");
check("stock ok with no par set", inventoryStatus({ qty: 5, par: 0 }), "ok");
check("stock label low", inventoryStatusLabel("low"), "Low");
check("stock label out", inventoryStatusLabel("out"), "Out");
check("stock label ok", inventoryStatusLabel("ok"), "OK");
check("expiry in 4 days is soon", expiryStatus({ expiry: "2026-11-22" }, TODAY), "soon");
check("expiry today is soon", expiryStatus({ expiry: "2026-11-18" }, TODAY), "soon");
check("expiry in 7 days is soon", expiryStatus({ expiry: "2026-11-25" }, TODAY), "soon");
check("expiry in 8 days is ok", expiryStatus({ expiry: "2026-11-26" }, TODAY), "ok");
check("expiry past is expired", expiryStatus({ expiry: "2026-11-17" }, TODAY), "expired");
check("no expiry is ok", expiryStatus({ expiry: "" }, TODAY), "ok");
check("days to expiry 4", daysToExpiry({ expiry: "2026-11-22" }, TODAY), 4);
check("days to expiry none", daysToExpiry({ expiry: "" }, TODAY), null);
const invRows = [
  { ingredient: "Butter", qty: 8.5, unit: "kg", par: 10, expiry: "2026-11-30" },
  { ingredient: "Eggs", qty: 6, unit: "dozen", par: 5, expiry: "2026-11-22" },
  { ingredient: "Wheat flour", qty: 42, unit: "kg", par: 20, expiry: "2027-01-17" },
  { ingredient: "Sugar", qty: 0, unit: "kg", par: 10, expiry: "" }
];
const invAlerts = inventoryAlerts(invRows, TODAY);
check("inventory alerts count", invAlerts.length, 3);
check("butter low alert", invAlerts.find((a) => a.ingredient === "Butter").kind, "low");
check("eggs soon alert", invAlerts.find((a) => a.ingredient === "Eggs").kind, "soon");
check("sugar out alert", invAlerts.find((a) => a.ingredient === "Sugar").kind, "out");
check("flour has no alert", invAlerts.find((a) => a.ingredient === "Wheat flour"), undefined);
const invStart = [
  { ingredient: "Butter", qty: 8.5, unit: "kg", par: 10, expiry: "2026-11-30" }
];
const invAdded = addInvoiceToInventory(invStart, [
  { ingredient: "Butter", qty: 20, unit: "kg" },
  { ingredient: "Vanilla", qty: 2, unit: "L" }
]);
check("invoice adds to existing stock", invAdded.find((r) => r.ingredient === "Butter").qty, 28.5);
check("invoice starts a row for a new ingredient",
  invAdded.find((r) => r.ingredient === "Vanilla").qty, 2);
check("new row has par 0", invAdded.find((r) => r.ingredient === "Vanilla").par, 0);
check("add invoice does not mutate the input", invStart[0].qty, 8.5);
const invDeducted = deductBakeFromInventory(
  [
    { ingredient: "Butter", qty: 8.5, unit: "kg", par: 10, expiry: "2026-11-30" },
    { ingredient: "Eggs", qty: 6, unit: "dozen", par: 5, expiry: "2026-11-22" },
    { ingredient: "Wheat flour", qty: 42, unit: "kg", par: 20, expiry: "2027-01-17" }
  ],
  [
    { name: "Butter", qty: 2 },
    { name: "Wheat flour", qty: 8.8 },
    { name: "Eggs", qty: 16 }
  ],
  ingredients);
check("bake deducts butter", invDeducted.find((r) => r.ingredient === "Butter").qty, 6.5);
check("bake deducts flour", invDeducted.find((r) => r.ingredient === "Wheat flour").qty, 33.2);
check("bake deducts eggs in dozen", invDeducted.find((r) => r.ingredient === "Eggs").qty, 4.667);
check("deduct clamps at zero",
  deductBakeFromInventory(
    [{ ingredient: "Butter", qty: 1, unit: "kg", par: 10, expiry: "" }],
    [{ name: "Butter", qty: 2 }],
    ingredients)[0].qty, 0);
const invBuilt = inventoryFromInvoices(invoices);
check("built from invoices butter 60 kg", invBuilt.find((r) => r.ingredient === "Butter").qty, 60);
check("built from invoices eggs 30 dozen", invBuilt.find((r) => r.ingredient === "Eggs").qty, 30);
check("built from invoices flour 150 kg", invBuilt.find((r) => r.ingredient === "Wheat flour").qty, 150);
check("built from invoices sugar 75 kg", invBuilt.find((r) => r.ingredient === "Sugar").qty, 75);

console.log("\n" + passed + " passed, " + failed + " failed.");
process.exit(failed === 0 ? 0 : 1);
