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

## v7 "bakery counter" redesign (19 Nov ~00:00 PKT)

Amina, 23:52 PKT 18 Nov: the UI was "too bad", search real bakery
UI/UX designs and rebuild from them. Grounded in six real bakery
homepages (screenshots downloaded and viewed: Magnolia, Bobbette &
Belle, Self Raised, Beaucoup, Leaven & Co, Bluebird) plus 2026
bakery design data (61.8% of Shopify bakery sites use white or
near-white backgrounds, 88.2% photo-based heroes; Milk Bar and
GAIL's scored 10/10). Diagnosis: v6 sat in an awkward middle, dark
burgundy canvas and moody hero, neither light and fresh like
Magnolia/Bobbette/Self Raised nor bold-type-driven like
Beaucoup/Leaven. The fix was a flip, not more polish.

Landing page: light first. Warm white canvas #fdf8f0, white cards,
burgundy demoted from canvas to action colour (buttons, prices,
links), honey #b45309 as the warm accent. The dark photo hero, its
scrim and Ken Burns drift are gone. The new hero is cream ground
with a giant burgundy serif headline, one honey-italic word
("really"), and a wide photo banner below: arched seeded-loaves
photo plus two organic blob photos (cookies, cupcakes), the
rotating gold stamp overlapping the banner's corner. The app
preview frame sits on the cream ground with plain spacing. Dark
sections (audit, final CTA, footer) stay as the page's one dark
moment. Everything else (bento, gallery, calculator, pricing,
motion system) is restyled into the light language, not rebuilt.

App: cream background, white cards, burgundy stat numbers, pill
tabs on desktop (active view is a filled burgundy pill; the phone
bottom bar keeps its icon style), and food photos: round thumbs on
the dashboard recipe rows and a full-width photo banner on each
recipe card, using the same three shots as the landing page.
User-added recipes have no photo and render without one. The
app-preview.png screenshot was re-captured from the new look.

Two defects caught by proof and fixed: (1) aspect-ratio plus
max-height made recipe photos shrink to 427px wide on desktop
cards; fixed with a fixed height (200px phone, 240px desktop).
(2) A headless-shell capture showed the Dashboard tab invisible
after switching views; the cause was a frozen CSS colour transition
under --virtual-time-budget (compositor transitions run in real
time, virtual time does not wait for them). Proved a capture
artifact by re-shooting with transitions disabled in the proof
server only: the post-click steady state is correct (white text on
the active pill, plain text on the rest). The shipped CSS is
unchanged.

Proof: all sections verified from rendered frames at 390px and
1280px (hero, preview, examples, calculator, bento, gallery,
pricing, audit, CTA, footer, dashboard, recipes), zero overflow at
390px. Tests: npm run check clean, npm test 53 passed, zero
em/en dashes. Brief: BakeCost-Design-Direction-v7-Bakery.md.

## v8 "Tartufo" redesign (19 Nov ~00:30 PKT, NOT DEPLOYED)

Amina, 00:24 PKT 19 Nov: pick a design from the Awwwards nominees
page and replicate it exactly, show it to her BEFORE deploying,
responsive for PC and phones. Three food/product nominees were
compared from their submission screenshots: Chef Masa (a
drag-to-explore memoir wall, no headline or CTA, wrong fit) and
Patike Webshop (a purple product carousel, not a landing structure)
were rejected. PICKED: Le Delizie Del Tartufo, an Italian truffle
brand. Its structure maps 1:1 onto BakeCost: full-bleed photo hero,
giant serif headline, floating product card with a price.

Only the DESIGN LANGUAGE was replicated (layout, typography,
colour treatment, the floating card, minimal chrome), with
BakeCost's own content, copy, photos and logo. None of their text,
logo, product images or brand assets were copied.

Landing rebuild: full-bleed croissant photo hero with a dark
gradient rising from the bottom; giant Cormorant Garamond headline
low over it in blush cream ("Know what every recipe / really
costs.", "really" italic); floating white Butter Cake card
bottom-right on desktop (name, description, cake photo on a
burgundy-black square, $5.86 cost, "See it in the app" dark sharp
button), full-width below the headline on phones; rotating stamp
as the circular badge top-right; transparent header over the
photo. Sharp corners everywhere on the landing (0px), flat cards
with hairlines, Cormorant display type throughout, dark editorial
sections in burgundy-black with huge cream headlines. The v6
app-preview section was dropped (Tartufo has no equivalent).
The $3.94/$3.95 Lemon Drizzle rounding nit is fixed ($3.95).

Cormorant Garamond is self-hosted (fonts/cormorant.woff2 and
fonts/cormorant-italic.woff2, variable fonts, weight axis 300-700;
Google serves one file per style for all weights) so proof frames
and the live site render the same Didone. The landing is scoped
under body.landing in styles.css so the app keeps its v7 look
untouched: shared rules (buttons, badges, tables, forms,
skeletons) are unchanged, and --display stays Fraunces for the
app. app.html/app.js/app.css were NOT touched.

Proof: all sections verified from rendered frames at 390px, 768px
and 1280px (hero, recipes, calculator, bento, gallery, pricing,
audit, CTA, footer), zero overflow at 390px. Two defects caught
by proof and fixed: the hero-card price rule was accidentally
deleted in an edit (price and label ran together), and the card
foot button overflowed the card on phones (foot now stacks on
phones, row on desktop). The hero-enter translucency in early
frames was a headless-shell virtual-time artifact, not a site
bug (proven by re-shooting with the animation disabled in the
proof server only). Tests: npm run check clean, npm test 53
passed, zero em/en dashes. Brief:
BakeCost-Design-Direction-v8-Tartufo.md. STATUS: awaiting
Amina's yes after seeing the screenshots; nothing pushed.

## v8 motion match (19 Nov ~01:00 PKT, NOT DEPLOYED)

Trigger: Amina 00:43 PKT 19 Nov asked for a Muse test link and
said the motion, scrolling effects and animations must match the
Tartufo sample exactly or she will reject it. Two deliverables:
match the motion, then a Muse-hosted test link.

Tartufo motion study. Source (curl of their homepage): Webflow
site, GSAP 3.15.0 + SplitText + ScrollTrigger, a first-visit
loader script, a hero product slider. No Lenis or Locomotive in
the source. Live observation (browser task, homepage top to
bottom twice): first-visit full-screen loader (blush ground,
logo parts fading in staggered, exits sliding DOWN, first visit
only); hero photo parallax at about 0.85x scroll speed while the
headline moves 1:1, hero not pinned, photo does not scale or
fade; section headlines rise line by line inside overflow-hidden
masks (under 1s, fade plus short upward slide); images fade/slide
in with no scale-up and no clip wipe, collage images at different
parallax rates; header not sticky, fades away within the first
300px and returns only at the very top; buttons share one hover,
a light fill wiping left to right; hero product card auto-rotates
every 15-25s, new card in from the right, old out to the left;
no marquee, no pinned section, no counters, no floating cards,
circular badge STATIC. Scroll feel smooth and inertial.

Implemented in vanilla JS and CSS (no GSAP; the effects are what
matters, not the library), landing only, app untouched:
loader (cream overlay, AH logo, BakeCost, tagline fading in at
0s/0.45s/0.9s, curtain drops at 1.6s, 1s slide down, first visit
only via localStorage, 5s hard fallback, reduced motion skips
it); hero parallax (photo 118% tall, translates at 12% of
scroll); masked line reveals (splitLines measures real rendered
lines after fonts.ready, preserves the h1 <br> and italic,
re-splits on resize from stored original HTML so a rotated phone
never clips; hero lines rise in order after the loader, section
lines on IntersectionObserver, one way); header fades out over
0-300px scroll (opacity plus 8px rise, hidden at the end);
button wipe (background gradient growing 0 to 100% width behind
the text, text colour flips with it, per variant); hero card
rotator (three sample recipes, 8s interval, slide in from right
and out to left, pauses on hover, off-screen, or hidden tab,
stage height follows the active card); gallery differential
parallax (0.03/0.06/0.09 by column); stamp rotation REMOVED
(their badge is static); card lift and image zoom REMOVED on
the landing; button press scale REMOVED on the landing.
Everything no-ops under prefers-reduced-motion.

Proof: headless frames (proof server 8932, virtual-time
budgets). 400ms: loader overlay up (part fades frozen at start
by the virtual-time artifact, as expected). 5000ms: loader gone,
hero lines in, Butter Cake card, desktop and phone both clean.
15000ms: card rotated to Sourdough Loaf ($1.86, $8.00, 76.8%),
proving the rotator. Checks: npm run check clean, npm test 53
passed, zero em/en dashes. Proof-server injection extended to
kill .line-inner and .hero-card transitions (final-state frames
only; shipped CSS untouched).

Preview link: single-file export (196,895 bytes) built by
inlining styles.css (fonts embedded as base64 data URIs), a
bundled classic script (motion + sample-data + costing +
landing, import/export stripped, node --check clean), logo and
app links pointed at the live Vercel site (logo.png curl 200;
app.html 308s to /app, 200). Rendered identically in the
headless shell (logo broken there only, proxy artifact).
Uploaded to Muse storage:
https://muse.ai/files/1410730908793121/2367028930725162/oscehjrq684fan438hcspf7i/bakecost-v8-preview.html
expires 2026-11-20T20:00:44Z (21 Nov 01:00 PKT). Anyone with
the link can open it. Cloud-browser verification of the live
motion was BLOCKED: the cloud browser refuses muse.ai/files
URLs (organisation policy), so the real-time motion check is
Amina's own test on the link. On this preview, Google sign-in
and AI invoice reading do not work (Firebase only allows the
Vercel domain); guest demo works, and app links open the live
app. STATUS: NOT PUSHED to GitHub or Vercel; push waits on her
yes after testing the preview.

## v9 "Flaky's" redesign (19 Nov, NOT DEPLOYED)

Trigger: Amina rejected the live (v7) site again on 19 Nov
11:13 PKT and sent the Flaky's Dribbble shot
(dribbble.com/shots/25939557, Maria Maximova: giant bubbly
pink letters on a dark maroon card floating over a blue sky
with falling croissants) as the new direction. v8 is
superseded. Brief:
`~/workspace/goals/500-per-week-from-technical-services/hidden_files/BakeCost-Design-Direction-v9-Flakys.md`;
reference at `hidden_files/flakys-reference.png`. Design
language only is replicated, with BakeCost's own copy, photos,
prices and logo; never their brand name, text, logo or product
images.

Mapping. Palette: maroon-black #1a0302 (hero card), burgundy
#6d1a2d (secondary), bubbly pink #ff6ccf (headlines on dark,
accents), warm white #fdf8f0 (canvas), deep indigo #2b2d9e
(hero CTA). Display font: Fredoka (Google Fonts, rounded
bubbly sans), self-hosted as `fonts/fredoka.woff2` (29,732
bytes; fontTools verified variable font, wght axis 300-700,
230 glyphs); Inter stays for body; Cormorant files stay in
the repo, unused by v9. Corners ROUNDED everywhere (the
opposite of v8's sharp corners): 20-24px cards, pill buttons,
pill nav, pill SAMPLE chips.

Hero. Sky photo backdrop, full-bleed. Dark maroon rounded
card floats over it with a thick pale cream frame (10-12px,
28-32px radius), inset from the viewport edges. Four
blob-masked floating croissant photos peek from behind the
card's corners (two small ones on phones). Pill nav INSIDE
the hero card: translucent lighter-maroon pill, pink Fredoka
"BakeCost" wordmark left, centre links (Recipes, Calculator,
Features, Pricing), Sign in + pink pill "Try free" right; the
old sticky header is gone (footer carries the links below the
hero). Headline, centred, two lines, Fredoka Bold, uppercase,
pink: "EVERY RECIPE / COSTED!". One large glossy diagonal
croissant photo, point-down, centred, OVERLAPPING the
headline (blob mask, -8deg rotation, drop shadow). Indigo
pill CTA "Get the free audit" (short "Free audit" on phones)
centred over the photo, links to the audit section. Bottom
strip inside the card: tagline bottom-left ("Prices move.
Your recipes should keep up."), centre RECIPE CAROUSEL (pink
square arrows; Butter Cake $5.86, Sourdough Loaf $1.86,
Lemon Drizzle $3.95, real sample figures; middle selected),
right three rounded-square thumbnails (active on a pink
tile). Switching (arrows, thumbnails, auto-rotate every 8s)
changes the central photo, the selected name/price and the
active thumbnail.

Below the hero, the same sections as v8 restyled: sections
alternate cream canvas and dark maroon; headings Fredoka
bubbly (pink on dark, maroon-black on cream); big rounded
corners; pink pill buttons; small-caps pink section labels;
SAMPLE chips kept. The app-preview section stays dropped
(it never returned after v8).

Motion (v8 system adapted, not rebuilt): first-visit loader
RECOLOURED (maroon bg, pink Fredoka name, curtain slides
down, first visit only, same localStorage key); masked line
reveals for the bubbly headline and section headings
(splitLines, real rendered lines, re-splits on resize);
floating croissants drift on slow float keyframes plus scroll
parallax in the same rAF loop (sky photo parallaxes at 12%);
carousel slides between selections (new in from right, old
out to left, 650ms); button hover is a playful pop (scale
1.04 + shadow grow), not the Tartufo wipe; recipe card hover
is a gentle lift + photo zoom. Everything no-ops under
prefers-reduced-motion. The v8 header-fade code is gone
(no header element); the v8 card rotator is replaced by
initRecipeCarousel (landing.js). App files untouched;
body.landing scoping stays; all JS hooks preserved.

Photos (all curl-verified HTTP 200 and VIEWED before use).
Sky: photo-1513002749550-c59d786b8e6c (vivid blue sky, wispy
clouds top, fluffy cloud sea bottom). The brief's candidate
photo-1534088568595 was REJECTED (dark storm clouds, not
bright blue sky). Central croissant: photo-1555507036 (two
glossy golden-brown croissants on dark slate; no true
single-croissant photo surfaced among 8 candidates tested).
Floating croissants: photo-1623334044303 (top-down grid,
three different crops, one per floater) + photo-1530610476181
(basket). Recipe and gallery photos unchanged from v6/v7.
Note: the three grid-crop floaters replaced two dark-slate
floaters mid-proof, because the visible corner chunks of the
dark-slate photo showed dark background, not pastry (the
frame aspect ratio leaves no vertical overflow for
object-position to shift).

Proof defects found and fixed (frames in /tmp/v9-proof/).
(1) Floaters covered content on all viewports (z-index above
the card): moved behind the card (z-index 1) to peek from
its corners, four corners on tablet/desktop, two on phones.
(2) Phone card overflowed the viewport: the carousel row
(~428px) set the card's min-content width above the 366px
available and the flex-item card refused to shrink
(min-width: auto). Fixed with min-width: 0 on the card,
strip and carousel, plus a selected-item-only carousel on
phones (thumbnails below still show all three recipes).
(3) Phone "COSTED!" hidden behind the central photo: photo
shrunk to 130px and moved to top 62% of the stage, CTA
shrunk to 14px on phones; the overlap is softer on phones
for readability, a deliberate responsive trade-off.
(4) The tall-proof pin (.hero 560px) did not hold: the card
carries its own min-height calc(100svh - 112px), so the
proof server now pins .hero-card too in tall mode.
(5) Audit small note touched its button: #audit .small now
has margin-top 18px. The virtual-time artifact applied as
in v8 (loader parts frozen at opacity 0 at 400ms); a
?loaderfinal=1 proof param shows the loader content at full
opacity.

Post-build fixes (parent review, 19 Nov 11:41 PKT, frames
d-hero-fix1.png and m-hero-fix1.png in /tmp/v9-proof/).
(6) Phone hero: the absolute overlap hid the second headline
line behind the CTA pill and the pill covered the 130px
photo almost entirely. Below 700px the stage is now a column
in flow (headline, then a 216px photo with the CTA on it),
with phone-specific entrance keyframes (the desktop ones
carry a translate(-50%) centring that would shift a relative
element). Re-proven at 390x844: headline fully visible,
pastry close-up visible around the pill.
(7) Intro photo: the source frame is half dark background,
so the blob showed dark slate, not pastry. The Unsplash URL
now requests a bottom-anchored 800x320 crop
(w=800&h=320&fit=crop&crop=bottom); the proof copy in
/tmp/unsplash-check/ was cropped to the same bottom half
(original kept as photo-1555507036-orig.jpg). Re-proven at
1280x800: the blob is now almost entirely golden croissant.
The preview export was patched with both fixes and
re-verified against the source: desktop pixel-identical
(max diff 0), phone near-identical (max diff 21, nav text
anti-aliasing only, zero pixels over 30).

(8) Colour swap (Amina, 19 Nov 11:47 PKT: "no its not
looking good pink color parrot would be good more"): the
Flaky's pink is gone everywhere. Tokens renamed --pink to
--parrot: #7ed321 (vivid parrot green), --parrot-soft
#a3e635, --parrot-dim rgba(163, 230, 53, 0.72), plus new
--parrot-deep #4d7c0f for the small section labels on cream,
where the bright green is too light to read. Button and nav
shadows/borders re-tinted to rgba(126, 211, 33). The indigo
CTA, maroon card, sky and photos are unchanged. Re-proven
at 1280x800, 390x844 and in full-page bands (recipes label
readable in deep green, featured $29 price and MOST BAKERIES
tag in bright parrot on maroon). Export rebuilt from the new
CSS with the same font data URIs and re-verified
pixel-identical at desktop and phone (max diff 0).

Proof results. Heroes verified at 1280x800, 768x1024 and
390x844 (nav complete, headline fits and is centred, photo
overlaps the headline, CTA pill on the photo, strip complete,
floaters peeking at corners, sky frame visible around the
card). Loader proven twice: overlay up at 400ms, and content
(AH logo, pink Fredoka BakeCost, tagline) via ?loaderfinal=1.
Rotator proven at 15000ms: Lemon Drizzle selected (pink),
drizzle thumb active (pink tile), central photo is the lemon
tart. Full-page bands viewed at all three widths: recipes
(3 cards, exact sample figures, Lemon Drizzle $3.95),
calculator (working: Butter Cake, Butter $6.64/kg, $5.86,
75.6%, On target), bento (exact sample data), gallery (all
6 photos, 3-col desktop/tablet, 2-col phone), pricing
($49/$19/$29, Bakery featured maroon with pink price),
audit, CTA, footer (real AH logo, Product/Company columns).
Zero horizontal overflow at 390px (pixel scan: card maroon
spans x 22..367 of 390). Checks: npm run check clean, npm
test 53 passed, 0 em/en dashes in index.html, styles.css,
landing.js, 8/8 calculator IDs present, 101 classes used in
index.html, all defined in CSS.

Screenshots: `~/workspace/bakecost-v9-preview/`
(v9-desktop-hero.png, v9-phone-hero.png,
v9-desktop-recipes.png). Single-file preview export:
`~/workspace/bakecost-v9-preview/bakecost-v9-preview.html`
(same technique as v8: styles.css inlined with fonts as
base64 data URIs; motion.js + sample-data.js + costing.js +
landing.js bundled as one classic script, import/export
stripped, node --check clean; logo and app links point at
the live Vercel site). STATUS: NOT PUSHED to GitHub or
Vercel; push waits on Amina's yes after she sees the
screenshots and the preview link.

## v10 "Real Bakery" redesign (19 Nov, NOT DEPLOYED)

Trigger: 19 Nov 13:07 PKT, Amina rejected v9 (both the pink
and the parrot-green versions) as looking AI-generated and
ordered a rebuild based on real bakery websites: "DEEPLY
INSPECT THE REAL WEBSITES HOW THEY LOOK THEM BMAD IT". She
was right. Flaky's was a Dribbble concept shot: bubbly type,
neon colour, blob photos, a floating card over a sky. It looks
generated because it is a concept, not a real shop.

Research (19 Nov 13:07-13:11 PKT): a browser task visited and
scrolled the full homepages of Tartine (tartinebakery.com),
Levain (levainbakery.com), Magnolia Bakery
(magnoliabakery.com), Milk Bar (milkbarstore.com), GAIL'S
(gailsbakery.com) and Poilane (poilane.com). CAVEAT:
gailsbakery.com is NOT the UK Gail's chain (that is
gailsbread.co.uk); it is a small Wix home-baker site with
template placeholders still in it, used only as a cautionary
example. The design model comes from the other five. What
they share: one restrained palette (cream/white + near-black
+ ONE accent, the food supplies the colour), real photography
in quantity, named places/dates/people, a plainly stated
ordering model with real constraints, story before selling,
muted functional typography with one display voice, sharp-ish
cards, a plain useful footer, seasonal dated content. Full
brief:
`~/workspace/goals/500-per-week-from-technical-services/hidden_files/BakeCost-Design-Direction-v10-RealBakery.md`.

Design language. Palette: warm cream #F7F3EC ground, white
cards, near-black #1A1A1A text, ONE deep bottle green accent
#0B3D2E (Magnolia's green). This keeps Amina's green
direction in the real-bakery register: deep and restrained,
not neon parrot. No pink, no parrot green, no burgundy, no
indigo on the landing (burgundy stays in the app UI only).
Type: Cormorant Garamond serif headlines (self-hosted since
v8, weight 500, sentence case, one italic word max) + Inter
body. Radii: buttons 4px, cards 8px max, everything else
sharp. No pills, no blobs, no neon.

Structure (landing only, all scoped under body.landing).
Announcement bar (deep green, one real line: the free audit
for the first 20 bakeries). White sticky header with hairline,
Cormorant "BakeCost" wordmark, small uppercase nav (Recipes,
Calculator, How it works, Pricing), Sign in text link + one
solid deep green Try free button. Hero: the Tartine pattern,
full-bleed bakery-interior photo (photo-1517433670267, about
70vh desktop, shorter on phones) with the headline BELOW it,
never overlaid: "Know what every recipe really costs." +
one plain sentence + ONE deep green button + a "See how it
works" text link + one dated line (butter down 17%, flour up
24% since last September, US Bureau of Labor Statistics,
September 2026). Sections in order: Recipes ("From the demo
kitchen", 3 sample cards, square photos, exact figures,
SAMPLE chips, "See it in the app" as a plain text link, not a
button); Calculator (fully interactive, all 8 calculator IDs
intact, plain inputs, deep green slider and button); Story
("Why BakeCost exists", bread-loaves photo beside plain text:
built by Amina Ahsan and Hadi Kashif in Lahore, November
2026; flour up 24%, eggs down 35%, butter down 17% in a year,
BLS September 2026); How it works (v5 bento content, exact
sample data unchanged, white cards, hairlines, sharp
corners); Gallery (the 6 verified photos, sharp corners,
static masonry); Pricing (3 plain cards; featured Bakery
$29/mo is deep green with white text and a plain "Most
bakeries" tag; Audit $49 one time, Home Baker $19/mo); Free
audit (deep green section, one button, one note line); FAQ
(new, 4 questions, all answers grounded in real facts:
audit input, no sign-up demo, any ingredient/supplier, real
prices); Footer (deep green, real email
ah.systemsss@gmail.com, "Lahore, Pakistan", "Built by Amina
Ahsan and Hadi Kashif, A&H Systems", "© 2026 BakeCost"). No
invented testimonials, quotes, stats, addresses, or hours.
Zero em dashes and zero en dashes in every touched file.

Motion: almost none. REMOVED: the loader (markup and code),
the hero carousel rotator, the hero parallax, the masked line
reveals, the sky background, the blob-masked photos, the
count-ups, the badge spring pop, the card hover lift and the
photo zoom. The ONLY motion is one subtle scroll fade
(opacity + 8px rise, 0.6s ease, IntersectionObserver) and a
button hover that darkens slightly. All no-op under
prefers-reduced-motion. landing.js shrank from 560 lines to
about 200: initReveals + the calculator only (calcRender now
sets values directly instead of animating them). motion.js
untouched (the app still uses it). The calculator wiring is
otherwise identical to v9.

Technical notes. Section IDs renamed to the brief's list
(recipes, calculator, story, features, gallery, pricing,
audit, faq) so the nav anchors work; the v9 IDs (examples,
tryit, new) are gone. The app (app.html, app.js, app.css)
and all app JS (costing, sample-data, invoice-parser,
charts, features, store, firebase files) are untouched.
Fredoka stays in the repo unused. The proof server
(/tmp/proof-server.mjs) was updated for v10: the proof-only
CSS now forces .reveal elements visible (the 0.6s fade
freezes near its start value under --virtual-time-budget, so
proof frames would otherwise show blank sections), ?tall=1
pins .hero-photo to 560px instead of the removed hero card,
and a probe script records scrollWidth/clientWidth as data
attributes so --dump-dom can verify overflow.

Proof (frames in /tmp/v10-proof/). Desktop hero 1280x800,
tablet 768x1024, phone hero 390x844, all viewed: photo-first
hero, headline below, no overlay type, no bubbles, no neon.
Full-page desktop bands viewed: recipes exact figures
($5.86/$24.00/75.6%, $1.86/$8.00/76.8%, $3.95/$18.00/78.1%),
calculator working ($5.86 / 75.6% / On target, slider at
$6.64 per kg), story block, bento exact data (Maya $20
balance due, Lena $54 overdue, Noor paid; 2 kg butter, 8.8 kg
flour, 16 eggs; Millbrook flour jumped +24%), gallery all 6
photos, pricing $49/$19/$29 with deep green featured card,
audit, FAQ (all 4 questions), footer. Tablet 768px: two
column recipe grid confirmed. Phone: single column cards,
story stacked, logo + Try free only in the header.
Horizontal overflow: scrollWidth equals clientWidth at 390px
(375/375), 768px (753/753) and 1280px (1265/1265). npm run
check clean, npm test 53 passed, 0 failed. 0 em/en dashes in
index.html, styles.css, landing.js, BUILD-REPORT.md.

Not verified: slider/recipe-change interaction in a live
browser (the headless shell cannot click; jsdom 31 does not
execute ES module scripts, so a scripted interaction test was
impossible with the available harness). The initial render
proves initCalculator and calcRender run correctly in real
Chromium, and the event wiring is unchanged from v9, whose
calculator was proven working. The parent should click-test
the slider on the preview link before showing Amina.

Parent verification (19 Nov ~13:20 PKT): the parent viewed fresh
frames with its own eyes (desktop/tablet/phone heroes, recipes,
calculator, story, pricing, audit, FAQ, footer) and confirmed the
build: deep green footer (the dormant v9 --maroon/--parrot base
rules are overridden under body.landing; the audit section and
footer both render #0B3D2E), calculator rendering $5.86 / 75.6% /
On target. The slider wiring was read in full: change/input
listeners on calcRecipe, calcIngredient and calcSlider all call
calcRender, the same pattern as v9, whose calculator was proven
working; a live click-test of the preview link is not possible
(the cloud browser refuses muse.ai/files URLs and cannot reach
the local proof server), so the code read plus the live initial
render stands as the verification. Single-file preview export
built (styles.css inlined with the same font data URIs; bundle is
sample-data.js + costing.js + landing.js only, no motion.js,
node --check clean; 8 app links rewritten to the live Vercel app)
and verified pixel-identical to the source at desktop and phone
(max diff 0). NOTE: /tmp was wiped by a VM restart at ~13:19 PKT
mid-verification (proof frames, the proof server and the Unsplash
cache all lost); the proof server was rebuilt from scratch and a
durable copy saved at ~/workspace/bakecost-proof/proof-server.mjs
so the next rebuild starts from the file, not from memory.

STATUS: NOT DEPLOYED. Nothing pushed to GitHub or Vercel.
Preview link sent to Amina 19 Nov ~13:30 PKT; push waits on her
yes.

## v11 "Aesthetic Motion" redesign (19 Nov, NOT DEPLOYED)

Trigger: Amina rejected v10 at 13:32 PKT as still not good
enough (too plain) and ordered the Pinterest/Dribbble aesthetic
with motion UI. Dribbble research done 13:33-13:38 PKT (7 shots;
Pinterest was blocked by a login wall, so the direction comes
from Dribbble only). Brief:
`~/workspace/goals/500-per-week-from-technical-services/hidden_files/BakeCost-Design-Direction-v11-AestheticMotion.md`.
Design language only from the shots, never their brand, text,
logo or product images; all copy, photos, prices and figures are
BakeCost's own.

Palette (exact): cream ground #FCF0C9, warm paper #FFF6E0,
butter panel #FFEBB1, ink (near-black brown) #110704, dark
panel #230F08, caramel #AC491F, copper #C88F63, ONE loud accent
burnt orange #F95202 (all primary CTAs + the one "Most
bakeries" sticker), pistachio #B8D871 only for positive
price-move tags, olive #5B5329 for small labels on cream. No
pink, no neon, no gradients, no parrot green as a headline
colour. Type: Anton (heavy condensed uppercase display,
self-hosted, see below) + Cormorant italic accent (one
emotional line per section) + Inter body. Grain: a very subtle
SVG feTurbulence data URI overlay on dark sections only.

Anton: `fonts/anton.woff2`, 18,612 bytes, downloaded from the
Google Fonts latin subset and verified with fontTools (woff2,
family Anton, Regular, weight 400, 283 glyphs, unitsPerEm
2048). Fredoka (v9) stays in the repo unused.

Hero (Loafly + Koko, dark #110704): full-width overhead photo
across the top third (top-down croissant grid
photo-1623334044303, viewed before use); centred huge Anton
headline "KNOW WHAT EVERY RECIPE COSTS" (two lines, "costs" in
Cormorant italic copper as the one emotional accent word); one
plain sentence in cream; ONE burnt-orange pill CTA "Get the
free audit" + one ghost text link "See how it works"; ONE giant
floating product (tray of croissants photo-1530610476181 in a
large rounded card, bobs slowly, soft shadow moves with it);
rotating circular stamp "BAKED FRESH, COSTED RIGHT" around a
small wheat mark (15s per revolution, pauses on hover, wheat
stays static); pill nav centred under the photo; directly under
the hero a slow marquee strip with the REAL BLS price moves
("BUTTER DOWN 17% / FLOUR UP 24% / EGGS DOWN 35% /" repeating,
25s loop, down moves pistachio, up moves copper); a second
identical marquee sits above the footer.

Sections in order: hero + marquee; Recipes ("FRESH PICKS",
cream): 3 sample recipes as warm paper cards, 28px radii,
SAMPLE chips rotated -2deg, sensory lines, exact figures
(Butter Cake $5.86/$24.00/75.6%, Sourdough Loaf
$1.86/$8.00/76.8%, Lemon Drizzle $3.95/$18.00/78.1%), no star
ratings; Calculator ("TRY IT YOURSELF", butter panel): fully
interactive, all 8 calculator IDs intact; Story ("WHY BAKECOST
EXISTS", dark panel): loaves photo beside real specifics only
(Amina Ahsan and Hadi Kashif, Lahore, November 2026; flour up
24%, eggs down 35%, butter down 17%, BLS September 2026), one
Cormorant italic line; How it works / features (cream): v5
bento restyled, exact sample data unchanged; Gallery (dark):
6 verified photos, large radii, one photo overlapping the
section edge (see the multicol note below); Pricing (cream):
Audit $49 one time, Home Baker $19/mo, Bakery $29/mo featured
dark card with a burnt-orange "Most bakeries" sticker rotated
-2deg; Free audit (dark): Anton headline, one Cormorant italic
line, one burnt-orange pill button; FAQ (cream); Footer (dark):
real email, "Lahore, Pakistan", "Built by Amina Ahsan and Hadi
Kashif, A&H Systems", "© 2026 BakeCost".

Signature interaction (built last): "Reveal the cost" on each
recipe card slides in a vintage receipt with that recipe's REAL
ingredient cost breakdown, built by landing.js from
sample-data.js + costing.js (latest prices: Butter $6.64/kg,
Wheat flour $3.10/kg, Eggs $3.90/dozen, Sugar $1.90/kg; latest
invoice date 2026-09-08, shown as "8 SEP 2026"). Receipt:
mono type, dashed separators, slightly rotated, torn zigzag
bottom edge (clip-path), "BAKER: BAKECOST DEMO", "SAMPLE DATA,
NOT A REAL SALE", Close link; click again (or Close) hides it.
Receipt math verified by hand before building: Butter Cake
$3.32 + $1.24 + $1.30 = $5.86; Sourdough $1.86; Lemon Drizzle
$0.93 + $1.66 + $0.98 + $0.38 = $3.95. `?receipt=1|2|3|<recipe
id>` opens one receipt on load (the proof hook, since the
headless shell cannot click).

Motion, in priority order: (1) hero staggered entrance
(headline words rise with 90ms stagger, 700ms ease-out; hero
photo scales 1.05 to 1.0 over 1200ms); (2) floating hero
product (5s loop, a few pixels, shadow breathes with it);
(3) hover: card lift 6px + photo scale 1.04, 300ms ease-out;
pill buttons lift 2px; (4) marquee 25s loop; (5) scroll
reveals (fade + 24px rise, 0.7s) + gentle parallax on the hero
photo (0.3x, capped 48px) and the wheat doodle; (6) rotating
stamp 15s; (7) receipt slide-in (grid-rows 0fr to 1fr + fade).
No loader, no rotator, no masked line reveals (the v8/v9
systems stay removed). Reduced motion: float, marquee,
parallax and stamp rotation disabled; entrance forced visible;
only fades remain. JS off: everything visible, calculator keeps
its server-rendered state.

TWO DEVIATIONS from the brief, decided with reasons: (1) The
floating product uses photo-1530610476181 (tray of croissants,
a v9-verified photo) instead of the brief's photo-1555507036
with a bottom-anchored URL crop, because the proof server
ignores URL query params and serves the full frame, so a URL
crop cannot be proven, and the 1555507036 full frame is half
dark background; the tray photo shows pastry with
object-position bottom and proof matches production exactly.
(2) The italic "costs" accent word uses copper #C88F63 instead
of caramel #AC491F: caramel on dark #110704 is about 2.9:1
contrast and reads muddy; copper is the same warm family at
about 5:1 and reads golden. Caramel is still used on cream
(prices, labels).

Gallery overlap, multicol lesson: the first attempt used
margin-top: -120px on the cookies figure (first item in the
middle multicol column). A geometry probe proved Chrome
computes the margin but ignores it there (fig3 top stayed
5036, level with the other columns). The working form is
transform: translateY(-120px) rotate(-1.5deg) plus a matching
margin-bottom: -120px to close the hole the transform leaves
below it. The figure is NOT a .reveal (the reveal system owns
transform on .reveal elements and would fight it); the other
five figures still reveal. Re-probed after the fix: fig3 top
4912 (124px above the other columns), transform matrix shows
-120px translate and -1.5deg rotate, fig4 pulled up to 5333.
Scoped to min-width 700px only; on phones the two-column flow
has no overlap.

Files changed (landing only): index.html rewritten (dark hero
with overhead photo + stamp SVG + floating product + pill nav
+ wheat doodle + two marquees; recipe cards with sensory lines,
receipt toggle buttons and receipt divs; story/audit italic
lines; all section IDs and all 8 calculator IDs kept);
styles.css gained Anton @font-face, v11 tokens, and the full
v11 system appended (hero, stamp, float, marquee, recipes +
receipt, calculator, story, bento, gallery, pricing, FAQ,
footer, reveals, reduced motion, 700px/900px scale-up), all
scoped under body.landing; landing.js rewritten (calculator
code identical to v10; added initHeroEntrance, initParallax,
initReceipts; initReveals unchanged). fonts/anton.woff2 added.
App files untouched (app.html/app.js/app.css, costing.js,
sample-data.js and all app JS verified by mtime). Dormant v9
tokens (--parrot/--maroon) and v10 tokens remain in styles.css,
overridden under body.landing; the rendered page shows none of
them.

Proof (rendered frames, proof server on port 8932, durable
copy at ~/workspace/bakecost-proof/proof-server.mjs): heroes
viewed at 1280x800, 768x1024, 390x844, plus a 1280x1150 full
hero; entrance start (headline/lead/CTA/pillnav invisible),
half (55% opacity, 14px rise left) and settled frames viewed;
float at two loop points (42,302 differing px between animt 0
and 6250), marquee at two positions (12,232 differing px,
viewed: strip shifted a quarter loop), stamp rotated 150
degrees between frames (viewed: "COSTED RIGHT" moved to the
top, wheat mark static); one scroll reveal mid-state viewed
(?revealhalf=1, recipes band at 50% opacity); receipt revealed
via ?receipt=1 (only the Butter Cake receipt open, correct
breakdown, zigzag edge, Close link; all three receipts'
contents verified in an earlier capture); full-page desktop
bands viewed (recipes exact figures, calculator $5.86/75.6%/On
target, story, bento exact data, gallery all 6 photos with the
overlap, pricing $49/$19/$29 with dark featured card, audit
with orange pill, FAQ, footer); phone bands viewed (recipes
single column, pricing single column, gallery 2 columns, all 6
photos); tablet recipes viewed (2-column grid). Zero
horizontal overflow at 390/768/1280 (scrollWidth ==
clientWidth in all three probes). npm run check clean, npm
test 53 passed, 0 em/en dashes in index.html, styles.css,
landing.js and this report. 106 classes used in index.html,
all defined (the `primary` class is a marker with no rule of
its own; the plain .btn IS the primary button, noted in the
CSS).

Proof fixes made along the way (proof server only, shipped
files untouched): (1) lazy images below the fold came out
blank in tall captures, so the server now rewrites
loading="lazy" to loading="eager" in served HTML. (2) That
alone was not enough: images decode in document order and the
virtual-time budget expired mid-decode (butter cake loaded,
sourdough/lemon/story/gallery blank). Fixed by raising tall
captures to --virtual-time-budget=60000 (120000 for the
12000px phone capture) and downscaling the local proof copies
in /tmp/unsplash-check/ to 800px wide (hero kept at 1600px);
all 12 photos then render. (3) The first receipt-forcing
injection opened ALL receipts; scoped to .receipt-open.
(4) Added a ?geom=1 probe (gallery figure offsets + computed
styles + overflow numbers, readable via --dump-dom).

NOT verified by render (headless shell limits, code-reviewed
only): hover lift/photo scale (no hover in the headless
shell); scroll parallax (no scrolling); the receipt toggle and
Close clicks and the calculator slider drag (no clicking; the
?receipt param proves the open state through the same
setReceiptOpen code path, and the initial calculator render
proves initCalculator/calcRender run in real Chromium).

STATUS: NOT DEPLOYED. Nothing pushed to GitHub or Vercel.
Preview export + showing Amina is the parent's job; push waits
on her yes.

Post-build fix (parent, 19 Nov ~14:05 PKT, after Amina's verdict
"YES THATS GOOD BUT WE HAVE ONLY DONET"): she approved v11 but
pointed out the hero only showed one item, croissants twice
(hero band + floating tray), which she called a donut. Fixed in
index.html only: hero band is now rustic bread loaves
(photo-1509440159596), the floating product is a real
chocolate-glazed donut stack (photo-1551024601-bec78aea704b,
curl-verified HTTP 200 and viewed), and the story photo moved
to the bakery interior (photo-1517433670267) so the loaves do
not repeat three times. One croissant photo remains, in the
gallery only. Re-proven by the parent: desktop + phone heroes
viewed, npm run check clean, npm test 53 passed, 0 dashes.
Second preview export:
~/workspace/bakecost-v11-donut-preview/bakecost-v11-donut-preview.html
(verified against source: only 583 pixels differ, all in the
animated float/stamp regions, i.e. animation phase only).
REVERTED the same day (19 Nov ~14:05 PKT): Amina said "NO THE
PREVIOUS ONE IS GOOD", so the donut fix was undone and the
original v11 croissant hero was restored and re-verified
(reverted hero matches the original v11 hero except for
animation phase). The donut version is dead; the ORIGINAL v11
is the approved one being deployed.

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
