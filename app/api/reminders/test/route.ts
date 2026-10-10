import { z } from "zod";
import { loadPlan } from "@/lib/plans";
import { hourLabel } from "@/lib/reminder-times";
import {
  DEFAULT_TIME_ZONE,
  loadReminder,
  pushIsSetUp,
  reminderHour,
  reminderMessage,
  sendReminder,
} from "@/lib/reminders";

const TestRequest = z.object({ endpoint: z.string().max(1000) });

// Sends this phone a reminder right now, so she can see what it looks like.
export async function POST(request: Request) {
  const parsed = TestRequest.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !pushIsSetUp()) {
    return Response.json({ error: "Reminders aren't set up yet." }, { status: 400 });
  }
  const reminder = await loadReminder(parsed.data.endpoint);
  if (!reminder) {
    return Response.json({ error: "Turn reminders on first." }, { status: 404 });
  }
  const plan = await loadPlan(reminder.planId);
  const message = (plan && reminderMessage(plan, reminder.timeZone ?? DEFAULT_TIME_ZONE)) ?? {
    title: "PlateWise reminders are on",
    body: `On weeknights around ${hourLabel(reminderHour(reminder))}, you'll get tonight's dinner here.`,
    url: plan ? `/plan/${plan.id}?tab=today` : "/",
  };
  const result = await sendReminder(reminder, message);
  return result === "sent"
    ? Response.json({ ok: true })
    : Response.json({ error: "The reminder didn't go through. Try turning reminders off and on." }, { status: 502 });
}
