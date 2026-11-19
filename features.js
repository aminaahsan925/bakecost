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

import { priceChangePct, roundTo, trueCost } from "./costing.js";

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

/* ---------- waste log (v12) ---------- */

// Waste entry: { id, date, recipeId, made, sold }.
// date is YYYY-MM-DD. Wasted qty is made minus sold, never below
// zero (selling more than was made counts as no waste, not negative
// waste). The value is wasted qty times the recipe's true cost.

// Wasted quantity for one entry.
export function wastedQty(entry) {
  var made = Number(entry.made) || 0;
  var sold = Number(entry.sold) || 0;
  return Math.max(0, made - sold);
}

// Waste value in $ for one entry, at the recipe's true cost.
// prices: { name: { price, factor } }. Returns null when the recipe
// is missing or has no price.
export function wasteEntryValue(entry, recipes, prices, laborRate) {
  var recipe = recipeById(recipes, entry.recipeId);
  if (!recipe) return null;
  var cost = trueCost(recipe, prices, laborRate);
  if (!cost) return null;
  return roundTo(wastedQty(entry) * cost.total, 2);
}

// Total value of all purchases on record, from invoice lines.
export function purchasesTotal(invoices) {
  var total = 0;
  invoices.forEach(function (inv) {
    inv.lines.forEach(function (line) {
      total += line.qty * line.price;
    });
  });
  return roundTo(total, 2);
}

// Summary over a list of waste entries (already filtered to the
// range the caller wants, for example the last 7 days):
// { totalValue, byDay, worst, pctOfPurchases }.
// byDay is [{ date, value }] sorted by date, one row per day with
// an entry. worst is { recipeId, name, value } for the recipe with
// the most waste value, or null when there is no waste.
// pctOfPurchases is waste value as a percent of purchasesTotal, or
// null when purchases total is zero.
export function wasteSummary(entries, recipes, prices, laborRate, purchases) {
  var byDayMap = {};
  var byRecipeMap = {};
  var total = 0;
  entries.forEach(function (entry) {
    var value = wasteEntryValue(entry, recipes, prices, laborRate);
    if (value === null) return;
    total += value;
    byDayMap[entry.date] = roundTo((byDayMap[entry.date] || 0) + value, 2);
    var recipe = recipeById(recipes, entry.recipeId);
    var key = entry.recipeId;
    if (!byRecipeMap[key]) {
      byRecipeMap[key] = {
        recipeId: entry.recipeId,
        name: recipe ? recipe.name : "Recipe removed",
        value: 0
      };
    }
    byRecipeMap[key].value = roundTo(byRecipeMap[key].value + value, 2);
  });
  var byDay = Object.keys(byDayMap).sort().map(function (date) {
    return { date: date, value: byDayMap[date] };
  });
  var worst = null;
  Object.keys(byRecipeMap).forEach(function (key) {
    var row = byRecipeMap[key];
    if (row.value > 0 && (!worst || row.value > worst.value)) worst = row;
  });
  return {
    totalValue: roundTo(total, 2),
    byDay: byDay,
    worst: worst,
    pctOfPurchases: purchases > 0 ? roundTo((total / purchases) * 100, 1) : null
  };
}

/* ---------- ingredient inventory (v12) ---------- */

// Inventory row: { ingredient, qty, unit, par, expiry }.
// qty is in display units (kg, or dozen for eggs), matching the
// invoice lines. par is the reorder level in the same units.
// expiry is YYYY-MM-DD or "" when the baker has not set one.

// Stock status: "out" at zero, "low" below par, "ok" otherwise.
// A par of zero means no reorder level is set, so any stock is ok.
export function inventoryStatus(row) {
  var qty = Number(row.qty) || 0;
  var par = Number(row.par) || 0;
  if (qty <= 0) return "out";
  if (par > 0 && qty < par) return "low";
  return "ok";
}

export function inventoryStatusLabel(status) {
  if (status === "out") return "Out";
  if (status === "low") return "Low";
  return "OK";
}

// Expiry status against today's date (YYYY-MM-DD string).
// "expired": past the date. "soon": within 7 days, today included.
// "ok": more than 7 days away, or no expiry set.
export function expiryStatus(row, today) {
  if (!row.expiry) return "ok";
  if (row.expiry < today) return "expired";
  var msPerDay = 24 * 60 * 60 * 1000;
  var days = Math.round((Date.parse(row.expiry) - Date.parse(today)) / msPerDay);
  if (days <= 7) return "soon";
  return "ok";
}

// Days from today until the expiry date, or null with no expiry.
export function daysToExpiry(row, today) {
  if (!row.expiry) return null;
  var msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((Date.parse(row.expiry) - Date.parse(today)) / msPerDay);
}

// Low-stock and expiry alerts for the Alerts feed.
// Returns [{ kind, ingredient, qty, unit, par, daysLeft }] where
// kind is "low", "out" or "soon". Rows that are out also count as
// low, but only one alert is raised per row (out wins).
export function inventoryAlerts(inventory, today) {
  var alerts = [];
  inventory.forEach(function (row) {
    var status = inventoryStatus(row);
    if (status === "out") {
      alerts.push({
        kind: "out", ingredient: row.ingredient,
        qty: Number(row.qty) || 0, unit: row.unit,
        par: Number(row.par) || 0, daysLeft: daysToExpiry(row, today)
      });
    } else if (status === "low") {
      alerts.push({
        kind: "low", ingredient: row.ingredient,
        qty: Number(row.qty) || 0, unit: row.unit,
        par: Number(row.par) || 0, daysLeft: daysToExpiry(row, today)
      });
    }
    if (expiryStatus(row, today) === "soon" || expiryStatus(row, today) === "expired") {
      alerts.push({
        kind: "soon", ingredient: row.ingredient,
        qty: Number(row.qty) || 0, unit: row.unit,
        par: Number(row.par) || 0, daysLeft: daysToExpiry(row, today)
      });
    }
  });
  return alerts;
}

// Add an invoice's lines to stock. Lines are in canonical display
// units (kg, dozen), the same units inventory rows use, so no
// conversion is needed. A line for an ingredient with no row yet
// starts a row with par 0 and no expiry. Returns a new array; the
// input is not mutated.
export function addInvoiceToInventory(inventory, lines) {
  var next = inventory.map(function (row) {
    return {
      ingredient: row.ingredient, qty: row.qty, unit: row.unit,
      par: row.par, expiry: row.expiry, isSample: row.isSample
    };
  });
  lines.forEach(function (line) {
    var qty = Number(line.qty) || 0;
    if (!(qty > 0)) return;
    var found = null;
    for (var i = 0; i < next.length; i++) {
      if (next[i].ingredient === line.ingredient) found = next[i];
    }
    if (found) {
      found.qty = roundTo((Number(found.qty) || 0) + qty, 3);
    } else {
      next.push({
        ingredient: line.ingredient, qty: roundTo(qty, 3),
        unit: line.unit || "kg", par: 0, expiry: ""
      });
    }
  });
  return next;
}

// Deduct a bake's ingredient totals from stock. Totals are in base
// units (kg, or single eggs), so they are converted to display units
// with the ingredient's factor (eggs: 12 singles to a dozen). Stock
// never goes below zero: a bake bigger than the stock on hand empties
// the row. Returns a new array; the input is not mutated.
export function deductBakeFromInventory(inventory, totals, ingredients) {
  var factorByName = {};
  ingredients.forEach(function (ing) {
    factorByName[ing.name] = ing.factor || 1;
  });
  return inventory.map(function (row) {
    var used = null;
    for (var i = 0; i < totals.length; i++) {
      if (totals[i].name === row.ingredient) used = totals[i];
    }
    if (!used) return {
      ingredient: row.ingredient, qty: row.qty, unit: row.unit,
      par: row.par, expiry: row.expiry, isSample: row.isSample
    };
    var factor = factorByName[row.ingredient] || 1;
    var usedDisplay = used.qty / factor;
    return {
      ingredient: row.ingredient,
      qty: Math.max(0, roundTo((Number(row.qty) || 0) - usedDisplay, 3)),
      unit: row.unit, par: row.par, expiry: row.expiry, isSample: row.isSample
    };
  });
}

// Build starting stock from all invoices on record: every line adds
// its quantity. Used by the empty state, so a baker with invoices
// but no stock rows can start from what they bought.
export function inventoryFromInvoices(invoices) {
  return addInvoiceToInventory([], invoices.reduce(function (all, inv) {
    return all.concat(inv.lines);
  }, []));
}
