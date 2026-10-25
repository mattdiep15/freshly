# P2-05: Push reminders for real users

Tier: P2. Estimate: 3 to 4 hours for one engineer. Step 2 depends on real sign-in (see p2-03).

## Purpose

The reminder pipeline from p1-03 works end to end. The hourly `lifecycle.tick` cron builds one digest per user at their digest hour and pushes it, and a real notification reached an iPhone on 2026-10-24. The demo does not rely on the cron: a second laptop triggers each push by hand with `/api/dev/push-reminder?days=3` (see `docs/DEMO.md`). This plan covers what has to change before real users get reminders with nobody pressing a button.

## Context

State on 2026-10-24:

- `convex/crons.ts` runs `lifecycle.tick` at minute 0 of every hour. For each profile whose local hour equals `digestHour`, and who has no digest for today's local `dateKey`, it builds a digest with `lib/digest.ts` and schedules `pushNode.send`. It runs hourly because each user has their own UTC offset and digest hour. A single daily run at a fixed UTC time would reach some users at 3am.
- Opt-in is the dev page `app/dev/push/page.tsx`, reached from the "push reminders" row in `SettingsCard`. Both are tagged `TODO(release)`. The page's status line points at `/api/dev/push-test`.
- A subscription belongs to whoever `getUserId` returns. On the dev deployment that is the demo user for anyone not signed in, so every tester's phone gets the demo user's pushes.
- `app/manifest.ts` makes the site installable to the Home Screen, which iOS requires before it allows web push.
- VAPID keys are set on the team dev deployment only. Its `VAPID_SUBJECT` is a placeholder, `mailto:freshly-dev@example.com`. The prod deployment and Vercel have not been checked.
- Dev-only triggers are `/api/dev/push-test`, `/api/dev/tick?force=1`, and `/api/dev/push-reminder?days=1|3|7`. They return 404 in production builds, and their Convex functions refuse to run without `ALLOW_DEMO_USER=true`.

## Steps

1. Production keys. Run `npm run setup:convex` against prod. It generates the VAPID keys and prints the public key. Add that key to Vercel as `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, and set `VAPID_SUBJECT` to a team address on dev and prod.
   Verify: `npx convex env get VAPID_PUBLIC_KEY --prod` matches the Vercel value.
2. Designed opt-in. Replace the settings link and the dev page with a toggle in `SettingsCard`. The toggle subscribes, unsubscribes with `push.removeSubscription`, and reads its state from `pushManager.getSubscription()`. In an iPhone Safari tab, where push is unavailable, show the Add to Home Screen steps instead of a button that fails. Delete `app/dev/push/page.tsx`.
   Verify: on an iPhone, the Home Screen app subscribes from settings, and a Safari tab shows the Home Screen steps.
3. Digest hour. `profiles.utcOffsetMinutes` and `digestHour` come from the seed today. Set the offset from the browser on sign-in and let the user pick the hour in settings. p1-03's decision log notes that a stored offset drifts an hour at daylight saving, so consider storing an IANA time zone instead.
4. Scan only due users. `lifecycle.tick` reads every profile every hour (`TODO(release)` in `convex/lifecycle.ts`). Store the UTC hour each profile is due, index it, and read only that hour's profiles.
5. Remove the dev triggers. Delete `dev.pushTest`, `dev.runTick`, `dev.pushReminder`, and their routes, as their `TODO(release)` tags say.

Optional, if users ask for it: let each user choose reminder days instead of the fixed 1, 3, and 7 in `REMINDER_DAYS`. That means storing the days on `profiles`, passing them to `buildDigest`, and generating the labels that `DAY_LABEL` now hardcodes. `lib/digest.test.ts` needs cases for the new days.

## Validation

- On prod, a signed-in test account with an item 3 days from expiry gets one push at its digest hour and none in the other 23 hours.
- Turning the toggle off deletes the row from `pushSubscriptions`, and no push arrives at the next digest hour.
- `grep -r "TODO(release)" web` lists nothing about push.

## Open questions

1. Should the cron stay on for the dev deployment during the demo? It sends the demo user's full digest at 9am Pacific (16:00 UTC). It does not interfere with the manual trigger, but a push will arrive on its own if the demo runs at 9am.

## Decision log

- 2026-10-24: The demo triggers pushes by hand with `/api/dev/push-reminder` so the audience sees a push the moment someone asks for one. The route reuses `buildDigest` and `pushNode.send`, so the text matches what the cron sends for that day group.
- 2026-10-24: `/api/dev/push-reminder` stays dev-only. A GET request triggers the push, the Next.js call to Convex passes no auth token, and the notification row it saves blocks that day's real digest.
