"use client";

import { useQuery } from "convex/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type ReactNode } from "react";
import { api } from "@/convex/_generated/api";
import { AddFriendPanel, InviteConfirm } from "@/app/_components/AddFriend";
import { Leaderboard } from "@/app/_components/Leaderboard";
import { SettingsCard } from "@/app/_components/SettingsCard";
import { setCommunityView, useCommunityView, type CommunityView } from "@/app/_components/useCommunityView";
import { PeriodTable, StatCircles, StatsMascot } from "@/app/_components/WasteStats";
import { Leekly } from "@/app/_components/ui/Leekly";

const VIEW_LABELS: Record<CommunityView, string> = { numbers: "my numbers", friends: "friends" };

function NumbersView() {
  const week = useQuery(api.stats.summary, { range: "week" });
  const month = useQuery(api.stats.summary, { range: "month" });
  const all = useQuery(api.stats.summary, { range: "all" });
  const streak = useQuery(api.stats.streak);
  if (!week || !month || !all || !streak) return <div className="numbers-view" aria-busy="true" />;

  const periods = [
    { label: "this week", summary: week },
    { label: "this month", summary: month },
    { label: "all time", summary: all },
  ].map(({ label, summary }) => ({ label, rescued: summary.itemsUsed, lbsWasted: summary.wastedLbs, centsWasted: summary.wastedCents, usedRate: summary.usedRate }));

  return (
    <div className="numbers-view">
      <div className="numbers-hero">
        <section className="community-section-heading stats-heading">
          <StatsMascot />
          <h2>your numbers.</h2>
        </section>
        <StatCircles
          totals={{
            rescued: month.itemsUsed,
            lbsWasted: month.wastedLbs,
            streakDays: streak.streakDays,
            approximate: month.itemsMissingWeight > 0,
          }}
        />
      </div>
      <PeriodTable periods={periods} />
      <SettingsCard />
    </div>
  );
}

function FriendsView({ invite, onInviteDone }: { invite: string | null; onInviteDone: () => void }) {
  const leaderboard = useQuery(api.friends.leaderboard);
  const [adding, setAdding] = useState(false);
  return (
    <div className="friends-page">
      <section className="community-section-heading heading-with-action friends-heading">
        <Leekly pose="friends" className="friends-header-art" />
        <div>
          <p className="eyebrow">this week</p>
          <h2>you + friends.</h2>
        </div>
        <button className="outline-button" aria-expanded={adding} onClick={() => setAdding((open) => !open)}>
          {adding ? "close" : "+ add a friend"}
        </button>
      </section>
      {invite && <InviteConfirm code={invite} onDone={onInviteDone} />}
      {adding && <AddFriendPanel />}
      <div className="friends-stage">
        {leaderboard && <Leaderboard entries={leaderboard.map((row) => (row.isYou ? { ...row, name: "you" } : row))} />}
      </div>
    </div>
  );
}

// Both panels stay mounted so switching back keeps the stats animation and mascot as they were.
function Panel({ view, active, children }: { view: CommunityView; active: boolean; children: ReactNode }) {
  return (
    <section id={`community-${view}`} role="tabpanel" className={`community-panel ${active ? "is-active" : ""}`} aria-hidden={!active}>
      {children}
    </section>
  );
}

function Community() {
  const view = useCommunityView();
  const router = useRouter();
  const params = useSearchParams();
  const requested = params.get("view");
  // Kept in state because the URL is cleared below; invite links are /community?view=friends&invite=<code>.
  const [invite, setInvite] = useState(() => params.get("invite"));

  // /stats and /friends redirect here with ?view=; it picks the tab once, then the URL goes back to plain /community.
  useEffect(() => {
    if (requested !== "numbers" && requested !== "friends") return;
    setCommunityView(requested);
    router.replace("/community");
  }, [requested, router]);

  return (
    <main className="community-page">
      <h1>community.</h1>
      <div className="community-switch" role="tablist" aria-label="Community view">
        {(Object.keys(VIEW_LABELS) as CommunityView[]).map((option) => (
          <button
            key={option}
            type="button"
            role="tab"
            aria-selected={view === option}
            aria-controls={`community-${option}`}
            className={view === option ? "is-selected" : ""}
            onClick={() => setCommunityView(option)}
          >
            {VIEW_LABELS[option]}
          </button>
        ))}
      </div>
      <Panel view="numbers" active={view === "numbers"}>
        <NumbersView />
      </Panel>
      <Panel view="friends" active={view === "friends"}>
        <FriendsView invite={invite} onInviteDone={() => setInvite(null)} />
      </Panel>
    </main>
  );
}

export default function CommunityPage() {
  return (
    <Suspense>
      <Community />
    </Suspense>
  );
}
