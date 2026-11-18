// BakeCost app (v2). Single-page app, no build step.
// Modes:
// - Guest demo: no sign-in, no Firebase config. State lives in
//   localStorage, sample data is seeded on first run, the local
//   parser structures pasted invoices. The full flow works end to end.
// - Signed in: Google sign-in via Firebase Auth, state in Firestore,
//   Gemini extraction via Firebase AI Logic when Firebase is configured.

import {
  recipeCost, margin, priceChangePct, latestPoint, earliestPoint,
  previousPoint, marginStatus, statusLabel, biggestMovers, marginAlerts,
  recentMoves, roundTo, money, pct, buildCSV, buildPriceCSV, buildInvoiceCSV
} from "./costing.js";
import {
  parseInvoiceText, matchIngredient, normalizeUnit, convertPrice,
  convertQty, displayUnitKey
} from "./invoice-parser.js";
import { sampleState, emptyState, SAMPLE_INVOICE_TEXT } from "./sample-data.js";
import { lineChartSVG, sparklineSVG } from "./charts.js";
import { isFirebaseConfigured } from "./firebase-config.js";
import {
  extractInvoiceTextWithGemini, extractInvoiceFileWithGemini,
  isAIVisionFile, isLocalTextFile
} from "./ai.js";
import {
  loadGuestState, saveGuestState, clearGuestState,
  signInWithGoogle, signOutUser, onAuthChange,
  loadCloudState, saveCloudState, freshCloudState
} from "./store.js";

var $ = function (id) { return document.getElementById(id); };

var MOVE_THRESHOLD = 5; // percent move that counts as a price alert

var state = null;
var user = null;
var mode = "guest"; // "guest" or "cloud"
var currentView = "dashboard";
var pendingInvoice = null; // parsed invoice awaiting save in the preview
var manualLines = []; // lines in the manual invoice form
var editorLines = []; // ingredient lines in the recipe editor
var editingRecipeId = null;
var cloudSavePending = false;

/* ---------- small helpers ---------- */

function uid() {
  return "id-" + Date.now().toString(36) + "-" +
    Math.floor(Math.random() * 1000000).toString(36);
}

function escapeHtml(text) {
  return String(text === null || text === undefined ? "" : text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDate(iso) {
  if (!iso) return "No date";
  var parts = String(iso).split("-");
  if (parts.length !== 3) return iso;
  var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return parseInt(parts[2], 10) + " " + months[parseInt(parts[1], 10) - 1] + " " + parts[0];
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function downloadCSV(filename, text) {
  var blob = new Blob([text], { type: "text/csv;charset=utf-8" });
  var url = URL.createObjectURL(blob);
  var a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function showNotice(message, kind) {
  var notice = $("notice");
  $("noticeText").textContent = message;
  notice.className = "notice notice-" + (kind || "info");
  notice.hidden = false;
}

function hideNotice() {
  $("notice").hidden = true;
}

function ingredientByName(name) {
  for (var i = 0; i < state.ingredients.length; i++) {
    if (state.ingredients[i].name === name) return state.ingredients[i];
  }
  return null;
}

// Display unit for a unit key: kg -> "per kg", dozen -> "per dozen".
function displayUnit(unit) {
  var map = {
    kg: "per kg", g: "per kg", l: "per L", ml: "per L",
    dozen: "per dozen", each: "each", pack: "per pack",
    box: "per box", bag: "per bag", bottle: "per bottle",
    tray: "per tray", sack: "per sack"
  };
  return map[unit] || ("per " + unit);
}

// Base unit label shown next to a recipe quantity input.
function baseUnitLabel(ing) {
  if (!ing) return "";
  var key = displayUnitKey(ing.unit);
  var map = {
    kg: "kg", l: "L", dozen: "singles", each: "each",
    pack: "packs", box: "boxes", bag: "bags",
    bottle: "bottles", tray: "trays", sack: "sacks"
  };
  return map[key] || key;
}

function addActivity(text) {
  state.activity.unshift({ id: uid(), at: todayISO(), text: text });
  if (state.activity.length > 50) state.activity.length = 50;
}

/* ---------- persistence ---------- */

function persist() {
  if (mode === "cloud" && user) {
    if (cloudSavePending) return;
    cloudSavePending = true;
    saveCloudState(user, state)
      .then(function () { cloudSavePending = false; })
      .catch(function (err) {
        cloudSavePending = false;
        console.error("Cloud save failed:", err);
        showNotice("Could not save to your account (" + (err.message || "unknown error") +
          "). Your changes are still on this page, but sign out and they will be lost.", "error");
      });
  } else {
    if (!saveGuestState(state)) {
      showNotice("Could not save in this browser (local storage is full or blocked).", "error");
    }
  }
}

/* ---------- derived data ---------- */

function pricePoints(name) {
  var points = [];
  state.invoices.forEach(function (inv) {
    inv.lines.forEach(function (line) {
      if (line.ingredient === name) {
        points.push({ date: inv.date, price: line.price });
      }
    });
  });
  points.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
  return points;
}

// One history per known ingredient, plus any ingredient that appears
// on an invoice but has no ingredient entry yet.
function histories() {
  var names = {};
  state.ingredients.forEach(function (ing) { names[ing.name] = ing.unit; });
  state.invoices.forEach(function (inv) {
    inv.lines.forEach(function (line) {
      if (!names[line.ingredient]) names[line.ingredient] = displayUnit(line.unit);
    });
  });
  return Object.keys(names).sort().map(function (name) {
    return { name: name, unit: names[name], points: pricePoints(name) };
  });
}

function priceSet(which) {
  var set = {};
  state.ingredients.forEach(function (ing) {
    var points = pricePoints(ing.name);
    var point = which === "earliest" ? earliestPoint(points) : latestPoint(points);
    if (point) set[ing.name] = { price: point.price, factor: ing.factor };
  });
  return set;
}

function costingRows() {
  var thenPrices = priceSet("earliest");
  var nowPrices = priceSet("latest");
  return state.recipes.map(function (recipe) {
    var costThen = recipeCost(recipe, thenPrices);
    var costNow = recipeCost(recipe, nowPrices);
    var m = costNow === null ? { amount: null, pct: null } : margin(costNow, recipe.sellPrice);
    return {
      recipe: recipe,
      costThen: costThen,
      costNow: costNow,
      sellPrice: recipe.sellPrice,
      marginAmount: m.amount,
      marginPct: m.pct,
      status: marginStatus(m.pct, recipe.targetPct)
    };
  });
}

function activeAlerts() {
  return marginAlerts(costingRows().map(function (r) {
    return {
      name: r.recipe.name,
      marginPct: r.marginPct,
      targetPct: r.recipe.targetPct,
      sellPrice: r.sellPrice,
      cost: r.costNow
    };
  }));
}

/* ---------- line normalisation (local parser and Gemini share this) ---------- */

// Turn parsed lines into canonical app lines: match the ingredient
// against known ingredients, convert grams to kg and ml to L, and
// flag lines whose ingredient is new.
function normaliseLines(lines) {
  return (lines || []).map(function (line) {
    var matched = matchIngredient(line.ingredient, state.ingredients);
    var name = matched || String(line.ingredient || "").trim();
    var known = matched ? ingredientByName(matched) : null;
    var unit = normalizeUnit(line.unit);
    var qty = Number(line.qty);
    if (!qty || qty <= 0) qty = 1;
    var price = Number(line.price);
    var targetUnit = known ? displayUnitKey(known.unit) : canonicalTarget(unit);
    if (!unit) unit = targetUnit;
    if (unit !== targetUnit) {
      var converted = convertPrice(price, unit, targetUnit);
      if (converted !== null) {
        price = converted;
        qty = convertQty(qty, unit, targetUnit);
        unit = targetUnit;
      }
    }
    return {
      ingredient: name,
      qty: Math.round(qty * 1000) / 1000,
      unit: unit,
      price: Math.round(price * 10000) / 10000,
      uncertain: !matched || !!line.uncertain
    };
  }).filter(function (line) {
    return line.ingredient && line.price > 0;
  });
}

// Canonical unit for a new ingredient: grams become kg, ml becomes L.
function canonicalTarget(unit) {
  if (unit === "g") return "kg";
  if (unit === "ml") return "l";
  return unit || "kg";
}

// Make sure every ingredient on a new invoice exists in the list.
function ensureIngredients(lines) {
  lines.forEach(function (line) {
    if (!ingredientByName(line.ingredient)) {
      state.ingredients.push({
        name: line.ingredient,
        unit: displayUnit(line.unit),
        factor: line.unit === "dozen" ? 12 : 1
      });
    }
  });
}

/* ---------- rendering: header, badges, tabs ---------- */

function renderHeader() {
  var modeBadge = $("modeBadge");
  var aiBadge = $("aiBadge");
  var signInBtn = $("signInBtn");
  var signOutBtn = $("signOutBtn");
  var authNote = $("authNote");
  if (mode === "cloud" && user) {
    modeBadge.textContent = "Signed in as " + (user.displayName || user.email || "baker");
    modeBadge.className = "badge badge-cloud";
    signInBtn.hidden = true;
    signOutBtn.hidden = false;
    authNote.hidden = true;
  } else {
    modeBadge.textContent = "Guest demo";
    modeBadge.className = "badge badge-guest";
    signOutBtn.hidden = true;
    if (isFirebaseConfigured) {
      signInBtn.hidden = false;
      authNote.hidden = true;
    } else {
      signInBtn.hidden = true;
      authNote.hidden = false;
    }
  }
  if (isFirebaseConfigured) {
    aiBadge.textContent = "AI: Gemini ready";
    aiBadge.className = "badge badge-ai";
  } else {
    aiBadge.textContent = "AI: off, local parser";
    aiBadge.className = "badge badge-demo";
  }
  var count = activeAlerts().length;
  var alertBadge = $("alertCountBadge");
  alertBadge.textContent = count > 0 ? String(count) : "";
  alertBadge.hidden = count === 0;
  var banner = $("sampleBanner");
  if (mode === "guest" && state.isSample) {
    banner.hidden = false;
  } else {
    banner.hidden = true;
  }
}

function setView(view) {
  currentView = view;
  var tabs = document.querySelectorAll(".tab-btn");
  tabs.forEach(function (btn) {
    btn.classList.toggle("active", btn.getAttribute("data-view") === view);
    btn.setAttribute("aria-selected", btn.getAttribute("data-view") === view ? "true" : "false");
  });
  var panels = document.querySelectorAll(".view");
  panels.forEach(function (panel) {
    panel.hidden = panel.id !== "view-" + view;
  });
  renderView(view);
  window.scrollTo({ top: 0 });
}

function renderView(view) {
  if (view === "dashboard") renderDashboard();
  else if (view === "invoices") renderInvoices();
  else if (view === "prices") renderPrices();
  else if (view === "recipes") renderRecipes();
  else if (view === "alerts") renderAlerts();
}

function renderAll() {
  renderHeader();
  renderView(currentView);
}

/* ---------- rendering: dashboard ---------- */

function renderDashboard() {
  var rows = costingRows();
  var alerts = activeAlerts();
  var movers = biggestMovers(histories());
  var topMover = movers.length > 0 && movers[0].changePct !== null ? movers[0] : null;

  $("dashCards").innerHTML =
    '<div class="stat-card"><div class="stat-num">' + state.ingredients.length + '</div>' +
    '<div class="stat-label">Ingredients tracked</div></div>' +
    '<div class="stat-card"><div class="stat-num">' + state.recipes.length + '</div>' +
    '<div class="stat-label">Recipes</div></div>' +
    '<div class="stat-card' + (alerts.length > 0 ? " stat-alert" : "") + '"><div class="stat-num">' + alerts.length + '</div>' +
    '<div class="stat-label">Recipes below target margin</div></div>' +
    '<div class="stat-card"><div class="stat-num">' + (topMover ? pct(topMover.changePct) : "n/a") + '</div>' +
    '<div class="stat-label">Biggest price move' + (topMover ? ": " + escapeHtml(topMover.name) : "") + '</div></div>';

  var moversHtml = "";
  var shown = movers.filter(function (m) { return m.changePct !== null; }).slice(0, 5);
  if (shown.length === 0) {
    moversHtml = '<p class="small">Add a second invoice to see price moves. One price point per ingredient is not a move yet.</p>';
  } else {
    moversHtml = '<ul class="mover-list">' + shown.map(function (m) {
      var points = pricePoints(m.name);
      var cls = m.changePct > 0 ? "up" : "down";
      return '<li><div><strong>' + escapeHtml(m.name) + '</strong> ' +
        '<span class="small">(' + escapeHtml(m.unit) + ')</span><br>' +
        '<span class="small">' + money(m.first) + " to " + money(m.last) + '</span></div>' +
        '<div class="mover-right">' + sparklineSVG(points) +
        '<span class="mover-pct ' + cls + '">' + pct(m.changePct) + '</span></div></li>';
    }).join("") + "</ul>";
  }
  $("dashMovers").innerHTML = moversHtml;

  var belowHtml = "";
  if (alerts.length === 0) {
    belowHtml = '<div class="alert-box ok"><h3>No margin alerts</h3><p>Every recipe with a price is at or above its target margin at the latest prices.</p></div>';
  } else {
    belowHtml = '<div class="alert-box"><h3>' + alerts.length + ' recipe' +
      (alerts.length === 1 ? "" : "s") + ' below target</h3><ul>' +
      alerts.map(function (a) {
        return '<li><strong>' + escapeHtml(a.name) + '</strong>: margin ' +
          a.marginPct.toFixed(1) + "% against a " + a.targetPct + "% target.</li>";
      }).join("") + '</ul><p><a href="#" data-goto="alerts">See all alerts</a></p></div>';
  }
  $("dashAlerts").innerHTML = belowHtml;

  var activityHtml = "";
  if (state.activity.length === 0) {
    activityHtml = '<p class="small">Nothing yet. Add an invoice or a recipe and it shows up here.</p>';
  } else {
    activityHtml = '<ul class="activity-list">' + state.activity.slice(0, 8).map(function (a) {
      return '<li><span class="small">' + formatDate(a.at) + '</span><br>' + escapeHtml(a.text) + '</li>';
    }).join("") + "</ul>";
  }
  $("dashActivity").innerHTML = activityHtml;

  // Cloud-only action: copy the guest work into the account.
  var copyWrap = $("copyGuestWrap");
  if (mode === "cloud" && user) {
    var guest = loadGuestState();
    if (guest && (guest.invoices.length > 0 || guest.recipes.length > 0)) {
      copyWrap.hidden = false;
    } else {
      copyWrap.hidden = true;
    }
  } else {
    copyWrap.hidden = true;
  }

  // Recipe margin table on the dashboard.
  var tableHtml = "";
  if (rows.length === 0) {
    tableHtml = '<p class="small">No recipes yet. Add one from the Recipes tab.</p>';
  } else {
    tableHtml = '<div class="table-wrap"><table><thead><tr><th>Recipe</th>' +
      '<th class="num">Cost now</th><th class="num">Selling price</th>' +
      '<th class="num">Margin</th><th>Status</th></tr></thead><tbody>' +
      rows.map(function (r) {
        var marginText = r.marginPct === null ? "n/a" :
          money(r.marginAmount) + " (" + r.marginPct.toFixed(1) + "%)";
        return '<tr><td><strong>' + escapeHtml(r.recipe.name) + '</strong></td>' +
          '<td class="num">' + money(r.costNow) + '</td>' +
          '<td class="num">' + money(r.sellPrice) + '</td>' +
          '<td class="num">' + marginText + '</td>' +
          '<td><span class="badge badge-' + r.status + '">' + statusLabel(r.status) + '</span></td></tr>';
      }).join("") + "</tbody></table></div>";
  }
  $("dashRecipes").innerHTML = tableHtml;
}

/* ---------- rendering: invoices ---------- */

function renderInvoices() {
  var list = $("invoiceList");
  if (state.invoices.length === 0) {
    list.innerHTML = '<p class="small">No invoices yet. Paste one below, upload a photo or PDF, or add lines by hand.</p>';
  } else {
    var sorted = state.invoices.slice().sort(function (a, b) {
      return a.date < b.date ? 1 : -1;
    });
    list.innerHTML = '<div class="invoice-cards">' + sorted.map(function (inv) {
      var total = inv.lines.reduce(function (sum, line) {
        return sum + line.qty * line.price;
      }, 0);
      var rows = inv.lines.map(function (line) {
        return "<tr><td>" + escapeHtml(line.ingredient) + "</td>" +
          '<td class="num">' + line.qty + " " + escapeHtml(line.unit) + "</td>" +
          '<td class="num">' + money(line.price) + "</td>" +
          '<td class="num">' + money(line.qty * line.price) + "</td></tr>";
      }).join("");
      return '<div class="invoice-card"><h3>' + escapeHtml(inv.supplier || "Unknown supplier") + "</h3>" +
        '<div class="inv-date">' + formatDate(inv.date) + " &middot; " + inv.lines.length +
        " line" + (inv.lines.length === 1 ? "" : "s") + " &middot; total " + money(total) + "</div>" +
        '<table><tr><th>Ingredient</th><th class="num">Qty</th><th class="num">Unit price</th><th class="num">Total</th></tr>' +
        rows + "</table>" +
        '<button class="btn small ghost danger" type="button" data-delete-invoice="' + inv.id + '">Delete invoice</button></div>';
    }).join("") + "</div>";
  }
  renderManualLines();
}

/* ---------- invoice intake: paste, upload, manual, preview ---------- */

function setIntakeTab(tab) {
  ["paste", "upload", "manual"].forEach(function (t) {
    $("tab-" + t).classList.toggle("active", t === tab);
    $("panel-" + t).hidden = t !== tab;
  });
}

function setParseBusy(busy, label) {
  $("parsePasteBtn").disabled = busy;
  $("parsePasteAiBtn").disabled = busy;
  $("pasteStatus").textContent = busy ? (label || "Working...") : "";
}

function openPreview(parsed, sourceLabel) {
  var lines = normaliseLines(parsed.lines);
  if (lines.length === 0) {
    showNotice("No ingredient lines were found. Check the text and try again, or add the lines by hand.", "warn");
    return;
  }
  pendingInvoice = {
    supplier: parsed.supplier || "",
    date: parsed.date || todayISO(),
    lines: lines,
    skipped: parsed.skipped || [],
    source: sourceLabel || "Local parser"
  };
  $("previewPanel").hidden = false;
  $("previewSource").textContent = "Parsed by " + pendingInvoice.source +
    ". Check every line before saving: the preview is editable.";
  renderPreview();
  $("previewPanel").scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderPreview() {
  if (!pendingInvoice) return;
  $("previewSupplier").value = pendingInvoice.supplier;
  $("previewDate").value = pendingInvoice.date;
  var body = $("previewBody");
  body.innerHTML = pendingInvoice.lines.map(function (line, i) {
    var options = state.ingredients.map(function (ing) {
      return '<option value="' + escapeHtml(ing.name) + '"' +
        (ing.name === line.ingredient ? " selected" : "") + ">" +
        escapeHtml(ing.name) + "</option>";
    }).join("");
    if (!ingredientByName(line.ingredient)) {
      options += '<option value="' + escapeHtml(line.ingredient) + '" selected>' +
        escapeHtml(line.ingredient) + " (new)</option>";
    }
    return "<tr>" +
      '<td><select data-preview-field="ingredient" data-index="' + i + '">' + options + "</select>" +
      (line.uncertain ? ' <span class="badge badge-watch">Check</span>' : "") + "</td>" +
      '<td><input type="number" min="0.001" step="0.001" value="' + line.qty +
      '" data-preview-field="qty" data-index="' + i + '"></td>' +
      '<td><select data-preview-field="unit" data-index="' + i + '">' +
      ["kg", "g", "l", "ml", "dozen", "each", "pack", "box", "bag", "bottle"].map(function (u) {
        return '<option value="' + u + '"' + (u === line.unit ? " selected" : "") + ">" + u + "</option>";
      }).join("") + "</select></td>" +
      '<td><input type="number" min="0.0001" step="0.0001" value="' + line.price +
      '" data-preview-field="price" data-index="' + i + '"></td>' +
      '<td class="num">' + money(line.qty * line.price) + "</td>" +
      '<td><button class="btn small ghost danger" type="button" data-preview-remove="' + i + '">Remove</button></td>' +
      "</tr>";
  }).join("");
  var skipped = pendingInvoice.skipped;
  $("previewSkipped").textContent = skipped.length > 0
    ? skipped.length + " line" + (skipped.length === 1 ? " was" : "s were") +
      " skipped: " + skipped.map(function (s) { return s.line; }).join("; ")
    : "";
}

function closePreview() {
  pendingInvoice = null;
  $("previewPanel").hidden = true;
}

function savePendingInvoice() {
  if (!pendingInvoice) return;
  var supplier = $("previewSupplier").value.trim();
  var date = $("previewDate").value;
  if (!date) {
    showNotice("Pick an invoice date before saving.", "warn");
    return;
  }
  if (pendingInvoice.lines.length === 0) {
    showNotice("Add at least one line before saving.", "warn");
    return;
  }
  var lines = normaliseLines(pendingInvoice.lines);
  ensureIngredients(lines);
  state.invoices.push({
    id: uid(),
    supplier: supplier || "Unknown supplier",
    date: date,
    lines: lines
  });
  state.isSample = false;
  addActivity("Invoice added: " + (supplier || "Unknown supplier") + ", " +
    formatDate(date) + " (" + lines.length + " line" + (lines.length === 1 ? "" : "s") + ").");
  closePreview();
  persist();
  renderAll();
  showNotice("Invoice saved. Price history, recipes and alerts are updated.", "ok");
}

function onParsePaste(useAi) {
  var text = $("pasteText").value.trim();
  if (!text) {
    showNotice("Paste the invoice text first, or try the sample text.", "warn");
    return;
  }
  hideNotice();
  if (!useAi) {
    var parsed = parseInvoiceText(text, state.ingredients);
    openPreview(parsed, "Local parser");
    return;
  }
  setParseBusy(true, "Gemini is reading the invoice...");
  extractInvoiceTextWithGemini(text)
    .then(function (parsed) {
      setParseBusy(false);
      openPreview(parsed, "Gemini");
    })
    .catch(function (err) {
      setParseBusy(false);
      console.error("Gemini extraction failed:", err);
      showNotice("Gemini could not read that text (" + (err.message || "unknown error") +
        "). The local parser is still available below.", "error");
    });
}

function fileToBase64(file) {
  return new Promise(function (resolve, reject) {
    var reader = new FileReader();
    reader.onload = function () {
      var dataUrl = reader.result;
      resolve(dataUrl.split(",")[1]);
    };
    reader.onerror = function () { reject(new Error("Could not read the file.")); };
    reader.readAsDataURL(file);
  });
}

function onFileChosen(event) {
  var file = event.target.files && event.target.files[0];
  if (!file) return;
  hideNotice();
  $("uploadStatus").textContent = "Reading " + file.name + "...";
  if (isLocalTextFile(file.type, file.name)) {
    file.text().then(function (text) {
      $("uploadStatus").textContent = "";
      var parsed = parseInvoiceText(text, state.ingredients);
      openPreview(parsed, "Local parser");
    }).catch(function () {
      $("uploadStatus").textContent = "";
      showNotice("Could not read that text file.", "error");
    });
    return;
  }
  if (isAIVisionFile(file.type)) {
    if (!isFirebaseConfigured) {
      $("uploadStatus").textContent = "";
      showNotice("Photos and PDFs need AI extraction, which needs Firebase. " +
        "Paste the invoice text instead, or add the lines by hand.", "warn");
      return;
    }
    fileToBase64(file)
      .then(function (base64) {
        return extractInvoiceFileWithGemini(base64, file.type);
      })
      .then(function (parsed) {
        $("uploadStatus").textContent = "";
        openPreview(parsed, "Gemini");
      })
      .catch(function (err) {
        $("uploadStatus").textContent = "";
        console.error("Gemini file extraction failed:", err);
        showNotice("Gemini could not read that file (" + (err.message || "unknown error") +
          "). Try pasting the text instead.", "error");
      });
    return;
  }
  $("uploadStatus").textContent = "";
  showNotice("That file type is not supported. Use a photo, a PDF, or a text file.", "warn");
}

/* Manual invoice lines */

function renderManualLines() {
  var wrap = $("manualLines");
  if (manualLines.length === 0) {
    manualLines.push({ ingredient: "", qty: 1, unit: "kg", price: "" });
  }
  wrap.innerHTML = manualLines.map(function (line, i) {
    var options = '<option value="">Pick an ingredient</option>' +
      state.ingredients.map(function (ing) {
        return '<option value="' + escapeHtml(ing.name) + '"' +
          (ing.name === line.ingredient ? " selected" : "") + ">" +
          escapeHtml(ing.name) + " (" + escapeHtml(ing.unit) + ")</option>";
      }).join("") +
      '<option value="__new"' + (line.ingredient === "__new" ? " selected" : "") + ">New ingredient...</option>";
    var nameField = line.ingredient === "__new"
      ? '<input type="text" placeholder="New ingredient name" data-manual-field="newName" data-index="' + i +
        '" value="' + escapeHtml(line.newName || "") + '">'
      : "";
    return '<div class="line-row">' +
      '<select data-manual-field="ingredient" data-index="' + i + '">' + options + "</select>" +
      nameField +
      '<input type="number" min="0.001" step="0.001" placeholder="Qty" value="' + line.qty +
      '" data-manual-field="qty" data-index="' + i + '">' +
      '<select data-manual-field="unit" data-index="' + i + '">' +
      ["kg", "g", "l", "ml", "dozen", "each", "pack", "box", "bag", "bottle"].map(function (u) {
        return '<option value="' + u + '"' + (u === line.unit ? " selected" : "") + ">" + u + "</option>";
      }).join("") + "</select>" +
      '<input type="number" min="0.0001" step="0.0001" placeholder="Unit price ($)" value="' + line.price +
      '" data-manual-field="price" data-index="' + i + '">' +
      '<button class="btn small ghost danger" type="button" data-manual-remove="' + i + '">Remove</button>' +
      "</div>";
  }).join("");
}

function onManualSave(event) {
  event.preventDefault();
  var supplier = $("manualSupplier").value.trim();
  var date = $("manualDate").value;
  if (!date) {
    showNotice("Pick an invoice date before saving.", "warn");
    return;
  }
  var rawLines = [];
  for (var i = 0; i < manualLines.length; i++) {
    var line = manualLines[i];
    var name = line.ingredient === "__new" ? (line.newName || "").trim() : line.ingredient;
    var price = parseFloat(line.price);
    if (!name || !(price > 0)) continue;
    rawLines.push({ ingredient: name, qty: Number(line.qty) || 1, unit: line.unit, price: price });
  }
  if (rawLines.length === 0) {
    showNotice("Add at least one line with an ingredient and a price above zero.", "warn");
    return;
  }
  var lines = normaliseLines(rawLines);
  ensureIngredients(lines);
  state.invoices.push({
    id: uid(),
    supplier: supplier || "Unknown supplier",
    date: date,
    lines: lines
  });
  state.isSample = false;
  addActivity("Invoice added by hand: " + (supplier || "Unknown supplier") + ", " +
    formatDate(date) + " (" + lines.length + " line" + (lines.length === 1 ? "" : "s") + ").");
  manualLines = [{ ingredient: "", qty: 1, unit: "kg", price: "" }];
  $("manualSupplier").value = "";
  $("manualDate").value = todayISO();
  persist();
  renderAll();
  showNotice("Invoice saved. Price history, recipes and alerts are updated.", "ok");
}

/* ---------- rendering: prices ---------- */

function renderPrices() {
  var wrap = $("priceCards");
  var hs = histories();
  if (hs.length === 0) {
    wrap.innerHTML = '<p class="small">No ingredients yet. Add an invoice to start tracking prices.</p>';
    return;
  }
  wrap.innerHTML = hs.map(function (h) {
    var first = earliestPoint(h.points);
    var last = latestPoint(h.points);
    var prev = previousPoint(h.points);
    var change = (h.points.length < 2 || !first || !last) ? null : priceChangePct(first.price, last.price);
    var recent = (!last || !prev) ? null : priceChangePct(prev.price, last.price);
    var changeHtml = change === null ? '<span class="small">n/a, one price point so far</span>' :
      '<span class="' + (change > 0 ? "up" : "down") + '">' + pct(change) + "</span>";
    var recentHtml = recent === null ? "" :
      ' <span class="small">(latest move: <span class="' + (recent > 0 ? "up" : "down") + '">' +
      pct(recent) + "</span>)</span>";
    var tableRows = h.points.slice().reverse().map(function (p) {
      return "<tr><td>" + formatDate(p.date) + '</td><td class="num">' + money(p.price) + "</td></tr>";
    }).join("");
    return '<div class="price-card"><h3>' + escapeHtml(h.name) +
      ' <span class="small">(' + escapeHtml(h.unit) + ")</span></h3>" +
      '<div class="price-now">Latest: <strong>' + (last ? money(last.price) : "n/a") + "</strong> " +
      (last ? '<span class="small">' + formatDate(last.date) + "</span>" : "") + "</div>" +
      '<div class="price-change">Change since first price: ' + changeHtml + recentHtml + "</div>" +
      lineChartSVG(h.points, { label: h.name }) +
      '<div class="table-wrap"><table><tr><th>Date</th><th class="num">Price</th></tr>' +
      tableRows + "</table></div></div>";
  }).join("");
}

/* ---------- rendering: recipes ---------- */

function renderRecipes() {
  var list = $("recipeList");
  var rows = costingRows();
  if (rows.length === 0) {
    list.innerHTML = '<p class="small">No recipes yet. Add your first recipe below.</p>';
  } else {
    list.innerHTML = rows.map(function (r) {
      var recipe = r.recipe;
      var marginText = r.marginPct === null ? "No price yet for one or more ingredients." :
        "Margin " + money(r.marginAmount) + " (" + r.marginPct.toFixed(1) + "%) at a " +
        money(r.sellPrice) + " selling price.";
      var costText = r.costNow === null ? "Cost: n/a" :
        "Cost now " + money(r.costNow) +
        (r.costThen !== null ? " (was " + money(r.costThen) + ")" : "");
      var ingText = recipe.ingredients.map(function (ing) {
        return escapeHtml(ing.name) + " " + ing.qty;
      }).join(", ");
      return '<div class="recipe-card"><div class="recipe-head"><h3>' + escapeHtml(recipe.name) + "</h3>" +
        '<span class="badge badge-' + r.status + '">' + statusLabel(r.status) + "</span></div>" +
        '<p class="small">' + escapeHtml(recipe.note || "") + "</p>" +
        "<p>" + escapeHtml(ingText) + "</p>" +
        "<p>" + costText + "<br>" + marginText + "<br>" +
        '<span class="small">Target margin: ' + recipe.targetPct + "%</span></p>" +
        '<div class="btn-row"><button class="btn small" type="button" data-edit-recipe="' + recipe.id + '">Edit recipe</button>' +
        '<button class="btn small ghost danger" type="button" data-delete-recipe="' + recipe.id + '">Delete</button></div></div>';
    }).join("");
  }
  if (editingRecipeId !== null || $("recipeEditor").hidden === false) {
    renderEditorLines();
  }
}

function openRecipeEditor(recipeId) {
  var recipe = null;
  if (recipeId) {
    for (var i = 0; i < state.recipes.length; i++) {
      if (state.recipes[i].id === recipeId) recipe = state.recipes[i];
    }
  }
  editingRecipeId = recipe ? recipe.id : null;
  $("recipeEditorTitle").textContent = recipe ? "Edit recipe" : "Add a recipe";
  $("recipeName").value = recipe ? recipe.name : "";
  $("recipeSellPrice").value = recipe ? recipe.sellPrice : "";
  $("recipeTarget").value = recipe ? recipe.targetPct : 60;
  $("recipeNote").value = recipe ? (recipe.note || "") : "";
  $("recipeDeleteBtn").hidden = !recipe;
  editorLines = recipe
    ? recipe.ingredients.map(function (ing) {
        return { name: ing.name, qty: ing.qty, isNew: false, newName: "", newUnit: "kg" };
      })
    : [{ name: "", qty: 0, isNew: false, newName: "", newUnit: "kg" }];
  $("recipeEditor").hidden = false;
  renderEditorLines();
  $("recipeEditor").scrollIntoView({ behavior: "smooth", block: "start" });
}

function closeRecipeEditor() {
  editingRecipeId = null;
  editorLines = [];
  $("recipeEditor").hidden = true;
}

function renderEditorLines() {
  var wrap = $("recipeLines");
  wrap.innerHTML = editorLines.map(function (line, i) {
    var options = '<option value="">Pick an ingredient</option>' +
      state.ingredients.map(function (ing) {
        return '<option value="' + escapeHtml(ing.name) + '"' +
          (ing.name === line.name && !line.isNew ? " selected" : "") + ">" +
          escapeHtml(ing.name) + "</option>";
      }).join("") +
      '<option value="__new"' + (line.isNew ? " selected" : "") + ">New ingredient...</option>";
    var ing = !line.isNew ? ingredientByName(line.name) : null;
    var unitLabel = line.isNew ? line.newUnit : baseUnitLabel(ing);
    var newFields = line.isNew
      ? '<input type="text" placeholder="New ingredient name" data-editor-field="newName" data-index="' + i +
        '" value="' + escapeHtml(line.newName || "") + '">' +
        '<select data-editor-field="newUnit" data-index="' + i + '">' +
        ["kg", "l", "dozen", "each", "pack", "box", "bag", "bottle"].map(function (u) {
          return '<option value="' + u + '"' + (u === line.newUnit ? " selected" : "") + ">" + u + "</option>";
        }).join("") + "</select>"
      : "";
    return '<div class="line-row">' +
      '<select data-editor-field="name" data-index="' + i + '">' + options + "</select>" +
      newFields +
      '<input type="number" min="0.001" step="0.001" placeholder="Qty" value="' + (line.qty || "") +
      '" data-editor-field="qty" data-index="' + i + '">' +
      '<span class="small unit-label">' + escapeHtml(unitLabel) + "</span>" +
      '<button class="btn small ghost danger" type="button" data-editor-remove="' + i + '">Remove</button>' +
      "</div>";
  }).join("");
}

function onRecipeSave(event) {
  event.preventDefault();
  var name = $("recipeName").value.trim();
  var sellPrice = parseFloat($("recipeSellPrice").value);
  var target = parseFloat($("recipeTarget").value);
  var note = $("recipeNote").value.trim();
  if (!name) {
    showNotice("Give the recipe a name.", "warn");
    return;
  }
  if (!(sellPrice > 0)) {
    showNotice("Enter a selling price above zero.", "warn");
    return;
  }
  if (isNaN(target) || target < 0 || target > 100) {
    showNotice("Enter a margin target between 0 and 100.", "warn");
    return;
  }
  var ingredients = [];
  for (var i = 0; i < editorLines.length; i++) {
    var line = editorLines[i];
    var ingName = line.isNew ? (line.newName || "").trim() : line.name;
    var qty = parseFloat(line.qty);
    if (!ingName || !(qty > 0)) continue;
    if (line.isNew && !ingredientByName(ingName)) {
      state.ingredients.push({
        name: ingName,
        unit: displayUnit(line.newUnit),
        factor: line.newUnit === "dozen" ? 12 : 1
      });
    }
    ingredients.push({ name: ingName, qty: qty });
  }
  if (ingredients.length === 0) {
    showNotice("Add at least one ingredient with a quantity above zero.", "warn");
    return;
  }
  if (editingRecipeId) {
    for (var j = 0; j < state.recipes.length; j++) {
      if (state.recipes[j].id === editingRecipeId) {
        state.recipes[j] = {
          id: editingRecipeId, name: name, sellPrice: sellPrice,
          targetPct: target, note: note, ingredients: ingredients
        };
      }
    }
    addActivity("Recipe updated: " + name + ".");
  } else {
    state.recipes.push({
      id: uid(), name: name, sellPrice: sellPrice,
      targetPct: target, note: note, ingredients: ingredients
    });
    addActivity("Recipe added: " + name + ".");
  }
  state.isSample = false;
  closeRecipeEditor();
  persist();
  renderAll();
  showNotice("Recipe saved.", "ok");
}

/* ---------- rendering: alerts ---------- */

function renderAlerts() {
  var alerts = activeAlerts();
  var moves = recentMoves(histories(), MOVE_THRESHOLD);
  var feed = $("alertFeed");
  var items = "";
  alerts.forEach(function (a) {
    items += '<li class="alert-item alert-' + a.status + '"><strong>' + escapeHtml(a.name) +
      '</strong>: margin ' + a.marginPct.toFixed(1) + "% against a " + a.targetPct +
      "% target. Short by " + a.shortfall.toFixed(1) + " points at a " +
      money(a.sellPrice) + " selling price.</li>";
  });
  moves.forEach(function (m) {
    var cls = m.changePct > 0 ? "up" : "down";
    items += '<li class="alert-item"><strong>' + escapeHtml(m.name) +
      '</strong> moved <span class="' + cls + '">' + pct(m.changePct) + "</span> since the last invoice (" +
      money(m.from) + " to " + money(m.to) + " " + escapeHtml(m.unit) + ", " + formatDate(m.date) + ").</li>";
  });
  if (!items) {
    feed.innerHTML = '<div class="alert-box ok"><h3>No alerts</h3>' +
      "<p>No recipe is below its target margin, and no ingredient moved " + MOVE_THRESHOLD +
      "% or more since the last invoice.</p></div>";
  } else {
    feed.innerHTML = '<ul class="alert-list">' + items + "</ul>";
  }

  var movers = biggestMovers(histories());
  var rows = movers.map(function (m) {
    var changeHtml = m.changePct === null ? '<span class="small">n/a</span>' :
      '<span class="' + (m.changePct > 0 ? "up" : "down") + '">' + pct(m.changePct) + "</span>";
    return "<tr><td>" + escapeHtml(m.name) + "</td>" +
      '<td class="num">' + (m.first === null ? "n/a" : money(m.first)) + "</td>" +
      '<td class="num">' + (m.last === null ? "n/a" : money(m.last)) + "</td>" +
      '<td class="num">' + changeHtml + "</td></tr>";
  }).join("");
  $("moversTable").innerHTML = movers.length === 0
    ? '<p class="small">No ingredients yet.</p>'
    : '<div class="table-wrap"><table><thead><tr><th>Ingredient</th>' +
      '<th class="num">First price</th><th class="num">Latest price</th>' +
      '<th class="num">Change</th></tr></thead><tbody>' + rows + "</tbody></table></div>";

  var targetRows = costingRows().map(function (r) {
    return "<tr><td>" + escapeHtml(r.recipe.name) + "</td>" +
      '<td class="num">' + r.recipe.targetPct + "%</td>" +
      '<td class="num">' + (r.marginPct === null ? "n/a" : r.marginPct.toFixed(1) + "%") + "</td>" +
      '<td><span class="badge badge-' + r.status + '">' + statusLabel(r.status) + "</span></td>" +
      '<td><button class="btn small ghost" type="button" data-edit-recipe="' + r.recipe.id + '">Edit</button></td></tr>';
  }).join("");
  $("targetsTable").innerHTML = targetRows
    ? '<div class="table-wrap"><table><thead><tr><th>Recipe</th><th class="num">Target</th>' +
      '<th class="num">Margin now</th><th>Status</th><th></th></tr></thead><tbody>' +
      targetRows + "</tbody></table></div>"
    : '<p class="small">No recipes yet.</p>';
}

/* ---------- sample data controls ---------- */

function onResetSample() {
  if (!window.confirm("Reset to the sample data? Your guest work will be replaced by the sample invoices and recipes.")) return;
  state = sampleState();
  persist();
  renderAll();
  showNotice("Sample data restored.", "ok");
}

function onStartEmpty() {
  if (!window.confirm("Start empty? This clears the sample data and your guest work in this browser.")) return;
  state = emptyState();
  persist();
  renderAll();
  showNotice("Started empty. Add your first invoice to begin.", "ok");
}

function onCopyGuestToCloud() {
  if (!user) return;
  var guest = loadGuestState();
  if (!guest) return;
  if (!window.confirm("Copy your guest data into your account? This replaces what is saved in your account now.")) return;
  guest.isSample = false;
  state = guest;
  persist();
  renderAll();
  showNotice("Guest data copied to your account.", "ok");
}

/* ---------- auth ---------- */

function onSignIn() {
  hideNotice();
  signInWithGoogle()
    .then(function (signedInUser) {
      showNotice("Signed in as " + (signedInUser.displayName || signedInUser.email || "baker") + ".", "ok");
    })
    .catch(function (err) {
      console.error("Sign-in failed:", err);
      showNotice("Sign-in failed (" + (err.message || "unknown error") + "). You can keep using guest demo mode.", "error");
    });
}

function onSignOut() {
  signOutUser().catch(function (err) {
    console.error("Sign-out failed:", err);
  });
}

function handleAuthChange(newUser) {
  user = newUser;
  if (user) {
    mode = "cloud";
    loadCloudState(user)
      .then(function (cloudState) {
        state = cloudState || freshCloudState();
        renderAll();
        if (!cloudState) {
          showNotice("Welcome. Your account is empty, so here is a clean start. " +
            "Use the button below the dashboard to copy your guest work in, or add your first invoice.", "info");
        }
      })
      .catch(function (err) {
        console.error("Cloud load failed:", err);
        showNotice("Could not load your saved data (" + (err.message || "unknown error") +
          "). Showing an empty account for now.", "error");
        state = freshCloudState();
        renderAll();
      });
  } else {
    mode = "guest";
    state = loadGuestState() || sampleState();
    if (!loadGuestState()) persist();
    renderAll();
  }
}

/* ---------- exports ---------- */

function onExportRecipes() {
  var rows = costingRows().map(function (r) {
    return {
      recipe: r.recipe.name, costThen: r.costThen, costNow: r.costNow,
      sellPrice: r.sellPrice, marginAmount: r.marginAmount, marginPct: r.marginPct
    };
  });
  downloadCSV("bakecost-recipes.csv", buildCSV(rows));
  showNotice("Downloaded bakecost-recipes.csv.", "ok");
}

function onExportPrices() {
  downloadCSV("bakecost-prices.csv", buildPriceCSV(histories()));
  showNotice("Downloaded bakecost-prices.csv.", "ok");
}

function onExportInvoices() {
  downloadCSV("bakecost-invoices.csv", buildInvoiceCSV(state.invoices));
  showNotice("Downloaded bakecost-invoices.csv.", "ok");
}

/* ---------- delete actions ---------- */

function onDeleteInvoice(id) {
  var inv = null;
  for (var i = 0; i < state.invoices.length; i++) {
    if (state.invoices[i].id === id) inv = state.invoices[i];
  }
  if (!inv) return;
  if (!window.confirm("Delete the invoice from " + (inv.supplier || "Unknown supplier") +
      " dated " + formatDate(inv.date) + "? Its prices leave the price history.")) return;
  state.invoices = state.invoices.filter(function (item) { return item.id !== id; });
  addActivity("Invoice deleted: " + (inv.supplier || "Unknown supplier") + ", " + formatDate(inv.date) + ".");
  persist();
  renderAll();
  showNotice("Invoice deleted.", "ok");
}

function onDeleteRecipe(id) {
  var recipe = null;
  for (var i = 0; i < state.recipes.length; i++) {
    if (state.recipes[i].id === id) recipe = state.recipes[i];
  }
  if (!recipe) return;
  if (!window.confirm("Delete the recipe " + recipe.name + "?")) return;
  state.recipes = state.recipes.filter(function (item) { return item.id !== id; });
  if (editingRecipeId === id) closeRecipeEditor();
  addActivity("Recipe deleted: " + recipe.name + ".");
  persist();
  renderAll();
  showNotice("Recipe deleted.", "ok");
}

/* ---------- wiring ---------- */

function init() {
  // Tabs.
  document.querySelectorAll(".tab-btn").forEach(function (btn) {
    btn.addEventListener("click", function () { setView(btn.getAttribute("data-view")); });
  });
  // Links that jump to a view.
  document.addEventListener("click", function (event) {
    var goto = event.target.closest("[data-goto]");
    if (goto) {
      event.preventDefault();
      setView(goto.getAttribute("data-goto"));
    }
    var delInv = event.target.closest("[data-delete-invoice]");
    if (delInv) {
      onDeleteInvoice(delInv.getAttribute("data-delete-invoice"));
      return;
    }
    var editRecipe = event.target.closest("[data-edit-recipe]");
    if (editRecipe) {
      setView("recipes");
      openRecipeEditor(editRecipe.getAttribute("data-edit-recipe"));
      return;
    }
    var delRecipe = event.target.closest("[data-delete-recipe]");
    if (delRecipe) {
      onDeleteRecipe(delRecipe.getAttribute("data-delete-recipe"));
      return;
    }
    var previewRemove = event.target.closest("[data-preview-remove]");
    if (previewRemove) {
      pendingInvoice.lines.splice(parseInt(previewRemove.getAttribute("data-preview-remove"), 10), 1);
      renderPreview();
      return;
    }
    var manualRemove = event.target.closest("[data-manual-remove]");
    if (manualRemove) {
      manualLines.splice(parseInt(manualRemove.getAttribute("data-manual-remove"), 10), 1);
      renderManualLines();
      return;
    }
    var editorRemove = event.target.closest("[data-editor-remove]");
    if (editorRemove) {
      editorLines.splice(parseInt(editorRemove.getAttribute("data-editor-remove"), 10), 1);
      renderEditorLines();
    }
  });

  // Delegated change handling for dynamic rows (preview, manual, editor).
  document.addEventListener("change", function (event) {
    var el = event.target;
    var field = el.getAttribute("data-preview-field");
    if (field && pendingInvoice) {
      var pi = parseInt(el.getAttribute("data-index"), 10);
      var line = pendingInvoice.lines[pi];
      if (!line) return;
      if (field === "qty" || field === "price") line[field] = parseFloat(el.value) || 0;
      else line[field] = el.value;
      renderPreview();
      return;
    }
    var mfield = el.getAttribute("data-manual-field");
    if (mfield) {
      var mi = parseInt(el.getAttribute("data-index"), 10);
      var mline = manualLines[mi];
      if (!mline) return;
      if (mfield === "qty" || mfield === "price") mline[mfield] = el.value;
      else mline[mfield] = el.value;
      if (mfield === "ingredient") renderManualLines();
      return;
    }
    var efield = el.getAttribute("data-editor-field");
    if (efield) {
      var ei = parseInt(el.getAttribute("data-index"), 10);
      var eline = editorLines[ei];
      if (!eline) return;
      if (efield === "name") {
        if (el.value === "__new") {
          eline.isNew = true;
          eline.name = "";
        } else {
          eline.isNew = false;
          eline.name = el.value;
        }
        renderEditorLines();
      } else if (efield === "qty") {
        eline.qty = el.value;
      } else if (efield === "newName") {
        eline.newName = el.value;
      } else if (efield === "newUnit") {
        eline.newUnit = el.value;
      }
    }
  });

  // Notice close.
  $("noticeClose").addEventListener("click", hideNotice);

  // Auth buttons (static in app.html, shown or hidden by renderHeader).
  $("signInBtn").addEventListener("click", onSignIn);
  $("signOutBtn").addEventListener("click", onSignOut);

  // Dashboard quick actions.
  $("qaAddInvoice").addEventListener("click", function () { setView("invoices"); });
  $("qaAddRecipe").addEventListener("click", function () {
    setView("recipes");
    openRecipeEditor(null);
  });
  $("qaExport").addEventListener("click", onExportRecipes);
  $("copyGuestBtn").addEventListener("click", onCopyGuestToCloud);

  // Sample banner.
  $("resetSampleBtn").addEventListener("click", onResetSample);
  $("startEmptyBtn").addEventListener("click", onStartEmpty);

  // Intake tabs.
  ["paste", "upload", "manual"].forEach(function (t) {
    $("tab-" + t).addEventListener("click", function () { setIntakeTab(t); });
  });

  // Paste intake.
  $("pasteSampleBtn").addEventListener("click", function () {
    $("pasteText").value = SAMPLE_INVOICE_TEXT;
    hideNotice();
  });
  $("parsePasteBtn").addEventListener("click", function () { onParsePaste(false); });
  $("parsePasteAiBtn").addEventListener("click", function () { onParsePaste(true); });
  if (!isFirebaseConfigured) {
    $("parsePasteAiBtn").hidden = true;
    $("pasteAiNote").textContent = "AI extraction is off: Firebase is not configured yet. " +
      "The local parser below works without it, and the README explains how to switch AI on.";
  }

  // Upload intake.
  $("fileInput").addEventListener("change", onFileChosen);

  // Manual intake.
  $("manualDate").value = todayISO();
  $("manualAddLineBtn").addEventListener("click", function () {
    manualLines.push({ ingredient: "", qty: 1, unit: "kg", price: "" });
    renderManualLines();
  });
  $("manualForm").addEventListener("submit", onManualSave);

  // Preview.
  $("previewSaveBtn").addEventListener("click", savePendingInvoice);
  $("previewCancelBtn").addEventListener("click", closePreview);
  $("previewAddLineBtn").addEventListener("click", function () {
    if (!pendingInvoice) return;
    pendingInvoice.lines.push({ ingredient: "", qty: 1, unit: "kg", price: 0, uncertain: true });
    renderPreview();
  });

  // Recipes.
  $("addRecipeBtn").addEventListener("click", function () { openRecipeEditor(null); });
  $("recipeEditorAddLineBtn").addEventListener("click", function () {
    editorLines.push({ name: "", qty: 0, isNew: false, newName: "", newUnit: "kg" });
    renderEditorLines();
  });
  $("recipeForm").addEventListener("submit", onRecipeSave);
  $("recipeCancelBtn").addEventListener("click", closeRecipeEditor);
  $("recipeDeleteBtn").addEventListener("click", function () {
    if (editingRecipeId) onDeleteRecipe(editingRecipeId);
  });

  // Exports.
  $("exportRecipesBtn").addEventListener("click", onExportRecipes);
  $("exportPricesBtn").addEventListener("click", onExportPrices);
  $("exportInvoicesBtn").addEventListener("click", onExportInvoices);

  // Auth state drives the first render (guest mode calls back at once).
  onAuthChange(handleAuthChange);
}

init();
