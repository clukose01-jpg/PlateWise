import type { Account } from "./accounts";
import type { AppEvent } from "./events";
import type { SavedReminder } from "./reminders";
import { groceryTotal } from "./plan-schema";
import { DEFAULT_REMINDER_HOUR, hourLabel, REMINDER_HOURS } from "./reminder-times";
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
    plansPrev7: number;
    families: number;
    returning: number;
    newFamiliesLast7: number;
    returningLast7: number;
    accounts: number;
    accountsLast7: number;
    withPassword: number;
    reminders: number;
    swaps: number;
    scans: number;
    photos: number;
    safetyFixed: number;
    blocked: number;
    blockedLast7: number;
    liked: number;
    disliked: number;
    costTotal: number;
    costLast30: number;
    costLast7: number;
    costPerPlan: number | null;
  };
  planTimes: string[];
  places: Count[];
  placesLast7: Count[];
  timeZones: Count[];
  reminderTimes: Count[];
  allergies: Count[];
  refusals: Count[];
  cookTimes: Count[];
  lunchesShare: number | null;
  budgets: {
    // Of families, how many set a budget, and the average one.
    share: number | null;
    average: number | null;
    // Of plans with prices: the average grocery list, and how many came out over budget.
    averageGroceries: number | null;
    plansWithBudget: number;
    overBudget: number;
  };
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

const isBlocked = (event: AppEvent) => event.type === "plan-blocked" || event.type === "swap-blocked";

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
  const between = (iso: string | undefined, fromDays: number, toDays: number) =>
    recent(iso, toDays) && !recent(iso, fromDays);
  const datedPlans = plans.filter((plan) => plan.createdAt).sort((a, b) => b.createdAt!.localeCompare(a.createdAt!));

  // Who made each plan.
  const familyOf = (plan: StoredPlan) =>
    plan.accountId ? `a:${plan.accountId}` : plan.deviceId ? `d:${plan.deviceId}` : `p:${plan.id}`;

  // Families, the weeks each one made a plan in, and when each one first and last made one.
  const weeks = new Map<string, Set<number>>();
  const firstPlan = new Map<string, string>();
  const lastPlan = new Map<string, string>();
  const addWeek = (family: string, iso: string) => {
    if (!weeks.has(family)) weeks.set(family, new Set());
    weeks.get(family)!.add(weekOf(iso));
    if (!firstPlan.has(family) || iso < firstPlan.get(family)!) firstPlan.set(family, iso);
    if (!lastPlan.has(family) || iso > lastPlan.get(family)!) lastPlan.set(family, iso);
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
  const budgets: number[] = [];
  for (const plan of newestByFamily.values()) {
    if (plan.family.budget) budgets.push(plan.family.budget);
    for (const allergy of new Set(terms(plan.family.allergies ?? ""))) bump(allergies, allergy);
    const foods = new Set(plan.family.kids.flatMap((kid) => terms(kid.refuses ?? "")));
    for (const food of foods) bump(refusals, food);
    cookTimes.set(plan.family.maxMinutes, (cookTimes.get(plan.family.maxMinutes) ?? 0) + 1);
    if (plan.family.lunches) withLunches++;
  }

  // Where families are: from their plans, and from scans and swaps.
  const placeFamilies = new Map<string, Set<string>>();
  const placeFamiliesLast7 = new Map<string, Set<string>>();
  const addPlace = (place: string | null, family: string, at: string) => {
    if (!place) return;
    for (const map of recent(at, 7) ? [placeFamilies, placeFamiliesLast7] : [placeFamilies]) {
      if (!map.has(place)) map.set(place, new Set());
      map.get(place)!.add(family);
    }
  };
  const deviceFamily = new Map<string, string>();
  for (const plan of datedPlans) {
    addPlace(placeName(plan.origin), familyOf(plan), plan.createdAt!);
    if (plan.deviceId && !deviceFamily.has(plan.deviceId)) deviceFamily.set(plan.deviceId, familyOf(plan));
  }
  for (const event of events) {
    const family = event.deviceId ? (deviceFamily.get(event.deviceId) ?? `d:${event.deviceId}`) : `e:${event.at}`;
    addPlace(placeName(event.origin), family, event.at);
  }
  const familiesPerPlace = (map: Map<string, Set<string>>, limit?: number) =>
    topCounts(new Map([...map].map(([place, families]) => [place, families.size])), limit);
  const places = familiesPerPlace(placeFamilies);

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

  const totals = datedPlans.map((plan) => ({ total: groceryTotal(plan.plan.groceryList), budget: plan.family.budget }));
  const priced = totals.filter((plan) => plan.total !== null);
  const budgeted = priced.filter((plan) => plan.budget);
  const average = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null);

  const ratings = accounts.flatMap((account) => Object.values(account.data?.ratings ?? {}));
  const tracked = datedPlans.filter((plan) => plan.deviceId || plan.origin);

  return {
    generatedAt: new Date().toISOString(),
    trackingSince: tracked.length ? tracked[tracked.length - 1].createdAt! : null,
    totals: {
      plans: plans.length,
      plansLast7: datedPlans.filter((plan) => recent(plan.createdAt, 7)).length,
      plansPrev7: datedPlans.filter((plan) => between(plan.createdAt, 7, 14)).length,
      families: weeks.size,
      returning: [...weeks.values()].filter((set) => set.size >= 2).length,
      // New this week: their first plan was in the last 7 days. Came back: a plan this week, and one before.
      newFamiliesLast7: [...firstPlan.values()].filter((iso) => recent(iso, 7)).length,
      returningLast7: [...lastPlan].filter(([family, iso]) => recent(iso, 7) && !recent(firstPlan.get(family), 7))
        .length,
      accounts: accounts.length,
      accountsLast7: accounts.filter((account) => recent(account.createdAt, 7)).length,
      withPassword: accounts.filter((account) => account.passwordHash).length,
      reminders: reminders.length,
      swaps: plans.reduce((total, plan) => total + (plan.swaps ?? 0), 0),
      scans: events.filter((event) => event.type === "scan").length,
      photos: events.filter((event) => event.type === "photo").length,
      safetyFixed: plans.filter((plan) => (plan.safetyFixes ?? 0) > 0).length,
      blocked: events.filter(isBlocked).length,
      blockedLast7: events.filter((event) => isBlocked(event) && recent(event.at, 7)).length,
      liked: ratings.filter((rating) => rating.liked).length,
      disliked: ratings.filter((rating) => !rating.liked).length,
      costTotal: planCost() + eventCost(),
      costLast30: planCost(30) + eventCost(30),
      costLast7: planCost(7) + eventCost(7),
      costPerPlan: planCosts.length ? planCosts.reduce((a, b) => a + b, 0) / planCosts.length : null,
    },
    planTimes: datedPlans.map((plan) => plan.createdAt!),
    places,
    placesLast7: familiesPerPlace(placeFamiliesLast7, 5),
    timeZones: topCounts(timeZones),
    reminderTimes: REMINDER_HOURS.map((hour) => ({
      label: hourLabel(hour),
      count: reminders.filter((reminder) => (reminder.hour ?? DEFAULT_REMINDER_HOUR) === hour).length,
    })).filter((time) => time.count > 0),
    allergies: topCounts(allergies),
    refusals: topCounts(refusals),
    cookTimes: [...cookTimes.entries()].sort((a, b) => a[0] - b[0]).map(([minutes, count]) => ({ label: `${minutes} min`, count })),
    lunchesShare: newestByFamily.size ? withLunches / newestByFamily.size : null,
    budgets: {
      share: newestByFamily.size ? budgets.length / newestByFamily.size : null,
      average: average(budgets),
      averageGroceries: average(priced.map((plan) => plan.total!)),
      plansWithBudget: budgeted.length,
      overBudget: budgeted.filter((plan) => plan.total! > plan.budget! + 0.5).length,
    },
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
