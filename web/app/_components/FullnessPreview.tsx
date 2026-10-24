"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

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
  const previewRef = useRef<HTMLDivElement>(null);
  const isDesktop = () => window.innerWidth >= 768;

  // On mobile the tooltip has no hover-out, so a tap anywhere else closes it.
  useEffect(() => {
    if (!showGroups) return;
    const closeOutside = (event: PointerEvent) => {
      if (isDesktop() || previewRef.current?.contains(event.target as Node)) return;
      setShowGroups(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [showGroups]);

  return (
    <div
      ref={previewRef}
      className="fullness-preview"
      onMouseEnter={() => {
        if (isDesktop()) setShowGroups(true);
      }}
      onMouseLeave={() => {
        if (isDesktop()) setShowGroups(false);
      }}
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
        <div className="stock-tooltip" onClick={() => setShowGroups(false)}>
          <p>
            <strong>stocked</strong>
            <span>{stocked.join(", ") || "nothing yet."}</span>
          </p>
          <p>
            <strong>empty</strong>
            <span>{empty.join(", ") || "nothing empty."}</span>
          </p>
          <small className="stock-tooltip-hint">tap to close</small>
        </div>
      )}
    </div>
  );
}
