import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { del, get, list, put } from "@vercel/blob";
import webpush from "web-push";
import { z } from "zod";
import { prepGroups, type StoredPlan, StorageNotSetUpError, useBlob } from "./plans";

// Reminders go out around 3pm Eastern. Vercel's free plan runs scheduled jobs once a day within
// an hour, so two daily jobs an hour apart call us, and only the one in the 3pm hour sends.
export const REMINDER_TIME_ZONE = "America/New_York";
export const REMINDER_HOUR = 15;

export const SubscriptionSchema = z.object({
  endpoint: z.string().url().max(1000),
  expirationTime: z.number().nullable().optional(),
  keys: z.object({ p256dh: z.string().max(200), auth: z.string().max(100) }),
});

export type Subscription = z.infer<typeof SubscriptionSchema>;
export type SavedReminder = { subscription: Subscription; planId: string; savedAt: string };
export type ReminderMessage = { title: string; body: string; url: string };

// Online, each phone's sign-up is a private file in Vercel Blob storage; on your own computer, in .data.
const LOCAL_DIR = path.join(process.cwd(), ".data", "reminders");

function fileName(endpoint: string) {
  return `${createHash("sha256").update(endpoint).digest("hex").slice(0, 32)}.json`;
}

export async function saveReminder(subscription: Subscription, planId: string) {
  const json = JSON.stringify({ subscription, planId, savedAt: new Date().toISOString() });
  const name = fileName(subscription.endpoint);
  if (useBlob()) {
    await put(`reminders/${name}`, json, { access: "private", contentType: "application/json", allowOverwrite: true });
  } else if (process.env.VERCEL) {
    throw new StorageNotSetUpError();
  } else {
    await mkdir(LOCAL_DIR, { recursive: true });
    await writeFile(path.join(LOCAL_DIR, name), json);
  }
}

export async function deleteReminder(endpoint: string) {
  const name = fileName(endpoint);
  if (useBlob()) {
    await del(`reminders/${name}`);
  } else {
    await unlink(path.join(LOCAL_DIR, name)).catch(() => {});
  }
}

async function readReminder(name: string): Promise<SavedReminder | null> {
  if (useBlob()) {
    const result = await get(`reminders/${name}`, { access: "private", useCache: false });
    return result?.stream ? new Response(result.stream).json() : null;
  }
  try {
    return JSON.parse(await readFile(path.join(LOCAL_DIR, name), "utf8"));
  } catch {
    return null;
  }
}

export async function loadReminder(endpoint: string) {
  return readReminder(fileName(endpoint));
}

export async function allReminders(): Promise<SavedReminder[]> {
  let names: string[] = [];
  if (useBlob()) {
    let cursor: string | undefined;
    do {
      const page = await list({ prefix: "reminders/", cursor });
      names.push(...page.blobs.map((blob) => blob.pathname.replace("reminders/", "")));
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
  } else {
    names = await readdir(LOCAL_DIR).catch(() => []);
  }
  const reminders = await Promise.all(names.map(readReminder));
  return reminders.filter((reminder): reminder is SavedReminder => reminder !== null);
}

// The weekday and hour in Eastern time, whatever the server's own clock is set to.
export function easternNow(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: REMINDER_TIME_ZONE,
    weekday: "long",
    hour: "numeric",
    hourCycle: "h23",
  }).formatToParts(date);
  return {
    weekday: parts.find((part) => part.type === "weekday")?.value ?? "",
    hour: Number(parts.find((part) => part.type === "hour")?.value),
  };
}

const NEXT_DAY: Record<string, string> = {
  Monday: "Tuesday",
  Tuesday: "Wednesday",
  Wednesday: "Thursday",
  Thursday: "Friday",
};

// What today's reminder says, or nothing if there's nothing to remind her of.
export function reminderMessage(stored: StoredPlan, date = new Date()): ReminderMessage | null {
  const { weekday } = easternNow(date);
  const ageDays = stored.createdAt ? (date.getTime() - Date.parse(stored.createdAt)) / 86_400_000 : 0;
  const today = `/plan/${stored.id}?tab=today`;

  if (weekday === "Saturday") return null;

  if (weekday === "Sunday") {
    if (ageDays > 2) {
      return {
        title: "Time to plan next week",
        body: "It takes a few minutes. Your pantry, family answers and ratings are saved.",
        url: "/new",
      };
    }
    const steps = prepGroups(stored.plan).reduce((total, group) => total + group.steps.length, 0);
    return { title: "Prep day", body: `${steps} quick things to prep for the week. Tap for the list.`, url: today };
  }

  // Don't nag about an old plan on weeknights.
  if (ageDays > 7) return null;
  const dinner = stored.plan.dinners.find((d) => d.day === weekday);
  if (!dinner) return null;
  const tomorrow = stored.plan.dinners.find((d) => d.day === NEXT_DAY[weekday]);
  const forTomorrow = tomorrow?.nightBefore?.[0];
  return {
    title: `Tonight: ${dinner.name}`,
    body: `${dinner.minutes} min. ${forTomorrow ? `Also tonight: ${forTomorrow}.` : "Tap for the steps."}`,
    url: today,
  };
}

export function pushIsSetUp() {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

// Sends one reminder. If the phone has turned reminders off or the sign-up expired, forget it.
export async function sendReminder(reminder: SavedReminder, message: ReminderMessage) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? "https://plate-wise-one.vercel.app",
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
  try {
    await webpush.sendNotification(reminder.subscription, JSON.stringify(message), { TTL: 4 * 60 * 60 });
    return "sent";
  } catch (error) {
    const status = (error as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410) {
      await deleteReminder(reminder.subscription.endpoint);
      return "expired";
    }
    console.error("Reminder failed:", status, error);
    return "failed";
  }
}
