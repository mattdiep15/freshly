import Image from "next/image";

const DRAWINGS = {
  bowl: [254, 202],
  "chef-leek": [349, 867],
  "cutting-board": [498, 278],
  flame: [203, 345],
  pan: [531, 239],
  plate: [286, 237],
  pot: [341, 269],
  timer: [353, 301],
  whisk: [72, 393],
} as const;

export type RecipeDrawingName = keyof typeof DRAWINGS;

export function RecipeDrawing({ name, className = "" }: { name: RecipeDrawingName; className?: string }) {
  const [width, height] = DRAWINGS[name];
  return (
    <Image
      className={`recipe-drawing ${className}`}
      src={`/illustrations/recipes/${name}.png`}
      width={width}
      height={height}
      alt=""
      aria-hidden="true"
    />
  );
}
