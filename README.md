# PlateWise

PlateWise plans a family's week of dinners on Sunday. See [plan.md](plan.md) for the MVP plan.

**Built so far:**
1. **Kitchen scan.** She takes a photo of each fridge shelf, the freezer and the pantry (up to 8). PlateWise sorts what it sees into fresh food for this week and pantry staples, which her phone remembers for next week. She can fix either list or type it herself.
2. **Family questions.** Allergies, what each kid won't eat, the longest she'll cook on a weeknight, and whether to plan lunches. Her phone remembers the answers for next week.
3. **The plan.** Monday–Friday dinners, a Sunday prep list grouped by day, and one grocery list, saved at a private link she can share.
4. **Ratings.** After a dinner, she taps "Liked it" or "Not for us" and can add a comment. Her phone remembers the ratings, and each new plan brings back favorites, avoids misses, and gets less experimental as favorites build up.

## Put it online

You need two accounts: one to pay for the AI, and one to host the app.

1. **Get a Claude API key.**
   - Sign up at [platform.claude.com](https://platform.claude.com) and add a payment method.
   - Set a monthly spend limit in the account's limits settings, so the app can't go over your budget.
   - Create an API key and copy it. Treat it like a password: never paste it into code, chat, or a message.
2. **Put the app on Vercel.**
   - Sign in at [vercel.com](https://vercel.com) with your GitHub account.
   - Choose **Add New → Project** and pick the PlateWise repository.
   - Under **Environment Variables**, add `ANTHROPIC_API_KEY` and paste your key as the value.
   - Click **Deploy**. Vercel gives you a link you can open on your phone.
3. **Turn on plan saving.**
   - In your Vercel project, open **Storage**, create a **Blob** store, and connect it to PlateWise. Choose **Private** if it asks.
   - Vercel adds the storage key for you. Redeploy once so the app picks it up.

## Run your 20 test scans

1. Open your app link with `?test` at the end, for example `https://your-app.vercel.app/?test`.
2. Each scan then shows how long it took, how many tokens it used, and roughly what it cost.
3. For each scan, write down:
   - What the scan got right
   - What it got wrong
   - What it missed
   - What it cost

Plans work the same way: make a plan from a `?test` link, and the bottom of the plan page shows what that plan cost. (People you share the plan with won't see this.)

The average cost of a scan plus a plan tells you whether $6.99 a month works. The misses tell you whether the scan is good enough to show your mom.

## Run it on your own computer (optional)

```bash
npm install
cp .env.example .env.local   # then paste your key into .env.local
npm run dev                  # opens at http://localhost:3000
```
