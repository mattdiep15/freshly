# Demo: live push notifications

On stage, someone on a second laptop opens one URL and the presenter's iPhone shows "1 thing to use soon. In 3 days: Cremini mushrooms." The app runs on a host laptop with `npm run dev`, and a `cloudflared` tunnel gives the phone the HTTPS address that web push requires. The Vercel deploy cannot run this demo, because `/dev/push` and every `/api/dev/*` route return 404 in production builds.

The hourly reminder cron plays no part here. `docs/exec-plans/p2-05-push-for-real-users.md` covers turning it into the real feature.

## Before demo day

- Merge the push branch into `main`. Each `convex dev` run replaces the team dev deployment's functions with its own checkout's, so a teammate running `npm run dev` from an older checkout removes `dev.pushReminder` and the demo route fails.
- On the host laptop, install `cloudflared` once with `winget install --id Cloudflare.cloudflared`.
- Check that the host's `web/.env.local` has `NEXT_PUBLIC_VAPID_PUBLIC_KEY`. The Convex side (the VAPID keys and `ALLOW_DEMO_USER`) is already set on `dev:secret-opossum-432`.
- The iPhone needs iOS 16.4 or later.

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

## During the demo

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
