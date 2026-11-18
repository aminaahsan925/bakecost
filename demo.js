/* BakeCost demo. All data on this page is sample data, clearly labelled.
   State lives in memory only; nothing is sent anywhere. */

(function () {
  "use strict";

  var C = window.BakeCost;

  /* Ingredients. "unit" is the display unit on invoices; "factor" converts
     the display price to a price per base unit used by recipes. Eggs are
     priced per dozen but recipes count single eggs, so factor 12. */
  var INGREDIENTS = [
    { name: "Eggs", unit: "per dozen", factor: 12 },
    { name: "Butter", unit: "per kg", factor: 1 },
    { name: "Wheat flour", unit: "per kg", factor: 1 },
    { name: "Sugar", unit: "per kg", factor: 1 }
  ];

  /* Sample supplier invoices. Dollar prices are illustrative. The end to end
     moves for eggs, butter and flour match the public figures on the home
     page (eggs down 35%, butter down 17%, flour up 24%). */
  var invoices = [
    {
      id: 1, supplier: "Millbrook Supplies", date: "2025-09-12",
      lines: [
        { ingredient: "Eggs", price: 6.00 },
        { ingredient: "Butter", price: 8.00 },
        { ingredient: "Wheat flour", price: 2.50 },
        { ingredient: "Sugar", price: 1.80 }
      ]
    },
    {
      id: 2, supplier: "Millbrook Supplies", date: "2026-03-10",
      lines: [
        { ingredient: "Eggs", price: 5.10 },
        { ingredient: "Butter", price: 7.40 },
        { ingredient: "Wheat flour", price: 2.80 },
        { ingredient: "Sugar", price: 1.85 }
      ]
    },
    {
      id: 3, supplier: "Millbrook Supplies", date: "2026-09-08",
      lines: [
        { ingredient: "Eggs", price: 3.90 },
        { ingredient: "Butter", price: 6.64 },
        { ingredient: "Wheat flour", price: 3.10 },
        { ingredient: "Sugar", price: 1.90 }
      ]
    }
  ];

  /* Sample recipes. Quantities are in base units (kg, or single eggs). */
  var RECIPES = [
    {
      name: "Butter Cake",
      sellPrice: 24.00,
      note: "500g butter, 400g flour, 4 eggs.",
      ingredients: [
        { name: "Butter", qty: 0.5 },
        { name: "Wheat flour", qty: 0.4 },
        { name: "Eggs", qty: 4 }
      ]
    },
    {
      name: "Sourdough Loaf",
      sellPrice: 8.00,
      note: "600g flour. Salt and water not costed.",
      ingredients: [
        { name: "Wheat flour", qty: 0.6 }
      ]
    },
    {
      name: "Lemon Drizzle",
      sellPrice: 18.00,
      note: "300g flour, 250g butter, 3 eggs, 200g sugar.",
      ingredients: [
        { name: "Wheat flour", qty: 0.3 },
        { name: "Butter", qty: 0.25 },
        { name: "Eggs", qty: 3 },
        { name: "Sugar", qty: 0.2 }
      ]
    }
  ];

  var targetPct = 60;
  var nextInvoiceId = 4;

  /* ---------- helpers ---------- */

  function ingredientByName(name) {
    for (var i = 0; i < INGREDIENTS.length; i++) {
      if (INGREDIENTS[i].name === name) return INGREDIENTS[i];
    }
    return null;
  }

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatDate(iso) {
    var parts = iso.split("-");
    var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return parseInt(parts[2], 10) + " " + months[parseInt(parts[1], 10) - 1] + " " + parts[0];
  }

  /* All price points for one ingredient, across all invoices. */
  function pricePoints(name) {
    var points = [];
    invoices.forEach(function (inv) {
      inv.lines.forEach(function (line) {
        if (line.ingredient === name) {
          points.push({ date: inv.date, price: line.price });
        }
      });
    });
    points.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    return points;
  }

  /* Price set for recipe costing: earliest or latest point per ingredient. */
  function priceSet(which) {
    var set = {};
    INGREDIENTS.forEach(function (ing) {
      var points = pricePoints(ing.name);
      var point = which === "earliest" ? C.earliestPoint(points) : C.latestPoint(points);
      if (point) set[ing.name] = { price: point.price, factor: ing.factor };
    });
    return set;
  }

  /* One row of the costing table per recipe. */
  function costingRows() {
    var thenPrices = priceSet("earliest");
    var nowPrices = priceSet("latest");
    return RECIPES.map(function (recipe) {
      var costThen = C.recipeCost(recipe, thenPrices);
      var costNow = C.recipeCost(recipe, nowPrices);
      var m = C.margin(costNow, recipe.sellPrice);
      return {
        recipe: recipe.name,
        note: recipe.note,
        costThen: costThen,
        costNow: costNow,
        sellPrice: recipe.sellPrice,
        marginAmount: m.amount,
        marginPct: m.pct
      };
    });
  }

  /* ---------- rendering ---------- */

  function renderInvoices() {
    var el = document.getElementById("invoiceCards");
    el.innerHTML = invoices.map(function (inv) {
      var rows = inv.lines.map(function (line) {
        var ing = ingredientByName(line.ingredient);
        var unit = ing ? ing.unit : "per unit";
        return "<tr><td>" + escapeHtml(line.ingredient) + "</td><td class=\"num\">" +
          C.money(line.price) + " " + escapeHtml(unit) + "</td></tr>";
      }).join("");
      return "<div class=\"invoice-card\"><h3>Sample invoice</h3>" +
        "<div class=\"inv-date\">" + escapeHtml(inv.supplier) + ", " + formatDate(inv.date) + "</div>" +
        "<table><tr><th>Ingredient</th><th class=\"num\">Price</th></tr>" + rows + "</table></div>";
    }).join("");
  }

  function renderPriceHistory() {
    var head = document.getElementById("priceHistoryHead");
    var body = document.getElementById("priceHistoryBody");
    var dates = invoices.map(function (inv) { return inv.date; }).sort();
    var headHtml = "<tr><th>Ingredient</th>";
    dates.forEach(function (d) { headHtml += "<th class=\"num\">" + formatDate(d) + "</th>"; });
    headHtml += "<th class=\"num\">Change</th></tr>";
    head.innerHTML = headHtml;

    body.innerHTML = INGREDIENTS.map(function (ing) {
      var points = pricePoints(ing.name);
      var byDate = {};
      points.forEach(function (p) { byDate[p.date] = p.price; });
      var cells = dates.map(function (d) {
        return "<td class=\"num\">" + (byDate[d] !== undefined ? C.money(byDate[d]) : "-") + "</td>";
      }).join("");
      var first = C.earliestPoint(points);
      var last = C.latestPoint(points);
      /* One price point means no change measured yet, so show n/a. */
      var change = (points.length < 2 || !first || !last) ? null : C.priceChangePct(first.price, last.price);
      var changeHtml = change === null ? "<td class=\"num\">n/a</td>" :
        "<td class=\"num " + (change > 0 ? "up" : "down") + "\">" + C.pct(change) + "</td>";
      return "<tr><td>" + escapeHtml(ing.name) + " <span class=\"small\">(" + escapeHtml(ing.unit) + ")</span></td>" +
        cells + changeHtml + "</tr>";
    }).join("");
  }

  function renderRecipes() {
    var body = document.getElementById("recipeBody");
    var rows = costingRows();
    body.innerHTML = rows.map(function (r) {
      var change = r.costNow - r.costThen;
      var changeClass = change > 0 ? "up" : "down";
      var ok = r.marginPct >= targetPct;
      var badge = ok
        ? "<span class=\"badge ok\">On target</span>"
        : "<span class=\"badge alert\">Below target</span>";
      return "<tr><td><strong>" + escapeHtml(r.recipe) + "</strong><br>" +
        "<span class=\"small\">" + escapeHtml(r.note) + "</span></td>" +
        "<td class=\"num\">" + C.money(r.costThen) + "</td>" +
        "<td class=\"num\">" + C.money(r.costNow) + "</td>" +
        "<td class=\"num " + changeClass + "\">" + C.money(change) + "</td>" +
        "<td class=\"num\">" + C.money(r.sellPrice) + "</td>" +
        "<td class=\"num\">" + C.money(r.marginAmount) + " (" + r.marginPct.toFixed(1) + "%)</td>" +
        "<td>" + badge + "</td></tr>";
    }).join("");
    renderAlerts(rows);
  }

  function renderAlerts(rows) {
    var box = document.getElementById("alertBox");
    var below = rows.filter(function (r) { return r.marginPct < targetPct; });
    if (below.length === 0) {
      box.className = "alert-box ok";
      box.innerHTML = "<h3>No margin alerts</h3>" +
        "<p>Every sample recipe is at or above your " + targetPct + "% margin target at the latest prices. " +
        "Raise the target to see an alert in action.</p>";
    } else {
      box.className = "alert-box";
      var items = below.map(function (r) {
        return "<li><strong>" + escapeHtml(r.recipe) + "</strong>: margin " +
          r.marginPct.toFixed(1) + "% at a " + C.money(r.sellPrice) +
          " selling price, below your " + targetPct + "% target.</li>";
      }).join("");
      box.innerHTML = "<h3>Margin alerts (" + below.length + ")</h3><ul>" + items + "</ul>";
    }
  }

  function renderAll() {
    renderInvoices();
    renderPriceHistory();
    renderRecipes();
  }

  /* ---------- actions ---------- */

  function applyTarget() {
    var input = document.getElementById("targetInput");
    var value = parseFloat(input.value);
    var status = document.getElementById("targetStatus");
    if (isNaN(value) || value < 0 || value > 100) {
      status.textContent = "Enter a target between 0 and 100.";
      return;
    }
    targetPct = value;
    status.textContent = "Target set to " + value + "%.";
    renderRecipes();
  }

  function addLine(event) {
    event.preventDefault();
    var status = document.getElementById("addStatus");
    var select = document.getElementById("lineIngredient");
    var name = select.value;
    if (name === "__other") {
      name = document.getElementById("lineOtherName").value.trim();
      if (!name) {
        status.textContent = "Enter a name for the new ingredient.";
        return;
      }
      if (!ingredientByName(name)) {
        INGREDIENTS.push({ name: name, unit: "per kg", factor: 1 });
        var opt = document.createElement("option");
        opt.value = name;
        opt.textContent = name + " (per kg)";
        select.appendChild(opt);
      }
    }
    var price = parseFloat(document.getElementById("linePrice").value);
    var date = document.getElementById("lineDate").value;
    if (isNaN(price) || price <= 0) {
      status.textContent = "Enter a price above zero.";
      return;
    }
    if (!date) {
      status.textContent = "Pick a date for this invoice line.";
      return;
    }
    invoices.push({
      id: nextInvoiceId++,
      supplier: "Your entry",
      date: date,
      lines: [{ ingredient: name, price: price }]
    });
    status.textContent = "Added: " + name + " at " + C.money(price) + " on " + formatDate(date) +
      ". The price history and recipe margins below are updated.";
    document.getElementById("addLineForm").reset();
    document.getElementById("lineOtherName").style.display = "none";
    renderAll();
  }

  function exportCSV() {
    var csv = C.buildCSV(costingRows());
    var blob = new Blob([csv], { type: "text/csv" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "bakecost-sample-costing.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    document.getElementById("exportStatus").textContent =
      "Downloaded bakecost-sample-costing.csv with the current costing table.";
  }

  /* ---------- wiring ---------- */

  document.getElementById("applyTarget").addEventListener("click", applyTarget);
  document.getElementById("targetInput").addEventListener("keydown", function (e) {
    if (e.key === "Enter") { e.preventDefault(); applyTarget(); }
  });
  document.getElementById("addLineForm").addEventListener("submit", addLine);
  document.getElementById("lineIngredient").addEventListener("change", function () {
    var other = document.getElementById("lineOtherName");
    other.style.display = this.value === "__other" ? "block" : "none";
    if (this.value === "__other") other.focus();
  });
  document.getElementById("exportCsv").addEventListener("click", exportCSV);

  renderAll();
})();
