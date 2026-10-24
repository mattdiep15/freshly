import { demoLeaderboard } from "@/app/_demo/fixtures";
import { Leaderboard } from "@/app/_components/Leaderboard";

export default function FriendsPage() {
  // TODO(release): leaderboard is P2 (p2-social-and-shopping); this is demo data only.
  return (
    <main className="friends-page">
      <section className="compact-heading heading-with-action">
        <div>
          <p className="eyebrow">this week</p>
          <h1>you + friends.</h1>
        </div>
        <button className="outline-button" disabled>
          + add a friend
        </button>
      </section>
      <Leaderboard entries={demoLeaderboard} />
    </main>
  );
}
