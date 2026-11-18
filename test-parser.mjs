// Node tests for BakeCost v2 invoice-parser.js. Run: node test-parser.mjs

import {
  parseInvoiceText, parseDateFromText, normalizeUnit, convertPrice,
  convertQty, matchIngredient, displayUnitKey
} from "./invoice-parser.js";
import { SAMPLE_INGREDIENTS, SAMPLE_INVOICE_TEXT } from "./sample-data.js";

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

/* Unit normalisation and conversion */
check("normalize kilograms", normalizeUnit("Kilograms"), "kg");
check("normalize dozen", normalizeUnit("dz"), "dozen");
check("normalize pieces", normalizeUnit("pcs"), "each");
check("convert price g to kg", convertPrice(0.0072, "g", "kg"), 7.20);
check("convert price kg to g", convertPrice(7.20, "kg", "g"), 0.0072, 0.0001);
check("convert price each to dozen", convertPrice(0.325, "each", "dozen"), 3.90);
check("convert price across groups is null", convertPrice(5, "kg", "dozen"), null);
check("convert qty g to kg", convertQty(500, "g", "kg"), 0.5);
check("convert qty dozen to each", convertQty(2, "dozen", "each"), 24);
check("display unit key per dozen", displayUnitKey("per dozen"), "dozen");
check("display unit key per kg", displayUnitKey("per kg"), "kg");

/* Ingredient matching */
check("match exact", matchIngredient("Butter", SAMPLE_INGREDIENTS), "Butter");
check("match case-insensitive", matchIngredient("butter", SAMPLE_INGREDIENTS), "Butter");
check("match contains", matchIngredient("unsalted butter", SAMPLE_INGREDIENTS), "Butter");
check("match flour", matchIngredient("Wheat Flour", SAMPLE_INGREDIENTS), "Wheat flour");
check("match unknown is null", matchIngredient("Chocolate", SAMPLE_INGREDIENTS), null);

/* Date parsing */
check("date ISO", parseDateFromText("Invoice date: 2026-11-02"), "2026-11-02");
check("date DD/MM/YYYY", parseDateFromText("02/11/2026"), "2026-11-02");
check("date day month year words", parseDateFromText("2 Nov 2026"), "2026-11-02");
check("date month day year words", parseDateFromText("Nov 2, 2026"), "2026-11-02");
check("date invalid returns empty", parseDateFromText("32/13/2026"), "");
check("date none returns empty", parseDateFromText("Butter 5 kg"), "");

/* Full invoice parse: the pasteable sample text */
const sample = parseInvoiceText(SAMPLE_INVOICE_TEXT, SAMPLE_INGREDIENTS);
check("sample supplier", sample.supplier, "Millbrook Supplies");
check("sample date", sample.date, "2026-11-02");
check("sample line count", sample.lines.length, 4);
check("sample butter qty", sample.lines[0].qty, 20);
check("sample butter unit", sample.lines[0].unit, "kg");
check("sample butter price", sample.lines[0].price, 7.10);
check("sample flour price", sample.lines[1].price, 3.45);
check("sample eggs qty", sample.lines[2].qty, 10);
check("sample eggs unit", sample.lines[2].unit, "dozen");
check("sample eggs price", sample.lines[2].price, 4.20);
check("sample sugar price", sample.lines[3].price, 1.95);
check("sample total line skipped", sample.skipped.length, 1);
check("sample skipped reason", sample.skipped[0].reason, "Not an item line");

/* Line total form: bare price with a quantity is the total */
const totalForm = parseInvoiceText(
  "Supplier: City Mills\nDate: 2026-10-05\nSugar 25 kg $48.75\nButter 20 kg $142.00",
  SAMPLE_INGREDIENTS
);
check("total form supplier", totalForm.supplier, "City Mills");
check("total form date", totalForm.date, "2026-10-05");
check("total form sugar unit price", totalForm.lines[0].price, 1.95);
check("total form butter unit price", totalForm.lines[1].price, 7.10);

/* Gram lines convert to the canonical kg unit */
const gramForm = parseInvoiceText("Butter 500 g $3.60", SAMPLE_INGREDIENTS);
check("gram line qty in kg", gramForm.lines[0].qty, 0.5);
check("gram line unit", gramForm.lines[0].unit, "kg");
check("gram line price per kg", gramForm.lines[0].price, 7.20);

/* "per kg" unit price form */
const perForm = parseInvoiceText("Butter $7.20 per kg", SAMPLE_INGREDIENTS);
check("per form price", perForm.lines[0].price, 7.20);
check("per form qty defaults to 1", perForm.lines[0].qty, 1);

/* "2 x" quantity form */
const xForm = parseInvoiceText("2 x Butter 1kg $14.40", SAMPLE_INGREDIENTS);
check("x form qty", xForm.lines[0].qty, 2);
check("x form unit price", xForm.lines[0].price, 7.20);

/* Leading quantity form */
const leadForm = parseInvoiceText("10 dozen eggs 39.00", SAMPLE_INGREDIENTS);
check("leading qty form qty", leadForm.lines[0].qty, 10);
check("leading qty form unit", leadForm.lines[0].unit, "dozen");
check("leading qty form price", leadForm.lines[0].price, 3.90);

/* Unknown ingredient is kept, flagged uncertain, default kg unit */
const unknownForm = parseInvoiceText("Dark chocolate 2 kg @ $18.50", SAMPLE_INGREDIENTS);
check("unknown ingredient kept", unknownForm.lines[0].ingredient, "Dark Chocolate");
check("unknown ingredient uncertain", unknownForm.lines[0].uncertain, true);
check("unknown ingredient unit", unknownForm.lines[0].unit, "kg");
check("unknown ingredient price", unknownForm.lines[0].price, 18.50);

/* Duplicate lines merge, latest price wins, quantities sum */
const dupForm = parseInvoiceText(
  "Butter 10 kg @ $7.00\nButter 10 kg @ $7.20",
  SAMPLE_INGREDIENTS
);
check("duplicate lines merged", dupForm.lines.length, 1);
check("duplicate qty summed", dupForm.lines[0].qty, 20);
check("duplicate latest price wins", dupForm.lines[0].price, 7.20);

/* Noise lines are skipped, not parsed as items */
const noiseForm = parseInvoiceText(
  "Thank you for your business\nVAT $12.00\nDelivery $5.00\nButter 5 kg @ $7.20",
  SAMPLE_INGREDIENTS
);
check("noise form one item", noiseForm.lines.length, 1);
check("noise form item name", noiseForm.lines[0].ingredient, "Butter");

/* Empty text parses to an empty invoice */
const emptyForm = parseInvoiceText("", SAMPLE_INGREDIENTS);
check("empty text no lines", emptyForm.lines.length, 0);
check("empty text no supplier", emptyForm.supplier, "");
check("empty text no date", emptyForm.date, "");

console.log("\n" + passed + " passed, " + failed + " failed.");
process.exit(failed === 0 ? 0 : 1);
