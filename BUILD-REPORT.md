# BakeCost v2: Build Report

Built 2026-11-18. v1 lives untouched at `~/workspace/projects/bakecost/`
and stays deployed as it was. v2 is a fresh folder:
`~/workspace/projects/bakecost-v2/`.

## What was built

v1 was a landing page plus a read-only demo. v2 is the real product:
a landing page plus a working app with invoice intake, price history
with charts, editable recipes, margin alerts, a dashboard, CSV export,
guest demo mode, and Google sign-in with cloud saving and Gemini
invoice reading when Firebase is wired up.

### Landing page (`index.html`, `styles.css`)

Upgraded design: sticky blurred nav, gradient hero with a CSS-built
dashboard mockup showing the real sample numbers (Butter Cake cost
$5.86 at 75.6% margin, Sourdough Loaf $1.86 at 76.8%, eggs down 35%,
wheat flour up 24%), a six-feature grid, how it works, the free audit
offer, the same three pricing plans (now describing the app), and an
FAQ updated for the app (no install, guest demo needs no account,
every invoice is previewed before saving). No invented claims,
testimonials, stats, or user counts anywhere. The real AH logo only.

### App (`app.html`, `app.js`, `app.css`)

Five views, mobile-first (bottom tab bar on phones, top tabs on
desktop):

- Dashboard: summary cards (ingredients tracked, recipes, recipes
  below target, biggest price move), biggest movers with sparklines,
  margin alerts, recent activity, recipe margin table, quick actions.
- Invoices: invoice cards with line totals and delete, plus intake in
  three ways: paste text (local parser or Gemini), upload a file
  (photo or PDF via Gemini when AI is on, text files via the local
  parser), or type lines by hand. Every parsed invoice opens in an
  editable preview (supplier, date, and every line editable, lines
  removable, lines addable) before saving.
- Prices: one card per ingredient with the latest price, change since
  first price, latest move, a hand-rolled SVG line chart, and the full
  table of price points.
- Recipes: recipe cards with cost then and now, margin, and a green,
  amber, or red status against a per-recipe margin target. Add and
  edit recipes with dynamic ingredient rows, including new ingredients
  with no price yet (their cost shows as n/a until an invoice prices
  them).
- Alerts: the alert feed (recipes below target, ingredients that moved
  5% or more since the last invoice), the biggest movers table, and a
  margin targets table with quick edit links.

Supporting modules:

- `costing.js`: v1 maths extended with margin status bands (ok, watch
  within 5 points below target, alert), biggest movers, margin alerts,
  recent moves above a threshold, and price-history and invoice CSV
  builders.
- `invoice-parser.js`: deterministic local parser. Detects supplier
  and date (ISO, DD/MM/YYYY, written dates), reads `@` unit prices,
  `per kg` prices, line totals, leading quantities, `2 x` quantities,
  and gram to kg and ml to L conversion. Skips totals, taxes, and
  noise lines, merges duplicate ingredients, and flags uncertain lines.
- `sample-data.js`: the v1 dataset carried over (3 sample invoices,
  4 ingredients, 3 recipes) with per-recipe margin targets added, plus
  a pasteable sample invoice text.
- `charts.js`: hand-rolled SVG line charts and sparklines. No library,
  no network call.
- `firebase-config.js`: placeholders only (same pattern as StockPilot),
  model gemini-2.0-flash, `isFirebaseConfigured` flag.
- `firebase-app.js`: shared lazy Firebase app instance, dynamic
  imports only.
- `ai.js`: Gemini invoice extraction through Firebase AI Logic, with
  the Gemini Developer API backend selected explicitly (the SDK
  default Vertex AI backend needs billing and is not used). Reads
  pasted text and uploaded photos and PDFs. Returns structured JSON
  against a fixed schema; the app normalises it into invoice lines.
- `store.js`: localStorage in guest mode, Firestore under
  `users/{uid}` when signed in, Google sign-in and sign-out, auth
  state listener, and a copy-guest-data-to-account action.

## What works in demo mode vs what needs Firebase wiring

Demo mode (no Firebase config, no sign-in) is the full product except
two things:

- Works: sample data, paste and text-file invoice intake with the
  local parser, manual invoice entry, editable preview, price history
  with charts, recipes and targets, alerts, movers, dashboard,
  activity log, all three CSV exports, localStorage persistence,
  reset sample data, start empty.
- Needs Firebase wiring: Google sign-in, cloud saving across devices,
  and Gemini extraction of pasted text and of photo and PDF uploads.
  With no Firebase config the app says so plainly where each feature
  would appear, and offers the working alternative (paste or manual
  entry).

## Verification (all run 2026-11-18)

- `npm run check`: syntax check on all 9 JS modules, clean.
- `npm test`: 157 checks, 0 failures.
  - `test-costing.mjs`: 61 passed (recipe costs, margins, price
    changes, status bands, movers, alerts, all three CSV builders,
    against the verified sample audit figures).
  - `test-parser.mjs`: 61 passed (dates, units, conversions, line
    totals, gram lines, `2 x` form, duplicate merging, noise
    skipping, unknown ingredients).
  - `verify-e2e.mjs`: 35 passed (the guest demo flow as a logic
    chain: paste the sample invoice, price history updates, recipes
    recost, a flour spike fires a Sourdough alert at 55.0% margin,
    every CSV builds, charts render, a Gemini-style payload
    normalises).
- `npm run smoke` (jsdom, needs `npm install --no-save jsdom` first):
  33 passed, 0 failures. Loads the real app.html in jsdom and drives
  the UI: dashboard renders, paste and save an invoice from the
  preview, dashboard and charts update, a manual flour-spike invoice
  fires an alert, the alerts view names Sourdough Loaf at 55.0%,
  recipe add and edit work, CSV export runs, localStorage holds 5
  invoices, start-empty and reset-sample work.
- Static wiring check: all 71 DOM ids the app looks up exist in
  app.html (this caught two dynamically created auth buttons, which
  were moved to static markup in app.html).
- Served over HTTP and fetched every route: `/`, `/app.html`, all JS,
  CSS, `logo.png`, and `vercel.json` return 200.
- Em dash scan: zero em dashes and zero en dashes in every file
  (code, copy, comments, docs).
- `logo.png` is a byte-identical copy of the v1 logo (md5 match).
  No logo was generated or invented.
- `firebase-config.js` holds placeholders only. No API keys or config
  values were invented.
- Landing page mock numbers verified against the computed sample
  values (Butter Cake 75.6%, Sourdough 76.8%, eggs -35.0%, flour
  +24.0%).

## Still needs a live run-through

- The Gemini path (AI extraction of pasted text and of photo and PDF
  uploads) has no Firebase project behind it yet, so it has not had a
  live run-through. After Firebase is wired up: sign in, upload a real
  invoice photo, and check the extraction before calling AI mode done.
  The local parser path is fully tested and is the fallback.
- Google sign-in and Firestore saving likewise need a Firebase project
  with Auth (Google provider) and Firestore enabled, plus rules that
  only let a user read and write their own `users/{uid}` document.
- No real-browser visual check was possible on this VM (no headless
  browser). The DOM smoke test verifies rendering and behaviour in
  jsdom, but a phone-width visual check of the landing page and the
  app is still worth doing after deploy.
- v2 has not been pushed to GitHub and has not been deployed to
  Vercel. The parent handles that after verifying this build.

## Files

- `index.html`, `styles.css`: landing page.
- `app.html`, `app.js`, `app.css`: the product.
- `costing.js`, `invoice-parser.js`, `sample-data.js`, `charts.js`:
  pure logic and data.
- `firebase-config.js`, `firebase-app.js`, `ai.js`, `store.js`:
  Firebase integration.
- `logo.png`, `vercel.json`, `package.json`, `LICENSE`, `.gitignore`.
- `README.md`, `BUILD-REPORT.md` (this file).
- `test-costing.mjs`, `test-parser.mjs`, `verify-e2e.mjs`,
  `dom-smoke.mjs`: tests.
