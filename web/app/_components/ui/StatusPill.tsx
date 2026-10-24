import type { Freshness } from "@/lib/freshness";

const labels: Record<Freshness, string> = {
  fresh: "fresh",
  soon: "use soon",
  expired: "expired",
  unknown: "no date",
};

export function StatusPill({ status }: { status: Freshness }) {
  return <span className="status-pill">{labels[status]}</span>;
}
