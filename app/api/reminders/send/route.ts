import { loadPlan } from "@/lib/plans";
import {
  allReminders,
  DEFAULT_TIME_ZONE,
  isReminderTime,
  localNow,
  markReminderSent,
  pushIsSetUp,
  reminderHour,
  reminderMessage,
  sendReminder,
} from "@/lib/reminders";

export const maxDuration = 60;

// Called every hour by Vercel's schedule (see vercel.json). Only Vercel knows the secret.
export async function GET(request: Request) {
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Not allowed." }, { status: 401 });
  }
  if (!pushIsSetUp()) {
    return Response.json({ error: "Reminders aren't set up." }, { status: 503 });
  }

  // ?force sends to everyone now, whatever their time, for testing.
  const force = new URL(request.url).searchParams.has("force");
  const now = new Date();
  const results = { sent: 0, notTimeYet: 0, alreadySent: 0, nothingToday: 0, expired: 0, failed: 0 };

  for (const reminder of await allReminders()) {
    const timeZone = reminder.timeZone ?? DEFAULT_TIME_ZONE;
    const local = localNow(timeZone, now);
    if (!force && !isReminderTime(local.hour, reminderHour(reminder))) {
      results.notTimeYet++;
      continue;
    }
    if (!force && reminder.lastSentOn === local.date) {
      results.alreadySent++;
      continue;
    }

    const plan = await loadPlan(reminder.planId);
    const message = plan && reminderMessage(plan, timeZone, now);
    if (!message) {
      results.nothingToday++;
      continue;
    }
    const result = await sendReminder(reminder, message);
    if (result === "sent") {
      results.sent++;
      await markReminderSent(reminder, local.date);
    } else if (result === "expired") results.expired++;
    else results.failed++;
  }
  return Response.json(results);
}
