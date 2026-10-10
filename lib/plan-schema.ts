import { z } from "zod";

export const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"] as const;

export const COOK_TIMES = [15, 20, 30, 45, 60] as const;

// What she tells us. Limits keep one request from running up the AI bill.
export const FamilySchema = z.object({
  // Up to 12 allergies, joined like "peanuts, shellfish".
  allergies: z.string().max(600),
  adults: z.number().int().min(1).max(6),
  kids: z
    .array(z.object({ name: z.string().max(60), refuses: z.string().max(300) }))
    .max(8),
  maxMinutes: z.number().int().min(10).max(120),
  lunches: z.boolean(),
  // The most she wants to spend on this week's groceries, in dollars. Optional.
  budget: z.number().int().min(1).max(5000).nullish(),
  fridgeItems: z.array(z.string().max(100)).max(80),
  // Long-lasting staples she keeps stocked. Older versions of the app didn't send this.
  pantryItems: z.array(z.string().max(100)).max(80).default([]),
  // What the family thought of past dinners, newest first.
  feedback: z
    .array(
      z.object({
        dish: z.string().max(120),
        liked: z.boolean(),
        note: z.string().max(300),
        lastPlan: z.boolean(),
      }),
    )
    .max(30)
    .default([]),
  madeOn: z.string().max(60),
});

export type Family = z.infer<typeof FamilySchema>;

// What Claude gives back.
export const PlanSchema = z.object({
  dinners: z.array(
    z.object({
      day: z.enum(WEEKDAYS),
      name: z.string(),
      minutes: z.number().int(),
      // About what the dinner's ingredients cost, in dollars, for the whole family.
      cost: z.number(),
      tip: z.string(),
      steps: z.array(z.string()),
      // Things to do the night before, like moving meat from the freezer to the fridge.
      nightBefore: z.array(z.string()),
    }),
  ),
  lunches: z.array(z.object({ day: z.enum(WEEKDAYS), name: z.string() })),
  // Sunday prep, grouped by the day it's for, as short steps.
  prepList: z.array(z.object({ day: z.enum(WEEKDAYS), steps: z.array(z.string()) })),
  // Each item with its amount, and about what it costs in dollars.
  groceryList: z.array(
    z.object({ section: z.string(), items: z.array(z.object({ name: z.string(), price: z.number() })) }),
  ),
});

export type Plan = z.infer<typeof PlanSchema>;
export type GroceryItem = Plan["groceryList"][number]["items"][number];

// Plans made before prices were added list each grocery item as plain text.
export function itemName(item: GroceryItem | string) {
  return typeof item === "string" ? item : item.name;
}

export function itemPrice(item: GroceryItem | string): number | null {
  return typeof item === "string" || !Number.isFinite(item.price) ? null : item.price;
}

// The whole list's estimated cost, or null for a plan made before prices were added.
export function groceryTotal(groceryList: { items: (GroceryItem | string)[] }[]): number | null {
  const prices = groceryList.flatMap((group) => group.items.map(itemPrice));
  if (!prices.length || prices.some((price) => price === null)) return null;
  return prices.reduce((total: number, price) => total + price!, 0);
}

// Prices are estimates, so whole dollars are close enough.
export function dollars(amount: number) {
  return `$${Math.max(1, Math.round(amount)).toLocaleString()}`;
}

export type TestInfo = {
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number | null;
  seconds: number;
};
