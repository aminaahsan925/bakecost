# BakeCost

BakeCost tracks ingredient prices from a bakery's supplier invoices, recosts
recipes from the latest prices, and warns when a margin drops below target.
Built by A&H Systems.

This repo holds the public website: a landing page plus a working interactive
demo with sample data. It is a static site: no build step, no dependencies,
no backend, no environment variables.

## What is in here

- `index.html`, the landing page: the problem, how it works, the free audit
  offer, pricing, FAQ, contact.
- `demo.html` + `demo.js`, the working demo: sample supplier invoices, price
  history per ingredient, recipes recosted at the latest prices, a margin
  target with alerts, manual invoice-line entry, and CSV export. All
  client-side; nothing leaves the browser.
- `costing.js`, the pure costing maths (recipe cost, margin, price change,
  CSV), shared by the demo and the Node tests.
- `styles.css`, the shared stylesheet.
- `logo.png`, the A&H Systems logo.
- `test-demo.cjs`, Node tests for the costing maths. Run with `node test-demo.cjs`.
- `vercel.json`, static site config for Vercel.

## Run it locally

Any static server works. For example, from this folder:

```
python3 -m http.server 8000
```

Then open http://localhost:8000/ for the landing page and
http://localhost:8000/demo.html for the demo.

## Deploy on Vercel

1. Push this folder to a GitHub repo.
2. In Vercel, import the repo.
3. Framework preset: Other. Build command: none. Output directory: none
   (the site is served from the repo root). No environment variables needed.
4. Deploy. Vercel serves `index.html` at `/` and `demo.html` at `/demo`.

## Honesty notes

- Every figure on the site is either a price from the BakeCost offer
  ($49 audit, $19 and $29 a month) or a sourced public figure, labelled with
  its source: eggs down 35% and butter down 17% (US Bureau of Labor
  Statistics, September 2025 to September 2026), wheat flour up 24%
  (French wheat flour, 12 months to October 2026).
- All demo data is sample data, labelled as such on the page. The dollar
  prices in the demo are illustrative; only the end to end percentage moves
  for eggs, butter and flour match the public figures.
- The free audit is done by hand by Amina Ahsan and Hadi Kashif. The site
  makes no claim that any software product is live or that anyone uses it yet.
- No customers, testimonials, revenue figures or user counts appear anywhere
  on the site, because there are none yet.
