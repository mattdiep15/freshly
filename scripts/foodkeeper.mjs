// Maps the FSIS FoodKeeper export to convex/data/foodkeeper.json: node scripts/foodkeeper.mjs <foodkeeper.json>
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const DATA_VERSION = "v128";
const DAYS = { Hours: 1 / 24, Days: 1, Weeks: 7, Months: 30, Year: 365, Years: 365 };
const CATEGORY = {
  2: "bakery", 3: "baking", 4: "refrigerated dough", 5: "beverages", 6: "condiments",
  7: "dairy", 8: "frozen", 9: "grains", 10: "meat", 11: "meat", 12: "meat", 13: "meat",
  14: "poultry", 15: "poultry", 16: "poultry", 17: "poultry", 18: "produce", 19: "produce",
  20: "seafood", 21: "seafood", 22: "seafood", 23: "pantry", 24: "vegetarian proteins", 25: "deli",
};
const COLD_CATEGORIES = new Set(["dairy", "meat", "poultry", "seafood", "deli", "refrigerated dough"]);
// FoodKeeper rows that describe the same food as an FDA chart row; they merge into it.
const FDA_NAME = {
  21: "eggs", 22: "raw egg yolks and whites", 23: "hard cooked eggs", 40: "steak", 43: "ground beef",
  50: "ground lamb", 59: "ground veal", 73: "ground pork", 77: "variety meats", 79: "bacon",
  81: "corned beef", 98: "hot dogs", 102: "raw sausage", 113: "whole chicken", 114: "whole chicken",
  115: "ground turkey", 116: "chicken breast", 117: "chicken breast", 118: "chicken thighs",
  119: "turkey parts", 120: "turkey parts", 121: "turkey parts", 130: "giblets",
  135: "cooked poultry dishes", 136: "fried chicken", 140: "cooked poultry in broth or gravy",
  144: "lean fish", 145: "lean fish", 146: "fatty fish", 148: "cooked fish", 150: "scallops",
  151: "shrimp", 152: "squid", 176: "vacuum-packed dinners", 192: "lunch meat", 193: "soups and stews",
};
// Short names for common grocery items, so receipt matching finds them.
const RENAME = { 27: "milk", 290: "lettuce", 291: "spinach", 1: "butter", 33: "yogurt" };
const ALIASES = {
  27: ["whole milk", "2% milk", "skim milk", "milk, plain or flavored"],
  290: ["iceberg lettuce", "romaine", "lettuce, iceberg, romaine"],
  291: ["leaf lettuce", "lettuce, leaf, spinach"],
  415: ["bagged salad", "spring mix", "baby spinach"],
};
// Ranges in the export that look like data-entry errors; left unsourced instead of trusted.
const SKIP = new Set(["574:Refrigerate"]); // homemade bread "Refrigerate 2 - 3 Months"
const LOCATIONS = [
  ["pantryDays", "Pantry", "Pantry"],
  ["fridgeDays", "Refrigerate", "Fridge"],
  ["freezerDays", "Freeze", "Freezer"],
];

const clean = (s) => (typeof s === "string" ? s.trim() : "");
const label = (p) => [clean(p.Name), clean(p.Name_subtitle)].filter(Boolean).join(", ");

// Prefers the "from date of purchase" (DOP_) column, else the plain one.
function pick(p, field) {
  for (const prefix of ["DOP_", ""]) {
    const min = p[`${prefix}${field}_Min`], max = p[`${prefix}${field}_Max`];
    const metric = clean(p[`${prefix}${field}_Metric`]);
    if (metric) return { column: `${prefix}${field}`, min, max, metric };
  }
  return null;
}

function toRange(p, col) {
  const unit = DAYS[col.metric];
  // A missing low end is never filled in: the low end is the safety claim.
  if (unit === undefined || typeof col.min !== "number") return null;
  const max = typeof col.max === "number" ? col.max : col.min;
  return {
    min: col.min * unit,
    max: max * unit,
    source: "foodkeeper",
    ref: `FoodKeeper ${DATA_VERSION} > #${p.ID} ${label(p)} > ${col.column}: ${col.min}${max !== col.min ? ` - ${max}` : ""} ${col.metric}`,
  };
}

const METRIC_NOTE = {
  "Package use-by date": "follow the package use-by date.",
  "When Ripe": "until ripe.",
  Indefinitely: "keeps indefinitely.",
  "Not Recommended": "not recommended.",
};

export function mapProducts(products) {
  const out = [];
  const seen = new Map();
  for (const p of products) {
    const category = CATEGORY[p.Category_ID];
    if (!category) continue; // baby food has no storage times
    const food = { name: "", aliases: [...(ALIASES[p.ID] ?? [])], category, defaultLocation: "pantry" };
    const notes = [];
    const metrics = {};
    for (const [key, field, word] of LOCATIONS) {
      const col = SKIP.has(`${p.ID}:${field}`) ? null : pick(p, field);
      if (col) metrics[key] = col.metric;
      const range = col && toRange(p, col);
      if (range) food[key] = range;
      else if (col && METRIC_NOTE[col.metric]) notes.push(`${word}: ${METRIC_NOTE[col.metric]}`);
      const tipKey = field === "Freeze" ? "Tips" : "tips";
      const tips = [p[`${field}_${tipKey}`], p[`DOP_${field}_${tipKey}`]].map(clean).filter(Boolean);
      for (const t of tips) notes.push(`${word}: ${t}`);
    }
    if (notes.length) food.storageTip = { text: notes.join(" "), source: "foodkeeper" };
    food.defaultLocation = chooseLocation(food, metrics, category);

    const fdaName = FDA_NAME[p.ID];
    let name = fdaName ?? RENAME[p.ID] ?? label(p).toLowerCase();
    if (!fdaName && seen.has(name)) name = `${name} (${category})`;
    if (fdaName) food.aliases.push(label(p).toLowerCase());
    food.name = name;
    if (seen.has(name)) {
      if (!fdaName) throw new Error(`duplicate food name: ${name}`);
      // Two FoodKeeper rows for one FDA food: keep the first row's ranges, add the alias.
      seen.get(name).aliases.push(...food.aliases);
      continue;
    }
    seen.set(name, food);
    out.push(food);
  }
  return out;
}

// Pantry while ripening, else the longest sourced storage among pantry and fridge.
function chooseLocation(food, metrics, category) {
  if (category === "frozen") return "freezer";
  if (metrics.pantryDays === "When Ripe") return "pantry";
  const pantry = food.pantryDays?.max ?? -1, fridge = food.fridgeDays?.max ?? -1;
  if (fridge >= 0 && fridge >= pantry) return "fridge";
  if (pantry >= 0) return "pantry";
  const usable = (m) => m !== undefined && m !== "Not Recommended";
  if (usable(metrics.fridgeDays)) return "fridge";
  if (usable(metrics.pantryDays)) return "pantry";
  if (food.freezerDays) return "freezer";
  return COLD_CATEGORIES.has(category) ? "fridge" : "pantry";
}

// The FSIS export is { sheets: [{ name, data: [[{ Field: value }, ...], ...] }] }.
export function productsFromExport(json) {
  const sheet = json.sheets.find((s) => s.name === "Product");
  return sheet.data.map((row) => Object.assign({}, ...row));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const json = JSON.parse(readFileSync(process.argv[2], "utf8"));
  const foods = mapProducts(productsFromExport(json));
  const target = new URL("../convex/data/foodkeeper.json", import.meta.url);
  writeFileSync(target, JSON.stringify(foods, null, 2) + "\n");
  console.log("wrote", foods.length, "foods");
}
