// Hand transcription of docs/food_storage_chart.pdf (FDA, 2018) with rows the newer chart changed taken from
// docs/cold_food_storage_chart_2023.md; writes convex/data/fdaChart.json: node convex/data/fdaChart.script.mjs
import { writeFileSync } from "node:fs";

const D = 1, W = 7, M = 30, Y = 365;
const MEAT_TIP =
  "Keep meat and poultry in its package until just before using. If freezing it in the original package longer than 2 months, overwrap the package with airtight heavy-duty foil, plastic wrap, or freezer paper, or place it inside a plastic bag.";
const WRAP_TIP = "Freezer times assume freezer wrap.";
const C23 = "2023";
const CHARTS = { 2018: "FDA chart 2018-03", 2023: "foodsafety.gov Cold Food Storage Chart, reviewed 2023-09-19" };

// [section, chart row text, name, aliases, category, location, fridge, freezer, extra]; extra.src: C23 cites the 2023 chart.
// fridge/freezer: [min, max, unit, chart text], or null for "Don't freeze" and blank cells. A month is 30 days.
const rows = [
  ["Eggs", "Fresh, in shell", "eggs", ["egg", "eggs in shell", "large eggs", "dozen eggs"], "eggs", "fridge", [3, 5, W, "3 - 5 weeks"], null],
  ["Eggs", "Raw yolks, whites", "raw egg yolks and whites", ["egg whites", "egg yolks"], "eggs", "fridge", [2, 4, D, "2 - 4 days"], [1, 1, Y, "1 year"]],
  ["Eggs", "Hard cooked", "hard cooked eggs", ["hard boiled eggs", "boiled eggs"], "eggs", "fridge", [1, 1, W, "1 week"], null],
  ["Eggs", "Liquid pasteurized eggs or egg substitutes, opened", "liquid eggs, opened", ["egg substitute, opened"], "eggs", "fridge", [3, 3, D, "3 days"], null],
  ["Eggs", "Egg substitutes, liquid, unopened", "liquid eggs", ["liquid egg whites", "egg substitute", "liquid pasteurized eggs"], "eggs", "fridge", [1, 1, W, "1 week"], null, { src: C23 }],
  ["TV Dinners, Frozen Casseroles", "Keep frozen until ready to heat", "frozen dinners", ["tv dinners", "frozen casseroles", "frozen meals"], "frozen", "freezer", null, [3, 4, M, "3 - 4 months"], { tip: "Keep frozen until ready to heat." }],
  ["Salad", "Egg, chicken, ham, tuna, and macaroni salads", "deli salads", ["egg salad", "chicken salad", "tuna salad", "ham salad", "macaroni salad"], "deli", "fridge", [3, 4, D, "3 to 4 days"], null, { src: C23 }],
  ["Deli & Vacuum-Packed Products", "Pre-stuffed pork & lamb chops, chicken breasts stuffed w/dressing", "pre-stuffed chops and chicken breasts", ["stuffed pork chops", "stuffed lamb chops", "stuffed chicken breasts"], "deli", "fridge", [1, 1, D, "1 day"], null],
  ["Deli & Vacuum-Packed Products", "Store-cooked convenience meals", "store-cooked convenience meals", ["prepared meals", "deli meals"], "deli", "fridge", [3, 4, D, "3 - 4 days"], null],
  ["Deli & Vacuum-Packed Products", "Commercial brand vacuum-packed dinners with USDA seal, unopened", "vacuum-packed dinners", ["commercial brand vacuum-packed dinners"], "deli", "fridge", [2, 2, W, "2 weeks"], null],
  ["Raw Hamburger, Ground & Stew Meat", "Hamburger & stew meats", "ground beef", ["hamburger", "stew meat", "beef stew meat", "ground chuck", "lean ground beef", "beef, ground"], "meat", "fridge", [1, 2, D, "1 - 2 days"], [3, 4, M, "3 - 4 months"], { tip: MEAT_TIP }],
  ["Raw Hamburger, Ground & Stew Meat", "Ground turkey, veal, pork, lamb", "ground turkey", ["turkey, ground"], "poultry", "fridge", [1, 2, D, "1 - 2 days"], [3, 4, M, "3 - 4 months"], { tip: MEAT_TIP }],
  ["Raw Hamburger, Ground & Stew Meat", "Ground turkey, veal, pork, lamb", "ground veal", ["veal, ground"], "meat", "fridge", [1, 2, D, "1 - 2 days"], [3, 4, M, "3 - 4 months"], { tip: MEAT_TIP }],
  ["Raw Hamburger, Ground & Stew Meat", "Ground turkey, veal, pork, lamb", "ground pork", ["pork, ground"], "meat", "fridge", [1, 2, D, "1 - 2 days"], [3, 4, M, "3 - 4 months"], { tip: MEAT_TIP }],
  ["Raw Hamburger, Ground & Stew Meat", "Ground turkey, veal, pork, lamb", "ground lamb", ["lamb, ground"], "meat", "fridge", [1, 2, D, "1 - 2 days"], [3, 4, M, "3 - 4 months"], { tip: MEAT_TIP }],
  ["Ham, Corned Beef", "Corned beef in pouch with pickling juices", "corned beef", ["corned beef in pouch"], "meat", "fridge", [5, 7, D, "5 - 7 days"], [1, 1, M, "Drained, 1 month"], { tip: "Drain the pickling juices before freezing." }],
  ["Ham, Corned Beef", "Ham, canned, labeled \"Keep Refrigerated,\" unopened", "canned ham, unopened", ["canned ham"], "meat", "fridge", [6, 9, M, "6 - 9 months"], null],
  ["Ham, Corned Beef", "Ham, canned, labeled \"Keep Refrigerated,\" opened", "canned ham, opened", [], "meat", "fridge", [3, 5, D, "3 - 5 days"], [1, 2, M, "1 - 2 months"]],
  ["Ham, Corned Beef", "Ham, fully cooked, whole", "ham, whole", ["whole ham", "fully cooked ham"], "meat", "fridge", [7, 7, D, "7 days"], [1, 2, M, "1 - 2 months"]],
  ["Ham, Corned Beef", "Ham, fully cooked, half", "ham, half", ["half ham"], "meat", "fridge", [3, 5, D, "3 - 5 days"], [1, 2, M, "1 - 2 months"]],
  ["Ham", "Cooked, store-wrapped, slices, half, or spiral cut", "ham slices", ["sliced ham", "ham steak"], "meat", "fridge", [3, 5, D, "3 to 5 days"], [1, 2, M, "1 to 2 months"], { src: C23 }],
  ["Hot Dogs & Lunch Meats (in freezer wrap)", "Hot dogs, opened package", "hot dogs, opened", [], "meat", "fridge", [1, 1, W, "1 week"], [1, 2, M, "1 - 2 months"], { tip: WRAP_TIP }],
  ["Hot Dogs & Lunch Meats (in freezer wrap)", "Hot dogs, unopened package", "hot dogs", ["franks", "frankfurters", "wieners"], "meat", "fridge", [2, 2, W, "2 weeks"], [1, 2, M, "1 - 2 months"], { tip: WRAP_TIP }],
  ["Hot Dogs & Lunch Meats (in freezer wrap)", "Lunch meats, opened package", "lunch meat, opened", [], "deli", "fridge", [3, 5, D, "3 - 5 days"], [1, 2, M, "1 - 2 months"], { tip: WRAP_TIP }],
  ["Hot Dogs & Lunch Meats (in freezer wrap)", "Lunch meats, unopened package", "lunch meat", ["deli meat", "cold cuts", "lunchmeat", "sliced turkey"], "deli", "fridge", [2, 2, W, "2 weeks"], [1, 2, M, "1 - 2 months"], { tip: WRAP_TIP }],
  ["Soups & Stews", "Vegetable or meat-added & mixtures of them", "soups and stews", ["soup", "stew", "homemade soup"], "leftovers", "fridge", [3, 4, D, "3 - 4 days"], [2, 3, M, "2 - 3 months"]],
  ["Bacon & Sausage", "Bacon", "bacon", ["sliced bacon", "thick cut bacon"], "meat", "fridge", [7, 7, D, "7 days"], [1, 1, M, "1 month"], { tip: MEAT_TIP }],
  ["Bacon & Sausage", "Sausage, raw from pork, beef, chicken or turkey", "raw sausage", ["sausage", "fresh sausage", "italian sausage", "pork sausage"], "meat", "fridge", [1, 2, D, "1 - 2 days"], [1, 2, M, "1 - 2 months"], { tip: MEAT_TIP }],
  ["Bacon & Sausage", "Smoked breakfast links, patties", "smoked breakfast links and patties", ["breakfast links", "smoked sausage links", "breakfast sausage patties"], "meat", "fridge", [7, 7, D, "7 days"], [1, 2, M, "1 - 2 months"], { tip: MEAT_TIP }],
  ["Fresh beef, veal, lamb, and pork", "Steaks", "steak", ["steaks", "beef steak", "ribeye", "sirloin steak", "beef, steaks"], "meat", "fridge", [3, 5, D, "3 to 5 days"], [4, 12, M, "4 to 12 months"], { tip: MEAT_TIP, src: C23 }],
  ["Fresh beef, veal, lamb, and pork", "Chops", "pork chops", ["pork chop", "lamb chops", "veal chops", "chops"], "meat", "fridge", [3, 5, D, "3 to 5 days"], [4, 12, M, "4 to 12 months"], { tip: MEAT_TIP, src: C23 }],
  ["Fresh Meat (Beef, Veal, Lamb, & Pork)", "Roasts", "roast", ["pot roast", "beef roast", "pork roast", "chuck roast"], "meat", "fridge", [3, 5, D, "3 - 5 days"], [4, 12, M, "4 - 12 months"], { tip: MEAT_TIP }],
  ["Fresh Meat (Beef, Veal, Lamb, & Pork)", "Variety meats (tongue, kidneys, liver, heart, chitterlings)", "variety meats", ["liver", "beef liver", "tongue", "kidneys", "heart", "chitterlings"], "meat", "fridge", [1, 2, D, "1 - 2 days"], [3, 4, M, "3 - 4 months"], { tip: MEAT_TIP }],
  ["Leftovers", "Cooked meat or poultry", "cooked meat leftovers", ["leftover meat", "cooked meat", "meat dishes"], "leftovers", "fridge", [3, 4, D, "3 to 4 days"], [2, 6, M, "2 to 6 months"], { src: C23 }],
  ["Meat Leftovers", "Gravy & meat broth", "gravy and meat broth", ["gravy", "meat broth"], "leftovers", "fridge", [1, 2, D, "1 - 2 days"], [2, 3, M, "2 - 3 months"]],
  ["Fresh Poultry", "Chicken or turkey, whole", "whole chicken", ["whole turkey", "chicken, whole", "turkey, whole"], "poultry", "fridge", [1, 2, D, "1 - 2 days"], [1, 1, Y, "1 year"], { tip: MEAT_TIP }],
  ["Fresh Poultry", "Chicken or turkey, parts", "chicken breast", ["boneless skinless chicken breast", "bnls chkn brst", "chicken breasts", "chicken tenders"], "poultry", "fridge", [1, 2, D, "1 - 2 days"], [9, 9, M, "9 months"], { tip: MEAT_TIP }],
  ["Fresh Poultry", "Chicken or turkey, parts", "chicken thighs", ["chicken thigh", "chicken legs", "chicken drumsticks"], "poultry", "fridge", [1, 2, D, "1 - 2 days"], [9, 9, M, "9 months"], { tip: MEAT_TIP }],
  ["Fresh Poultry", "Chicken or turkey, parts", "chicken wings", ["wings"], "poultry", "fridge", [1, 2, D, "1 - 2 days"], [9, 9, M, "9 months"], { tip: MEAT_TIP }],
  ["Fresh Poultry", "Chicken or turkey, parts", "turkey parts", ["turkey breast", "turkey legs", "turkey thighs"], "poultry", "fridge", [1, 2, D, "1 - 2 days"], [9, 9, M, "9 months"], { tip: MEAT_TIP }],
  ["Fresh Poultry", "Giblets", "giblets", [], "poultry", "fridge", [1, 2, D, "1 - 2 days"], [3, 4, M, "3 - 4 months"], { tip: MEAT_TIP }],
  ["Cooked Poultry, Leftover", "Fried chicken", "fried chicken", [], "leftovers", "fridge", [3, 4, D, "3 - 4 days"], [4, 4, M, "4 months"]],
  ["Leftovers", "Cooked meat or poultry", "cooked poultry dishes", ["chicken casserole", "leftover chicken dish"], "leftovers", "fridge", [3, 4, D, "3 to 4 days"], [2, 6, M, "2 to 6 months"], { src: C23 }],
  ["Leftovers", "Cooked meat or poultry", "cooked chicken pieces", ["cooked chicken", "leftover chicken", "cooked turkey"], "leftovers", "fridge", [3, 4, D, "3 to 4 days"], [2, 6, M, "2 to 6 months"], { src: C23 }],
  ["Cooked Poultry, Leftover", "Pieces covered with broth, gravy", "cooked poultry in broth or gravy", [], "leftovers", "fridge", [3, 4, D, "3 - 4 days"], [6, 6, M, "6 months"]],
  ["Cooked Poultry, Leftover", "Chicken nuggets, patties", "cooked chicken nuggets and patties", ["leftover chicken nuggets"], "leftovers", "fridge", [3, 4, D, "3 - 4 days"], [1, 3, M, "1 - 3 months"]],
  // The 2023 chart splits lean fish into cod-type (6 - 8 months frozen) and pollock-type (4 - 8 months); one row keeps the shorter.
  ["Fin Fish", "Lean Fish (cod, flounder, haddock, halibut, sole, etc.); Lean Fish (pollock, ocean perch, rockfish, sea trout.)", "lean fish", ["cod", "tilapia", "flounder", "haddock", "halibut", "sole", "pollock"], "seafood", "fridge", [1, 3, D, "1 - 3 Days"], [4, 8, M, "4 - 8 Months"], { src: C23 }],
  ["Fin Fish", "Fatty Fish (bluefish, catfish, mackerel, mullet, salmon, tuna, etc.)", "fatty fish", ["salmon", "salmon fillet", "mackerel", "trout", "bluefish", "catfish"], "seafood", "fridge", [1, 3, D, "1 - 3 Days"], [2, 3, M, "2 - 3 Months"], { src: C23 }],
  ["Fish & Shellfish", "Cooked fish", "cooked fish", ["leftover fish"], "leftovers", "fridge", [3, 4, D, "3 - 4 days"], [4, 6, M, "4 - 6 months"]],
  ["Fish & Shellfish", "Smoked fish", "smoked fish", ["smoked salmon", "lox"], "seafood", "fridge", [14, 14, D, "14 days"], [2, 2, M, "2 months"]],
  ["Shellfish", "Shrimp, Crayfish", "shrimp", ["fresh shrimp", "raw shrimp"], "seafood", "fridge", [3, 5, D, "3 - 5 Days"], [6, 18, M, "6 - 18 Months"], { src: C23 }],
  ["Shellfish", "Shucked Clams, Mussels, Oysters, and Scallops", "scallops", [], "seafood", "fridge", [3, 10, D, "3 - 10 Days"], [3, 4, M, "3 - 4 Months"], { src: C23 }],
  ["Shellfish", "Shrimp, Crayfish", "crawfish", ["crayfish"], "seafood", "fridge", [3, 5, D, "3 - 5 Days"], [6, 18, M, "6 - 18 Months"], { src: C23 }],
  ["Shellfish", "Squid", "squid", ["calamari"], "seafood", "fridge", [1, 3, D, "1 - 3 Days"], [6, 18, M, "6 - 18 Months"], { src: C23 }],
  ["Fish & Shellfish", "Canned seafood (Pantry, 5 years)", "canned seafood", ["canned tuna", "canned salmon", "canned sardines", "canned crab"], "seafood", "pantry", [3, 4, D, "after opening 3 - 4 days"], [2, 2, M, "out of can 2 months"], { pantry: [5, 5, Y, "Pantry, 5 years"], tip: "After opening, refrigerate and use within 3 - 4 days, or freeze out of the can for up to 2 months." }],
];

const range = ([min, max, unit, text], section, row, loc, src = "2018") => ({
  min: min * unit,
  max: max * unit,
  source: "fda_chart",
  ref: `${CHARTS[src]} > ${section} > ${row} > ${loc}: ${text}`,
});

const out = rows.map(([section, row, name, aliases, category, defaultLocation, fridge, freezer, extra = {}]) => {
  const food = { name, aliases, category, defaultLocation };
  if (fridge) food.fridgeDays = range(fridge, section, row, "Refrigerator", extra.src);
  if (freezer) food.freezerDays = range(freezer, section, row, "Freezer", extra.src);
  if (extra.pantry) food.pantryDays = range(extra.pantry, section, row, "Pantry", extra.src);
  if (extra.tip) food.storageTip = { text: extra.tip, source: "fda_chart" };
  return food;
});

const names = new Set(out.map((f) => f.name));
if (names.size !== out.length) throw new Error("duplicate names");
writeFileSync(new URL("./fdaChart.json", import.meta.url), JSON.stringify(out, null, 2) + "\n");
console.log("rows", out.length);
