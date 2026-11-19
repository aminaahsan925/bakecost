// BakeCost costing logic. Pure functions, no DOM access.
// ES module, so the same file runs in the browser app and in the Node tests.
//
// Data shapes used across the app:
//   ingredient: { name, unit, factor }
//     unit is the display unit on invoices, for example "per kg" or
//     "per dozen". factor converts the display price to a price per base
//     unit used by recipes. Eggs are priced per dozen but recipes count
//     single eggs, so factor 12.
//   invoice line: { ingredient, qty, unit, price }
//     qty is in canonical display units, unit is the display unit key
//     ("kg", "dozen"), price is the unit price per display unit.
//   price point: { date, price }, date as YYYY-MM-DD.
//   recipe: { name, sellPrice, targetPct, ingredients: [{ name, qty }] }
//     quantities are in base units (kg, or single eggs).

// Price per display unit, converted to price per base unit.
export function pricePerBaseUnit(price, factor) {
  return price / factor;
}

// Cost of one recipe line: quantity (in base units) times price per base unit.
export function lineCost(qty, pricePerDisplayUnit, factor) {
  return qty * pricePerBaseUnit(pricePerDisplayUnit, factor);
}

// Total ingredient cost of a recipe at a given price set.
// prices: { name: { price, factor } } (price per display unit)
// Returns null if any ingredient has no price.
export function recipeCost(recipe, prices) {
  var total = 0;
  for (var i = 0; i < recipe.ingredients.length; i++) {
    var ing = recipe.ingredients[i];
    var p = prices[ing.name];
    if (!p) return null;
    total += lineCost(ing.qty, p.price, p.factor);
  }
  return total;
}

// Labor cost for a recipe: minutes of hands-on time at an hourly
// rate. Minutes and rate default to zero when missing, so a recipe
// with no labor recorded costs its ingredients only.
export function laborCost(laborMinutes, hourlyRate) {
  var minutes = Number(laborMinutes) || 0;
  var rate = Number(hourlyRate) || 0;
  if (minutes <= 0 || rate <= 0) return 0;
  return (minutes / 60) * rate;
}

// True cost of one unit of a recipe: ingredients + labor +
// packaging + overhead. Recipe fields laborMinutes, packaging and
// overhead are per unit; the hourly rate is one rate for the whole
// bakery, passed in. Returns null if any ingredient has no price,
// else { ingredients, labor, packaging, overhead, total }, each
// rounded to cents. The total is the sum of the rounded parts, so
// the breakdown always adds up exactly as displayed.
export function trueCost(recipe, prices, hourlyRate) {
  var ingredients = recipeCost(recipe, prices);
  if (ingredients === null) return null;
  var parts = {
    ingredients: roundTo(ingredients, 2),
    labor: roundTo(laborCost(recipe.laborMinutes, hourlyRate), 2),
    packaging: roundTo(Number(recipe.packaging) || 0, 2),
    overhead: roundTo(Number(recipe.overhead) || 0, 2)
  };
  parts.total = roundTo(
    parts.ingredients + parts.labor + parts.packaging + parts.overhead, 2);
  return parts;
}

// Margin in money and percent at a selling price. Returns { amount, pct }.
export function margin(cost, sellPrice) {
  var amount = sellPrice - cost;
  var pct = sellPrice > 0 ? (amount / sellPrice) * 100 : 0;
  return { amount: amount, pct: pct };
}

// Percent change from old to new price. Returns null if old is 0 or missing.
export function priceChangePct(oldPrice, newPrice) {
  if (oldPrice === null || oldPrice === undefined || oldPrice === 0) return null;
  return ((newPrice - oldPrice) / oldPrice) * 100;
}

// Latest price point for an ingredient from a list of { date, price } points.
// Points are compared by date string (YYYY-MM-DD sorts correctly).
export function latestPoint(points) {
  if (!points || points.length === 0) return null;
  var best = points[0];
  for (var i = 1; i < points.length; i++) {
    if (points[i].date >= best.date) best = points[i];
  }
  return best;
}

// Earliest price point for an ingredient.
export function earliestPoint(points) {
  if (!points || points.length === 0) return null;
  var best = points[0];
  for (var i = 1; i < points.length; i++) {
    if (points[i].date < best.date) best = points[i];
  }
  return best;
}

// Second latest price point, or null when fewer than two points exist.
export function previousPoint(points) {
  if (!points || points.length < 2) return null;
  var sorted = points.slice().sort(function (a, b) {
    return a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
  });
  return sorted[sorted.length - 2];
}

// Margin status against a target, with a 5 point watch band below target.
// "ok": at or above target. "watch": below target but within 5 points.
// "alert": more than 5 points below target. "unknown": no margin (no price).
export function marginStatus(marginPct, targetPct) {
  if (marginPct === null || marginPct === undefined) return "unknown";
  if (marginPct >= targetPct) return "ok";
  if (marginPct >= targetPct - 5) return "watch";
  return "alert";
}

export function statusLabel(status) {
  if (status === "ok") return "On target";
  if (status === "watch") return "Near target";
  if (status === "alert") return "Below target";
  return "No price yet";
}

// Biggest price movers across ingredients, sorted by absolute change.
// histories: [{ name, unit, points: [{ date, price }] }]
// Returns [{ name, unit, first, last, changePct }] with changePct null
// when fewer than two points exist. Entries with no measurable change
// sort last.
export function biggestMovers(histories) {
  var movers = histories.map(function (h) {
    var first = earliestPoint(h.points);
    var last = latestPoint(h.points);
    var change = (h.points.length < 2 || !first || !last)
      ? null
      : priceChangePct(first.price, last.price);
    return {
      name: h.name,
      unit: h.unit,
      first: first ? first.price : null,
      last: last ? last.price : null,
      firstDate: first ? first.date : null,
      lastDate: last ? last.date : null,
      changePct: change
    };
  });
  movers.sort(function (a, b) {
    var av = a.changePct === null ? -1 : Math.abs(a.changePct);
    var bv = b.changePct === null ? -1 : Math.abs(b.changePct);
    return bv - av;
  });
  return movers;
}

// Margin alerts for recipes below their target.
// rows: [{ name, marginPct, targetPct, sellPrice, cost }]
// Returns only the below-target rows, worst shortfall first, each with
// a status and the points short of target.
export function marginAlerts(rows) {
  return rows
    .filter(function (r) {
      return r.marginPct !== null && r.marginPct !== undefined && r.marginPct < r.targetPct;
    })
    .map(function (r) {
      return {
        name: r.name,
        marginPct: r.marginPct,
        targetPct: r.targetPct,
        sellPrice: r.sellPrice,
        cost: r.cost,
        shortfall: r.targetPct - r.marginPct,
        status: marginStatus(r.marginPct, r.targetPct)
      };
    })
    .sort(function (a, b) { return b.shortfall - a.shortfall; });
}

// Price moves since the previous point that cross a threshold.
// histories: [{ name, unit, points: [{ date, price }] }]
// Returns [{ name, unit, from, to, changePct, date }] for moves at or
// above thresholdPct in absolute terms, largest first.
export function recentMoves(histories, thresholdPct) {
  var moves = [];
  histories.forEach(function (h) {
    var last = latestPoint(h.points);
    var prev = previousPoint(h.points);
    if (!last || !prev) return;
    var change = priceChangePct(prev.price, last.price);
    if (change !== null && Math.abs(change) >= thresholdPct) {
      moves.push({
        name: h.name,
        unit: h.unit,
        from: prev.price,
        to: last.price,
        changePct: change,
        date: last.date
      });
    }
  });
  moves.sort(function (a, b) { return Math.abs(b.changePct) - Math.abs(a.changePct); });
  return moves;
}

// Round half up to a number of decimal places. The tiny epsilon counters
// floating point dust (for example 3.945 stored as 3.9449999999999998),
// so money values display the way a person would round them.
export function roundTo(value, places) {
  var factor = Math.pow(10, places);
  return Math.sign(value) * Math.round(Math.abs(value) * factor + 1e-9) / factor;
}

// Money formatting: $12.34, two decimals, minus sign for negatives.
export function money(value) {
  if (value === null || value === undefined) return "n/a";
  var rounded = roundTo(value, 2);
  var sign = rounded < 0 ? "-" : "";
  return sign + "$" + Math.abs(rounded).toFixed(2);
}

// Percent formatting: one decimal, with sign, e.g. +24.0% or -35.0%.
export function pct(value) {
  if (value === null || value === undefined) return "n/a";
  var rounded = roundTo(value, 1);
  var sign = rounded > 0 ? "+" : "";
  return sign + rounded.toFixed(1) + "%";
}

function csvCell(text) {
  var s = text === null || text === undefined ? "" : String(text);
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

// Build the CSV text for the recipe costing table.
// rows: [{ recipe, costThen, costNow, sellPrice, marginAmount, marginPct }]
export function buildCSV(rows) {
  var lines = ["Recipe,Cost then,Cost now,Change,Selling price,Margin now,Margin now %"];
  rows.forEach(function (r) {
    var change = (r.costNow === null || r.costThen === null)
      ? null : r.costNow - r.costThen;
    lines.push([
      csvCell(r.recipe),
      r.costThen === null ? "" : roundTo(r.costThen, 2).toFixed(2),
      r.costNow === null ? "" : roundTo(r.costNow, 2).toFixed(2),
      change === null ? "" : roundTo(change, 2).toFixed(2),
      roundTo(r.sellPrice, 2).toFixed(2),
      r.marginAmount === null ? "" : roundTo(r.marginAmount, 2).toFixed(2),
      r.marginPct === null ? "" : roundTo(r.marginPct, 1).toFixed(1)
    ].join(","));
  });
  return lines.join("\n") + "\n";
}

// Build the CSV text for the full price history.
// histories: [{ name, unit, points: [{ date, price }] }]
export function buildPriceCSV(histories) {
  var lines = ["Ingredient,Unit,Date,Price"];
  histories.forEach(function (h) {
    var sorted = h.points.slice().sort(function (a, b) {
      return a.date < b.date ? -1 : 1;
    });
    sorted.forEach(function (p) {
      lines.push([
        csvCell(h.name),
        csvCell(h.unit),
        p.date,
        roundTo(p.price, 2).toFixed(2)
      ].join(","));
    });
  });
  return lines.join("\n") + "\n";
}

// Build the CSV text for all invoice lines.
// invoices: [{ supplier, date, lines: [{ ingredient, qty, unit, price }] }]
export function buildInvoiceCSV(invoices) {
  var lines = ["Supplier,Date,Ingredient,Quantity,Unit,Unit price,Line total"];
  invoices.forEach(function (inv) {
    inv.lines.forEach(function (line) {
      lines.push([
        csvCell(inv.supplier),
        inv.date,
        csvCell(line.ingredient),
        line.qty,
        csvCell(line.unit),
        roundTo(line.price, 2).toFixed(2),
        roundTo(line.qty * line.price, 2).toFixed(2)
      ].join(","));
    });
  });
  return lines.join("\n") + "\n";
}
