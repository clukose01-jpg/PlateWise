# PlateWise

PlateWise plans a family's week of dinners on Sunday. See [plan.md](plan.md) for the MVP plan.

**Built so far:** step 1, the fridge scan. She takes a photo of her fridge, PlateWise lists the food it sees, and she can fix the list or type it herself.

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

## Run your 20 test scans

1. Open your app link with `?test` at the end, for example `https://your-app.vercel.app/?test`.
2. Each scan then shows how long it took, how many tokens it used, and roughly what it cost.
3. For each scan, write down:
   - What the scan got right
   - What it got wrong
   - What it missed
   - What it cost

The average cost tells you whether $6.99 a month works. The misses tell you whether the scan is good enough to show your mom.

## Run it on your own computer (optional)

```bash
npm install
cp .env.example .env.local   # then paste your key into .env.local
npm run dev                  # opens at http://localhost:3000
```
