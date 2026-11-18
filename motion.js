// BakeCost motion helpers. Pure vanilla JS, no dependencies.
// Shared by the landing page (landing.js) and the app (app.js).
// Every helper is a no-op under prefers-reduced-motion: the caller
// leaves the final value or state in place instead of animating.

// True when the user asked for reduced motion. Guarded so it also
// works in test environments where matchMedia is missing.
export function reducedMotion() {
  try {
    return typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch (err) {
    return false;
  }
}

// Cubic ease-out, the curve the count-ups use.
function easeOutCubic(p) {
  return 1 - Math.pow(1 - p, 3);
}

// Animate an element's text from a start number to a target number.
// options: { from, duration (ms), decimals, prefix, suffix, signed }.
// Progress comes from elapsed time, not frames, so 60Hz and 120Hz
// displays finish together. Under reduced motion the final value is
// set immediately and no frames run.
export function countUp(el, target, options) {
  var opts = options || {};
  var from = typeof opts.from === "number" ? opts.from : 0;
  var duration = opts.duration || 1200;
  var decimals = typeof opts.decimals === "number" ? opts.decimals : 0;
  var prefix = opts.prefix || "";
  var suffix = opts.suffix || "";
  var signed = !!opts.signed;
  function format(value) {
    var sign = signed && value > 0 ? "+" : "";
    return prefix + sign + value.toFixed(decimals) + suffix;
  }
  if (reducedMotion() || duration <= 0) {
    el.textContent = format(target);
    return;
  }
  var start = null;
  var raf = typeof requestAnimationFrame === "function"
    ? requestAnimationFrame
    : function (cb) { return setTimeout(function () { cb(Date.now()); }, 16); };
  function frame(now) {
    if (start === null) start = now;
    var p = Math.min(1, (now - start) / duration);
    var value = from + (target - from) * easeOutCubic(p);
    el.textContent = format(value);
    if (p < 1) raf(frame);
    else el.textContent = format(target);
  }
  raf(frame);
}

// A true damped spring on an element's scale: overshoots once, then
// settles, instead of a fixed curve. Integrated at a fixed timestep
// (120Hz), so the feel is the same on every display. Snappy control
// tuning from the research: stiffness 240, damping 22, mass 1.
// Under reduced motion, or without rAF, nothing happens.
export function springPop(el, options) {
  if (reducedMotion()) return;
  if (typeof requestAnimationFrame !== "function") return;
  var opts = options || {};
  var stiffness = opts.stiffness || 240;
  var damping = opts.damping || 22;
  var mass = opts.mass || 1;
  var peak = opts.peak || 1.35; // how far past 1 the scale goes
  var x = 1; // current scale
  var v = 0; // current velocity
  var target = 1;
  // Kick the spring away from rest so it has something to settle from.
  x = peak;
  var dt = 1 / 120;
  var last = null;
  var acc = 0;
  function frame(now) {
    if (last === null) last = now;
    acc += Math.min(0.05, (now - last) / 1000);
    last = now;
    while (acc >= dt) {
      var force = -stiffness * (x - target) - damping * v;
      v += (force / mass) * dt;
      x += v * dt;
      acc -= dt;
    }
    el.style.transform = "scale(" + x.toFixed(3) + ")";
    if (Math.abs(x - target) < 0.002 && Math.abs(v) < 0.002) {
      el.style.transform = "";
      return;
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
