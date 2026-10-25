# Demo runbook

The presenter drives freshly on an iPhone, from a receipt scan to the stats, and in the middle someone on a second laptop opens one URL so the phone shows a live reminder: "1 thing to use soon. In 3 days: Cremini mushrooms." The app runs on a host laptop with `npm run dev`, and a `cloudflared` tunnel gives the phone the HTTPS address that web push requires. The Vercel deploy cannot run this demo, because `/dev/push` and every `/api/dev/*` route return 404 in production builds.

How each step works under the hood is in the Freshly System Map artifact (https://claude.ai/artifact/2GPQjF9ZvhQkSyWCLKUmj8).

The hourly reminder cron plays no part here. `docs/exec-plans/p2-05-push-for-real-users.md` covers turning it into the real feature.

## Before demo day

- Merge the push branch into `main`. Each `convex dev` run replaces the team dev deployment's functions with its own checkout's, so a teammate running `npm run dev` from an older checkout removes `dev.pushReminder` and the demo route fails.
- On the host laptop, install `cloudflared` once with `winget install --id Cloudflare.cloudflared`.
- Check that the host's `web/.env.local` has `NEXT_PUBLIC_VAPID_PUBLIC_KEY`. The Convex side (the VAPID keys and `ALLOW_DEMO_USER`) is already set on `dev:secret-opossum-432`.
- The iPhone needs iOS 16.4 or later.
- Put a grocery receipt photo in the iPhone's photo library for the scan. The Costco test receipts in `data/` show a member number and card digits, so pick or redact one before it goes on a projected screen.

## Setup, 10 minutes before

On the host laptop, from the main checkout:

```bash
cd web
npm run dev
```

In a second terminal:

```bash
cloudflared tunnel --url http://localhost:3000
```

Copy the `https://<random>.trycloudflare.com` URL it prints. Leave both terminals running.

1. Open `<tunnel>/api/dev/seed` to reset the demo data. This resets the demo user's items and receipts for everyone on the deployment.
2. On the iPhone, delete any freshly icon left from an earlier tunnel. Open the tunnel URL in Safari and tap Share, then Add to Home Screen.
3. Open freshly from the Home Screen icon. Go to Community, scroll to settings, tap "set up" next to push reminders, tap Subscribe, and allow notifications.
4. From the second laptop, open `<tunnel>/api/dev/push-reminder?days=3` and check that the push arrives.
5. Turn off Focus on the iPhone so banners show.
6. Open the Recipes tab once and wait for the web recipes to appear. The first search takes about 1.5 minutes, and the result is saved for the rest of the day.

## Walkthrough, about 6 minutes

The item names below come from `/api/dev/seed`. Reseed after a rehearsal so the live run starts from the same state.

1. **Fridge (30 s).** The app opens on the fridge. The use-soon section at the top shows Chicken breast (1 day) and Cremini mushrooms (3 days). Baby spinach, Ground beef, and Strawberries are past their dates and each has a "review expired item" button. Whole milk reads "no sourced shelf life. set a date." because FoodKeeper has no fridge range for milk, and the app does not guess.
2. **Recipes and grocery (1 min).** Open Recipes. The web recipes for chicken and mushrooms load from the search run during setup, each citing its page. Tap "+ grocery list" on one, then open Grocery: the new entries say which recipe they are for, and Bananas says to buy less because the seed wasted them last time.
3. **Scan (1 to 2 min).** Tap the camera button and pick the receipt photo. Claude reads the lines while you wait. On the review screen, point out that every date comes from a sourced range, then tap freezer on one row to show the date change. Tap "add to fridge". If the receipt has spinach, the grocery entry for spinach checks itself off.
4. **Live reminder (30 s).** Lock the iPhone. The second laptop opens `<tunnel>/api/dev/push-reminder?days=3`, and the lock screen shows the reminder. Tap it to open freshly. The other URLs are in the table below.
5. **Swipe cards (1 min).** Tap "review expired item" on Baby spinach. Swipe left ("not used"), and the second card asks whether it looks spoiled. Swipe right to keep it 2 more days, which stays inside spinach's sourced 3 to 7 day range. Then open Ground beef and swipe left. Beef's range is only 1 to 2 days, so there is no second card and it is marked wasted.
6. **Community (30 s).** "My numbers" shows dollars and pounds wasted over the last 4 weeks. "Friends" shows the weekly leaderboard, where nina's dollars read "private" because she turned sharing off.

Recipes comes before the scan and the swipes on purpose. Both can change the three soonest items (a kept spinach has 2 days left, so it joins the use-soon list), and a new set starts a new search that takes about 1.5 minutes. The tab shows the newest search, so the web recipes can disappear until it finishes, and at most 3 searches run per day. A rehearsal uses some of them.

## Push URLs

From the second laptop, open one of these. The text assumes a seed from the same day.

| URL | Push |
| --- | --- |
| `<tunnel>/api/dev/push-reminder?days=1` | Expiring tomorrow: Chicken breast. |
| `<tunnel>/api/dev/push-reminder?days=3` | In 3 days: Cremini mushrooms. |
| `<tunnel>/api/dev/push-reminder?days=7` | In a week: Eggs. |

Lock the phone first to show the notification on the lock screen. Tapping it opens freshly.

## If something goes wrong

- The JSON says `"sent": false` and "No active item expires in 3 days": someone marked that item used, or the seed is from an earlier day. Open `<tunnel>/api/dev/seed` and try again.
- The JSON says `"sent": true` but nothing arrives: that only means the push was queued. Open `<tunnel>/api/dev/push-test`. If it shows `"subscriptions": 0`, the phone is not subscribed, so repeat setup step 3 inside the Home Screen app.
- The page does not load: the tunnel or `npm run dev` stopped. A restarted tunnel gets a new URL, so repeat setup steps 2 and 3. Keep the host laptop plugged in with sleep turned off.

## Side effects

- Every device subscribed as the demo user gets every push, including teammates' phones.
- The cron still runs on the dev deployment and sends the demo user's full digest at 9am Pacific. A manual push earlier that day blocks it, because each manual push saves that day's notification row. `/api/dev/seed` clears those rows.
