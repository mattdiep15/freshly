import { demoLeaderboard } from "@/app/_demo/fixtures";
import { Leaderboard } from "@/app/_components/Leaderboard";
import { Leekly } from "@/app/_components/ui/Leekly";

export default function FriendsPage() {
  // TODO(release): leaderboard is P2 (p2-03-community-and-streaks); this is demo data only.
  return (
    <main className="friends-page">
      <section className="compact-heading heading-with-action friends-heading">
        <Leekly pose="friends" className="friends-header-art" />
        <div>
          <p className="eyebrow">this week</p>
          <h1>you + friends.</h1>
        </div>
        <button className="outline-button" disabled>
          + add a friend
        </button>
      </section>
      <div className="friends-stage">
        <Leaderboard entries={demoLeaderboard} />
      </div>
    </main>
  );
}
