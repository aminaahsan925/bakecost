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

## Redesign, 18 Nov 2026 (after Amina's verdict on the live site)

Amina looked at the live site on her phone: "everything is off, too
bad UI, too much text, too generic". The visual layer was rebuilt
in place; no feature was cut and no logic module changed.

- Landing copy cut from 1,234 words to 433 (65% less). One-line hero
  plus one subline plus one CTA. The six text feature cards became
  three features, each with a CSS-built visual (invoice lines, a
  recosted recipe, an alert example). The how-it-works section was
  removed. FAQ cut from 5 questions to 3. Pricing tightened to 3
  short bullets per plan. One CTA repeated: "Open the app, free".
- Character: bakery warmth, not generic SaaS. Deepened cream/ink/
  caramel palette, Fraunces display serif plus Inter body (Google
  Fonts, display=swap, Georgia/system fallbacks), no gradients.
- App: bigger key numbers (dashboard stats, recipe cost/margin/
  target, latest prices), invoice lines and dashboard recipes
  rebuilt as rows instead of tables, invoice preview becomes
  stacked cards on phones, icon bottom tab bar (56px touch
  targets), bigger inputs, shorter leads everywhere.
- Bug found by the phone screenshots and fixed: the `hidden`
  attribute was losing to `.btn { display: inline-block }`, so the
  Sign in/Sign out buttons and the empty alert badge were showing
  when they should have been hidden. A global
  `[hidden] { display: none !important; }` rule in styles.css
  fixes it. The auth note now reads "Sign-in is not set up yet."
  instead of the dev-facing Firebase wording.
- Verification: a real headless Chromium (playwright-core, shell
  build) was installed on the VM, so this redesign WAS checked
  with real 390px renders. Screenshots in /tmp/pw-check/shots/:
  landing, all five app views, recipe editor, invoice preview,
  plus 1280px desktop landing and app. Zero horizontal overflow
  on every view at 390px and at 1280px. Fraunces confirmed
  loading. Tests still green: npm test 157 passed, npm run
  smoke 33 passed, npm run check clean, zero em/en dashes.

## Motion rebuild (2026-11-18 evening)

Amina judged the redesign "still not too good, not too bad" and
asked for research on good UI and motion UI, then a rebuild with
motion. The research report lives at
~/workspace/research_notes/motion-ui-good-design-research-20261118-1507/
(12-technique playbook, 8 reference sites). Motion is a new layer
on the same warm editorial look and the same short copy, not a new
identity. No GSAP, no WebGL, no loading screens, no custom
cursors, no scroll hijacking, no dark-by-default.

What was added, per technique:

- Motion tokens in styles.css: durations 100-300ms, strong
  ease-out curves, a spring overshoot curve for tactile controls.
- Hero entrance choreography: eyebrow, headline, subline, CTA,
  dashboard mockup stagger in 60ms apart (500ms, hero-in
  keyframes). Visible-safe: elements start at 55% opacity, never
  0, so load paint is never blank.
- CSS scroll reveals for below-fold sections
  (animation-timeline: view(), range entry 0% to entry 30%,
  backwards fill so hover transforms keep working), plus an
  IntersectionObserver fallback in landing.js (~15 lines,
  threshold 0.1, unobserve after firing) for browsers without
  scroll timelines. Without either mechanism, content is visible.
- Staggered entrances: app view switches cascade cards in 60ms
  apart (app.js adds .view-enter, removes it after 800ms;
  stagger index capped at 5).
- Haptic button press: buttons and tabs scale to 0.97 over
  100-160ms on :active. Spring-feel controls: motion.js has a
  ~20 line vanilla JS spring integrator (stiffness 240, damping
  22); the alert badge pops with it when the count changes, and
  the calculator badge pops when its status flips.
- Card hover lift: translateY(-3px) plus a deeper shadow,
  transform only, pointer devices only, no hover-gated content.
- Count-up stats: rAF plus cubic ease-out over ~1200ms,
  triggered once by IntersectionObserver, tabular-nums, final
  value in the HTML. Hero mock numbers and the three price-move
  percentages (-35%, -17%, +24%).
- Skeleton screens: shape-matched placeholders in app.html for
  every view (stat cards, mover rows, invoice/price/recipe
  cards, alert feed, tables), plus hidden skeletons in the paste
  and upload panels that show only while Gemini is reading, plus
  a showSkeletons() in app.js for signed-in cloud loads. The
  shimmer sweep stops under reduced motion. No fake waiting:
  skeletons never appear for instant local renders.
- View Transitions between landing and app:
  @view-transition { navigation: auto; }, zero JS.
- Interactive in-page demo: a mini cost calculator on the
  landing page (landing.js, ~150 lines). Pick a recipe, move one
  ingredient price on a slider, cost and margin retween live
  using the real costing.js and sample data. Badge flips between
  On target, Near target, Below target with a spring pop.
- Reduced motion and performance: prefers-reduced-motion kills
  all of it (hero, reveals, staggers, shimmer, transitions,
  view transitions); count-ups and calculator tweens jump to
  finals in JS. Only transform and opacity animate, never layout
  props. No parallax or mouse-follow on touch. No loaders over
  a second.

Bugs found by the frame proof and fixed:

- The calculator badge never had its pill styling: landing.js
  wrote class "badge badge-ok" but styles.css defines ".badge
  .ok" (the app uses the hyphenated form in app.css; the landing
  page uses the two-class form). Fixed to "badge " + status in
  landing.js and index.html, and added .badge.watch and
  .badge.unknown to styles.css.
- Reduced motion left the hero headline at 0.55 opacity: the
  duration hack cannot help during an animation delay phase, and
  the first fix targeted a class name (hero-anim) that does not
  exist. The real class is hero-enter; the reduced-motion block
  now kills it outright (animation none, opacity 1, transform
  none). Same delay-phase fix for .view-enter .stagger-item in
  app.css.
- Anchored sections hid their heading under the sticky nav when
  jumped to. Added scroll-margin-top: 84px to section[id].

Verification: headless Chromium (playwright-core shell build),
script /tmp/pw-check/motion.cjs, frames in
/tmp/pw-check/motion-shots/ (19 frames, every one read):
hero entrance mid-flight (h1 opacity 0.55, +14px) and settled,
count-up mid-flight (3, 2, 0, -27%) and settled (4, 3, 0, -35%),
moves count-up mid-flight (-16%, -8%, +11%), scroll reveal
mid-flight and settled (third card 0.58 mid-entry, 1 when
centered), button press (scale 0.969), calculator default
($5.86, 75.6%, On target, green pill) and moved (Sourdough,
flour at max $6.20, $3.72, 53.5%, Below target, red pill),
app skeletons (67 skeleton blocks, 0 stat cards at 500ms with
app.js delayed), view-switch stagger mid-flight (opacities
0.99, 0.90, 0.47), hover lift (translateY -3px), reduced motion
(hero fully visible at 150ms, finals at once, shimmer none on
a visible skeleton, tab switch opacities 1, 1, 1 at 50ms).
Zero horizontal overflow on every view at 390px and 1280px.
Tests still green: npm test 157 passed, npm run smoke 33
passed, npm run check clean (now covers motion.js and
landing.js), zero em/en dashes, all routes 200.

## Design v3 (2026-11-18 evening): burgundy + real photography

Amina judged the motion version "still the same bad app" and
asked to explore Pinterest, Figma and Canva for modern design.
The exploration brief is at
~/workspace/goals/500-per-week-from-technical-services/hidden_files/BakeCost-Design-Direction-v3.md.
The new look is a visible rebuild, not a tweak.

Palette: deep burgundy #6d1a2d replaces caramel as the lead
accent (tokens --accent, --accent-dark #4f1220, --accent-soft
#f7e8ea); warm cream background and ink text stay. Buttons are
pills now (border-radius 999px), with a cream .btn.light
variant for dark surfaces. The app restyles through the same
shared tokens (tabs, buttons, alert borders), and charts.js
now draws price lines and sparklines in burgundy. The only
other hardcoded colour found was the chart default; app.css
needed no change.

Hero: full-bleed real bakery photography (Unsplash croissants,
photo-1555507036, srcset 800w/1600w) with a dark legibility
scrim, one oversized serif headline (clamp 52px to 104px) and
one pill CTA. The hero has a dark #1a080c background fallback
so the cream headline still reads if the photo ever fails.
The dashboard mockup moved below the hero into its own
"preview" section, keeping its count-ups.

Product grid replaces the abstract feature cards: Butter Cake,
Sourdough Loaf and Lemon Drizzle, each with a real photo, a
SAMPLE chip, ingredient cost, selling price, and margin with
an On target badge. Numbers computed from the sample data with
the real costing code: $5.86 / $24.00 / 75.6%, $1.86 / $8.00 /
76.8%, $3.94 / $18.00 / 78.1%. Photos (all Unsplash, each URL
verified HTTP 200 with curl before shipping, each image viewed
before use): hero photo-1555507036-ab1f4038808a (croissants),
Butter Cake photo-1578985545062-69928b1d9587 (chocolate layer
cake), Sourdough photo-1549931319-a545dcf3bc73 (sliced rustic
loaf), Lemon Drizzle photo-1519915028121-7d3463d20b13 (lemon
meringue tart). Four photos total: the brief said 2 to 3, but
a three-card grid needs one photo per card. All are sized with
Unsplash w= params (hero 800/1600, cards 800) and the card
photos lazy-load. Footer credits "Photography via Unsplash."

Section rhythm: hero (photo + headline + one CTA), app
preview (mockup), how it works (3 numbered steps, burgundy
rules and numerals), examples (product grid + mini calculator),
proof (BLS moves only: -35%/-17%/+24%), free audit (now a
burgundy panel with a cream pill button), pricing, FAQ (3
items), one strong final CTA. Landing copy 473 words by the
same count that gave 458 before (nav and footer included).

Motion system kept intact (landing.js and motion.js
untouched): hero entrance, scroll reveals, count-ups, springs,
haptic press, skeleton screens, View Transitions,
reduced-motion guardrails. The feature-card CSS and the
quiet-link were removed; hover lift now applies to product
cards.

Verification: headless Chromium, script /tmp/pw-check/v3.cjs,
31 frames in /tmp/pw-check/v3-shots/, every one read: hero
entrance mid-flight (h1 opacity 0.55, +14px) and settled
(photo loaded, headline readable over the croissants),
count-up mid-flight (3, 2, 0, -25%) and settled (4, 3, 0,
-35%), reveal mid-flight and settled, button press (scale
0.969), calculator default ($5.86, 75.6%, On target) and
moved (Sourdough, flour max $6.20, $3.72, 53.5%, Below
target), moves settled (-35%/-17%/+24%), burgundy audit
panel, pricing, FAQ, final CTA and footer (photo credit
visible), all 5 app views at 390px (burgundy tabs, buttons,
chart lines and sparklines), skeletons (67 blocks at 500ms),
view-switch stagger mid-flight (opacities 0.97, 0.84, 0.22),
reduced motion (hero fully visible at 150ms, shimmer none,
switch opacities 1, 1, 1), desktop hero, 3-card grid, hover
lift (-3px), desktop calculator and desktop app. Zero
horizontal overflow on every view at 390px and 1280px.
Fraunces confirmed loaded (document.fonts.check). One
environment note: the VM egress proxy refuses Chromium's
CONNECT tunnel to images.unsplash.com, so the proof run
served the Unsplash requests from the exact downloaded bytes
in /tmp/unsplash-check/; the remote URLs themselves were
verified 200 via curl and need the live-site check to confirm
in a real browser. Tests still green: npm test 157 passed,
npm run smoke 33 passed, npm run check clean, zero em/en
dashes, all routes 200.

## Design v4 (2026-11-18 evening): premium refinement

Amina approved v3 ("yes now it loook good") and asked to refine
it further toward premium by studying premium UI/UX design on
Figma, Pinterest and Canva. The study brief is at
~/workspace/goals/500-per-week-from-technical-services/hidden_files/BakeCost-Design-Direction-v4-Premium.md.
This is a refinement, not a new look: the v3 identity stays
(burgundy + cream, croissant hero, oversized serif headline,
3 product cards, pill buttons, mini calculator, motion system)
and the brief's 9 premium moves are applied on top.

1. Deeper burgundy, one gold. New tokens: --burgundy-deep
   #3f0e1a (dark sections), --burgundy-black #2a0812 (footer),
   --gold #c9a86a (rules, prices, tiny accents). No other new
   colours. Dark sections are now #3f0e1a instead of the
   brighter accent; the footer is near-black burgundy with a
   gold top hairline.
2. Type system. Fraunces import now includes the italic axis;
   exactly one word in the hero headline is italic
   ("really"). Eyebrows, nav links and section labels are
   11-12px small caps at 0.15-0.2em letter-spacing. Body
   line-height is 1.65; h1 leading tightened to 1.02.
3. Hairlines instead of shadows. New --hairline token
   (burgundy at 18% opacity, cream at 22% on dark). Nav,
   section separators, card borders and FAQ use 1px hairlines;
   --shadow-sm is now near-zero and --shadow-md is a soft
   12% blur. Mockup, moves, product cards, plans, FAQ and
   calc card carry no shadow at all.
4. Air. Section padding 96px on phones, 128px on desktop.
5. Photography. All photos get a warm, slightly desaturated
   grade (saturate 0.92, sepia 0.10, contrast 1.02). Product
   photos are arched at the top (999px 999px 16px 16px)
   inside a thin cream frame (12px card padding).
6. Product cards quiet and price-led. Cream cards with a
   small-caps category label (Cake / Bread / Tart), serif
   name, selling price in serif burgundy, hairline rows, and
   a small ghost pill button "See it in the app" linking to
   app.html (not "Add": this is not a shop). The SAMPLE chip
   moved to the bottom-left of the photo. Identical radius,
   padding and near-zero shadow on every card.
7. Micro-details. Numbered section labels ("01 · The app"
   through "08 · Questions"; the separator is a middle dot,
   not an em dash, per the no-em-dash rule) with a short gold
   rule before each. A circular rotating-text stamp sits on
   the hero, bottom-right: "BAKED FRESH • COSTED RIGHT •"
   around a serif "B", gold rings, 28s rotation, 84px on
   phones / 120px on desktop, aria-hidden. No testimonial
   and no stars, as required (none exist).
8. Alternating grounds. Cream, deep burgundy, cream: the how
   it works section and the free audit section are now full
   dark sections (the boxed .dark-panel is gone), with gold
   numerals and rules and cream text; the final CTA is dark
   and the footer darker still. A full-bleed photo band
   (bakery interior) sits between the audit and pricing.
   Band photo (Unsplash, URL verified HTTP 200 with curl,
   image viewed before use): photo-1517433670267-08bbd4be890f
   (bakery interior, bread display and baguettes), srcset
   800w/1600w, lazy-loaded. The crop favours the upper
   display and the wash deepens toward the bottom, so the
   shop's own price tags stay out of frame.
9. Locked tokens, calm motion. Two fonts, three colours plus
   gold, one radius (18px cards, pill buttons), one hairline,
   one calm hover (card lifts 2px, product photo scales to
   1.03, both over 350ms, no shadow appears). The app's hover
   matches (app.css: lift 2px, 350ms, no shadow). Entrance,
   scroll, count-up and skeleton motion kept, with the
   reduced-motion guardrails intact.

Two defects found by the frame proof and fixed before
reporting: (a) the new dark-section link colour
(.section.dark a) outranked .btn.light, so the cream buttons
on the audit and final CTA sections showed pale gold text on
cream and were nearly unreadable; fixed by scoping the rule
to a:not(.btn), verified by computed colour rgb(79, 18, 32)
on both buttons. (b) The photo band's first crop (300px,
30%) showed the shop's price tags legibly on phones; fixed
by shortening the band to 220px, cropping to the upper
display (object-position 8%) and deepening the bottom wash.

Verification: headless Chromium, script /tmp/pw-check/v4.cjs,
34 frames in /tmp/pw-check/v4-shots/, every one read: hero
entrance mid-flight (h1 opacity 0.55, +14px) and settled
(stamp present, spinning, clear of the headline and CTA;
exactly one italic word, "really"), count-up mid-flight (3,
2, 0, -26%) and settled (4, 3, 0, -35%), reveal mid-flight
and settled, button press (scale 0.969), calculator default
($5.86, 75.6%, On target) and moved (Sourdough, flour max
$6.20, $3.72, 53.5%, Below target), moves settled
(-35%/-17%/+24%), dark how-it-works section (gold numerals,
verified rgb(201, 168, 106)), arched product cards (radius
999px, category, burgundy serif sell price, "See it in the
app" pill, no shadow), dark audit section, photo band
(loaded, 220px, tags out of frame), pricing (gold plan tag,
burgundy serif prices), FAQ, final CTA and near-black footer,
all 5 app views at 390px, skeletons (67 blocks at 500ms),
view-switch stagger mid-flight (opacities 0.99, 0.90, 0.46),
reduced motion (hero fully visible at 150ms, shimmer none,
switch opacities 1, 1, 1), desktop hero, 3-card grid, hover
(card -2px, photo scale 1.03), desktop calculator, desktop
band, desktop pricing, desktop footer and desktop app. Zero
horizontal overflow on every view at 390px and 1280px.
Fraunces (incl. italic) confirmed loaded. Same environment
note as v3: the VM egress proxy refuses Chromium's CONNECT
tunnel to images.unsplash.com, so the proof run served the
Unsplash requests from the exact downloaded bytes in
/tmp/unsplash-check/; the remote URLs themselves were
verified 200 via curl and need the live-site check to confirm
in a real browser. Tests still green: npm test 157 passed,
npm run smoke 33 passed, npm run check clean, zero em/en
dashes, all routes 200.

## Design v5 (2026-11-18 evening): three new features + shorter landing page

Amina's feedback on v4: the page is too long and the app should
have different features. She delegated the pick ("its up to you
search what famous bakiers have then madeit"). The research report
is at ~/workspace/research_notes/famous-bakery-features-research-20261118-1616/report.md
and the pick brief at ~/workspace/goals/500-per-week-from-technical-services/hidden_files/BakeCost-v5-Features-Brief.md.
The pick: Orders, Bake Day, and Suppliers, chosen because famous
bakery tools (BakeSmart, FlexiBake, CakeBoss, Cybake, Bakesy) all
have them, small bakers take orders on WhatsApp and Instagram and
lose track of deposits, and supplier price comparison is the
natural next step after price history.

1. Orders view. Add an order: customer name, due date, recipe
   items with quantities picked from existing recipes, deposit
   paid. The total is computed from recipe selling prices and
   the balance due follows automatically. The list shows every
   order with a status badge: Paid, Balance due, Deposit due, or
   Overdue (unpaid and past the due date). A summary strip shows
   outstanding balance, overdue count, and order count. Edit,
   delete, and Mark paid (sets deposit to total) per order.
   Sample data: 3 orders with dates relative to today, so the
   demo always shows one of each status: Maya (balance due),
   Lena (deposit due and overdue), Noor (paid).
2. Bake Day view. Pick a date, add recipes and quantities for
   the day's bake. The totals table aggregates ingredient
   quantities across recipes using the real costing code (base
   units, eggs counted as singles), and the shopping list shows
   what to buy, with eggs as "16 (buy 2 dozen)". Items tick off
   as bought. Bake days save and reload from a saved list.
   Sample data: one bake day (4 Butter Cakes + 12 Sourdough
   Loaves: 2 kg butter, 8.8 kg flour, 16 eggs).
3. Suppliers view. Per ingredient, every supplier from the
   invoices, cheapest first, with the cheapest price
   highlighted and a "Jumped" flag when a supplier's price rose
   5% or more since that supplier's previous invoice. Drops
   show green with no flag. Ingredients with no invoices show
   "No prices yet". The second supplier comes from renaming
   sample invoice 2 to City Mills (prices and dates unchanged,
   so all existing price-history tests still pass): Millbrook
   is cheapest for butter and eggs, City Mills for flour and
   sugar, and Millbrook flour jumped 24% between its invoices.
4. Nav. The tab bar had 5 tabs; 8 would not fit on a phone.
   The three new views sit behind a More tab (three dots) that
   opens a menu: on desktop it drops down below the tab, on
   phones it opens upward above the bottom bar. Every view is
   one tap from the tab bar or one tap from More. The More tab
   lights up while a More view is open. The Alerts badge stays
   margin-alerts-only; overdue orders are flagged in the Orders
   view itself.
5. Persistence. Orders and bake days persist in localStorage in
   guest mode and in Firestore when signed in, through the
   existing store.js pattern. normalizeState() fills missing
   arrays so pre-v5 saved states load cleanly.
6. Shorter landing page. Dropped: the app preview section, the
   how-it-works section, the prices/BLS section, and the FAQ.
   Kept, renumbered 01 to 05: sample recipes, mini calculator,
   a new compact features strip (one line each for Orders,
   Bake Day, Suppliers), the photo band, pricing, free audit,
   final CTA. The v4 premium look is untouched (burgundy,
   gold, hairlines, arches, stamp, numbered labels, motion
   system, reduced-motion guardrails). The dropped sections'
   CSS was left in styles.css as harmless dead CSS. The
   landing-page count-ups lived in the dropped preview and
   prices sections, so the calculator's animated numbers are
   now the only count-ups on the page.

One defect found by the smoke test and fixed before reporting:
renderOrders and renderOrderTotals named a local variable
`money`, shadowing the app's money() currency helper, so the
orders view threw on render. Renamed the locals to `amounts`;
the smoke test then passed in full.

Verification: headless Chromium, scripts /tmp/pw-check/v5.cjs and
v5b.cjs, 32 frames in /tmp/pw-check/v5-shots/, every one read:
hero mid-flight and settled (stamp present, exactly one italic
word, "really"), recipes (arched Butter Cake card, $5.86, 75.6%,
On target), calculator default ($5.86, 75.6%, On target) and moved
(Sourdough, flour to max $6.20, $3.72, 53.5%, Below target), the
new-features strip (three hairline rows + CTA, phone stacked and
desktop side by side), photo band, pricing (04), free audit (05),
final CTA and near-black footer, desktop hero and pricing. Section
labels confirmed 01 to 05 in order; the four dropped sections
confirmed absent from the DOM. App: dashboard (4 ingredients, 3
recipes, 0 below target, -35.0% eggs, "Add an order" quick action),
More menu open upward above the bottom bar on a phone (menu bottom
above the tab bar top, measured) and dropping down on desktop,
Orders (summary $74.00 outstanding, 1 overdue, 3 orders; Lena
Overdue, Maya $40.00/$20.00/$20.00 balance due, Noor Paid),
order editor with live totals preview ($48.00 total, $38.00
balance), the added order saved end to end (4 orders, summary
$112.00, still 4 after a reload), Bake Day (planner with 4 Butter
Cakes + 12 Sourdough, totals 2 kg butter / 16 eggs / 8.8 kg flour,
shopping list with "16 (buy 2 dozen)", tick-off strike-through,
saved day with "In the planner" badge), Suppliers (Butter:
Millbrook $6.64 Cheapest with green border, -17.0%; City Mills
$7.40 "First price from this supplier"; flour: Millbrook $3.10
"+24.0% since $2.50" with a red Jumped badge), plus Invoices,
Prices (Butter chart, -17.0%), Recipes ($5.86, 75.6%) and Alerts
(eggs -23.5%, flour +10.7%, butter -10.3%) as regression. Reduced
motion: hero h1 opacity 1 at 150ms. Zero horizontal overflow on
every view at 390px and 1280px. 7/7 landing images decoded. Same
environment note as v3/v4: the VM egress proxy refuses Chromium's
CONNECT tunnel to images.unsplash.com, so the proof run served the
Unsplash requests from the exact downloaded bytes in
/tmp/unsplash-check/; the remote URLs themselves were verified 200
via curl and need the live-site check to confirm in a real browser.
Tests: npm test 232 passed (61 costing + 61 parser + 57 features
+ 53 e2e), npm run smoke 51 passed, npm run check clean, zero
em/en dashes, all routes 200.

## Sign-in: popup to redirect (18 Nov evening, after the Firebase wiring)

Google sign-in first shipped with signInWithPopup. The live test showed
the Firebase popup opening as a full tab (and failing with "The requested
action is invalid") in browsers that do not open real popup windows,
including the test browser and many mobile browsers. The fix switches
sign-in to the redirect flow: store.js now calls signInWithRedirect, the
page navigates to Google and back, and onAuthChange picks the user up on
return. A new consumeRedirectResult call at startup surfaces a failed or
cancelled redirect as a notice instead of landing back in guest mode in
silence. app.js no longer shows a "Signed in as" notice on the click (the
page unloads before it could run); handleAuthChange already welcomes a
first-time signed-in baker. No popup sign-in remains anywhere. Tests:
npm run check clean, npm test 53 e2e passed, zero em/en dashes.

## v6 premium redesign (18 Nov evening)

Amina: the UI "is looking good but not toooooooo good, it should be
premium like we see in canva pinterest and figma", then "not like
modern and people impress through it". Full delegation. Research
grounded it (premium SaaS 2026 + Canva/Pinterest/Figma patterns):
whitespace is the number one premium signal, typography carries 60%
of the feel, display size only for the hero, two radii, bento grids,
visual proof over words.

Changes (index.html, styles.css, app.css, new app-preview.png):
more air (112px/160px sections), section headings stepped down so
only the hero shouts, two radii (20px cards, 10px inner, 999px
pills), soft layered shadows plus hairlines, the real app in a
browser frame overlapping the hero (screenshot captured from the
live app with a temporary harness, deleted after; the VM proxy
blocks gstatic so the harness clicked away the sign-in notice real
users never see), a floating price-alert card on the frame, the
features as a bento grid with static UI snippets from the real
sample data (Orders wide on top, Bake Day + Suppliers below; the
first row-span layout left dead space in the Orders card, fixed by
switching to column-span), the photo band replaced by a Pinterest
masonry gallery (6 verified Unsplash photos), a slow Ken Burns
drift on the hero photo, taller header, proper footer columns.
The app inherits the new tokens (radius, shadows) via :root.

Proof: headless Chromium frames at 390px and 1280px (tall-viewport
full-page shots with a local proof server that serves Unsplash from
downloaded bytes; the server pins the hero height because 90vh in
a tall window swallows the page, and strips lazy/async attributes
because they race the screenshot timer). All sections verified:
hero, preview, examples, calculator, bento, gallery, pricing,
audit, CTA, footer. Zero overflow at 390px. Tests 53 passed, check
clean, zero em/en dashes.

## Retest 18 Nov 23:24 PKT: hung, no error

The retest after the v6 push behaved differently: the app showed
"Reading test-invoice.png..." for 5 minutes with no error banner and
no extraction preview. Nothing was saved, sample data untouched.
The retry loop has no per-attempt timeout, so a slow or stalled
Gemini response leaves the app hanging forever. Fix (same night):
every generateContent call is now wrapped in a 60s timeout, and a
timeout counts as transient, so it still retries. Worst case the
baker sees a clear error after about 3 minutes, never a hang.
AI extraction remains unverified; retest in the morning.

## Gemini 500 "high demand" and retry logic (18 Nov evening)

After the model switch, the live test reached Gemini and got 500 "This
model is currently experiencing high demand. Spikes in demand are
usually temporary." on two attempts (30s and 2.5min). The model name is
accepted; the failure is Google-side overload. ai.js now retries
transient errors (5xx, high demand, overloaded, network, timeout)
twice, waiting 5s then 15s, before showing the error. Non-transient
errors are not retried. If the retest still 500s after retries, the
model is still overloaded and the honest answer is to try again later.
Retest 18 Nov 23:01 PKT: still 500 high demand after the app's retries
(2.5 minutes of reading). The retry logic works; Google's capacity for
this model is the blocker. Retest later.

## Gemini model retirement (18 Nov evening)

The live AI test reached Gemini and returned 404: "This model
models/gemini-2.0-flash is no longer available. Please update your code
to use models/gemini-3.8-flash". MODEL_ID in firebase-config.js moved to
gemini-3.8-flash (the API's own recommendation, current free-tier Flash
model). The same change was made to StockPilot's firebase-config.js,
which used the same retired model. README updated to match.

## Firebase App Check (18 Nov evening)

AI Logic setup turned on App Check enforcement "Basic - Enforced" for
the AI Logic API. The web app has no App Check provider registered, so
every Gemini call failed with 401 "Firebase App Check token is invalid".
Enforcement was switched OFF in the console 18 Nov 22:43 PKT (now
"Basic - Unenforced", success confirmed). The console says unenforcement
can take up to 15 minutes to start. DEADLINE: App Check will be
automatically enforced for AI Logic again on 21 Jan 2027. Before then
the web app must be registered with reCAPTCHA Enterprise and App Check
initialised in the app, or Gemini calls will 401 again. The API key
HTTP referrer restrictions stay in place as the abuse protection.

## Firebase Auth users (18 Nov evening)

Authentication > Users shows 0 users ("No users for this project yet")
after many completed Google sign-in flows in the cloud browser. No
sign-in has ever completed end to end, so no user record exists. The
sign-in is unproven until it works in a real browser (Amina's phone);
do not keep re-attempting it in the cloud browser.

## Firebase AI backend class fix (18 Nov evening, after the second AI test)

The second live AI test failed with "GoogleAI is not a constructor".
Reading the actual firebase-ai.js bundle (11.10.0 and 12.3.0) showed the
export is named GoogleAIBackend, not GoogleAI, in every version. ai.js
now uses modules.GoogleAIBackend and new GoogleAIBackend(). No version
change was needed. Same fix round: onFileChosen now clears the file
input after capturing the file, so choosing the same photo again still
fires a change event and the baker can retry a failed read.

## Firebase SDK version fix (18 Nov evening, after the AI test failed)

The first live AI test failed with "Failed to fetch dynamically imported
module: .../11.0.2/firebase-ai.js". The firebase-ai module does not exist
in SDK 11.0.2 (verified 404 with curl; it also 404s on 11.2.0 and 11.6.0).
Only the old firebase-vertexai module exists that far back. All four
Firebase SDK URLs in firebase-app.js moved to 11.10.0, the first version
checked where firebase-ai.js exists (all four modules verified 200).
All modules stay on one version, as Firebase requires. The app code
already used the firebase/ai API (getAI with the GoogleAI backend,
getGenerativeModel, Schema), so no code change was needed beyond the
version bump. Tests: npm run check clean, npm test 53 e2e passed.

## Files

- `index.html`, `styles.css`, `landing.js`: landing page.
- `app.html`, `app.js`, `app.css`: the product.
- `motion.js`: spring integrator, count-up, reduced-motion check.
- `costing.js`, `invoice-parser.js`, `sample-data.js`, `charts.js`,
  `features.js`: pure logic and data.
- `firebase-config.js`, `firebase-app.js`, `ai.js`, `store.js`:
  Firebase integration.
- `logo.png`, `vercel.json`, `package.json`, `LICENSE`, `.gitignore`.
- `README.md`, `BUILD-REPORT.md` (this file).
- `test-costing.mjs`, `test-parser.mjs`, `test-features.mjs`,
  `verify-e2e.mjs`, `dom-smoke.mjs`: tests.
