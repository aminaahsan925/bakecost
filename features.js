// BakeCost v5 feature logic: orders, bake-day planner, supplier
// comparison. Pure functions, no DOM access. ES module, so the same
// file runs in the browser app and in the Node tests.
//
// Data shapes:
//   order: { id, customer, dueDate, items: [{ recipeId, qty }],
//            depositPaid }
//     dueDate is YYYY-MM-DD. depositPaid is money already taken.
//   recipe: { id, name, sellPrice, targetPct,
//             ingredients: [{ name, qty }] }
//     ingredient quantities are in base units (kg, or single eggs).
//   bake plan item: { recipeId, qty }
//     qty is how many of the recipe to bake that day.
//   invoice: { supplier, date, lines: [{ ingredient, qty, unit, price }] }

import { priceChangePct, roundTo } from "./costing.js";

export function recipeById(recipes, id) {
  for (var i = 0; i < recipes.length; i++) {
    if (recipes[i].id === id) return recipes[i];
  }
  return null;
}

/* ---------- orders ---------- */

// Order total from the recipes' selling prices. Returns null when
// any item's recipe is missing (for example it was deleted), so the
// app can say the total is unknown instead of showing a wrong number.
export function orderTotal(order, recipes) {
  var total = 0;
  for (var i = 0; i < order.items.length; i++) {
    var item = order.items[i];
    var recipe = recipeById(recipes, item.recipeId);
    if (!recipe) return null;
    var qty = Number(item.qty);
    if (qty > 0) total += recipe.sellPrice * qty;
  }
  return total;
}

// Money for an order: { total, deposit, balance }. Balance is total
// minus deposit, rounded to cents. Null when the total is unknown.
export function orderMoney(order, recipes) {
  var total = orderTotal(order, recipes);
  var deposit = Number(order.depositPaid) || 0;
  return {
    total: total,
    deposit: deposit,
    balance: total === null ? null : roundTo(total - deposit, 2)
  };
}

// Order status against today's date (YYYY-MM-DD string).
// Returns { status, overdue }:
//   "paid": nothing left to collect.
//   "balance due": a deposit was taken, money is still owed.
//   "deposit due": no deposit taken yet, the full total is owed.
//   "unknown": a recipe is missing, so the total is unknown.
// overdue is true when money is still owed past the due date.
export function orderStatus(order, recipes, today) {
  var money = orderMoney(order, recipes);
  if (money.total === null) return { status: "unknown", overdue: false };
  if (money.balance <= 0) return { status: "paid", overdue: false };
  var status = money.deposit > 0 ? "balance due" : "deposit due";
  var overdue = !!order.dueDate && order.dueDate < today;
  return { status: status, overdue: overdue };
}

export function orderStatusLabel(status) {
  if (status === "paid") return "Paid";
  if (status === "balance due") return "Balance due";
  if (status === "deposit due") return "Deposit due";
  return "Unknown total";
}

// Total money still owed across a list of orders.
export function outstandingBalance(orders, recipes) {
  var sum = 0;
  orders.forEach(function (order) {
    var money = orderMoney(order, recipes);
    if (money.balance !== null && money.balance > 0) sum += money.balance;
  });
  return roundTo(sum, 2);
}

/* ---------- bake-day planner ---------- */

// Aggregate a bake plan into total ingredient quantities in base
// units (kg, or single eggs). planItems: [{ recipeId, qty }].
// Returns [{ name, qty }] sorted by name. Items whose recipe is
// missing, or with a quantity at or below zero, are skipped.
export function aggregateBakeDay(planItems, recipes) {
  var totals = {};
  planItems.forEach(function (item) {
    var qty = Number(item.qty);
    if (!(qty > 0)) return;
    var recipe = recipeById(recipes, item.recipeId);
    if (!recipe) return;
    recipe.ingredients.forEach(function (ing) {
      totals[ing.name] = (totals[ing.name] || 0) + ing.qty * qty;
    });
  });
  return Object.keys(totals).sort().map(function (name) {
    return { name: name, qty: roundTo(totals[name], 3) };
  });
}

// Dozens to buy for an egg quantity counted in singles. A baker buys
// whole dozens, so 16 singles means buying 2 dozen.
export function dozensToBuy(singles) {
  return Math.ceil(singles / 12);
}

/* ---------- supplier comparison ---------- */

// Per-ingredient price comparison across suppliers, from invoices.
// Returns [{ name, unit, suppliers, cheapest }]:
//   suppliers: [{ supplier, latestPrice, latestDate, prevPrice,
//     prevDate, changePct }] sorted cheapest first. changePct is the
//     move since that supplier's previous invoice for the ingredient,
//     or null when it is the supplier's first price.
//   cheapest: the supplier name with the lowest latest price, or
//     null when there are no prices.
export function supplierComparison(invoices, ingredients) {
  var unitByName = {};
  ingredients.forEach(function (ing) { unitByName[ing.name] = ing.unit; });
  // byIngredient[name][supplier] = [{ date, price }]
  var byIngredient = {};
  invoices.forEach(function (inv) {
    var supplier = inv.supplier || "Unknown supplier";
    inv.lines.forEach(function (line) {
      if (!byIngredient[line.ingredient]) byIngredient[line.ingredient] = {};
      if (!byIngredient[line.ingredient][supplier]) {
        byIngredient[line.ingredient][supplier] = [];
      }
      byIngredient[line.ingredient][supplier].push({ date: inv.date, price: line.price });
      if (!unitByName[line.ingredient]) {
        unitByName[line.ingredient] = "per " + (line.unit || "kg");
      }
    });
  });
  // Include ingredients with no invoices yet, so the view can say
  // there are no prices instead of hiding the ingredient.
  ingredients.forEach(function (ing) {
    if (!byIngredient[ing.name]) byIngredient[ing.name] = {};
  });
  return Object.keys(byIngredient).sort().map(function (name) {
    var suppliers = Object.keys(byIngredient[name]).map(function (supplier) {
      var points = byIngredient[name][supplier].slice().sort(function (a, b) {
        return a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
      });
      var latest = points[points.length - 1];
      var prev = points.length > 1 ? points[points.length - 2] : null;
      return {
        supplier: supplier,
        latestPrice: latest.price,
        latestDate: latest.date,
        prevPrice: prev ? prev.price : null,
        prevDate: prev ? prev.date : null,
        changePct: prev ? priceChangePct(prev.price, latest.price) : null
      };
    });
    suppliers.sort(function (a, b) { return a.latestPrice - b.latestPrice; });
    return {
      name: name,
      unit: unitByName[name],
      suppliers: suppliers,
      cheapest: suppliers.length > 0 ? suppliers[0].supplier : null
    };
  });
}

// A price jump: the supplier's price rose at or above thresholdPct
// since its previous invoice. thresholdPct defaults to 5, the same
// threshold the alerts view uses for price moves.
export function isPriceJump(changePct, thresholdPct) {
  var threshold = thresholdPct === undefined ? 5 : thresholdPct;
  return changePct !== null && changePct !== undefined && changePct >= threshold;
}
