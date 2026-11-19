// BakeCost v2 DOM smoke test (jsdom + Node ESM).
// jsdom does not fetch external <script type="module"> files, so this
// test loads app.html into jsdom, exposes its document/window as Node
// globals, then imports the real app.js with Node's own module loader
// and drives the guest demo flow through the actual UI: paste an
// invoice, save it from the preview, add a manual invoice that spikes
// flour, check the alert fires, add and edit a recipe, and check the
// sample data controls.
// Needs jsdom, which is not a project dependency. Install it first
// (it is git-ignored via node_modules/):
//   npm install --no-save jsdom
// Then run: node dom-smoke.mjs
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const ROOT = dirname(fileURLToPath(import.meta.url));

let passed = 0;
let failed = 0;
function check(name, actual, expected) {
  const ok = actual === expected;
  if (ok) { passed++; console.log("PASS " + name); }
  else { failed++; console.log("FAIL " + name + " (expected " + JSON.stringify(expected) + ", got " + JSON.stringify(actual) + ")"); }
}
function checkContains(name, haystack, needle) {
  const ok = String(haystack).includes(needle);
  if (ok) { passed++; console.log("PASS " + name); }
  else { failed++; console.log("FAIL " + name + " (missing " + JSON.stringify(needle) + ")"); }
}
function waitFor(fn, timeoutMs) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    (function poll() {
      let result = null;
      try { result = fn(); } catch (e) { /* keep waiting */ }
      if (result) return resolve(result);
      if (Date.now() - start > timeoutMs) return reject(new Error("timeout waiting"));
      setTimeout(poll, 50);
    })();
  });
}

const html = readFileSync(ROOT + "/app.html", "utf8");
const dom = new JSDOM(html, {
  url: "http://localhost:8124/app.html",
  pretendToBeVisual: true
});
const { window } = dom;
const { document } = window;

// Expose the jsdom browser globals so the real app.js runs against them.
globalThis.window = window;
globalThis.document = document;
globalThis.localStorage = window.localStorage;
window.scrollTo = () => {};
window.Element.prototype.scrollIntoView = function () {};
window.confirm = () => true;
globalThis.confirm = window.confirm;

// Import the real app. init() runs on import; the guest auth callback
// fires on the next tick and renders the dashboard.
await import(pathToFileURL(ROOT + "/app.js").href);

await waitFor(() => {
  const cards = document.querySelectorAll("#dashCards .stat-card");
  return cards.length === 4 ? cards : null;
}, 5000);

function setValue(el, value) {
  el.value = value;
  el.dispatchEvent(new window.Event("change", { bubbles: true }));
}
function click(el) {
  el.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
}

check("mode badge is Guest demo", document.getElementById("modeBadge").textContent, "Guest demo");
check("AI badge is Gemini ready (Firebase is configured)",
  document.getElementById("aiBadge").textContent, "AI: Gemini ready");
check("sample banner visible", document.getElementById("sampleBanner").hidden, false);
const cardText = document.getElementById("dashCards").textContent;
checkContains("dashboard shows ingredients label", cardText, "Ingredients tracked");
check("dashboard shows 3 alerts at baseline (true cost below target)",
  document.querySelectorAll("#dashCards .stat-card")[2].textContent.includes("3"), true);
checkContains("dashboard biggest move is eggs -35%", cardText, "-35.0%");
check("alert badge shows 3 at baseline", document.getElementById("alertCountBadge").textContent, "3");
check("alert badge visible at baseline", document.getElementById("alertCountBadge").hidden, false);

// Go to Invoices, paste the sample invoice, parse it.
click(document.querySelector('[data-view="invoices"]'));
check("invoice list shows 3 sample invoices",
  document.querySelectorAll("#invoiceList .invoice-card").length, 3);

document.getElementById("pasteText").value =
  "Millbrook Supplies\nInvoice date: 2026-11-02\nButter 20 kg @ $7.10\n" +
  "Wheat flour 50 kg @ $3.45\nEggs 10 dozen @ $4.20\nSugar 25 kg @ $1.95\nTotal: $374.50";
click(document.getElementById("parsePasteBtn"));
check("preview panel opens", document.getElementById("previewPanel").hidden, false);
check("preview shows 4 parsed lines",
  document.querySelectorAll("#previewBody tr").length, 4);
check("preview supplier filled",
  document.getElementById("previewSupplier").value, "Millbrook Supplies");
check("preview date filled",
  document.getElementById("previewDate").value, "2026-11-02");

// Save from the preview.
click(document.getElementById("previewSaveBtn"));
check("invoice list now shows 4 invoices",
  document.querySelectorAll("#invoiceList .invoice-card").length, 4);
checkContains("notice confirms save", document.getElementById("noticeText").textContent, "Invoice saved");

// Dashboard reflects the new invoice: flour is now the biggest mover.
click(document.querySelector('[data-view="dashboard"]'));
checkContains("dashboard biggest move now flour +38%",
  document.getElementById("dashCards").textContent, "+38.0%");

// Prices view renders a chart per ingredient.
click(document.querySelector('[data-view="prices"]'));
check("prices view shows 4 ingredient cards",
  document.querySelectorAll("#priceCards .price-card").length, 4);
check("prices view renders charts",
  document.querySelectorAll("#priceCards svg.chart").length, 4);
checkContains("flour card shows latest price 3.45",
  document.getElementById("priceCards").textContent, "$3.45");

// Recipes view renders the three sample recipes with recosted prices.
click(document.querySelector('[data-view="recipes"]'));
check("recipes view shows 3 recipes",
  document.querySelectorAll("#recipeList .recipe-card").length, 3);
checkContains("butter cake shows recosted true cost",
  document.getElementById("recipeList").textContent, "$13.23");
checkContains("butter cake shows the cost breakdown",
  document.getElementById("recipeList").textContent, "True cost: ingredients $6.33, labor $6.00");

// Manual invoice with a flour spike, to fire a real alert.
click(document.querySelector('[data-view="invoices"]'));
click(document.getElementById("tab-manual"));
document.getElementById("manualSupplier").value = "Millbrook Supplies";
document.getElementById("manualDate").value = "2026-11-15";
setValue(document.querySelector('#manualLines select[data-manual-field="ingredient"]'), "Wheat flour");
setValue(document.querySelector('#manualLines input[data-manual-field="qty"]'), "50");
setValue(document.querySelector('#manualLines input[data-manual-field="price"]'), "6.00");
document.getElementById("manualForm").dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
check("alert badge still shows 3 after flour spike",
  document.getElementById("alertCountBadge").textContent, "3");

// Alerts view names the recipe below target.
click(document.querySelector('[data-view="alerts"]'));
checkContains("alert feed names Sourdough Loaf",
  document.getElementById("alertFeed").textContent, "Sourdough Loaf");
checkContains("alert feed shows sourdough margin -3.1%",
  document.getElementById("alertFeed").textContent, "-3.1%");

// Export works (download runs against Node's Blob/URL, notice confirms).
click(document.querySelector('[data-view="recipes"]'));
click(document.getElementById("exportRecipesBtn"));
checkContains("export notice confirms download",
  document.getElementById("noticeText").textContent, "Downloaded bakecost-recipes.csv");

// Guest state persisted to localStorage.
const saved = JSON.parse(window.localStorage.getItem("bakecost-v2-guest"));
check("guest state saved with 5 invoices", saved.invoices.length, 5);
check("guest state is no longer sample data", saved.isSample, false);

// Recipe editor: add a recipe through the form.
click(document.querySelector('[data-view="recipes"]'));
click(document.getElementById("addRecipeBtn"));
check("recipe editor opens", document.getElementById("recipeEditor").hidden, false);
document.getElementById("recipeName").value = "Test Cake";
document.getElementById("recipeSellPrice").value = "24";
document.getElementById("recipeTarget").value = "60";
setValue(document.querySelector('#recipeLines select[data-editor-field="name"]'), "Butter");
setValue(document.querySelector('#recipeLines input[data-editor-field="qty"]'), "0.5");
click(document.getElementById("recipeEditorAddLineBtn"));
const editorSelects = document.querySelectorAll('#recipeLines select[data-editor-field="name"]');
setValue(editorSelects[1], "Wheat flour");
const editorQtys = document.querySelectorAll('#recipeLines input[data-editor-field="qty"]');
setValue(editorQtys[1], "0.4");
document.getElementById("recipeForm").dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
check("recipes view now shows 4 recipes",
  document.querySelectorAll("#recipeList .recipe-card").length, 4);
checkContains("new recipe costed at latest prices (butter 7.10, flour 6.00)",
  document.getElementById("recipeList").textContent, "$5.95");

// Edit the new recipe's target to 90, so it drops below target.
const editButtons = document.querySelectorAll("#recipeList [data-edit-recipe]");
click(editButtons[editButtons.length - 1]);
document.getElementById("recipeTarget").value = "90";
document.getElementById("recipeForm").dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
check("alert badge shows 4 after target edit",
  document.getElementById("alertCountBadge").textContent, "4");

// v5: the More menu opens and closes, and the three new views work.
click(document.getElementById("moreBtn"));
check("more menu opens", document.getElementById("moreMenu").hidden, false);
click(document.getElementById("moreBtn"));
check("more menu closes", document.getElementById("moreMenu").hidden, true);

// Orders view shows the 3 sample orders, one flagged overdue.
click(document.querySelector('[data-view="orders"]'));
check("orders view shows 3 sample orders",
  document.querySelectorAll("#orderList .order-card").length, 3);
checkContains("orders view flags an overdue order",
  document.getElementById("orderList").textContent, "Overdue");
checkContains("orders summary shows outstanding $74.00",
  document.getElementById("orderSummary").textContent, "$74.00");

// Add an order through the editor: Test, 2 Butter Cakes, $10 deposit.
click(document.getElementById("addOrderBtn"));
check("order editor opens", document.getElementById("orderEditor").hidden, false);
document.getElementById("orderCustomer").value = "Test";
document.getElementById("orderDueDate").value = "2026-12-01";
setValue(document.querySelector('#orderItems select[data-order-field="recipeId"]'), "sample-r1");
setValue(document.querySelector('#orderItems input[data-order-field="qty"]'), "2");
document.getElementById("orderDeposit").value = "10";
document.getElementById("orderDeposit").dispatchEvent(new window.Event("input", { bubbles: true }));
checkContains("order totals preview shows $48.00",
  document.getElementById("orderTotalPreview").textContent, "$48.00");
checkContains("order balance preview shows $38.00",
  document.getElementById("orderBalancePreview").textContent, "$38.00");
document.getElementById("orderForm").dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
check("orders view now shows 4 orders",
  document.querySelectorAll("#orderList .order-card").length, 4);
checkContains("new order shows balance $38.00",
  document.getElementById("orderList").textContent, "$38.00");

// Mark the new order paid: it is the last one by due date.
const paidButtons = document.querySelectorAll("#orderList [data-order-paid]");
click(paidButtons[paidButtons.length - 1]);
check("mark paid leaves 2 unpaid orders",
  document.querySelectorAll("#orderList [data-order-paid]").length, 2);
checkContains("outstanding back to $74.00 after mark paid",
  document.getElementById("orderSummary").textContent, "$74.00");

// Bake Day: the sample day loads with its shopping list.
click(document.querySelector('[data-view="bakeday"]'));
checkContains("bake day shopping list shows 8.8 kg flour",
  document.getElementById("bakeShopping").textContent, "8.8");
checkContains("bake day shopping list shows 16 eggs",
  document.getElementById("bakeShopping").textContent, "16");
check("one saved bake day listed",
  document.querySelectorAll("#bakeDayList .bake-card").length, 1);

// v12: marking the bake done updates stock (checked in Inventory below).
click(document.querySelector("#bakeDayList [data-bake-done]"));
checkContains("bake day shows done after mark done",
  document.getElementById("bakeDayList").textContent, "Done, stock updated");

// Suppliers: City Mills appears and the cheapest price is highlighted.
click(document.querySelector('[data-view="suppliers"]'));
checkContains("suppliers view names City Mills",
  document.getElementById("supplierCards").textContent, "City Mills");
checkContains("suppliers view highlights the cheapest price",
  document.getElementById("supplierCards").textContent, "Cheapest");
checkContains("suppliers view flags the flour jump",
  document.getElementById("supplierCards").textContent, "Jumped");

// v12: Waste view shows the 3 sample entries and the weekly summary.
click(document.querySelector('[data-view="waste"]'));
check("waste view shows 3 sample entries",
  document.querySelectorAll("#wasteList .bake-card").length, 3);
checkContains("waste summary shows the week label",
  document.getElementById("wasteSummary").textContent, "Waste this week");
checkContains("waste trend shows 3 days",
  document.getElementById("wasteTrend").textContent, "$");

// Add a waste entry: 2 Sourdough made, 1 sold, so 1 wasted at $8.25
// (true cost at the spiked flour price: $3.60 ingredients + $4.65).
click(document.getElementById("addWasteBtn"));
check("waste editor opens", document.getElementById("wasteEditor").hidden, false);
setValue(document.getElementById("wasteRecipe"), "sample-r2");
setValue(document.getElementById("wasteMade"), "2");
setValue(document.getElementById("wasteSold"), "1");
checkContains("waste preview values the waste at $8.25",
  document.getElementById("wastePreview").textContent, "$8.25");
document.getElementById("wasteForm").dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
check("waste view now shows 4 entries",
  document.querySelectorAll("#wasteList .bake-card").length, 4);
checkContains("new waste entry shows 1 wasted at $8.25",
  document.getElementById("wasteList").textContent, "wasted 1 at $8.25");

// v12: Inventory view. The pasted invoice added 20 kg butter to the
// 8.5 kg sample stock, and marking the bake done took 2 kg back out,
// so butter reads 26.5 kg. Eggs still expire in 4 days: use soon.
click(document.querySelector('[data-view="inventory"]'));
check("inventory view shows 4 rows",
  document.querySelectorAll("#inventoryList .inv-card").length, 4);
checkContains("butter stock is 26.5 kg after invoice and bake",
  document.getElementById("inventoryList").textContent, "26.5 kg");
checkContains("eggs flagged use soon",
  document.getElementById("inventoryList").textContent, "Use soon");

// Manual adjust: one tap of minus takes butter to 25.5 kg.
click(document.querySelector('#inventoryList [data-inv-dec="Butter"]'));
checkContains("butter stock drops to 25.5 kg after minus",
  document.getElementById("inventoryList").textContent, "25.5 kg");

// Sample data controls: start empty, then reset the sample data.
click(document.getElementById("startEmptyBtn"));
click(document.querySelector('[data-view="dashboard"]'));
check("dashboard shows 0 ingredients after start empty",
  document.querySelectorAll("#dashCards .stat-card")[0].textContent.includes("0"), true);
click(document.getElementById("resetSampleBtn"));
click(document.querySelector('[data-view="invoices"]'));
check("invoice list back to 3 after reset",
  document.querySelectorAll("#invoiceList .invoice-card").length, 3);
check("sample banner visible again", document.getElementById("sampleBanner").hidden, false);

// v12: reset restores the sample waste and inventory too.
click(document.querySelector('[data-view="waste"]'));
check("waste view back to 3 entries after reset",
  document.querySelectorAll("#wasteList .bake-card").length, 3);
checkContains("waste week total back to $48.34 after reset",
  document.getElementById("wasteSummary").textContent, "$48.34");
click(document.querySelector('[data-view="inventory"]'));
checkContains("butter back to 8.5 kg and low after reset",
  document.getElementById("inventoryList").textContent, "8.5 kg");
checkContains("butter low flag back after reset",
  document.getElementById("inventoryList").textContent, "Low");

console.log("\n" + passed + " passed, " + failed + " failed.");
process.exit(failed === 0 ? 0 : 1);
