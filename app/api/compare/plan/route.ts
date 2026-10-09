import { z } from "zod";
import { apiKeyProblem } from "@/lib/claude";
import { checkPlan, TEST_FAMILIES } from "@/lib/compare";
import { compareAllowed } from "@/lib/compare-access";
import { writePlan } from "@/lib/write-plan";

export const maxDuration = 300;

const CompareRequest = z.object({
  family: z.number().int().min(0).max(TEST_FAMILIES.length - 1),
  effort: z.enum(["low", "medium"]),
});

// Makes one test plan (not saved anywhere) and checks it for foods the family can't eat.
export async function POST(request: Request) {
  if (!compareAllowed(request)) {
    return Response.json({ error: "That passcode didn't work." }, { status: 403 });
  }
  const keyProblem = apiKeyProblem();
  if (keyProblem) {
    return Response.json({ error: keyProblem }, { status: 500 });
  }
  const parsed = CompareRequest.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "That test didn't come through." }, { status: 400 });
  }
  const test = TEST_FAMILIES[parsed.data.family];
  try {
    const result = await writePlan(test.family, parsed.data.effort);
    if (!result) {
      return Response.json({ error: "Claude didn't return a plan." }, { status: 502 });
    }
    return Response.json({
      seconds: result.test.seconds,
      costUsd: result.test.costUsd,
      dinners: result.plan.dinners.map(({ day, name, minutes }) => ({ day, name, minutes })),
      lunches: result.plan.lunches.length,
      ...checkPlan(test, result.plan),
    });
  } catch (error) {
    console.error("Compare plan failed:", error);
    return Response.json({ error: "Something went wrong making this plan." }, { status: 502 });
  }
}
