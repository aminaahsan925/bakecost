// BakeCost landing page motion: scroll reveals, count-ups, and the
// mini cost calculator. Vanilla JS, no build step, no libraries.
// Everything degrades gracefully: with no JS, or no scroll-timeline
// support, the page shows all content un-animated.

import { reducedMotion, countUp, springPop } from "./motion.js";
import { sampleState, SAMPLE_INGREDIENTS } from "./sample-data.js";
import { recipeCost, margin, marginStatus, statusLabel, money, latestPoint } from "./costing.js";

var $ = function (id) { return document.getElementById(id); };

/* ---------- scroll reveals ---------- */

// Pure CSS scroll reveals (animation-timeline: view()) are the first
// choice. This IntersectionObserver fallback only runs where the
// browser does not support them. The .io-reveals class on <html> is
// what hides .reveal elements before they enter, so browsers without
// either mechanism see everything, un-animated, as normal.
function supportsScrollTimelines() {
  try {
    return typeof CSS !== "undefined" &&
      typeof CSS.supports === "function" &&
      CSS.supports("animation-timeline", "view()");
  } catch (err) {
    return false;
  }
}

function initReveals() {
  if (supportsScrollTimelines()) return;
  if (typeof IntersectionObserver !== "function") return;
  document.documentElement.classList.add("io-reveals");
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add("in");
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: "0px 0px -50px 0px" });
  document.querySelectorAll(".reveal").forEach(function (el) {
    io.observe(el);
  });
}

/* ---------- count-ups ---------- */

// Elements carry their final value in the HTML (so no-JS and screen
// readers get the real number) plus data-count attributes describing
// how to animate to it. Fires once, when the element scrolls into
// view. Under reduced motion the final values stay as written.
function initCountUps() {
  var els = document.querySelectorAll("[data-count]");
  if (els.length === 0) return;
  if (reducedMotion() || typeof IntersectionObserver !== "function") return;
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      var el = entry.target;
      io.unobserve(el);
      countUp(el, parseFloat(el.getAttribute("data-count")), {
        duration: 1200,
        decimals: parseInt(el.getAttribute("data-count-decimals") || "0", 10),
        suffix: el.getAttribute("data-count-suffix") || "",
        signed: el.getAttribute("data-count-signed") === "true"
      });
    });
  }, { threshold: 0.3 });
  els.forEach(function (el) { io.observe(el); });
}

/* ---------- mini cost calculator ---------- */

// The landing page's one interactive moment: pick a sample recipe,
// move one ingredient price, watch the cost and margin move live.
// Data comes from the same sample dataset as the app, so the numbers
// match what the app shows. No invented prices anywhere.

var calcState = null; // { recipes, prices, recipe, ingredient, price }

function latestPrices() {
  var data = sampleState();
  var prices = {};
  SAMPLE_INGREDIENTS.forEach(function (ing) {
    var points = [];
    data.invoices.forEach(function (inv) {
      inv.lines.forEach(function (line) {
        if (line.ingredient === ing.name) {
          points.push({ date: inv.date, price: line.price });
        }
      });
    });
    var latest = latestPoint(points);
    if (latest) prices[ing.name] = { price: latest.price, factor: ing.factor };
  });
  return { recipes: data.recipes, prices: prices };
}

function displayUnitFor(name) {
  for (var i = 0; i < SAMPLE_INGREDIENTS.length; i++) {
    if (SAMPLE_INGREDIENTS[i].name === name) return SAMPLE_INGREDIENTS[i].unit;
  }
  return "per kg";
}

function calcPriceSet() {
  var prices = {};
  Object.keys(calcState.prices).forEach(function (name) {
    prices[name] = {
      price: name === calcState.ingredient ? calcState.price : calcState.prices[name].price,
      factor: calcState.prices[name].factor
    };
  });
  return prices;
}

function calcRender(animate) {
  var recipe = calcState.recipe;
  var cost = recipeCost(recipe, calcPriceSet());
  var m = cost === null ? null : margin(cost, recipe.sellPrice);
  var status = m === null ? "unknown" : marginStatus(m.pct, recipe.targetPct);
  var costEl = $("calcCost");
  var marginEl = $("calcMargin");
  var badgeEl = $("calcBadge");
  var oldStatus = badgeEl.getAttribute("data-status") || "";
  if (animate && !reducedMotion()) {
    var fromCost = parseFloat(costEl.getAttribute("data-value") || "0");
    var fromMargin = parseFloat(marginEl.getAttribute("data-value") || "0");
    countUp(costEl, cost === null ? 0 : cost, {
      from: fromCost, duration: 250, decimals: 2, prefix: "$"
    });
    countUp(marginEl, m === null ? 0 : m.pct, {
      from: fromMargin, duration: 250, decimals: 1, suffix: "%"
    });
  } else {
    costEl.textContent = cost === null ? "n/a" : money(cost);
    marginEl.textContent = m === null ? "n/a" : m.pct.toFixed(1) + "%";
  }
  costEl.setAttribute("data-value", cost === null ? "0" : String(cost));
  marginEl.setAttribute("data-value", m === null ? "0" : String(m.pct));
  badgeEl.textContent = statusLabel(status);
  badgeEl.className = "badge " + status;
  badgeEl.setAttribute("data-status", status);
  if (animate && status !== oldStatus && status !== "unknown") {
    springPop(badgeEl, { peak: 1.2 });
  }
  $("calcPriceValue").textContent =
    money(calcState.price) + " " + displayUnitFor(calcState.ingredient);
}

function calcFillIngredients() {
  var select = $("calcIngredient");
  select.innerHTML = "";
  calcState.recipe.ingredients.forEach(function (ing) {
    var opt = document.createElement("option");
    opt.value = ing.name;
    var p = calcState.prices[ing.name];
    opt.textContent = ing.name + (p ? " (" + money(p.price) + " " + displayUnitFor(ing.name) + ")" : "");
    select.appendChild(opt);
  });
  calcState.ingredient = calcState.recipe.ingredients[0].name;
  select.value = calcState.ingredient;
  calcResetSlider();
}

function calcResetSlider() {
  var slider = $("calcSlider");
  var latest = calcState.prices[calcState.ingredient].price;
  slider.min = (latest * 0.5).toFixed(2);
  slider.max = (latest * 2).toFixed(2);
  slider.step = "0.05";
  slider.value = latest.toFixed(2);
  calcState.price = latest;
}

function initCalculator() {
  var wrap = $("calc");
  if (!wrap) return;
  var data = latestPrices();
  calcState = {
    recipes: data.recipes,
    prices: data.prices,
    recipe: data.recipes[0],
    ingredient: null,
    price: 0
  };
  var recipeSelect = $("calcRecipe");
  data.recipes.forEach(function (r) {
    var opt = document.createElement("option");
    opt.value = r.id;
    opt.textContent = r.name + " (sells at " + money(r.sellPrice) + ")";
    recipeSelect.appendChild(opt);
  });
  calcFillIngredients();
  calcRender(false);
  recipeSelect.addEventListener("change", function () {
    for (var i = 0; i < data.recipes.length; i++) {
      if (data.recipes[i].id === recipeSelect.value) calcState.recipe = data.recipes[i];
    }
    calcFillIngredients();
    calcRender(true);
  });
  $("calcIngredient").addEventListener("change", function () {
    calcState.ingredient = $("calcIngredient").value;
    calcResetSlider();
    calcRender(true);
  });
  $("calcSlider").addEventListener("input", function () {
    calcState.price = parseFloat($("calcSlider").value);
    calcRender(true);
  });
}

initReveals();
initCountUps();
initCalculator();
