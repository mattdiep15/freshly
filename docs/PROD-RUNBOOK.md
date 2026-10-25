# Prod runbook

Copy-paste commands for the demo user on the prod deployment (`scrupulous-leopard-121`, served at https://freshlyyy.vercel.app). Until `ALLOW_DEV_ROUTES=true` is set on Vercel, the `/api/dev/*` routes return 404 there, so these commands call the same Convex functions directly. Each function checks `ALLOW_DEMO_USER=true`, which is set on prod.

Run them from `web/` in the main checkout, after `npx convex login` with an account in the `matthew-lu-diep` team. `--prod` sends the call to the freshly project's production deployment instead of the dev deployment in `.env.local`.

The commands use Git Bash quoting. In PowerShell, double the inner quotes: `'{""days"": 3}'`.

## Reset the demo data

```bash
npx convex run dev:reseed --prod
```

This resets the demo user's items, receipts, and notification rows for everyone on the prod site and keeps the demo settings. `npm run reset` does the same reset on the dev deployment, not prod.

## Send a reminder push

The push text assumes a reseed from the same day.

| Command | Push |
| --- | --- |
| `npx convex run dev:pushReminder '{"days": 1}' --prod` | Expiring tomorrow: Chicken breast. |
| `npx convex run dev:pushReminder '{"days": 3}' --prod` | In 3 days: Cremini mushrooms. |
| `npx convex run dev:pushReminder '{"days": 7}' --prod` | In a week: Eggs. |

`days` must be 1, 3, or 7. A result with `"sent": false` means no active item expires in that many days, so reseed and run it again. Every device subscribed as the demo user gets the push, including teammates' phones.

## Check push subscriptions

```bash
npx convex run dev:pushTest --prod
```

This sends "Freshly test push" to every subscription of the demo user and returns how many there are. `"subscriptions": 0` means no phone is subscribed: open freshly from the Home Screen icon, go to Community, scroll to settings, tap "set up" next to push reminders, and tap Subscribe.

## Run the daily tick now

```bash
npx convex run dev:runTick '{"force": true}' --prod
```

This marks items past their date as expired, then sends every user their daily digest even if it is not their digest hour or one went out today. Without `force`, it only sends to users whose digest hour is the current hour.
