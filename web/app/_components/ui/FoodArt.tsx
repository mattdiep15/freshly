import Image from "next/image";

type Art = { file: string; width: number; height: number };

// First matching keyword wins, so specific foods come before broad ones.
const artByKeyword: [RegExp, Art][] = [
  [/shrimp|prawn/, { file: "shrimp", width: 479, height: 477 }],
  [/salmon|fish|tuna|cod|tilapia/, { file: "fish", width: 729, height: 281 }],
  [/chicken|drumstick|turkey|poultry/, { file: "drumstick", width: 620, height: 265 }],
  [/strawberr|berries/, { file: "strawberry", width: 388, height: 350 }],
  [/spinach|lettuce|romaine|kale|greens|cilantro/, { file: "spinach", width: 560, height: 615 }],
  [/banana/, { file: "banana", width: 611, height: 465 }],
  [/avocado/, { file: "avocado", width: 369, height: 402 }],
  [/broccoli/, { file: "broccoli", width: 529, height: 561 }],
  [/butter/, { file: "butter", width: 654, height: 430 }],
  [/milk/, { file: "milk-carton", width: 458, height: 656 }],
  [/bread|loaf|bagel|sourdough|bun/, { file: "bread", width: 639, height: 309 }],
  [/pasta|noodle|spaghetti|macaroni/, { file: "pasta", width: 518, height: 317 }],
];

// TODO(release): box.png is a placeholder; replace it (and the size below) with the designer's catch-all icon.
const packagedArt: Art = { file: "box", width: 433, height: 350 };

function artFor(name: string, packaged: boolean): Art | undefined {
  const lower = name.toLowerCase();
  const match = artByKeyword.find(([pattern]) => pattern.test(lower))?.[1];
  return match ?? (packaged ? packagedArt : undefined);
}

// Renders an empty span of the same size when no illustration exists yet.
export function FoodArt({ name, packaged = false, className }: { name: string; packaged?: boolean; className?: string }) {
  const art = artFor(name, packaged);
  if (!art) return <span className={className} aria-hidden="true" />;
  return (
    <Image
      className={className}
      src={`/illustrations/food/${art.file}.png`}
      width={art.width}
      height={art.height}
      alt=""
      aria-hidden="true"
    />
  );
}
