// Turning the daily reminder on and off from the phone.

const REMINDERS_ON_KEY = "platewise.remindersOn";

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

// The key arrives as base64url text; the browser wants raw bytes.
function keyBytes(base64url: string) {
  const base64 = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
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

export async function turnOnReminders(planId: string) {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Notifications are blocked. Allow them for PlateWise in your phone's settings, then try again.");
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
      "Your phone didn't let PlateWise send reminders. Check that notifications are allowed for this browser or app, then try again.",
    );
  }
  await postJson("/api/reminders", "POST", { subscription: subscription.toJSON(), planId });
  setRemindersOn(true);
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

// When she opens a different plan, reminders follow it.
export async function updateReminderPlan(planId: string) {
  if (!pushSupported() || !remindersOn()) return;
  const subscription = await currentSubscription();
  if (subscription) {
    await postJson("/api/reminders", "POST", { subscription: subscription.toJSON(), planId }).catch(() => {});
  }
}
