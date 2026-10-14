import { createHash } from "node:crypto";
import { compareAllowed } from "./compare-access";
import { sessionAccountId } from "./session";
import { deleteJson, readJson, writeJson } from "./store";
import { requestDeviceId } from "./visitor";

// Weekly limits, so one person (or a bug) can't run up the AI bill. Counted over the last 7 days:
// per account when she's logged in, otherwise per device. A request without a device shares one
// count. The admin's own devices (where the admin page was opened) aren't limited.
export const WEEKLY_LIMITS = { plan: 3, swap: 6, scan: 10 } as const;
export type UsageKind = keyof typeof WEEKLY_LIMITS;

const WEEK_MS = 7 * 86_400_000;
type Usage = Partial<Record<UsageKind, number[]>>;

function usageFile(who: string) {
  return `usage/${createHash("sha256").update(who).digest("hex").slice(0, 32)}.json`;
}

export function usageKey(request: Request) {
  const account = sessionAccountId(request);
  if (account) return `account:${account}`;
  const device = requestDeviceId(request);
  return device ? `device:${device}` : "no-device";
}

// "tomorrow", "in 3 days", "in 5 hours".
function whenAgain(until: number, now: number) {
  const hours = Math.ceil((until - now) / 3_600_000);
  if (hours <= 1) return "in about an hour";
  if (hours < 20) return `in ${hours} hours`;
  if (hours < 36) return "tomorrow";
  return `in ${Math.round(hours / 24)} days`;
}

const MESSAGES: Record<UsageKind, (when: string) => string> = {
  plan: (when) =>
    `You've made ${WEEKLY_LIMITS.plan} plans in the last 7 days, the most for now. You can make another ${when}.`,
  swap: (when) =>
    `You've changed ${WEEKLY_LIMITS.swap} dinners in the last 7 days, the most for now. You can swap again ${when}. Moving a dinner to another day still works.`,
  scan: (when) =>
    `You've scanned ${WEEKLY_LIMITS.scan} times in the last 7 days, the most for now. You can scan again ${when}. You can still type what's in your kitchen.`,
};

// What to tell her if she's used this week's share, or null if there's room.
export async function weeklyLimitMessage(request: Request, kind: UsageKind, now = Date.now()) {
  if (compareAllowed(request)) return null;
  const usage = (await readJson<Usage>(usageFile(usageKey(request))).catch(() => null)) ?? {};
  const recent = (usage[kind] ?? []).filter((at) => now - at < WEEK_MS).sort((a, b) => a - b);
  if (recent.length < WEEKLY_LIMITS[kind]) return null;
  // The next one frees up a week after the oldest one that still counts.
  const until = recent[recent.length - WEEKLY_LIMITS[kind]] + WEEK_MS;
  return MESSAGES[kind](whenAgain(until, now));
}

// Counts one, after it worked. Older ones are dropped.
export async function recordUse(request: Request, kind: UsageKind, now = Date.now()) {
  if (compareAllowed(request)) return;
  const file = usageFile(usageKey(request));
  try {
    const usage = (await readJson<Usage>(file).catch(() => null)) ?? {};
    const kept: Usage = {};
    for (const name of Object.keys(WEEKLY_LIMITS) as UsageKind[]) {
      const recent = (usage[name] ?? []).filter((at) => now - at < WEEK_MS);
      if (name === kind) recent.push(now);
      if (recent.length) kept[name] = recent;
    }
    await writeJson(file, kept);
  } catch (error) {
    // Counting is never worth breaking the app over.
    console.error("Couldn't count usage:", error);
  }
}

// For "Delete my account".
export async function forgetUsage(accountId: string) {
  await deleteJson(usageFile(`account:${accountId}`)).catch(() => {});
}
