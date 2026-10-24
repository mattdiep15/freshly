# Freshly product spec

Converted from the team's design doc, version 2 (`design_raw_v2.pdf`). Working names:
Fridge, Freshie, Freshy, Freshly, HeyFridge.

Version 2 added manual entry (P1.5), the second swipe card for freshness hints (P1), and an
image-based spoilage model (P3).

## Problem

College students and young adults struggle with best practices for grocery shopping and
storing food correctly, which wastes food (amount TBD). Wrong storage and low awareness
can also lead to food safety problems.

## Solution

A web app that keeps what's in a student's fridge on their mind day to day, cuts food
waste, and gives them reasons to compete with friends and shop locally.

Categories: edtech, sustainability, food waste, food safety.

## Priority 1 (demo must-haves)

### Food spoilage tracker

- Receipt scan as the input method.
- Manual entry (P1.5): the user can also type an item in by hand. Ships right after the
  P1 must-haves.
- Expiry lookup: look up receipt SKUs in known databases and estimate how long each item
  lasts.
- Storage recommendations for unknown or unlearned foods, taught Anki/Duolingo style.

### Food reminder system

- Swipe left/right on whether the food is still in the fridge or unfinished.
- Reminder cadence (decided): ping about 1 week, 3 days, and 1 day before expiry. Use
  push notifications for time-sensitive reminders.
- Show a swipe card only when an item expires, since that is the only event that matters
  for tracking waste. Yes means used; no means unused and expired.
- Before expiry, show a todo-style list of ingredients to use up, so the user isn't
  flooded with prompts.
- General hints for how fresh food should look, smell, taste, and feel.
- Hints appear in a second swipe card (decided in v2). Expiry dates use the low end of the
  sourced shelf-life range, so food is often still good on its expiry date. After the user
  swipes "no" on "your item expired, did you use it?", a second card shows the hint and
  asks "does your food look spoiled?" "Yes, toss" marks it wasted. "No, 1-2 more days to
  eat it!" extends the date by up to 2 days, never past the high end of the sourced range.

### Food waste measurement

- Track when foods are and aren't used completely.

### Clean, demo-ready UI

## Priority 2

- Community tab (Beli-style): leaderboard for food waste and cooking responsibly.
- Gamified tracking: streaks, dollars wasted, pounds wasted.
- Grocery list for what to buy next.
- Personalized shopping recommendations ("last time you bought too much X, buy less").
- Location-based reminders: when eating out ("you have X food left") and at the grocery
  store ("this goes well with what's left in your fridge").
- Takeout leftovers management.

## Priority 3

- External connections to grocery stores and farmers markets, with guided
  recommendations based on a subscription service.
- Recipe recommendations (MISE, recipe databases), ranked by which items expire soonest.
- Speech accessibility (TTS/STT).
- Wrapped Waste.
- Image-based spoilage prediction for produce. Produce lasts longer or shorter depending on
  its color and condition, so a self-trained neural net that reads a photo could become the
  backbone for expiry prediction.

## Stack

- Frontend: React, Next.js, Vercel
- Backend: TBD
- Database: Convex

## Reference data

`food_storage_chart.pdf` is the FDA refrigerator and freezer storage chart (March 2018).
