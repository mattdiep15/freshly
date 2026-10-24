# P3: Integrations, accessibility, and Wrapped Waste

Tier: P3. Status: draft. Not ready to execute. Most items need a product decision or an outside data source first.

## Purpose

Connect Freshly to the world outside the fridge: local stores and farmers markets, recipe sources, and voice input. Add Wrapped Waste, a shareable summary of a user's food waste over a semester or year, and an image-based spoilage model for produce. This covers Priority 3 in `docs/PRODUCT.md`.

## Features

### Grocery store and farmers market connections

The product spec lists "guided recommendation system based on subscription service" with no further detail.

Before any backend work, the team needs to answer: Is the subscription a CSA or farm box the user already pays for, a store loyalty program, or something Freshly offers? What does the user see?

Possible data source: USDA AMS publishes local food directories, including farmers markets. Check its current API and terms before planning around it.

### Recipe recommendations

Moved here from p1-05 part C on 2026-10-24: recipes are P3 in the spec, and P1 comes first. Option 3 below is the preferred approach, since it uses both sponsor technologies.

Recommend recipes that use items close to expiry. The product spec mentions "MISE" and recipe databases. Confirm with the team which product or dataset "MISE" refers to.

Three approaches:

1. Recipe API (for example Spoonacular or TheMealDB). Real recipes with photos, but needs an API key, has rate limits, and ingredient names must be mapped to `foods`.
2. LLM-generated recipes from `items.useSoon`. No new account, works with any ingredient, but recipes are untested and have no photos.

3. Real recipe pages through Apify, ranked by Gemini. Real recipes with working links, no recipe-API account, and it counts for the Apify and Gemini tracks. Apify's [Recipe Scraper (schema.org)](https://apify.com/crawlerbros/recipe-scraper) can return structured ingredients if search-result text is too loose.

Backend sketch for option 3, about 2 to 3 hours:

1. Action `recipes.suggest()` takes the user's `items.useSoon` (p1-03), picks the two or three items expiring first, and runs `apify/rag-web-browser` (already called by `convex/shelfLifeWeb.ts`) with a query like `recipe ground beef spinach`, `maxResults: 5`.
2. Gemini reads the pages and returns up to 3 recipes: title, source URL, the expiring items each one uses, and a one-line reason. It may only return recipes from the fetched pages, with their real URLs.
3. Cache the result per user per day in a `recipeSuggestions` table, so opening the screen does not start a new Apify run.
   Verify: with the demo seed, `recipes.suggest` returns recipes whose URLs open real recipe pages that mention at least one of the user's expiring items.

Option 2 needs no Apify account and is the fallback if the Apify run is too slow for the screen.

### Food recall alerts

Added 2026-10-24 (not in the product spec). Warn a user when something in their fridge matches an active food recall: "Costco ground beef in your fridge matches an FDA recall for possible E. coli."

Data sources:

- FDA recalls cover most packaged food. Apify has several community actors that wrap openFDA's food enforcement data, for example [FDA Food Recall Scraper](https://apify.com/copious_atoll/fda-food-recalls) (filter by keyword, state, class, and date; listed at $1.00 per 1,000 results). openFDA also has a free official API, so Apify here mainly serves the sponsor track.
- USDA FSIS handles meat, poultry, and egg products, which are the riskiest items in a student's fridge. No Apify actor covers FSIS, so meat recalls would need FSIS's own feed or a custom actor.

Backend sketch:

1. A daily cron (`convex/crons.ts`) pulls the last 30 days of Class I and II food recalls into a `recalls` table: firm, product description, reason, class, states, and recall date.
2. Match active and draft `items` against recalls by brand and product words from the receipt line (`rawText`, `displayName`). Generic receipt names ("GROUND BEEF") will produce false matches, so a match asks the user to check the package instead of telling them to throw food out.
3. Matches go out through the p1-03 notification path, with the recall's reason and a link to the FDA notice.

Open questions: how precise matching has to be before a warning is worth showing, and whether to wait for FSIS coverage before launching, since meat is where a recall matters most.

### Speech accessibility (TTS and STT)

Most of this is frontend. Browsers ship speech recognition and speech synthesis through the Web Speech API, though support varies by browser.

Backend sketch: `items.addFromText({ transcript })` reuses the p1-02 text normalization ("I bought two pounds of chicken and a bag of spinach" becomes two items). Reading the use-soon list aloud needs no backend work.

### Wrapped Waste

A Spotify Wrapped-style summary: total dollars and pounds wasted, most-wasted foods, best and worst month, and improvement since the first month.

Backend sketch: one query, `wrapped.summary({ from, to })`, aggregating resolved items. Every field it needs exists after p1-03. The share image is frontend work.

Wrapped Waste is cheap once P1 stats exist. It is a good demo closer if the team wants to pull it forward.

### Image-based spoilage prediction for produce

Added in design v2. The same produce can last more or less time depending on its color and condition, so the team wants to train a basic neural net that takes a photo and predicts how long the item has left. It would become the backbone of expiry prediction for produce.

Questions to answer before planning:

1. Data. The model needs produce photos labeled with days until spoiled. Check public datasets first; fresh-versus-rotten classification sets carry no time label. The second swipe card from p1-03 already asks "does your food look spoiled?", so an optional photo on that card would collect labeled examples from real fridges. That needs a privacy note before launch.
2. Safety. The model's output is a shelf-life number, which `CLAUDE.md` allows only from the FDA chart, FoodKeeper, or the user. See open question 7 in the README. The smallest change that keeps the rule is to let the model place the date inside the sourced range (anywhere from `range.min` to `range.max`) instead of always using `range.min`.
3. Where it runs. Convex actions are not built for model inference, and the repo has no `infra/`. The options are in-browser inference (for example ONNX Runtime Web or TensorFlow.js) or a hosted model API called from a Convex action. Either one adds a library or a service, which `CLAUDE.md` says to ask about first.

Backend sketch: an action `predictions.produce({ itemId, fileId })` that returns a predicted `expiresAt` clamped to the food's sourced range and stores it with a new `expirySource: "model"`. Adding that value means a schema change in `convex/schema.ts` and a rule change in `CLAUDE.md`.

## Suggested order

1. Wrapped Waste (no outside dependencies)
2. Recipe suggestions, Apify and Gemini approach (option 3)
3. Food recall alerts, FDA first
4. Speech input
5. Store and farmers market connections, after the product questions are answered
6. Spoilage model, after the data and safety questions are answered. Collecting photos can start earlier, since it only needs the p1-03 second card.

## Decision log

(none yet)
