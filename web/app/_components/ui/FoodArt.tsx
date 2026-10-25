import Image from "next/image";
import type { FoodGroup } from "@/lib/fullness";

type Art = { file: string; width: number; height: number };

const ART = {
  shrimp: { file: "shrimp", width: 479, height: 477 },
  fish: { file: "fish", width: 729, height: 281 },
  drumstick: { file: "drumstick", width: 620, height: 265 },
  strawberry: { file: "strawberry", width: 388, height: 350 },
  spinach: { file: "spinach", width: 560, height: 615 },
  banana: { file: "banana", width: 611, height: 465 },
  avocado: { file: "avocado", width: 369, height: 402 },
  broccoli: { file: "broccoli", width: 529, height: 561 },
  butter: { file: "butter", width: 654, height: 430 },
  yogurt: { file: "greek-yogurt", width: 354, height: 371 },
  milk: { file: "milk-carton", width: 458, height: 656 },
  eggs: { file: "eggs", width: 569, height: 366 },
  bread: { file: "bread", width: 639, height: 309 },
  pasta: { file: "pasta", width: 518, height: 317 },
  rice: { file: "rice", width: 419, height: 468 },
  grains: { file: "grains", width: 424, height: 461 },
  garlic: { file: "garlic", width: 421, height: 442 },
  honey: { file: "honey", width: 279, height: 401 },
  oil: { file: "oil", width: 314, height: 462 },
} satisfies Record<string, Art>;

// First matching keyword wins, so specific foods come before broad ones.
const artByKeyword: [RegExp, Art][] = [
  [/shrimp|prawn/, ART.shrimp],
  [/salmon|fish|tuna|cod|tilapia/, ART.fish],
  [/chicken|drumstick|turkey|poultry/, ART.drumstick],
  [/strawberr|berries/, ART.strawberry],
  [/spinach|lettuce|romaine|kale|greens|cilantro/, ART.spinach],
  [/banana/, ART.banana],
  [/avocado/, ART.avocado],
  [/broccoli/, ART.broccoli],
  [/butter/, ART.butter],
  [/yogurt/, ART.yogurt],
  [/milk/, ART.milk],
  [/\beggs?\b/, ART.eggs],
  [/bread|loaf|bagel|sourdough|bun/, ART.bread],
  [/pasta|noodle|spaghetti|macaroni/, ART.pasta],
  [/\brice\b/, ART.rice],
  [/\boats?\b|oatmeal|barley|grains?\b/, ART.grains],
  [/garlic/, ART.garlic],
  [/honey/, ART.honey],
  [/\boil\b/, ART.oil],
];

// The designer's catch-all drawings; a name always gets the same bag.
const BAGS: Art[] = [
  { file: "bag-1", width: 427, height: 498 },
  { file: "bag-2", width: 441, height: 485 },
  { file: "bag-3", width: 349, height: 497 },
];

function bagFor(name: string): Art {
  let hash = 0;
  for (const character of name.trim().toLowerCase()) hash = (Math.imul(hash, 31) + character.charCodeAt(0)) >>> 0;
  return BAGS[hash % BAGS.length];
}

// Manual entry shows the group's drawing for a food we have no drawing of.
const artByGroup: Partial<Record<FoodGroup, Art>> = {
  vegetables: ART.broccoli,
  fruit: ART.banana,
  protein: ART.drumstick,
  "dairy-eggs": ART.eggs,
  grains: ART.bread,
};

function artFor(name: string): Art | undefined {
  const lower = name.toLowerCase();
  return artByKeyword.find(([pattern]) => pattern.test(lower))?.[1];
}

// A food without its own drawing gets its group's drawing, then a bag; an empty name gets an empty box.
export function FoodArt({ name, group, className = "" }: { name: string; group?: FoodGroup | null; className?: string }) {
  if (!name.trim()) return <span className={`food-letter-placeholder ${className}`} aria-hidden="true" />;
  const drawn = artFor(name) ?? (group ? artByGroup[group] : undefined);
  const art = drawn ?? bagFor(name);
  return (
    <Image
      className={`${className} food-art ${drawn ? "" : "food-bag-icon"}`}
      src={`/illustrations/food/${art.file}.png`}
      width={art.width}
      height={art.height}
      alt=""
      aria-hidden="true"
    />
  );
}
