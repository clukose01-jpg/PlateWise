import { z } from "zod";
import { apiKeyProblem, PLAN_EFFORT } from "@/lib/claude";
import { checkPlan, TEST_FAMILIES } from "@/lib/compare";
import { compareAllowed } from "@/lib/compare-access";
import { makeSafePlan, type PlanFix, PlanSafetyError } from "@/lib/safe-plan";
import { writePlan } from "@/lib/write-plan";

export const maxDuration = 300;

const SafeRequest = z.object({ family: z.number().int().min(0).max(TEST_FAMILIES.length - 1) });

// Makes one test plan the way the app will once the safety check is on, and reports what the
// check caught and fixed. Then checks the final plan again with this page's own word lists.
export async function POST(request: Request) {
  if (!compareAllowed(request)) {
    return Response.json({ error: "That passcode didn't work." }, { status: 403 });
  }
  const keyProblem = apiKeyProblem();
  if (keyProblem) {
    return Response.json({ error: keyProblem }, { status: 500 });
  }
  const parsed = SafeRequest.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "That test didn't come through." }, { status: 400 });
  }
  const test = TEST_FAMILIES[parsed.data.family];
  const started = Date.now();
  try {
    const result = await makeSafePlan(test.family, (fix?: PlanFix) => writePlan(test.family, PLAN_EFFORT, fix));
    if (!result) {
      return Response.json({ error: "Claude didn't return a plan." }, { status: 502 });
    }
    return Response.json({
      seconds: (Date.now() - started) / 1000,
      costUsd: result.test.costUsd,
      rounds: result.rounds,
      dinners: result.plan.dinners.map(({ day, name, minutes }) => ({ day, name, minutes })),
      ...checkPlan(test, result.plan),
    });
  } catch (error) {
    if (error instanceof PlanSafetyError) {
      return Response.json({
        blocked: true,
        seconds: (Date.now() - started) / 1000,
        rounds: error.rounds,
      });
    }
    console.error("Compare safety test failed:", error);
    return Response.json({ error: "Something went wrong making this plan." }, { status: 502 });
  }
}
