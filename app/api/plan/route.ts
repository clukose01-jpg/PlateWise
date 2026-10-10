import Anthropic from "@anthropic-ai/sdk";
import { after } from "next/server";
import { apiKeyProblem, KEY_REJECTED, PLAN_EFFORT } from "@/lib/claude";
import { FamilySchema } from "@/lib/plan-schema";
import { newOwnerKey, savePlan, StorageNotSetUpError } from "@/lib/plans";
import { logEvent } from "@/lib/events";
import { makeSafePlan, type PlanFix, PlanSafetyError, SAFETY_CHECK_ON, type SafetyRound } from "@/lib/safe-plan";
import { sessionAccountId } from "@/lib/session";
import { priceArea, requestDeviceId, requestOrigin } from "@/lib/visitor";
import { writePlan } from "@/lib/write-plan";

// Writing and double-checking a whole week can take a minute or two.
export const maxDuration = 300;

const NOT_SAFE =
  "We couldn't make a plan we're sure is safe for your family's allergies this time. Please try again.";

function errorResponse(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export async function POST(request: Request) {
  const keyProblem = apiKeyProblem();
  if (keyProblem) {
    return errorResponse(keyProblem, 500);
  }

  const parsed = FamilySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return errorResponse("Some answers didn't come through. Please check them and try again.", 400);
  }
  const family = parsed.data;
  const origin = requestOrigin(request);

  try {
    const generate = (fix?: PlanFix) => writePlan(family, PLAN_EFFORT, fix, priceArea(origin));
    const result = SAFETY_CHECK_ON ? await makeSafePlan(family, generate) : await generate();
    if (!result) {
      return errorResponse("We couldn't make a plan this time. Please try again.", 502);
    }
    // The key goes back to her device only, so only she can delete the plan later.
    const { ownerKey, ownerKeyHash } = newOwnerKey();
    const id = await savePlan({
      family,
      plan: result.plan,
      test: result.test,
      safetyChecked: SAFETY_CHECK_ON,
      ownerKeyHash,
      origin,
      deviceId: requestDeviceId(request),
      accountId: sessionAccountId(request) ?? undefined,
      safetyFixes:
        "rounds" in result
          ? (result.rounds as SafetyRound[]).filter((round) => round.problems.length).length
          : undefined,
    });
    return Response.json({ id, ownerKey });
  } catch (error) {
    if (error instanceof PlanSafetyError) {
      console.error("Plan failed the safety check:", JSON.stringify(error.rounds));
      after(() =>
        logEvent({ type: "plan-blocked", origin: requestOrigin(request), deviceId: requestDeviceId(request) }),
      );
      return errorResponse(NOT_SAFE, 502);
    }
    if (error instanceof StorageNotSetUpError) {
      return errorResponse("The app can't save plans yet: connect a Blob store in Vercel.", 500);
    }
    if (error instanceof Anthropic.AuthenticationError) {
      console.error("Plan failed: Claude rejected the API key:", error.message);
      return errorResponse(KEY_REJECTED, 500);
    }
    if (error instanceof Anthropic.RateLimitError) {
      return errorResponse("Too many plans at once. Wait a minute and try again.", 429);
    }
    console.error("Plan failed:", error);
    return errorResponse("We couldn't make a plan this time. Please try again.", 502);
  }
}
