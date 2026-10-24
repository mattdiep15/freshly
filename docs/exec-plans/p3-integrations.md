# P3: Integrations, accessibility, and Wrapped Waste

Tier: P3. Status: draft. Not ready to execute. Most items need a product decision or an outside data source first.

## Purpose

Connect Freshly to the world outside the fridge: local stores and farmers markets, recipe sources, and voice input. Add Wrapped Waste, a shareable summary of a user's food waste over a semester or year. This covers Priority 3 in `docs/PRODUCT.md`.

## Features

### Grocery store and farmers market connections

The product spec lists "guided recommendation system based on subscription service" with no further detail.

Before any backend work, the team needs to answer: Is the subscription a CSA or farm box the user already pays for, a store loyalty program, or something Freshly offers? What does the user see?

Possible data source: USDA AMS publishes local food directories, including farmers markets. Check its current API and terms before planning around it.

### Recipe recommendations

Recommend recipes that use items close to expiry. The product spec mentions "MISE" and recipe databases. Confirm with the team which product or dataset "MISE" refers to.

Two approaches:

1. Recipe API (for example Spoonacular or TheMealDB). Real recipes with photos, but needs an API key, has rate limits, and ingredient names must be mapped to `foods`.
2. LLM-generated recipes from `items.useSoon`. No new account, works with any ingredient, but recipes are untested and have no photos.

For a hackathon demo, option 2 is faster. Backend sketch: an action `recipes.suggest()` that takes the user's `useSoon` items, asks Claude for 3 recipes that use as many of them as possible, and returns which expiring items each recipe uses. Cache per user per day.

### Speech accessibility (TTS and STT)

Most of this is frontend. Browsers ship speech recognition and speech synthesis through the Web Speech API, though support varies by browser.

Backend sketch: `items.addFromText({ transcript })` reuses the p1-02 text normalization ("I bought two pounds of chicken and a bag of spinach" becomes two items). Reading the use-soon list aloud needs no backend work.

### Wrapped Waste

A Spotify Wrapped-style summary: total dollars and pounds wasted, most-wasted foods, best and worst month, and improvement since the first month.

Backend sketch: one query, `wrapped.summary({ from, to })`, aggregating resolved items. Every field it needs exists after p1-03. The share image is frontend work.

Wrapped Waste is cheap once P1 stats exist. It is a good demo closer if the team wants to pull it forward.

## Suggested order

1. Wrapped Waste (no outside dependencies)
2. Recipe suggestions, LLM approach
3. Speech input
4. Store and farmers market connections, after the product questions are answered

## Decision log

(none yet)
