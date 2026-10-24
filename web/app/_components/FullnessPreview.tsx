"use client";

import Image from "next/image";
import { useState } from "react";

export type FullnessStage = 10 | 40 | 70 | 100;

export const fullnessLabels: Record<FullnessStage, string> = {
  10: "nearly empty.",
  40: "getting low.",
  70: "well stocked.",
  100: "fully stocked.",
};

export function FullnessPreview({ stage, stocked, empty }: {
  stage: FullnessStage;
  stocked: readonly string[];
  empty: readonly string[];
}) {
  const [showGroups, setShowGroups] = useState(false);

  return (
    <div
      className="fullness-preview"
      onMouseEnter={() => setShowGroups(true)}
      onMouseLeave={() => setShowGroups(false)}
    >
      <button
        type="button"
        className="fullness-art"
        aria-label={`Show food groups for ${stage}% stocked`}
        aria-expanded={showGroups}
        onClick={() => setShowGroups((value) => !value)}
      >
        <Image
          className="fullness-stage is-visible"
          src={`/illustrations/fullness/stage-${stage}.png`}
          width={869}
          height={869}
          alt=""
          aria-hidden="true"
          priority
        />
      </button>
      {showGroups && (
        <div className="stock-tooltip">
          <p>
            <strong>stocked</strong> {stocked.join(", ") || "nothing yet"}
          </p>
          <p>
            <strong>empty</strong> {empty.join(", ") || "nothing"}
          </p>
        </div>
      )}
    </div>
  );
}
