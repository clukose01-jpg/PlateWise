import { loadPlan } from "@/lib/plans";
import {
  allReminders,
  easternNow,
  pushIsSetUp,
  REMINDER_HOUR,
  reminderMessage,
  sendReminder,
} from "@/lib/reminders";

export const maxDuration = 60;

// Called by Vercel's daily schedule (see vercel.json). Only Vercel knows the secret.
export async function GET(request: Request) {
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Not allowed." }, { status: 401 });
  }
  if (!pushIsSetUp()) {
    return Response.json({ error: "Reminders aren't set up." }, { status: 503 });
  }

  // Two jobs run an hour apart; only the one in the 3pm Eastern hour sends.
  const force = new URL(request.url).searchParams.has("force");
  const { hour } = easternNow();
  if (hour !== REMINDER_HOUR && !force) {
    return Response.json({ skipped: `It's ${hour}:00 in New York, not ${REMINDER_HOUR}:00.` });
  }

  const results = { sent: 0, nothingToday: 0, expired: 0, failed: 0 };
  for (const reminder of await allReminders()) {
    const plan = await loadPlan(reminder.planId);
    const message = plan && reminderMessage(plan);
    if (!message) {
      results.nothingToday++;
      continue;
    }
    const result = await sendReminder(reminder, message);
    if (result === "sent") results.sent++;
    else if (result === "expired") results.expired++;
    else results.failed++;
  }
  return Response.json(results);
}
