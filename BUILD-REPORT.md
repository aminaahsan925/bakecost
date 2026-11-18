# BakeCost Website, Build Report

Built 18 November 2026. Static site, no build step, no dependencies, no
backend. Ready for a GitHub push and a Vercel deploy. Not pushed, not
deployed: the parent handles accounts and credentials.

## What was built

In `~/workspace/projects/bakecost/`:

- `index.html`, landing page: hero ("Know what every recipe really costs"),
  the problem with the sourced BLS figures (eggs down 35%, butter down 17%,
  wheat flour up 24%, each labelled with its source and linked), how it
  works in 3 steps, the free audit offer (done by hand, free, one time),
  pricing ($49 one-time audit; $19/month Home Baker up to 15 recipes;
  $29/month Bakery up to 50 recipes), a 4-question FAQ, contact
  (ah.systemsss@gmail.com), footer (A&H Systems, "Less Manual Work. More
  Business.").
- `demo.html` + `demo.js`, a working interactive demo, not a mockup:
  3 sample supplier invoices, a price history table per ingredient,
  3 sample recipes recosted at the latest prices with cost then, cost now,
  change, selling price, margin and a status badge, a margin target input
  (default 60%) with a live alerts panel, a form to add your own invoice
  line (existing or new ingredient), and CSV export of the costing table.
  Everything runs client-side; nothing is sent anywhere. Every sample
  element is labelled as sample/demo, including a red banner at the top.
- `costing.js`, the pure costing maths (recipe cost, margin, price change,
  latest/earliest price points, money/percent formatting, CSV build),
  shared by the demo and the Node tests.
- `styles.css`, shared stylesheet: monochrome with one warm caramel accent
  (#b45309), Georgia serif headings, system sans body, responsive (single
  column under 760px, tables scroll horizontally on narrow screens).
- `logo.png`, the real A&H Systems logo, copied from the brand files and
  used in the header and footer. No logo was generated or invented.
- `vercel.json` (static config, clean URLs), `.gitignore`, MIT `LICENSE`,
  `README.md` (what the site is, how to run it, how to deploy on Vercel).
- `test-demo.cjs`, Node tests for the costing maths.

## Figures used, and where they come from

- Eggs down 35%, butter down 17%: US Bureau of Labor Statistics prices,
  September 2025 to September 2026, as reported at menuthere.com (linked).
- Wheat flour up 24%: French wheat flour, 12 months to October 2026, as
  reported at vespertool.com (linked).
- Demo dollar prices are illustrative, labelled as such. The demo's end to
  end moves for eggs, butter and flour match the public figures above; the
  middle invoice and the sugar prices are illustrative.
- Prices: $49 audit, $19 and $29 a month, from the BakeCost brainstorm.
- No customers, testimonials, revenue figures, user counts or other
  statistics anywhere. No claim that any software product is live or that
  anyone uses it yet. The audit is described as done by hand throughout.

## Verification (all passed)

- `node --check` clean on `costing.js` and `demo.js`.
- `node test-demo.cjs`: 28 of 28 checks pass. Recipe costs and margins
  match the verified sample audit exactly (butter cake $7.00 then, $5.86
  now, margin $17.00/71% then, $18.14/76% now at a $24 selling price).
- Full demo flow exercised with a stubbed-DOM harness (kept in /tmp, not
  part of the site): 27 of 27 checks pass. Covers initial render of all
  three invoices, price history and margins; raising the target to 80%
  (3 alerts appear); invalid target rejected; adding a manual butter line
  at $10.00 (butter cake cost updates to $7.54, butter change flips to
  +25.0%); adding a brand-new ingredient (appears in price history with
  n/a change); CSV export (correct header, rows and values).
- Served locally with `python3 -m http.server`: all 11 files return
  HTTP 200, including `/` and `/demo.html`. Logo serves as image/png.
- All internal links resolve (no missing href/src targets). Both HTML
  files parse with no errors and no unclosed tags.
- Grep: 0 em dashes, 0 en dashes, 0 AI-assistant credit lines, no lorem ipsum,
  no TODO/FIXME/placeholder text anywhere in the project.

## Two bugs found and fixed during verification

1. Floating point rounding: the lemon drizzle cost displayed $3.94 instead
   of $3.95 (3.945 stored as 3.9449999999999998). Fixed with a half-up
   `roundTo` helper in `costing.js`, now used by money formatting, percent
   formatting and CSV output, so the table and the CSV always agree.
   Regression checks added to `test-demo.cjs`.
2. Single-point ingredients showed a +0.0% change. Now they show n/a, which
   is the honest display when no change has been measured yet.

## Not verified

- No headless browser is available on this machine, so the pages were not
  screenshot-tested at mobile width. The responsive CSS was reviewed by
  hand (single-column grids under 760px, horizontal scrolling tables,
  full-width form fields), but a quick visual check on a phone after
  deploy is still worth doing.

## Next steps for the parent

1. GitHub: create a repo (suggested name `bakecost`), then from this
   folder: `git init`, `git add .`, `git commit -m "BakeCost website"`,
   `git remote add origin <repo URL>`, `git push -u origin main`.
   Note: `git clone` fails on this VM (TLS); the parent should push from
   wherever git works, or use the GitHub web upload as a fallback.
2. Vercel: import the repo, framework preset Other, no build command, no
   output directory, no environment variables. Deploy. The site serves
   `index.html` at `/` and `demo.html` at `/demo`.
3. After deploy: open the live site on a phone-width screen and check the
   hero, the pricing cards and the demo tables; run the demo flow once
   (set target to 80%, add a line, export CSV).
4. The demo's "Try the demo" link is live in the site header and hero, and
   the free audit mailto links point at ah.systemsss@gmail.com. No further
   wiring is needed before sharing the link with bakery owners.

## Blockers

None. Nothing was cut for scope.
