# BakeCost v2

BakeCost tracks ingredient prices from a bakery's supplier invoices,
recosts recipes from the latest prices, and warns when a margin drops
below target. Built by A&H Systems.

This is v2: the static demo from v1 is now a real product. The app has
invoice intake (paste, upload, or type by hand), price history with
charts, recipes with per-recipe margin targets, a margin alert feed,
a dashboard, CSV export, guest demo mode, and Google sign-in with
cloud saving and Gemini invoice reading when Firebase is wired up.

It is still a static site: no build step, no dependencies, no backend
of its own, no environment variables. Firebase is used only as a
client-side service (Auth, Firestore, AI Logic), and only when
configured.

## What is in here

- `index.html`, the landing page: the problem with sourced price
  moves, features, how it works, the free audit offer, pricing, FAQ.
- `app.html` + `app.js` + `app.css`, the product: dashboard, invoices,
  prices, recipes, alerts. Guest demo mode works with no sign-in and
  no Firebase config.
- `costing.js`, the pure costing maths (recipe cost, margin, price
  change, movers, alerts, CSV), shared by the app and the Node tests.
- `invoice-parser.js`, the local deterministic invoice text parser
  (demo mode). Handles supplier and date detection, `@` unit prices,
  line totals, gram to kg and ml to L conversion, and duplicate
  merging.
- `sample-data.js`, the sample dataset carried over from v1 (3 sample
  invoices, 4 ingredients, 3 recipes with margin targets), plus a
  pasteable sample invoice text.
- `charts.js`, hand-rolled SVG line charts and sparklines. No library,
  no network call.
- `firebase-config.js`, Firebase config placeholders and the model ID.
  Holds placeholders only until the parent wires up a real project.
- `firebase-app.js`, the shared lazy Firebase app instance.
- `ai.js`, Gemini invoice extraction through Firebase AI Logic
  (gemini-2.0-flash, Gemini Developer API backend, free tier). Reads
  pasted text and uploaded photos and PDFs.
- `store.js`, persistence (localStorage in guest mode, Firestore when
  signed in) and Google sign-in.
- `styles.css`, the shared stylesheet (landing page and app).
- `logo.png`, the A&H Systems logo.
- `test-costing.mjs`, `test-parser.mjs`, Node tests. Run with
  `npm test` (also runs `verify-e2e.mjs`, below).
- `verify-e2e.mjs`, a logic-chain smoke test: loads the sample state,
  pastes the sample invoice, adds a price spike, checks an alert fires,
  and builds every CSV.
- `dom-smoke.mjs`, a DOM smoke test (needs jsdom, see Test it below):
  loads the real app in jsdom and drives the guest demo flow through
  the actual UI.
- `vercel.json`, static site config for Vercel.

## Run it locally

Any static server works. ES modules need HTTP, not `file://`.
For example, from this folder:

```
python3 -m http.server 8000
```

Then open http://localhost:8000/ for the landing page and
http://localhost:8000/app.html for the app. The app opens in guest
demo mode with sample data.

## How the modes work

- Guest demo mode (default, no Firebase config): state lives in
  localStorage, the local parser structures pasted invoices and text
  files, and photos and PDFs are not readable (the app says so and
  offers paste or manual entry instead). The full flow works end to
  end: add an invoice, see the price history update, see recipes
  recost, see alerts fire, export CSV.
- Signed-in mode (Firebase configured): the baker signs in with
  Google, state lives in Firestore under `users/{uid}`, and Gemini
  reads pasted text and uploaded photos and PDFs. The local parser
  stays available as a fallback, and every extracted invoice is shown
  in an editable preview before saving, so the baker checks the
  numbers first.

## How the AI works

- Firebase AI Logic (Firebase JS SDK v11, `firebase/ai`) calls Gemini
  from the browser. No server code is needed.
- Backend: the app uses the Gemini Developer API backend explicitly
  (`new GoogleAI()`). The SDK default is the Vertex AI backend, which
  needs a billing plan, so the app deliberately does not use it.
- Model: `gemini-2.0-flash`, on the Firebase AI Logic free tier. The
  model ID lives in `firebase-config.js` and can be swapped for
  `gemini-2.5-flash`, which is also free-tier eligible. No
  billing-required model is used anywhere.
- Structured output: the app asks Gemini for JSON matching a fixed
  schema (supplier, date, lines with ingredient, quantity, unit,
  optional unit price and line total), so the result always renders
  as an editable preview table.
- Business logic stays deterministic: Gemini only structures the
  invoice. Recosting, margins, alerts, and movers are computed by the
  app from the structured data.
- In guest demo mode, pasted text and uploaded files never leave the
  browser. With AI on, an uploaded file or pasted text goes to Gemini
  only to be read, and only when the baker asks for extraction.

## Firebase setup (to switch on sign-in, cloud saving, and AI)

1. Create a Firebase project at https://console.firebase.google.com
2. In the project, enable Firebase AI Logic (Build, Firebase AI Logic).
3. Enable Authentication (Build, Authentication, Sign-in method) and
   turn on the Google provider.
4. Create a Firestore database (Build, Firestore Database) in
   production mode, with rules that only let a user read and write
   their own document under `users/{uid}`.
5. Register a Web app in Project settings and copy its config.
6. Paste the config values into `firebase-config.js`, replacing the
   `YOUR_*` placeholders.
7. Reload the app. The badges switch to "AI: Gemini ready" and the
   Sign in button appears.

Until the config is filled in, the app runs in guest demo mode, so the
whole flow is testable end to end without a Firebase project.

NOTE: the Gemini path has not had a live run-through yet (no Firebase
project exists for BakeCost). After wiring Firebase, run the app,
sign in, upload a real invoice photo, and check the extraction before
calling AI mode done. The local parser path is fully tested.

## Deploy on Vercel

1. Push this folder to a GitHub repo.
2. In Vercel, import the repo.
3. Framework preset: Other. Build command: none. Output directory: none
   (the site is served from the repo root). No environment variables needed.
4. Deploy. Vercel serves `index.html` at `/` and `app.html` at `/app`.

## Test it

```
npm test
```

Or run the suites directly:

```
node test-costing.mjs
node test-parser.mjs
node verify-e2e.mjs
```

`test-costing.mjs` checks the recipe costs, margins, price changes,
status bands, movers, alerts, and all three CSV builders against the
verified sample audit figures. `test-parser.mjs` checks the local
invoice parser: dates, units, conversions, line totals, gram lines,
duplicate merging, and noise skipping. `verify-e2e.mjs` runs the
guest demo flow as a logic chain: paste the sample invoice, check the
price history and recipe costs update, spike the flour price, check
an alert fires, build every CSV, render a chart, and normalise a
Gemini-style payload.

The DOM smoke test needs jsdom (not a project dependency):

```
npm install --no-save jsdom
npm run smoke
```

It loads the real app.html in jsdom and drives the UI: paste and save
an invoice, check the dashboard and charts update, add a manual
invoice that fires an alert, add and edit a recipe, export CSV, and
check localStorage persistence and the sample data controls.

Syntax-check every module with:

```
npm run check
```

## Honesty notes

- Every figure on the site is either a price from the BakeCost offer
  ($49 audit, $19 and $29 a month) or a sourced public figure,
  labelled with its source: eggs down 35% and butter down 17% (US
  Bureau of Labor Statistics, September 2025 to September 2026),
  wheat flour up 24% (French wheat flour, 12 months to October 2026).
- All demo data is sample data, labelled as such in the app and on the
  landing page. The dollar prices in the sample data are illustrative;
  only the end to end percentage moves for eggs, butter and flour
  match the public figures.
- The free audit is done by hand by Amina Ahsan and Hadi Kashif.
- No customers, testimonials, revenue figures or user counts appear
  anywhere, because there are none yet.
