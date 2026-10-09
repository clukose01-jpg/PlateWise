import type { Account } from "./accounts";
import type { AppEvent } from "./events";
import type { SavedReminder } from "./reminders";
import type { StoredPlan } from "./plans";
import { listNames, readMany } from "./store";
import type { Origin } from "./visitor";

// Everything the admin page shows, worked out from the saved plans, accounts, reminder sign-ups
// and events. A "family" is a logged-in account, or else one device; plans made before tracking
// started count as one family each.

export type Count = { label: string; count: number };

export type AdminStats = {
  generatedAt: string;
  trackingSince: string | null;
  totals: {
    plans: number;
    plansLast7: number;
    families: number;
    returning: number;
    accounts: number;
    accountsLast7: number;
    withPassword: number;
    reminders: number;
    swaps: number;
    scans: number;
    safetyFixed: number;
    blocked: number;
    liked: number;
    disliked: number;
    costTotal: number;
    costLast30: number;
    costPerPlan: number | null;
  };
  planTimes: string[];
  places: Count[];
  timeZones: Count[];
  allergies: Count[];
  refusals: Count[];
  cookTimes: Count[];
  lunchesShare: number | null;
  recentPlans: {
    createdAt: string;
    place: string | null;
    allergies: string;
    kids: number;
    costUsd: number | null;
    safetyFixes: number | null;
    swaps: number;
  }[];
  accounts: { email: string; joined: string; plans: number; ratings: number; lastActive: string; hasPassword: boolean }[];
};

const DAY = 24 * 60 * 60 * 1000;
const TOP = 10;

const countryNames = new Intl.DisplayNames(["en"], { type: "region" });

function placeName(origin: Origin | undefined): string | null {
  if (!origin) return null;
  const country = origin.country ? (countryNames.of(origin.country) ?? origin.country) : "";
  if (origin.country === "US") return [origin.city, origin.region].filter(Boolean).join(", ") || "United States";
  return [origin.city, country].filter(Boolean).join(", ") || null;
}

// Monday-start weeks, so a family's two plans in one week count as one week.
function weekOf(iso: string) {
  return Math.floor((Date.parse(iso) - Date.parse("2024-01-01T00:00:00Z")) / (7 * DAY));
}

function terms(text: string) {
  return text
    .toLowerCase()
    .split(/[,;/]|\band\b/)
    .map((term) => term.replace(/[()]/g, "").trim())
    .filter((term) => term && !["none", "no", "n/a", "nothing"].includes(term));
}

function topCounts(counts: Map<string, number>, limit = TOP): Count[] {
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const top = sorted.slice(0, limit).map(([label, count]) => ({ label, count }));
  const rest = sorted.slice(limit).reduce((total, [, count]) => total + count, 0);
  return rest ? [...top, { label: "Everything else", count: rest }] : top;
}

function bump(map: Map<string, number>, key: string, by = 1) {
  map.set(key, (map.get(key) ?? 0) + by);
}

async function readFolder<T>(prefix: string) {
  return readMany<T>(await listNames(prefix));
}

export async function adminStats(): Promise<AdminStats> {
  const [plans, accounts, reminders, events] = await Promise.all([
    readFolder<StoredPlan>("plans/"),
    readFolder<Account>("accounts/"),
    readFolder<SavedReminder>("reminders/"),
    readFolder<AppEvent>("events/"),
  ]);
  const now = Date.now();
  const recent = (iso: string | undefined, days: number) => Boolean(iso) && now - Date.parse(iso!) < days * DAY;
  const datedPlans = plans.filter((plan) => plan.createdAt).sort((a, b) => b.createdAt!.localeCompare(a.createdAt!));

  // Who made each plan.
  const familyOf = (plan: StoredPlan) =>
    plan.accountId ? `a:${plan.accountId}` : plan.deviceId ? `d:${plan.deviceId}` : `p:${plan.id}`;

  // Families, and the weeks each one made a plan in.
  const weeks = new Map<string, Set<number>>();
  const addWeek = (family: string, iso: string) => {
    if (!weeks.has(family)) weeks.set(family, new Set());
    weeks.get(family)!.add(weekOf(iso));
  };
  for (const plan of datedPlans) addWeek(familyOf(plan), plan.createdAt!);
  for (const account of accounts) {
    for (const made of account.data?.plans ?? []) addWeek(`a:${account.id}`, made.createdAt);
    if (!weeks.has(`a:${account.id}`)) weeks.set(`a:${account.id}`, new Set());
  }

  // Each family's answers from its newest plan, so a family planning every week counts once.
  const newestByFamily = new Map<string, StoredPlan>();
  for (const plan of datedPlans) if (!newestByFamily.has(familyOf(plan))) newestByFamily.set(familyOf(plan), plan);
  const allergies = new Map<string, number>();
  const refusals = new Map<string, number>();
  const cookTimes = new Map<number, number>();
  let withLunches = 0;
  for (const plan of newestByFamily.values()) {
    for (const allergy of new Set(terms(plan.family.allergies ?? ""))) bump(allergies, allergy);
    const foods = new Set(plan.family.kids.flatMap((kid) => terms(kid.refuses ?? "")));
    for (const food of foods) bump(refusals, food);
    cookTimes.set(plan.family.maxMinutes, (cookTimes.get(plan.family.maxMinutes) ?? 0) + 1);
    if (plan.family.lunches) withLunches++;
  }

  // Where families are: from their plans, and from scans and swaps.
  const placeFamilies = new Map<string, Set<string>>();
  const addPlace = (place: string | null, family: string) => {
    if (!place) return;
    if (!placeFamilies.has(place)) placeFamilies.set(place, new Set());
    placeFamilies.get(place)!.add(family);
  };
  const deviceFamily = new Map<string, string>();
  for (const plan of datedPlans) {
    addPlace(placeName(plan.origin), familyOf(plan));
    if (plan.deviceId && !deviceFamily.has(plan.deviceId)) deviceFamily.set(plan.deviceId, familyOf(plan));
  }
  for (const event of events) {
    const family = event.deviceId ? (deviceFamily.get(event.deviceId) ?? `d:${event.deviceId}`) : `e:${event.at}`;
    addPlace(placeName(event.origin), family);
  }
  const places = topCounts(new Map([...placeFamilies].map(([place, families]) => [place, families.size])));

  const timeZones = new Map<string, number>();
  for (const reminder of reminders) {
    bump(timeZones, (reminder.timeZone ?? "America/New_York").replace(/_/g, " ").split("/").pop()!);
  }

  const planCosts = datedPlans.map((plan) => plan.test?.costUsd).filter((cost): cost is number => typeof cost === "number");
  const eventCost = (days?: number) =>
    events
      .filter((event) => typeof event.costUsd === "number" && (!days || recent(event.at, days)))
      .reduce((total, event) => total + (event.costUsd as number), 0);
  const planCost = (days?: number) =>
    datedPlans
      .filter((plan) => typeof plan.test?.costUsd === "number" && (!days || recent(plan.createdAt, days)))
      .reduce((total, plan) => total + (plan.test.costUsd as number), 0);

  const ratings = accounts.flatMap((account) => Object.values(account.data?.ratings ?? {}));
  const tracked = datedPlans.filter((plan) => plan.deviceId || plan.origin);

  return {
    generatedAt: new Date().toISOString(),
    trackingSince: tracked.length ? tracked[tracked.length - 1].createdAt! : null,
    totals: {
      plans: plans.length,
      plansLast7: datedPlans.filter((plan) => recent(plan.createdAt, 7)).length,
      families: weeks.size,
      returning: [...weeks.values()].filter((set) => set.size >= 2).length,
      accounts: accounts.length,
      accountsLast7: accounts.filter((account) => recent(account.createdAt, 7)).length,
      withPassword: accounts.filter((account) => account.passwordHash).length,
      reminders: reminders.length,
      swaps: plans.reduce((total, plan) => total + (plan.swaps ?? 0), 0),
      scans: events.filter((event) => event.type === "scan").length,
      safetyFixed: plans.filter((plan) => (plan.safetyFixes ?? 0) > 0).length,
      blocked: events.filter((event) => event.type === "plan-blocked" || event.type === "swap-blocked").length,
      liked: ratings.filter((rating) => rating.liked).length,
      disliked: ratings.filter((rating) => !rating.liked).length,
      costTotal: planCost() + eventCost(),
      costLast30: planCost(30) + eventCost(30),
      costPerPlan: planCosts.length ? planCosts.reduce((a, b) => a + b, 0) / planCosts.length : null,
    },
    planTimes: datedPlans.map((plan) => plan.createdAt!),
    places,
    timeZones: topCounts(timeZones),
    allergies: topCounts(allergies),
    refusals: topCounts(refusals),
    cookTimes: [...cookTimes.entries()].sort((a, b) => a[0] - b[0]).map(([minutes, count]) => ({ label: `${minutes} min`, count })),
    lunchesShare: newestByFamily.size ? withLunches / newestByFamily.size : null,
    recentPlans: datedPlans.slice(0, 15).map((plan) => ({
      createdAt: plan.createdAt!,
      place: placeName(plan.origin),
      allergies: plan.family.allergies || "none",
      kids: plan.family.kids.length,
      costUsd: plan.test?.costUsd ?? null,
      safetyFixes: plan.safetyFixes ?? null,
      swaps: plan.swaps ?? 0,
    })),
    accounts: accounts
      .map((account) => ({
        email: account.email,
        joined: account.createdAt,
        plans: account.data?.plans?.length ?? 0,
        ratings: Object.keys(account.data?.ratings ?? {}).length,
        lastActive: account.updatedAt,
        hasPassword: Boolean(account.passwordHash),
      }))
      .sort((a, b) => b.lastActive.localeCompare(a.lastActive)),
  };
}
