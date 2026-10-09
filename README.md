# PlateWise

PlateWise plans a family's week of dinners on Sunday. See [plan.md](plan.md) for the MVP plan.

**Built so far:**
1. **Kitchen scan.** She takes a photo of each fridge shelf, the freezer and the pantry (up to 8). PlateWise sorts what it sees into fresh food for this week and pantry staples, which her phone remembers for next week. She can fix either list or type it herself.
2. **Family questions.** Allergies, what each kid won't eat, the longest she'll cook on a weeknight, and whether to plan lunches. Her phone remembers the answers for next week.
3. **The plan.** Monday–Friday dinners, a Sunday prep list grouped by day, and one grocery list, saved at a private link she can share.
4. **Tabs.** The app opens to **Today**: tonight's dinner, tonight's "for tomorrow" steps, the grocery list on Saturday and prep on Sunday. **Week** shows the whole plan, **Groceries** the shopping and prep lists, **New plan** makes the next one, and **More** has favorites, the pantry, family answers and how to add PlateWise to the home screen.
5. **Swap a dinner.** "Swap for a different dinner" gets a new dinner that follows the same rules, keeps the rest of the week, and updates the grocery list and prep.
6. **Ratings.** After a dinner, she taps "Liked it" or "Not for us" and can add a comment. Her phone remembers the ratings, and each new plan brings back favorites, avoids misses, and gets less experimental as favorites build up.
7. **Daily reminder.** Turned on from the **More** tab. Weeknights around 3pm in her own time zone, her phone shows tonight's dinner and anything to do for tomorrow. Sundays it shows prep day, or a nudge to plan the week. On iPhone, PlateWise has to be added to the home screen first.
8. **Big screens.** On a computer or a tablet turned sideways, the tabs move to a sidebar and pages fill the screen. Tonight's recipe gets big text that's easy to read from across the kitchen. Phones look exactly the same as before.
9. **Allergy safety check.** Before any plan or swapped dinner is shown, a word check looks for the family's allergens (and foods that usually contain them, like wheat in soy sauce), the kids' dislikes, dinners over her cooking time and missing days. Then a second Claude review looks for hidden allergens. Anything found is fixed and checked again; if it still isn't clean after two fixes, she sees "please try again" instead of the plan.
10. **Delete a plan.** At the bottom of the **Week** tab. On the device that made the plan, "Delete this plan" removes it for everyone (after a confirmation) and goes straight to making a new one. Anyone else it was shared with can only remove it from their own device. The pantry, family answers and ratings stay saved.
11. **Log in (optional).** From the **More** tab, the Week tab after a plan, or "Already use PlateWise? Log in" on New plan. She types her email and the 6-digit code we email her; there's no password. Once logged in, her family answers, pantry, ratings, current plan and list of plans save to her account and come back on any device she logs into. Logging out takes them off that device.

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
4. **Turn on daily reminders.**
   - Add three more environment variables: `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` (make a pair with `npx web-push generate-vapid-keys`), and `CRON_SECRET` (any long random text).
   - The `vercel.json` file tells Vercel to check once an hour. Each phone saves its own time zone, and the app sends its reminder once a day, in the first check after 3pm there. That keeps it right in every time zone and when the clocks change.
5. **Turn on logging in.** Login codes are emailed from a Gmail account made just for the app.
   - Make a free Gmail account for PlateWise. In its Google Account settings, turn on **2-Step Verification**, then create an **App password** (search "App passwords" in the settings).
   - Add `SESSION_SECRET` in Vercel (any long random text). Then either open `/setup?code=<COMPARE_PASSCODE>` on the app and save the Gmail address and app password there (it checks them with Google and stores the password encrypted), or add `GMAIL_USER` and `GMAIL_APP_PASSWORD` (Sensitive) in Vercel and redeploy.
   - Until they're set, the login stays hidden and everything is saved on each device, as before.
   - Gmail sends up to about 500 emails a day. If PlateWise outgrows that, get a website name and an email service like Resend, and set `RESEND_API_KEY` and `EMAIL_FROM` instead.

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
