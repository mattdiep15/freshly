import Image from "next/image";

const art = {
  stand: { file: "leekly", width: 314, height: 734 },
  fridge: { file: "leekly-fridge", width: 690, height: 538 },
  point: { file: "leekly-point", width: 287, height: 635 },
  photo: { file: "photoleek", width: 290, height: 682 },
} as const;

export type LeeklyPose = keyof typeof art;

// Leekly is the freshly mascot; purely decorative, so hidden from screen readers.
export function Leekly({ pose = "stand", className }: { pose?: LeeklyPose; className?: string }) {
  const { file, width, height } = art[pose];
  return (
    <Image
      className={className}
      src={`/illustrations/mascot/${file}.png`}
      width={width}
      height={height}
      alt=""
      aria-hidden="true"
    />
  );
}
