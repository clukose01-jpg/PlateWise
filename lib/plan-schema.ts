import { z } from "zod";

export const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"] as const;

export const COOK_TIMES = [15, 20, 30, 45, 60] as const;

// What she tells us. Limits keep one request from running up the AI bill.
export const FamilySchema = z.object({
  allergies: z.string().max(300),
  adults: z.number().int().min(1).max(6),
  kids: z
    .array(z.object({ name: z.string().max(60), refuses: z.string().max(300) }))
    .max(8),
  maxMinutes: z.number().int().min(10).max(120),
  lunches: z.boolean(),
  fridgeItems: z.array(z.string().max(100)).max(80),
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
      tip: z.string(),
      steps: z.array(z.string()),
    }),
  ),
  lunches: z.array(z.object({ day: z.enum(WEEKDAYS), name: z.string() })),
  // Sunday prep, grouped by the day it's for, as short steps.
  prepList: z.array(z.object({ day: z.enum(WEEKDAYS), steps: z.array(z.string()) })),
  groceryList: z.array(z.object({ section: z.string(), items: z.array(z.string()) })),
});

export type Plan = z.infer<typeof PlanSchema>;

export type TestInfo = {
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number | null;
  seconds: number;
};
