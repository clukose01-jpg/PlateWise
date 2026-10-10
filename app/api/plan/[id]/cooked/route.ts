import { z } from "zod";
import { SKIP_REASONS } from "@/lib/cooked";
import { WEEKDAYS } from "@/lib/plan-schema";
import { loadPlan, StorageNotSetUpError, updatePlan } from "@/lib/plans";

const CookedRequest = z.object({
  day: z.enum(WEEKDAYS),
  // null clears the answer.
  status: z.enum(["made", "skipped"]).nullable(),
  reason: z.enum(SKIP_REASONS).optional(),
});

type Context = { params: Promise<{ id: string }> };

// "We made it" or "We skipped it" for one dinner. Anyone with the plan's link can answer, like
// anyone in the family.
export async function POST(request: Request, { params }: Context) {
  const { id } = await params;
  const parsed = CookedRequest.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "That didn't come through. Please try again." }, { status: 400 });
  }
  const { day, status, reason } = parsed.data;
  const stored = await loadPlan(id);
  if (!stored?.plan.dinners.some((dinner) => dinner.day === day)) {
    return Response.json({ error: "We couldn't find that dinner. Try reloading the page." }, { status: 404 });
  }
  const cooked = { ...(stored.cooked ?? {}) };
  if (status) {
    cooked[day] = { status, reason: status === "skipped" ? reason : undefined, at: new Date().toISOString() };
  } else {
    delete cooked[day];
  }
  try {
    await updatePlan({ ...stored, cooked });
    return Response.json({ ok: true });
  } catch (error) {
    if (!(error instanceof StorageNotSetUpError)) console.error("Saving made/skipped failed:", error);
    return Response.json({ error: "We couldn't save that. Please try again." }, { status: 502 });
  }
}
