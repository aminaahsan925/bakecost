// BakeCost charts. Hand-rolled SVG, no library and no network call.
// Pure functions: given price points they return an SVG string, so the
// output is testable in Node and the charts work offline.

function escapeAttr(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function niceNum(value, decimals) {
  return Number(value).toFixed(decimals);
}

// Line chart for one ingredient's price history.
// points: [{ date, price }], sorted or unsorted. options: width, height,
// color (line and dots), label (ingredient name, used in the title).
// Returns an SVG string. With no points it returns an empty-state div;
// with one point it draws a single dot.
export function lineChartSVG(points, options) {
  options = options || {};
  var width = options.width || 560;
  var height = options.height || 180;
  var color = options.color || "#6d1a2d";
  var label = options.label || "Price history";

  if (!points || points.length === 0) {
    return '<div class="chart-empty">No price points yet. Add an invoice to start this line.</div>';
  }

  var sorted = points.slice().sort(function (a, b) {
    return a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
  });

  var padLeft = 52;
  var padRight = 12;
  var padTop = 14;
  var padBottom = 28;
  var innerW = width - padLeft - padRight;
  var innerH = height - padTop - padBottom;

  var prices = sorted.map(function (p) { return p.price; });
  var min = Math.min.apply(null, prices);
  var max = Math.max.apply(null, prices);
  if (min === max) {
    min = min - Math.abs(min) * 0.1 - 0.5;
    max = max + Math.abs(max) * 0.1 + 0.5;
  }
  var span = max - min;
  // Pad the range a little so dots never sit on the frame.
  min -= span * 0.08;
  max += span * 0.08;
  span = max - min;

  function x(i) {
    if (sorted.length === 1) return padLeft + innerW / 2;
    return padLeft + (innerW * i) / (sorted.length - 1);
  }
  function y(price) {
    return padTop + innerH - ((price - min) / span) * innerH;
  }

  var parts = [];
  parts.push('<svg class="chart" viewBox="0 0 ' + width + ' ' + height +
    '" role="img" aria-label="' + escapeAttr(label) + ' price history chart">');

  // Gridlines and value labels at min, middle, max.
  [0, 0.5, 1].forEach(function (frac) {
    var value = min + span * frac;
    var gy = padTop + innerH - frac * innerH;
    parts.push('<line x1="' + padLeft + '" y1="' + niceNum(gy, 1) +
      '" x2="' + (width - padRight) + '" y2="' + niceNum(gy, 1) +
      '" class="chart-grid" />');
    parts.push('<text x="' + (padLeft - 8) + '" y="' + niceNum(gy + 4, 1) +
      '" class="chart-label" text-anchor="end">$' + niceNum(value, 2) + '</text>');
  });

  // Line path.
  if (sorted.length > 1) {
    var d = sorted.map(function (p, i) {
      return (i === 0 ? "M" : "L") + niceNum(x(i), 1) + " " + niceNum(y(p.price), 1);
    }).join(" ");
    parts.push('<path d="' + d + '" fill="none" stroke="' + color +
      '" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" />');
  }

  // Dots with value labels.
  sorted.forEach(function (p, i) {
    parts.push('<circle cx="' + niceNum(x(i), 1) + '" cy="' + niceNum(y(p.price), 1) +
      '" r="4" fill="' + color + '" stroke="#fff" stroke-width="1.5"><title>' +
      escapeAttr(p.date) + ': $' + niceNum(p.price, 2) + '</title></circle>');
  });

  // Date labels: first, middle (when there are 5 or more points), last.
  var dateIdx = [0];
  if (sorted.length >= 5) dateIdx.push(Math.floor((sorted.length - 1) / 2));
  if (sorted.length > 1) dateIdx.push(sorted.length - 1);
  dateIdx.forEach(function (i, k) {
    var anchor = k === 0 ? "start" : (k === dateIdx.length - 1 ? "end" : "middle");
    parts.push('<text x="' + niceNum(x(i), 1) + '" y="' + (height - 8) +
      '" class="chart-label" text-anchor="' + anchor + '">' +
      escapeAttr(shortDate(sorted[i].date)) + '</text>');
  });

  parts.push("</svg>");
  return parts.join("");
}

function shortDate(iso) {
  var parts = String(iso).split("-");
  if (parts.length !== 3) return iso;
  var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return parseInt(parts[2], 10) + " " + months[parseInt(parts[1], 10) - 1] + " " + parts[0].slice(2);
}

// Small sparkline for dashboard cards and recipe rows.
// points: [{ date, price }]. Returns an SVG string, or "" when empty.
export function sparklineSVG(points, options) {
  options = options || {};
  var width = options.width || 120;
  var height = options.height || 36;
  var color = options.color || "#6d1a2d";
  if (!points || points.length === 0) return "";
  var sorted = points.slice().sort(function (a, b) {
    return a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
  });
  var prices = sorted.map(function (p) { return p.price; });
  var min = Math.min.apply(null, prices);
  var max = Math.max.apply(null, prices);
  if (min === max) { min -= 0.5; max += 0.5; }
  var span = max - min;
  var pad = 3;
  function x(i) {
    if (sorted.length === 1) return width / 2;
    return pad + ((width - pad * 2) * i) / (sorted.length - 1);
  }
  function y(price) {
    return pad + (height - pad * 2) - ((price - min) / span) * (height - pad * 2);
  }
  var d = sorted.map(function (p, i) {
    return (i === 0 ? "M" : "L") + niceNum(x(i), 1) + " " + niceNum(y(p.price), 1);
  }).join(" ");
  var last = sorted[sorted.length - 1];
  return '<svg class="sparkline" viewBox="0 0 ' + width + ' ' + height +
    '" aria-hidden="true"><path d="' + d + '" fill="none" stroke="' + color +
    '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />' +
    '<circle cx="' + niceNum(x(sorted.length - 1), 1) + '" cy="' + niceNum(y(last.price), 1) +
    '" r="3" fill="' + color + '" /></svg>';
}
