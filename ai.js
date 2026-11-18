// BakeCost AI invoice extraction (Firebase AI Logic, Gemini).
// Only used when Firebase is configured. In guest demo mode the app
// uses the local parser in invoice-parser.js instead.
//
// Gemini only structures the invoice. It never invents lines: the
// prompt tells it to return only what is on the invoice, and the app
// shows every extracted line in an editable preview before saving, so
// the baker checks the numbers before they enter the price history.

import { MODEL_ID, isFirebaseConfigured } from "./firebase-config.js";
import { getFirebaseApp, FIREBASE_AI_URL } from "./firebase-app.js";

var GEMINI_PROMPT = [
  "You read a supplier invoice for a small bakery and return its lines as structured data.",
  "Rules:",
  "- supplier is the name of the business that sent the invoice. Use an empty string when it is not shown.",
  "- date is the invoice date as YYYY-MM-DD. Use an empty string when no date is shown.",
  "- lines holds one entry per ingredient or product line on the invoice.",
  "- ingredient is the product name as written, for example Butter, Wheat flour, Eggs.",
  "- quantity is the amount bought, as a number. Use 1 when no quantity is shown.",
  "- unit is a short unit such as kg, g, L, ml, dozen, each, pack, box, bag. Use an empty string when no unit is shown.",
  "- unitPrice is the price for one unit, as a number, when the invoice shows it. Otherwise omit it.",
  "- totalPrice is the line total, as a number, when the invoice shows it. Otherwise omit it.",
  "- Never invent ingredients, quantities, units, or prices. Return only what is on the invoice.",
  "- Skip totals, subtotals, taxes, delivery charges, and discounts. They are not ingredient lines."
].join("\n");

function buildModel(ai) {
  return ai.then(function (modules) {
    var getAI = modules.getAI;
    var getGenerativeModel = modules.getGenerativeModel;
    var Schema = modules.Schema;
    var GoogleAIBackend = modules.GoogleAIBackend;
    return getFirebaseApp().then(function (app) {
      // Use the Gemini Developer API backend explicitly. The SDK default
      // is the Vertex AI backend, which needs a billing plan. The Gemini
      // Developer API backend is the one with a free tier, and this app
      // only ever uses free-tier models.
      var aiInstance = getAI(app, { backend: new GoogleAIBackend() });
      var schema = Schema.object({
        properties: {
          supplier: Schema.string(),
          date: Schema.string(),
          lines: Schema.array({
            items: Schema.object({
              properties: {
                ingredient: Schema.string(),
                quantity: Schema.number(),
                unit: Schema.string(),
                unitPrice: Schema.number(),
                totalPrice: Schema.number()
              },
              optionalProperties: ["unitPrice", "totalPrice", "unit"]
            })
          })
        }
      });
      return getGenerativeModel(aiInstance, {
        model: MODEL_ID,
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: schema
        }
      });
    });
  });
}

var modelPromise = null;

function getModel() {
  if (!modelPromise) {
    modelPromise = buildModel(import(FIREBASE_AI_URL));
  }
  return modelPromise;
}

// Normalise a Gemini result into the app's invoice shape:
// { supplier, date, lines: [{ ingredient, qty, unit, price }], skipped: [] }
// price is the unit price per display unit. When Gemini returns only a
// line total, the unit price is total divided by quantity.
export function normaliseGeminiResult(parsed) {
  var lines = (parsed.lines || [])
    .map(function (item) {
      var qty = Number(item.quantity);
      if (!qty || qty <= 0) qty = 1;
      var unitPrice = item.unitPrice !== undefined && item.unitPrice !== null
        ? Number(item.unitPrice)
        : null;
      if ((unitPrice === null || unitPrice <= 0) &&
          item.totalPrice !== undefined && item.totalPrice !== null) {
        unitPrice = Number(item.totalPrice) / qty;
      }
      if (unitPrice === null || unitPrice <= 0 || !item.ingredient) return null;
      return {
        ingredient: String(item.ingredient).trim(),
        qty: Math.round(qty * 1000) / 1000,
        unit: item.unit ? String(item.unit).trim() : "",
        price: Math.round(unitPrice * 10000) / 10000,
        uncertain: false
      };
    })
    .filter(Boolean);
  return {
    supplier: parsed.supplier ? String(parsed.supplier).trim() : "",
    date: parsed.date ? String(parsed.date).trim() : "",
    lines: lines,
    skipped: []
  };
}

// Gemini sometimes answers 500 "high demand" when the model is busy.
// That is transient, so a failed read retries twice before giving up,
// with a short wait between tries. Non-transient errors (bad model,
// bad key, bad request) are not retried.
function sleep(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

function isTransientError(err) {
  var text = (err && err.message ? err.message : String(err)).toLowerCase();
  return /500|502|503|504|high demand|overloaded|try again later|temporarily|network|fetch failed|timeout/.test(text);
}

// Bound every Gemini call: without a timeout a slow or stalled
// response leaves the app on "Reading..." forever. The 18 Nov 23:24
// test hung for 5 minutes with no error and no result. A timed-out
// attempt is transient, so it still gets its retries; worst case the
// baker sees a clear error after about 3 minutes, never a hang.
function withTimeout(promise, ms) {
  var timer = null;
  return Promise.race([
    promise,
    new Promise(function (resolve, reject) {
      timer = setTimeout(function () {
        reject(new Error("Timed out after " + Math.round(ms / 1000) + "s"));
      }, ms);
    })
  ]).then(
    function (value) { clearTimeout(timer); return value; },
    function (err) { clearTimeout(timer); throw err; }
  );
}

async function generateWithRetry(model, request) {
  var waits = [5000, 15000];
  var lastErr = null;
  for (var attempt = 0; attempt <= waits.length; attempt++) {
    try {
      return await withTimeout(model.generateContent(request), 60000);
    } catch (err) {
      lastErr = err;
      if (!isTransientError(err) || attempt === waits.length) throw err;
      await sleep(waits[attempt]);
    }
  }
  throw lastErr;
}

// Extract an invoice from pasted text with Gemini.
export async function extractInvoiceTextWithGemini(text) {
  if (!isFirebaseConfigured) {
    throw new Error("Firebase is not configured, so AI extraction is unavailable.");
  }
  var model = await getModel();
  var result = await generateWithRetry(model, GEMINI_PROMPT + "\n\nInvoice text:\n" + text);
  var parsed = JSON.parse(result.response.text());
  return normaliseGeminiResult(parsed);
}

// Extract an invoice from an uploaded file (image or PDF) with Gemini.
// fileData is the file contents as a base64 string, mimeType its type.
export async function extractInvoiceFileWithGemini(fileData, mimeType) {
  if (!isFirebaseConfigured) {
    throw new Error("Firebase is not configured, so AI extraction is unavailable.");
  }
  var model = await getModel();
  var result = await generateWithRetry(model, [
    { inlineData: { mimeType: mimeType, data: fileData } },
    { text: GEMINI_PROMPT }
  ]);
  var parsed = JSON.parse(result.response.text());
  return normaliseGeminiResult(parsed);
}

// File types Gemini can read directly as an invoice image or document.
export function isAIVisionFile(mimeType) {
  return [
    "image/jpeg", "image/png", "image/webp", "image/gif",
    "application/pdf"
  ].indexOf(mimeType) !== -1;
}

// Plain text files the local parser can read without AI.
export function isLocalTextFile(mimeType, fileName) {
  if (mimeType === "text/plain" || mimeType === "text/csv") return true;
  return /\.(txt|csv)$/i.test(fileName || "");
}
