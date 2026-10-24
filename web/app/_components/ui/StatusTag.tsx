import type { ReactNode } from "react";
import type { Freshness } from "@/lib/freshness";

const labels: Record<Freshness, string> = {
  fresh: "fresh",
  soon: "use soon",
  expired: "expired",
  unknown: "no date",
};

// Same fixed size as StatusTag, for labels that are not a food status.
export function FixedTag({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={`status-tag ${className}`}>{children}</span>;
}

export function StatusTag({ status }: { status: Freshness }) {
  return <FixedTag className={`status-tag--${status}`}>{labels[status]}</FixedTag>;
}
