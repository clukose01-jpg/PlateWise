// Whether a family made each planned dinner, and why not if they skipped it. Saved on the plan, so
// the admin page can count it for every family, logged in or not.
export const SKIP_REASONS = [
  "Too busy or tired",
  "Ate out or ordered in",
  "Missing an ingredient",
  "Didn't sound good",
  "Plans changed",
] as const;

export type SkipReason = (typeof SKIP_REASONS)[number];
export type CookedStatus = "made" | "skipped";
export type Cooked = { status: CookedStatus; reason?: SkipReason; at: string };
