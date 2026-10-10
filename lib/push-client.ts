import { DEFAULT_REMINDER_HOUR, isReminderHour } from "./reminder-times";

// Turning the daily reminder on and off from a phone or computer, and picking its time.

const REMINDERS_ON_KEY = "platewise.remindersOn";
const REMINDER_HOUR_KEY = "platewise.reminderHour";

export function pushSupported() {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export function remindersOn() {
  try {
    return localStorage.getItem(REMINDERS_ON_KEY) === "1";
  } catch {
    return false;
  }
}

function setRemindersOn(on: boolean) {
  try {
    if (on) localStorage.setItem(REMINDERS_ON_KEY, "1");
    else localStorage.removeItem(REMINDERS_ON_KEY);
  } catch {
    // Not remembered; the switch will just show off next time.
  }
}

// The hour she picked on this device, like 17 for 5pm. 3pm until she changes it.
export function savedReminderHour(): number {
  try {
    const hour = Number(localStorage.getItem(REMINDER_HOUR_KEY));
    return isReminderHour(hour) ? hour : DEFAULT_REMINDER_HOUR;
  } catch {
    return DEFAULT_REMINDER_HOUR;
  }
}

function rememberReminderHour(hour: number) {
  try {
    localStorage.setItem(REMINDER_HOUR_KEY, String(hour));
  } catch {
    // Not remembered; the picker will just show 3pm next time.
  }
}

// The key arrives as base64url text; the browser wants raw bytes.
function keyBytes(base64url: string) {
  const base64 = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

// Like "America/Chicago". Reminders come at the hour she picked, wherever the device is.
function deviceTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

async function currentSubscription() {
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
}

async function postJson(url: string, method: string, body: unknown) {
  const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "Something went wrong. Please try again.");
  return result;
}

export async function turnOnReminders(planId: string, hour: number) {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Notifications are blocked. Allow them for PlateWise in your device's settings, then try again.");
  }
  const { publicKey } = await fetch("/api/reminders").then((r) => r.json());
  if (!publicKey) throw new Error("Reminders aren't set up on this app yet.");
  const registration = await navigator.serviceWorker.ready;
  let subscription: PushSubscription;
  try {
    subscription =
      (await registration.pushManager.getSubscription()) ??
      (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) }));
  } catch {
    throw new Error(
      "Your device didn't let PlateWise send reminders. Check that notifications are allowed for this browser or app, then try again.",
    );
  }
  await postJson("/api/reminders", "POST", {
    subscription: subscription.toJSON(),
    planId,
    timeZone: deviceTimeZone(),
    hour,
  });
  rememberReminderHour(hour);
  setRemindersOn(true);
}

// With reminders on, saves the new time right away. With them off, it's used when she turns them on.
export async function changeReminderHour(planId: string | null, hour: number) {
  const subscription = remindersOn() && planId ? await currentSubscription() : null;
  if (subscription) {
    await postJson("/api/reminders", "POST", {
      subscription: subscription.toJSON(),
      planId,
      timeZone: deviceTimeZone(),
      hour,
    });
  }
  rememberReminderHour(hour);
}

export async function turnOffReminders() {
  const subscription = await currentSubscription();
  if (subscription) {
    await postJson("/api/reminders", "DELETE", { endpoint: subscription.endpoint }).catch(() => {});
    await subscription.unsubscribe();
  }
  setRemindersOn(false);
}

export async function sendTestReminder() {
  const subscription = await currentSubscription();
  if (!subscription) throw new Error("Turn reminders on first.");
  await postJson("/api/reminders/test", "POST", { endpoint: subscription.endpoint });
}

// When she opens a different plan, or travels to another time zone, reminders follow.
export async function updateReminderPlan(planId: string) {
  if (!pushSupported() || !remindersOn()) return;
  const subscription = await currentSubscription();
  if (subscription) {
    await postJson("/api/reminders", "POST", {
      subscription: subscription.toJSON(),
      planId,
      timeZone: deviceTimeZone(),
    }).catch(() => {});
  }
}
