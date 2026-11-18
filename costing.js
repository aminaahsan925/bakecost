/* BakeCost costing logic. Pure functions, no DOM access.
   Works in the browser (window.BakeCost) and in Node (module.exports), so the
   maths can be tested without a browser. */

(function (root) {
  "use strict";

  // Price per display unit, converted to price per base unit.
  // Eggs are priced per dozen but recipes use single eggs, so factor 12.
  function pricePerBaseUnit(price, factor) {
    return price / factor;
  }

  // Cost of one recipe line: quantity (in base units) times price per base unit.
  function lineCost(qty, pricePerDisplayUnit, factor) {
    return qty * pricePerBaseUnit(pricePerDisplayUnit, factor);
  }

  // Total ingredient cost of a recipe at a given price set.
  // recipe: { ingredients: [{ name, qty }] }
  // prices: { name: { price, factor } } (price per display unit)
  // Returns null if any ingredient has no price.
  function recipeCost(recipe, prices) {
    var total = 0;
    for (var i = 0; i < recipe.ingredients.length; i++) {
      var ing = recipe.ingredients[i];
      var p = prices[ing.name];
      if (!p) return null;
      total += lineCost(ing.qty, p.price, p.factor);
    }
    return total;
  }

  // Margin in money and percent at a selling price. Returns { amount, pct }.
  function margin(cost, sellPrice) {
    var amount = sellPrice - cost;
    var pct = sellPrice > 0 ? (amount / sellPrice) * 100 : 0;
    return { amount: amount, pct: pct };
  }

  // Percent change from old to new price. Returns null if old is 0 or missing.
  function priceChangePct(oldPrice, newPrice) {
    if (oldPrice === null || oldPrice === undefined || oldPrice === 0) return null;
    return ((newPrice - oldPrice) / oldPrice) * 100;
  }

  // Latest price point for an ingredient from a list of { date, price } points.
  // Points are compared by date string (YYYY-MM-DD sorts correctly).
  function latestPoint(points) {
    if (!points || points.length === 0) return null;
    var best = points[0];
    for (var i = 1; i < points.length; i++) {
      if (points[i].date >= best.date) best = points[i];
    }
    return best;
  }

  // Earliest price point for an ingredient.
  function earliestPoint(points) {
    if (!points || points.length === 0) return null;
    var best = points[0];
    for (var i = 1; i < points.length; i++) {
      if (points[i].date < best.date) best = points[i];
    }
    return best;
  }

  // Round half up to a number of decimal places. The tiny epsilon counters
  // floating point dust (for example 3.945 stored as 3.9449999999999998),
  // so money values display the way a person would round them.
  function roundTo(value, places) {
    var factor = Math.pow(10, places);
    return Math.sign(value) * Math.round(Math.abs(value) * factor + 1e-9) / factor;
  }

  // Money formatting: $12.34, two decimals, minus sign for negatives.
  function money(value) {
    var rounded = roundTo(value, 2);
    var sign = rounded < 0 ? "-" : "";
    return sign + "$" + Math.abs(rounded).toFixed(2);
  }

  // Percent formatting: one decimal, with sign, e.g. +24.0% or -35.0%.
  function pct(value) {
    if (value === null || value === undefined) return "n/a";
    var rounded = roundTo(value, 1);
    var sign = rounded > 0 ? "+" : "";
    return sign + rounded.toFixed(1) + "%";
  }

  // Build the CSV text for the costing table.
  // rows: [{ recipe, costThen, costNow, sellPrice, marginAmount, marginPct }]
  function buildCSV(rows) {
    var lines = ["Recipe,Cost then,Cost now,Change,Selling price,Margin now,Margin now %"];
    rows.forEach(function (r) {
      var change = r.costNow - r.costThen;
      lines.push([
        csvCell(r.recipe),
        roundTo(r.costThen, 2).toFixed(2),
        roundTo(r.costNow, 2).toFixed(2),
        roundTo(change, 2).toFixed(2),
        roundTo(r.sellPrice, 2).toFixed(2),
        roundTo(r.marginAmount, 2).toFixed(2),
        roundTo(r.marginPct, 1).toFixed(1)
      ].join(","));
    });
    return lines.join("\n") + "\n";
  }

  function csvCell(text) {
    if (/[",\n]/.test(text)) return '"' + text.replace(/"/g, '""') + '"';
    return text;
  }

  var api = {
    pricePerBaseUnit: pricePerBaseUnit,
    lineCost: lineCost,
    recipeCost: recipeCost,
    margin: margin,
    priceChangePct: priceChangePct,
    latestPoint: latestPoint,
    earliestPoint: earliestPoint,
    roundTo: roundTo,
    money: money,
    pct: pct,
    buildCSV: buildCSV
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.BakeCost = api;
  }
})(typeof self !== "undefined" ? self : this);
