// BakeCost local invoice parser (demo mode fallback).
// A small deterministic parser, not AI. It exists so the app stays fully
// usable without a Firebase project. When Firebase is wired up, Gemini
// does the extraction instead and this file is only used if the AI call
// fails and the user chooses the local parser.
//
// Input: pasted invoice text, one item per line. Output:
//   { supplier, date, lines, skipped }
//   supplier: string, or "" when nothing looks like a supplier name.
//   date: ISO date "YYYY-MM-DD", or "" when no date is found.
//   lines: [{ ingredient, qty, unit, price, uncertain }]
//     qty is in canonical display units, unit is the canonical display
//     unit key ("kg", "dozen"), price is the unit price per display unit.
//     uncertain is true when the line needed a guess (missing unit, or an
//     ingredient name that did not match a known ingredient).
//   skipped: lines that were ignored, with a short reason each.
//
// Price rule for pasted lines: a price after "@", "at", "per" or "each"
// is a unit price. A bare trailing price next to a quantity is treated
// as the line total, and the unit price is total divided by quantity.
// A bare price with no quantity is a unit price for one unit.

var UNIT_ALIASES = {
  kilogram: "kg", kilograms: "kg", kilo: "kg", kilos: "kg",
  gram: "g", grams: "g", gm: "g", gms: "g",
  litre: "l", litres: "l", liter: "l", liters: "l", lt: "l",
  millilitre: "ml", millilitres: "ml", milliliter: "ml", milliliters: "ml",
  dozen: "dozen", dz: "dozen",
  each: "each", ea: "each", piece: "each", pieces: "each", pc: "each", pcs: "each",
  pack: "pack", packs: "pack", box: "box", boxes: "box",
  bag: "bag", bags: "bag", bottle: "bottle", bottles: "bottle",
  tray: "tray", trays: "tray", sack: "sack", sacks: "sack"
};

// Conversion groups. Within a group, prices convert by the ratio of the
// "per base" factors: price per A = price per B * (factorA / factorB)
// where factor is how many base units one of that unit holds.
var UNIT_GROUPS = {
  weight: { base: "g", units: { g: 1, kg: 1000 } },
  volume: { base: "ml", units: { ml: 1, l: 1000 } },
  count: { base: "each", units: { each: 1, dozen: 12 } }
};

var KNOWN_UNITS = Object.keys(UNIT_ALIASES).concat(["kg", "g", "l", "ml"]);

// Lines that are never items: totals, taxes, headers, footers.
var SKIP_PATTERNS = [
  /\b(subtotal|total|grand total|amount due|balance due)\b/i,
  /\b(vat|gst|sales tax|tax)\b/i,
  /\b(delivery|shipping|freight|discount)\b/i,
  /\b(invoice|receipt|order)\s*(no|number|#|date)?\s*:?\s*\d/i,
  /\b(thank you|thanks|payment due|due date)\b/i,
  /^[\s\-_=+*#]+$/
];

var MONTHS = {
  jan: "01", january: "01", feb: "02", february: "02", mar: "03", march: "03",
  apr: "04", april: "04", may: "05", jun: "06", june: "06", jul: "07",
  july: "07", aug: "08", august: "08", sep: "09", sept: "09",
  september: "09", oct: "10", october: "10", nov: "11", november: "11",
  dec: "12", december: "12"
};

export function normalizeUnit(raw) {
  if (!raw) return "";
  var key = String(raw).toLowerCase().replace(/\.$/, "").trim();
  return UNIT_ALIASES[key] || key;
}

// Convert a unit price from one unit to another within the same group.
// Returns the converted price, or null when the units do not convert.
export function convertPrice(price, fromUnit, toUnit) {
  var from = normalizeUnit(fromUnit);
  var to = normalizeUnit(toUnit);
  if (!from || !to || from === to) return price;
  var groups = Object.keys(UNIT_GROUPS);
  for (var i = 0; i < groups.length; i++) {
    var units = UNIT_GROUPS[groups[i]].units;
    if (units[from] !== undefined && units[to] !== undefined) {
      // Price per "to" = price per "from" * (units in "to" / units in "from").
      return price * (units[to] / units[from]);
    }
  }
  return null;
}

// Display unit key ("per kg") to unit key ("kg").
export function displayUnitKey(displayUnit) {
  if (!displayUnit) return "";
  return normalizeUnit(String(displayUnit).replace(/^per\s+/i, "").trim());
}

function titleCase(text) {
  return text
    .split(" ")
    .filter(Boolean)
    .map(function (word) {
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

// Match a parsed name against known ingredient names. Exact match first,
// then a contains match either way. Returns the known name or null.
export function matchIngredient(name, knownIngredients) {
  if (!name) return null;
  var lower = name.toLowerCase().trim();
  for (var i = 0; i < knownIngredients.length; i++) {
    if (knownIngredients[i].name.toLowerCase() === lower) {
      return knownIngredients[i].name;
    }
  }
  for (var j = 0; j < knownIngredients.length; j++) {
    var known = knownIngredients[j].name.toLowerCase();
    if (lower.indexOf(known) !== -1 || known.indexOf(lower) !== -1) {
      return knownIngredients[j].name;
    }
  }
  return null;
}

function pad2(n) {
  return (n < 10 ? "0" : "") + n;
}

function isValidDate(y, m, d) {
  if (y < 1900 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return false;
  var dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

// Find a date in a line of text. Supports ISO, DD/MM/YYYY, MM/DD/YYYY
// is not guessed (day first is assumed when the first number is over 12,
// otherwise DD/MM), and "12 Sep 2026" / "Sep 12, 2026" forms.
export function parseDateFromText(text) {
  if (!text) return "";
  var m = text.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) {
    var y = parseInt(m[1], 10), mo = parseInt(m[2], 10), d = parseInt(m[3], 10);
    if (isValidDate(y, mo, d)) return y + "-" + pad2(mo) + "-" + pad2(d);
  }
  m = text.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
  if (m) {
    var a = parseInt(m[1], 10), b = parseInt(m[2], 10);
    var year = parseInt(m[3], 10);
    if (year < 100) year += 2000;
    // Day first, unless the first number cannot be a day.
    var day = a, month = b;
    if (a > 12 && b <= 12) { day = a; month = b; }
    else if (b > 12 && a <= 12) { day = b; month = a; }
    if (isValidDate(year, month, day)) return year + "-" + pad2(month) + "-" + pad2(day);
  }
  m = text.match(/(\d{1,2})\s+([A-Za-z]+)\s*,?\s*(\d{4})/);
  if (m) {
    var mon = MONTHS[m[2].toLowerCase()];
    if (mon) {
      var yy = parseInt(m[3], 10), dd = parseInt(m[1], 10), mm = parseInt(mon, 10);
      if (isValidDate(yy, mm, dd)) return yy + "-" + mon + "-" + pad2(dd);
    }
  }
  m = text.match(/([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})/);
  if (m) {
    var mon2 = MONTHS[m[1].toLowerCase()];
    if (mon2) {
      var yy2 = parseInt(m[3], 10), dd2 = parseInt(m[2], 10), mm2 = parseInt(mon2, 10);
      if (isValidDate(yy2, mm2, dd2)) return yy2 + "-" + mon2 + "-" + pad2(dd2);
    }
  }
  return "";
}

function extractSupplier(lines) {
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].trim();
    var m = line.match(/^(?:supplier|from|vendor|seller|supplied by|invoice from)\s*:?\s*(.+)$/i);
    if (m && m[1].trim()) return titleCase(m[1].trim());
  }
  // Fall back to the first line when it looks like a business name:
  // no digits, no currency, short, and not a header word.
  for (var j = 0; j < Math.min(lines.length, 3); j++) {
    var first = lines[j].trim();
    if (!first) continue;
    if (/\d/.test(first)) continue;
    if (/[$€£]/.test(first)) continue;
    if (/^(invoice|receipt|tax invoice)$/i.test(first)) continue;
    if (first.length > 2 && first.length <= 40 && first.split(/\s+/).length <= 5) {
      return titleCase(first);
    }
  }
  return "";
}

function cleanName(raw) {
  var name = String(raw || "").replace(/[.,;:!?]+$/g, "").trim();
  name = name.replace(/^(for|of|the)\s+/i, "").trim();
  name = name.replace(/\s+/g, " ").trim();
  return name;
}

// Parse one invoice line. Returns a line object, or null when the line
// is not an item (with a reason in the second element).
function parseLine(rawLine, knownIngredients) {
  var line = rawLine.trim();
  if (!line) return null;
  for (var s = 0; s < SKIP_PATTERNS.length; s++) {
    if (SKIP_PATTERNS[s].test(line)) return { skip: "Not an item line" };
  }
  if (!/\d/.test(line)) return { skip: "No number found" };

  var working = line;
  // A date on the line is not part of the item; drop it for parsing.
  working = working.replace(/\d{4}-\d{1,2}-\d{1,2}/, " ");
  working = working.replace(/\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}/, " ");

  var unitPattern = KNOWN_UNITS.join("|");
  var qty = null;
  var unit = "";
  var price = null;
  var priceIsUnit = false;
  var name = null;

  // Explicit unit price: "@ $7.20", "at $7.20", "$7.20 per kg", "$7.20 each".
  var unitPriceMatch = working.match(
    /(?:@|at)\s*[$€£]?\s*(\d+(?:\.\d{1,2})?)/i
  ) || working.match(
    /[$€£]?\s*(\d+(?:\.\d{1,2})?)\s*(?:per|a|\/)\s*([A-Za-z]+)/i
  );
  if (unitPriceMatch) {
    price = parseFloat(unitPriceMatch[1]);
    priceIsUnit = true;
    working = working.replace(unitPriceMatch[0], " ").replace(/\s+/g, " ").trim();
  }

  // "2 x Butter 1kg" or "2x Butter".
  var xMatch = working.match(/^(\d+(?:\.\d+)?)\s*[x×]\s*(.+)$/i);
  if (xMatch) {
    qty = parseFloat(xMatch[1]);
    working = xMatch[2].trim();
  }

  // Quantity with unit at the start: "5 kg Butter" or "5kg Butter".
  var qtyMatch = working.match(
    new RegExp("^(\\d+(?:\\.\\d+)?)\\s*(" + unitPattern + ")?\\s+(.+)$", "i")
  );
  if (qtyMatch) {
    if (qty === null) qty = parseFloat(qtyMatch[1]);
    if (qtyMatch[2]) unit = normalizeUnit(qtyMatch[2]);
    working = qtyMatch[3].trim();
  }

  // Trailing price when no unit price was found yet. With a quantity this
  // is the line total; without one it is the unit price for one unit.
  // This runs before the tail quantity match, so "Butter 500 g $3.60"
  // leaves "Butter 500 g" for the quantity step below.
  if (price === null) {
    var priceMatch = working.match(/[$€£]?\s*(\d+(?:\.\d{1,2})?)\s*$/);
    if (priceMatch) {
      price = parseFloat(priceMatch[1]);
      working = working.slice(0, priceMatch.index).trim();
    }
  }

  // Quantity with unit at the end of the name part: "Butter 5 kg".
  // When an "x" quantity was already found ("2 x Butter 1kg"), the two
  // multiply, so that line means 2 kg in total.
  if (qty === null || xMatch) {
    var tailMatch = working.match(
      new RegExp("^(.+?)\\s+(\\d+(?:\\.\\d+)?)\\s*(" + unitPattern + ")\\.?$", "i")
    );
    if (tailMatch) {
      var tailQty = parseFloat(tailMatch[2]);
      qty = qty === null ? tailQty : qty * tailQty;
      unit = normalizeUnit(tailMatch[3]);
      working = tailMatch[1];
    }
  }

  // A unit may still be hiding at the end of the name ("Butter kg").
  var trailingUnit = working.match(new RegExp("\\s+(" + unitPattern + ")\\.?$", "i"));
  if (trailingUnit && !unit) {
    unit = normalizeUnit(trailingUnit[1]);
    working = working.slice(0, trailingUnit.index).trim();
  }

  if (price === null || price <= 0) return { skip: "No price found" };
  name = cleanName(working);
  if (!name || name.split(/\s+/).length > 5) return { skip: "No item name found" };

  var matched = matchIngredient(name, knownIngredients);
  var ingredientName = matched || titleCase(name);
  var uncertain = !matched;

  // Resolve the unit and the unit price.
  var known = null;
  for (var k = 0; k < knownIngredients.length; k++) {
    if (knownIngredients[k].name === ingredientName) { known = knownIngredients[k]; break; }
  }
  var canonicalUnit = known ? displayUnitKey(known.unit) : (unit || "kg");
  var finalQty = qty === null ? 1 : qty;
  var unitPrice;
  if (priceIsUnit) {
    unitPrice = price;
  } else if (qty !== null && qty !== 0) {
    unitPrice = price / qty;
  } else {
    unitPrice = price;
  }

  // Convert to the canonical unit when the line unit differs but converts.
  if (unit && canonicalUnit && unit !== canonicalUnit) {
    var converted = convertPrice(unitPrice, unit, canonicalUnit);
    if (converted !== null) {
      // Quantity also converts: 500 g at $x per kg is 0.5 kg.
      var qtyConverted = convertQty(finalQty, unit, canonicalUnit);
      unitPrice = converted;
      finalQty = qtyConverted;
    } else {
      uncertain = true;
    }
  }

  return {
    ingredient: ingredientName,
    qty: roundQty(finalQty),
    unit: canonicalUnit,
    price: Math.round(unitPrice * 10000) / 10000,
    uncertain: uncertain
  };
}

// Convert a quantity between units in the same group (500 g -> 0.5 kg).
export function convertQty(qty, fromUnit, toUnit) {
  var from = normalizeUnit(fromUnit);
  var to = normalizeUnit(toUnit);
  if (!from || !to || from === to) return qty;
  var groups = Object.keys(UNIT_GROUPS);
  for (var i = 0; i < groups.length; i++) {
    var units = UNIT_GROUPS[groups[i]].units;
    if (units[from] !== undefined && units[to] !== undefined) {
      return qty * (units[from] / units[to]);
    }
  }
  return qty;
}

function roundQty(qty) {
  return Math.round(qty * 1000) / 1000;
}

// Parse pasted invoice text into a structured invoice.
// knownIngredients: [{ name, unit, factor }] from the current state.
export function parseInvoiceText(text, knownIngredients) {
  knownIngredients = knownIngredients || [];
  var lines = String(text || "").split(/\r?\n/);
  var supplier = extractSupplier(lines);
  var date = "";
  for (var i = 0; i < lines.length; i++) {
    var found = parseDateFromText(lines[i]);
    if (found) { date = found; break; }
  }

  var parsed = [];
  var skipped = [];
  for (var j = 0; j < lines.length; j++) {
    var raw = lines[j].trim();
    if (!raw) continue;
    // The supplier line and pure date lines are not items.
    if (supplier && raw.toLowerCase().indexOf(supplier.toLowerCase()) !== -1 &&
        !/[$€£]?\s*\d/.test(raw.replace(supplier, ""))) continue;
    // A line that is only a date, with an optional label, is not an item.
    if (parseDateFromText(raw)) {
      var withoutDate = raw
        .replace(/\d{4}-\d{1,2}-\d{1,2}/, "")
        .replace(/\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}/, "")
        .replace(/\d{1,2}\s+[A-Za-z]+\s*,?\s*\d{4}/, "")
        .replace(/[A-Za-z]+\s+\d{1,2},?\s+\d{4}/, "")
        .replace(/^(invoice\s+date|date|dated)\s*:?\s*/i, "").trim();
      if (!withoutDate) continue;
    }
    var result = parseLine(raw, knownIngredients);
    if (!result) continue;
    if (result.skip) {
      skipped.push({ line: raw, reason: result.skip });
    } else {
      parsed.push(result);
    }
  }

  // Merge duplicate ingredients (same name and unit), keeping the latest
  // price and summing quantities.
  var merged = [];
  var seen = {};
  parsed.forEach(function (item) {
    var key = item.ingredient.toLowerCase() + "|" + item.unit;
    if (seen[key] !== undefined) {
      var existing = merged[seen[key]];
      existing.qty = roundQty(existing.qty + item.qty);
      existing.price = item.price;
      existing.uncertain = existing.uncertain || item.uncertain;
    } else {
      seen[key] = merged.length;
      merged.push(item);
    }
  });

  return { supplier: supplier, date: date, lines: merged, skipped: skipped };
}
