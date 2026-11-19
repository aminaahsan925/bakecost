// BakeCost landing page: hero entrance, gentle parallax, scroll
// reveals, the receipt reveal, and the mini cost calculator.
// Vanilla JS, no build step, no libraries. v11 "Aesthetic Motion"
// brings motion back (the Dribbble research), but used once per
// idea: a staggered hero entrance, one floating product, a slow
// marquee and a rotating stamp (both CSS), scroll reveals, and
// the receipt slide-in. No loader, no rotator, no masked line
// reveals (the v8/v9 systems stay removed). Everything degrades
// gracefully: with no JS, the page shows all content un-animated
// and the calculator keeps its server-rendered state. Motion
// respects prefers-reduced-motion (parallax skipped in JS, the
// rest killed in CSS).

import { sampleState, SAMPLE_INGREDIENTS, SAMPLE_LABOR_RATE } from "./sample-data.js";
import { trueCost, margin, marginStatus, statusLabel, money, latestPoint, lineCost } from "./costing.js";

var $ = function (id) { return document.getElementById(id); };

// The .js class gates the hero entrance: without JS the hero
// shows fully, with JS it starts hidden and animates in.
document.documentElement.classList.add("js");

function reducedMotion() {
  return typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/* ---------- hero entrance ---------- */

// Adds .hero-in after a tick so the browser paints the start
// state first and the staggered transitions actually run.
function initHeroEntrance() {
  var hero = document.querySelector(".hero");
  if (!hero) return;
  function go() {
    window.setTimeout(function () { hero.classList.add("hero-in"); }, 60);
  }
  if (typeof window.requestAnimationFrame === "function") {
    window.requestAnimationFrame(go);
  } else {
    go();
  }
}

/* ---------- gentle parallax ---------- */

// The hero photo drifts down at 0.3x scroll speed (capped, so it
// never slides out of its frame) and the wheat doodle drifts up
// slightly. Skipped under reduced motion. Only runs while the
// hero is on screen, rAF-throttled.
function initParallax() {
  if (reducedMotion()) return;
  var inner = document.querySelector(".hero-photo-inner");
  var wheat = document.querySelector(".hero-wheat");
  var hero = document.querySelector(".hero");
  if (!inner || !hero) return;
  var ticking = false;
  function update() {
    ticking = false;
    var y = window.scrollY || window.pageYOffset || 0;
    if (y > hero.offsetHeight + 200) return;
    var photoY = Math.min(y * 0.3, 48);
    inner.style.transform = "translateY(" + photoY.toFixed(1) + "px)";
    if (wheat) {
      var wheatY = -Math.min(y * 0.12, 24);
      wheat.style.transform = "rotate(-8deg) translateY(" + wheatY.toFixed(1) + "px)";
    }
  }
  window.addEventListener("scroll", function () {
    if (!ticking) {
      ticking = true;
      window.requestAnimationFrame(update);
    }
  }, { passive: true });
  update();
}

/* ---------- scroll reveals ---------- */

// Fade + 24px rise via IntersectionObserver. The .io-reveals
// class on <html> is what hides .reveal elements before they
// enter, so browsers without IntersectionObserver, or with JS
// off, see everything, un-animated, as normal. Reduced motion
// is handled in CSS: the transition is killed there, so elements
// appear instantly.
function initReveals() {
  if (typeof IntersectionObserver !== "function") return;
  document.documentElement.classList.add("io-reveals");
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add("in");
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: "0px 0px -40px 0px" });
  document.querySelectorAll(".reveal").forEach(function (el) {
    io.observe(el);
  });
}

/* ---------- mini cost calculator ---------- */

// The landing page's one interactive moment: pick a sample recipe,
// move one ingredient price, watch the cost and margin move live.
// Data comes from the same sample dataset as the app, so the numbers
// match what the app shows. No invented prices anywhere. Values
// update instantly on change: no count-up, no badge pop.

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
  var laborRate = data.settings && typeof data.settings.laborRate === "number"
    ? data.settings.laborRate : SAMPLE_LABOR_RATE;
  return { recipes: data.recipes, prices: prices, laborRate: laborRate };
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

function calcRender() {
  var recipe = calcState.recipe;
  var parts = trueCost(recipe, calcPriceSet(), calcState.laborRate);
  var cost = parts === null ? null : parts.total;
  var m = cost === null ? null : margin(cost, recipe.sellPrice);
  var status = m === null ? "unknown" : marginStatus(m.pct, recipe.targetPct);
  var costEl = $("calcCost");
  var marginEl = $("calcMargin");
  var badgeEl = $("calcBadge");
  costEl.textContent = cost === null ? "n/a" : money(cost);
  marginEl.textContent = m === null ? "n/a" : m.pct.toFixed(1) + "%";
  costEl.setAttribute("data-value", cost === null ? "0" : String(cost));
  marginEl.setAttribute("data-value", m === null ? "0" : String(m.pct));
  badgeEl.textContent = statusLabel(status);
  badgeEl.className = "badge " + status;
  badgeEl.setAttribute("data-status", status);
  $("calcPriceValue").textContent =
    money(calcState.price) + " " + displayUnitFor(calcState.ingredient);
  var breakdownEl = $("calcBreakdown");
  if (breakdownEl) {
    if (parts === null) {
      breakdownEl.textContent = "Needs a price for every ingredient.";
    } else {
      var laborMinutes = Number(recipe.laborMinutes) || 0;
      breakdownEl.textContent = "True cost: ingredients " + money(parts.ingredients) +
        ", labor " + money(parts.labor) + (laborMinutes > 0 ? " (" + laborMinutes + " min)" : "") +
        ", packaging " + money(parts.packaging) + ", overhead " + money(parts.overhead) + ".";
    }
  }
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
    laborRate: data.laborRate,
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
  calcRender();
  recipeSelect.addEventListener("change", function () {
    for (var i = 0; i < data.recipes.length; i++) {
      if (data.recipes[i].id === recipeSelect.value) calcState.recipe = data.recipes[i];
    }
    calcFillIngredients();
    calcRender();
  });
  $("calcIngredient").addEventListener("change", function () {
    calcState.ingredient = $("calcIngredient").value;
    calcResetSlider();
    calcRender();
  });
  $("calcSlider").addEventListener("input", function () {
    calcState.price = parseFloat($("calcSlider").value);
    calcRender();
  });
}

/* ---------- receipt reveal ---------- */

// The signature interaction: "Reveal the cost" slides a vintage
// receipt into the recipe card. Every line is real sample data:
// the recipe's ingredients at their latest invoice prices, the
// total cost, the selling price and the margin, plus the sample
// date and "BAKER: BAKECOST DEMO". Nothing is invented. The
// receipt is built on init (so the open animation is only ever
// the CSS slide) and toggled by the button or the Close link.
// ?receipt=1 (or 2, 3, or a recipe id) opens one receipt on
// load: the proof hook, since the headless shell cannot click.

var MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

function formatSampleDate(iso) {
  var parts = iso.split("-");
  var day = parseInt(parts[2], 10);
  var mon = MONTHS[parseInt(parts[1], 10) - 1] || "";
  return day + " " + mon + " " + parts[0];
}

function qtyLabel(ing) {
  // Recipe quantities are in base units: kg, or single eggs.
  if (ing.name === "Eggs") return String(ing.qty);
  return String(ing.qty) + " kg";
}

function pricePerLabel(name) {
  var unit = displayUnitFor(name);
  if (unit === "per dozen") return "/dozen";
  if (unit === "per kg") return "/kg";
  return " " + unit;
}

function buildReceipt(card, recipe, prices, laborRate, dateLabel) {
  var lines = [];
  recipe.ingredients.forEach(function (ing) {
    var p = prices[ing.name];
    if (!p) return;
    var cost = lineCost(ing.qty, p.price, p.factor);
    var desc = ing.name + " " + qtyLabel(ing) + " @ " + money(p.price) + pricePerLabel(ing.name);
    lines.push('<div class="receipt-line"><span>' + desc + '</span><span>' + money(cost) + '</span></div>');
  });
  var parts = trueCost(recipe, prices, laborRate);
  var cost = parts === null ? null : parts.total;
  var m = cost === null ? null : margin(cost, recipe.sellPrice);
  var laborMinutes = Number(recipe.laborMinutes) || 0;
  var laborDesc = "LABOR" + (laborMinutes > 0 ? " " + laborMinutes + " MIN @ " + money(laborRate) + "/HR" : "");
  var html =
    '<div class="receipt-inner"><div class="receipt-paper">' +
    '<p class="receipt-head">BAKECOST</p>' +
    '<p class="receipt-sub">DEMO RECEIPT · SAMPLE DATA</p>' +
    '<div class="receipt-sep"></div>' +
    '<p class="receipt-name">' + recipe.name + '</p>' +
    '<p class="receipt-meta">' + dateLabel + ' · BAKER: BAKECOST DEMO</p>' +
    '<div class="receipt-sep"></div>' +
    lines.join("") +
    '<div class="receipt-line"><span>' + laborDesc + '</span><span>' + (parts === null ? "n/a" : money(parts.labor)) + '</span></div>' +
    '<div class="receipt-line"><span>PACKAGING</span><span>' + (parts === null ? "n/a" : money(parts.packaging)) + '</span></div>' +
    '<div class="receipt-line"><span>OVERHEAD</span><span>' + (parts === null ? "n/a" : money(parts.overhead)) + '</span></div>' +
    '<div class="receipt-sep"></div>' +
    '<div class="receipt-line total"><span>TRUE COST</span><span>' + (cost === null ? "n/a" : money(cost)) + '</span></div>' +
    '<div class="receipt-line"><span>SELLS AT</span><span>' + money(recipe.sellPrice) + '</span></div>' +
    '<div class="receipt-line"><span>MARGIN</span><span>' + (m === null ? "n/a" : m.pct.toFixed(1) + "%") + '</span></div>' +
    '<div class="receipt-sep"></div>' +
    '<p class="receipt-foot">SAMPLE DATA · NOT A REAL SALE</p>' +
    '<button class="receipt-close" type="button">Close</button>' +
    '</div></div>';
  var box = card.querySelector(".receipt");
  if (box) box.innerHTML = html;
}

function setReceiptOpen(card, open) {
  var btn = card.querySelector(".receipt-toggle");
  if (open) {
    card.classList.add("receipt-open");
    if (btn) {
      btn.textContent = "Hide the receipt";
      btn.setAttribute("aria-expanded", "true");
    }
  } else {
    card.classList.remove("receipt-open");
    if (btn) {
      btn.textContent = "Reveal the cost";
      btn.setAttribute("aria-expanded", "false");
    }
  }
}

function initReceipts() {
  var cards = document.querySelectorAll(".product-card[data-recipe]");
  if (cards.length === 0) return;
  var data = latestPrices();
  var state = sampleState();
  var latestDate = "";
  state.invoices.forEach(function (inv) {
    if (inv.date > latestDate) latestDate = inv.date;
  });
  var dateLabel = latestDate ? formatSampleDate(latestDate) : "";
  var byId = {};
  data.recipes.forEach(function (r) { byId[r.id] = r; });
  cards.forEach(function (card) {
    var recipe = byId[card.getAttribute("data-recipe")];
    if (!recipe) return;
    buildReceipt(card, recipe, data.prices, data.laborRate, dateLabel);
    var btn = card.querySelector(".receipt-toggle");
    if (btn) {
      btn.addEventListener("click", function () {
        setReceiptOpen(card, !card.classList.contains("receipt-open"));
      });
    }
    var close = card.querySelector(".receipt-close");
    if (close) {
      close.addEventListener("click", function () { setReceiptOpen(card, false); });
    }
  });
  // Proof hook: ?receipt=1 (or 2, 3, or a recipe id) opens one
  // receipt on load, since the headless shell cannot click.
  var param = null;
  try {
    param = new URLSearchParams(window.location.search).get("receipt");
  } catch (e) { param = null; }
  if (param) {
    var target = null;
    if (param === "1" || param === "2" || param === "3") {
      target = cards[parseInt(param, 10) - 1];
    } else {
      cards.forEach(function (card) {
        if (card.getAttribute("data-recipe") === param) target = card;
      });
    }
    if (target) setReceiptOpen(target, true);
  }
}

initHeroEntrance();
initParallax();
initReveals();
initCalculator();
initReceipts();
