# Quickstart

Run freshly on your own machine with your own Convex backend. Plan on about 15 minutes, most of it waiting on `npm install` and the first Convex push.

You need:

- Node.js 20.9 or later
- A free [Convex](https://convex.dev) account
- An [Anthropic API key](https://console.anthropic.com) for receipt parsing. Everything else works without it, but receipt scans fail.
- Optional: a [Gemini API key](https://aistudio.google.com/apikey) for the receipt header check and recipe cards, and an [Apify token](https://console.apify.com/settings/integrations) for web recipes and shelf-life lookups. Without Gemini, those calls fall back to Claude.

## 1. Install

```bash
git clone https://github.com/mattdiep15/freshly.git
cd freshly/web
npm install
```

## 2. Create a Convex dev deployment

```bash
npx convex dev --once
```

This logs you in, creates a project and a dev deployment, pushes the functions, and writes `web/.env.local`.

## 3. Set up the deployment

```bash
npm run setup:convex
```

Pick `1` (dev) and press Enter through the prompts, pasting your API keys when asked. The script:

- generates the auth keys and sets `SITE_URL` to `http://localhost:3000`
- stores your API keys on the Convex deployment, never in a file
- generates VAPID keys for push notifications and prints a `NEXT_PUBLIC_VAPID_PUBLIC_KEY=...` line
- turns on the demo user, so you can use the app without signing up
- pushes the functions and loads the reference foods and demo fridge

Copy the printed `NEXT_PUBLIC_VAPID_PUBLIC_KEY=...` line into `web/.env.local` if you want push reminders. Leave the last two prompts (the paid backfills) at no for now; [web/README.md](web/README.md#paid-backfills) explains them.

## 4. Run

```bash
npm run dev
```

Open http://localhost:3000. You land on the demo user's fridge, with a few items already expired and a few to use soon.

Things to try:

1. Tap Baby spinach, tap **review expired item**, and swipe left. The second card asks whether it looks spoiled.
2. Tap the camera button and upload a photo of a grocery receipt. Claude reads it, and you review each item before it goes in the fridge.
3. Open **Recipes** and wait about a minute and a half for web recipes built around what expires first (needs the Apify token).
4. Open **Community** to see your waste stats and the friends leaderboard.

To start over with the same demo fridge, run `npm run reset` or open http://localhost:3000/api/dev/seed.

## Push reminders on a phone

Web push needs HTTPS, so a phone can't subscribe to `localhost`. [docs/DEMO.md](docs/DEMO.md) shows how to put the app behind a `cloudflared` tunnel, add it to an iPhone home screen, and send a test reminder.

## Next

- Deploy to Vercel and a prod Convex deployment: [web/README.md](web/README.md#deploy)
- How the pieces connect: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- Product scope and priorities: [docs/PRODUCT.md](docs/PRODUCT.md)
