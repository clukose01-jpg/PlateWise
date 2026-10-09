// Things remembered on this device only (phone or computer): the current plan, the pantry and the family answers.

const CURRENT_PLAN_KEY = "platewise.currentPlan";
const PANTRY_KEY = "platewise.pantry";
export const FAMILY_KEY = "platewise.family";

function read(key: string): unknown {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "null");
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // This browser blocks storage; it just won't be remembered.
  }
}

// The plan this device opens to. Opening a shared plan link makes it this device's plan too.
export function getCurrentPlanId(): string | null {
  const id = read(CURRENT_PLAN_KEY);
  return typeof id === "string" ? id : null;
}

export function setCurrentPlanId(id: string) {
  write(CURRENT_PLAN_KEY, id);
}

export function loadPantry(): string[] {
  const saved = read(PANTRY_KEY);
  return Array.isArray(saved) ? saved.filter((item): item is string => typeof item === "string") : [];
}

export function savePantry(items: string[]) {
  write(PANTRY_KEY, items);
}

export type SavedKid = { name: string; refuses: string[] };

export type SavedFamily = {
  allergies: string[];
  adults: number;
  kids: SavedKid[];
  maxMinutes: number;
  lunches: boolean;
};

// Answers saved before foods were separate bubbles stored them as one line, like "fish, mushrooms".
export function toFoods(refuses: unknown): string[] {
  if (Array.isArray(refuses)) return refuses.filter((food) => typeof food === "string");
  if (typeof refuses !== "string") return [];
  return refuses
    .split(",")
    .map((food) => food.trim())
    .filter(Boolean);
}

const NO_ALLERGIES = ["none", "no", "n/a", "na", "nothing", "nope"];

export function isNoAllergy(text: string) {
  return NO_ALLERGIES.includes(text.trim().toLowerCase());
}

// Allergies are separate bubbles. Answers saved before that were one line, like "peanuts, shellfish";
// commas inside brackets stay together, as in "dairy (milk, cheese)".
export function toAllergies(saved: unknown): string[] {
  if (Array.isArray(saved)) return saved.filter((allergy) => typeof allergy === "string");
  if (typeof saved !== "string") return [];
  const parts: string[] = [];
  let current = "";
  let depth = 0;
  for (const char of saved) {
    if (char === "(") depth++;
    if (char === ")") depth = Math.max(0, depth - 1);
    if ((char === "," || char === ";") && depth === 0) {
      parts.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  parts.push(current);
  return parts.map((part) => part.trim()).filter((part) => part && !isNoAllergy(part));
}

export function loadFamily(): SavedFamily | null {
  const saved = read(FAMILY_KEY) as Partial<SavedFamily> | null;
  if (!saved || typeof saved !== "object") return null;
  return {
    allergies: toAllergies(saved.allergies),
    adults: typeof saved.adults === "number" ? saved.adults : 2,
    kids: Array.isArray(saved.kids)
      ? saved.kids.map((kid: { name?: unknown; refuses?: unknown }) => ({
          name: typeof kid?.name === "string" ? kid.name : "",
          refuses: toFoods(kid?.refuses),
        }))
      : [],
    maxMinutes: typeof saved.maxMinutes === "number" ? saved.maxMinutes : 30,
    lunches: saved.lunches === true,
  };
}

export function saveFamily(family: SavedFamily) {
  write(FAMILY_KEY, family);
}

// After a swap the grocery and prep lists change, so old ticks no longer line up.
export function clearPlanTicks(planId: string) {
  try {
    const prefix = `platewise.${planId}.`;
    Object.keys(localStorage)
      .filter((key) => key.startsWith(prefix))
      .forEach((key) => localStorage.removeItem(key));
  } catch {
    // Nothing to clear.
  }
}
