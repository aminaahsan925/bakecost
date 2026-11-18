// BakeCost sample dataset. Carried over from v1, in the v2 shape.
// All of it is sample data, labelled SAMPLE wherever it is shown.
// The dollar prices are illustrative. The end to end moves for eggs
// (down 35%), butter (down 17%) and wheat flour (up 24%) match the
// public figures on the home page: US Bureau of Labor Statistics
// prices, September 2025 to September 2026, and French wheat flour,
// 12 months to October 2026. The middle invoice and the sugar prices
// are illustrative.

export var SAMPLE_INGREDIENTS = [
  { name: "Eggs", unit: "per dozen", factor: 12 },
  { name: "Butter", unit: "per kg", factor: 1 },
  { name: "Wheat flour", unit: "per kg", factor: 1 },
  { name: "Sugar", unit: "per kg", factor: 1 }
];

// The second invoice is from a second supplier (City Mills), so the
// Suppliers view has a real comparison: Millbrook is cheapest for
// butter and eggs, City Mills is cheapest for flour and sugar, and
// Millbrook's flour price jumped 24% between its two invoices.
export var SAMPLE_INVOICES = [
  {
    id: "sample-1",
    supplier: "Millbrook Supplies",
    date: "2025-09-12",
    lines: [
      { ingredient: "Eggs", qty: 10, unit: "dozen", price: 6.00 },
      { ingredient: "Butter", qty: 20, unit: "kg", price: 8.00 },
      { ingredient: "Wheat flour", qty: 50, unit: "kg", price: 2.50 },
      { ingredient: "Sugar", qty: 25, unit: "kg", price: 1.80 }
    ]
  },
  {
    id: "sample-2",
    supplier: "City Mills",
    date: "2026-03-10",
    lines: [
      { ingredient: "Eggs", qty: 10, unit: "dozen", price: 5.10 },
      { ingredient: "Butter", qty: 20, unit: "kg", price: 7.40 },
      { ingredient: "Wheat flour", qty: 50, unit: "kg", price: 2.80 },
      { ingredient: "Sugar", qty: 25, unit: "kg", price: 1.85 }
    ]
  },
  {
    id: "sample-3",
    supplier: "Millbrook Supplies",
    date: "2026-09-08",
    lines: [
      { ingredient: "Eggs", qty: 10, unit: "dozen", price: 3.90 },
      { ingredient: "Butter", qty: 20, unit: "kg", price: 6.64 },
      { ingredient: "Wheat flour", qty: 50, unit: "kg", price: 3.10 },
      { ingredient: "Sugar", qty: 25, unit: "kg", price: 1.90 }
    ]
  }
];

// Quantities are in base units (kg, or single eggs). targetPct is the
// margin target for that recipe, in percent.
export var SAMPLE_RECIPES = [
  {
    id: "sample-r1",
    name: "Butter Cake",
    sellPrice: 24.00,
    targetPct: 60,
    note: "500g butter, 400g flour, 4 eggs.",
    ingredients: [
      { name: "Butter", qty: 0.5 },
      { name: "Wheat flour", qty: 0.4 },
      { name: "Eggs", qty: 4 }
    ]
  },
  {
    id: "sample-r2",
    name: "Sourdough Loaf",
    sellPrice: 8.00,
    targetPct: 70,
    note: "600g flour. Salt and water not costed.",
    ingredients: [
      { name: "Wheat flour", qty: 0.6 }
    ]
  },
  {
    id: "sample-r3",
    name: "Lemon Drizzle",
    sellPrice: 18.00,
    targetPct: 60,
    note: "300g flour, 250g butter, 3 eggs, 200g sugar.",
    ingredients: [
      { name: "Wheat flour", qty: 0.3 },
      { name: "Butter", qty: 0.25 },
      { name: "Eggs", qty: 3 },
      { name: "Sugar", qty: 0.2 }
    ]
  }
];

// Sample orders (v5). Due dates are relative to today, so the demo
// always shows one of each status: Maya owes a balance, Lena's
// balance is overdue with no deposit taken, Noor is paid in full.
// dueInDays is days from today; sampleState() turns it into a date.
export var SAMPLE_ORDERS = [
  {
    id: "sample-o1",
    customer: "Maya",
    dueInDays: 5,
    items: [
      { recipeId: "sample-r1", qty: 1 },
      { recipeId: "sample-r2", qty: 2 }
    ],
    depositPaid: 20.00,
    isSample: true
  },
  {
    id: "sample-o2",
    customer: "Lena",
    dueInDays: -8,
    items: [
      { recipeId: "sample-r3", qty: 3 }
    ],
    depositPaid: 0,
    isSample: true
  },
  {
    id: "sample-o3",
    customer: "Noor",
    dueInDays: -3,
    items: [
      { recipeId: "sample-r2", qty: 1 }
    ],
    depositPaid: 8.00,
    isSample: true
  }
];

// Sample bake day (v5): 4 butter cakes and 12 sourdough loaves.
// Needs 2 kg butter, 8.8 kg flour and 16 eggs. dateInDays is days
// from today; sampleState() turns it into a date.
export var SAMPLE_BAKE_DAYS = [
  {
    id: "sample-b1",
    dateInDays: 2,
    items: [
      { recipeId: "sample-r1", qty: 4 },
      { recipeId: "sample-r2", qty: 12 }
    ],
    isSample: true
  }
];

// YYYY-MM-DD, n days from today. Used so sample order and bake-day
// dates stay meaningful whenever the demo is first loaded.
function daysFromToday(n) {
  var d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

// Pasteable sample invoice text for the "Try sample text" button.
// Parsing it adds a fourth invoice dated 2026-11-02, with flour up
// again and butter up a little, so the alerts and movers change.
export var SAMPLE_INVOICE_TEXT =
  "Millbrook Supplies\n" +
  "Invoice date: 2026-11-02\n" +
  "Butter 20 kg @ $7.10\n" +
  "Wheat flour 50 kg @ $3.45\n" +
  "Eggs 10 dozen @ $4.20\n" +
  "Sugar 25 kg @ $1.95\n" +
  "Total: $374.50";

// A fresh copy of the sample state. Deep cloned so callers can mutate it.
export function sampleState() {
  return {
    ingredients: JSON.parse(JSON.stringify(SAMPLE_INGREDIENTS)),
    invoices: JSON.parse(JSON.stringify(SAMPLE_INVOICES)),
    recipes: JSON.parse(JSON.stringify(SAMPLE_RECIPES)),
    orders: SAMPLE_ORDERS.map(function (o) {
      return {
        id: o.id,
        customer: o.customer,
        dueDate: daysFromToday(o.dueInDays),
        items: JSON.parse(JSON.stringify(o.items)),
        depositPaid: o.depositPaid,
        isSample: true
      };
    }),
    bakeDays: SAMPLE_BAKE_DAYS.map(function (b) {
      return {
        id: b.id,
        date: daysFromToday(b.dateInDays),
        items: JSON.parse(JSON.stringify(b.items)),
        isSample: true
      };
    }),
    activity: [
      {
        id: "sample-a1",
        at: "2026-09-08",
        text: "Sample invoice added: Millbrook Supplies, 8 Sep 2026 (4 lines)."
      },
      {
        id: "sample-a2",
        at: "2026-09-08",
        text: "Sample recipes loaded: Butter Cake, Sourdough Loaf, Lemon Drizzle."
      },
      {
        id: "sample-a3",
        at: "2026-09-08",
        text: "Sample orders loaded: Maya, Lena and Noor, plus one bake day."
      }
    ],
    isSample: true
  };
}

export function emptyState() {
  return {
    ingredients: [],
    invoices: [],
    recipes: [],
    orders: [],
    bakeDays: [],
    activity: [],
    isSample: false
  };
}
