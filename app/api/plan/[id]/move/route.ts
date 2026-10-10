import { z } from "zod";
import { type Plan, WEEKDAYS } from "@/lib/plan-schema";
import { loadPlan, StorageNotSetUpError, updatePlan } from "@/lib/plans";

const MoveRequest = z
  .object({ from: z.enum(WEEKDAYS), to: z.enum(WEEKDAYS) })
  .refine((move) => move.from !== move.to);

type Context = { params: Promise<{ id: string }> };
type PrepGroup = Plan["prepList"][number];

// Switches two days' dinners, with their Sunday prep, night-before steps and made/skipped answers.
// Nothing new is cooked up, so it's instant and needs no allergy check: the same dinners, other days.
export async function POST(request: Request, { params }: Context) {
  const { id } = await params;
  const parsed = MoveRequest.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "That didn't come through. Please try again." }, { status: 400 });
  }
  const { from, to } = parsed.data;
  const stored = await loadPlan(id);
  const moving = stored?.plan.dinners.find((dinner) => dinner.day === from);
  const other = stored?.plan.dinners.find((dinner) => dinner.day === to);
  if (!stored || !moving || !other) {
    return Response.json({ error: "We couldn't find those dinners. Try reloading the page." }, { status: 404 });
  }

  const switchDay = (day: string) => (day === from ? to : day === to ? from : day);
  const dinners = stored.plan.dinners.map((dinner) =>
    dinner.day === from ? { ...other, day: from } : dinner.day === to ? { ...moving, day: to } : dinner,
  );
  // Prep is grouped by the day it's for, so it follows its dinner. Plans from before prep was
  // grouped have one list for the week, which stays as it is.
  const prepList =
    stored.plan.prepList.length > 0 && typeof stored.plan.prepList[0] !== "string"
      ? (stored.plan.prepList as PrepGroup[])
          .map((group) => ({ ...group, day: switchDay(group.day) as PrepGroup["day"] }))
          .sort((a, b) => WEEKDAYS.indexOf(a.day) - WEEKDAYS.indexOf(b.day))
      : stored.plan.prepList;
  const cooked = Object.fromEntries(Object.entries(stored.cooked ?? {}).map(([day, answer]) => [switchDay(day), answer]));

  try {
    await updatePlan({ ...stored, plan: { ...stored.plan, dinners, prepList }, cooked, moves: (stored.moves ?? 0) + 1 });
    return Response.json({ ok: true });
  } catch (error) {
    if (!(error instanceof StorageNotSetUpError)) console.error("Moving a dinner failed:", error);
    return Response.json({ error: "We couldn't move that dinner. Please try again." }, { status: 502 });
  }
}
