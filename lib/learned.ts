import { type Learned, RECENT_PLANS, WEEKDAYS } from "./plan-schema";
import { loadPlan, type StoredPlan } from "./plans";

// What a family did with their recent plans, not only what they rated: dinners they made, skipped
// or swapped away, and nights they were rushed. The next plan learns from it.

// Plans older than this are left out.
const RECENT_DAYS = 42;
// A weeknight is busy once it was rushed in this many different weeks.
const BUSY_WEEKS = 2;
const MAX_DISHES = 10;

// Each dish once, newest first, ignoring capitals.
function unique(dishes: string[]) {
  const seen = new Set<string>();
  return dishes.filter((dish) => {
    const key = dish.trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function learnFrom(plans: StoredPlan[], now = Date.now()): Learned | undefined {
  const passedOn: string[] = [];
  const made: string[] = [];
  // Weekday → the plans (weeks) it was rushed in.
  const rushed = new Map<string, Set<string>>();
  let missingIngredient = 0;
  const rush = (day: string, planId: string) => rushed.set(day, (rushed.get(day) ?? new Set()).add(planId));

  const recent = plans
    .filter((plan) => !plan.createdAt || now - Date.parse(plan.createdAt) < RECENT_DAYS * 86_400_000)
    .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
  for (const plan of recent) {
    for (const [day, cooked] of Object.entries(plan.cooked ?? {})) {
      const dish = plan.plan.dinners.find((dinner) => dinner.day === day)?.name;
      if (!cooked || !dish) continue;
      if (cooked.status === "made") made.push(dish);
      else if (cooked.reason === "Didn't sound good") passedOn.push(dish);
      else if (cooked.reason === "Too busy or tired") rush(day, plan.id);
      else if (cooked.reason === "Missing an ingredient") missingIngredient++;
    }
    for (const swap of plan.swappedAway ?? []) {
      if (swap.quick) rush(swap.day, plan.id);
      else passedOn.push(swap.dish);
    }
  }

  const learned: Learned = {
    passedOn: unique(passedOn).slice(0, MAX_DISHES),
    made: unique(made).slice(0, MAX_DISHES),
    busyNights: WEEKDAYS.filter((day) => (rushed.get(day)?.size ?? 0) >= BUSY_WEEKS),
    missingIngredient,
  };
  const empty =
    !learned.passedOn.length && !learned.made.length && !learned.busyNights.length && !missingIngredient;
  return empty ? undefined : learned;
}

// The plans her device says she made recently. Plan ids can't be guessed, and anyone with one can
// already open that plan, so reading them here shares nothing new.
export async function learnFromPlans(ids: string[]): Promise<Learned | undefined> {
  const wanted = [...new Set(ids)].slice(0, RECENT_PLANS);
  const plans = await Promise.all(wanted.map((id) => loadPlan(id).catch(() => null)));
  return learnFrom(plans.filter((plan): plan is StoredPlan => plan !== null));
}
