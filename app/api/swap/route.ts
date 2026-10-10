import Anthropic from "@anthropic-ai/sdk";
import { after } from "next/server";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import {
  apiKeyProblem,
  createClient,
  estimateCostUsd,
  FALLBACK_BETA,
  KEY_REJECTED,
  MODEL,
} from "@/lib/claude";
import { buildPlanPrompt } from "@/lib/plan-prompt";
import { type Family, type Plan, PlanSchema, type TestInfo, WEEKDAYS } from "@/lib/plan-schema";
import { loadPlan, type StoredPlan, StorageNotSetUpError, updatePlan } from "@/lib/plans";
import { logEvent } from "@/lib/events";
import { describeFix, makeSafePlan, type PlanFix, PlanSafetyError, SAFETY_CHECK_ON } from "@/lib/safe-plan";
import { priceArea, requestDeviceId, requestOrigin } from "@/lib/visitor";

export const maxDuration = 300;

const SwapRequest = z.object({ planId: z.string().max(40), day: z.enum(WEEKDAYS) });

function buildSwapPrompt(family: Family, stored: StoredPlan, day: string, dish: string) {
  return `${buildPlanPrompt(family, priceArea(stored.origin))}

This is the plan you made for them:
${JSON.stringify(stored.plan)}

They'd like a different dinner on ${day} instead of "${dish}". Make the plan again with only that change:
- Pick a new ${day} dinner that follows every rule above. Don't use "${dish}" or anything close to it, and don't repeat another dinner already in the week.
- Keep every other dinner and lunch exactly as it is.
- Update the Sunday prep list, the night-before steps and the grocery list so they match the new week.`;
}

// Asks Claude for the new dinner and keeps the rest of the week exactly as it was, even if Claude
// reworded something.
async function swapDinner(
  family: Family,
  stored: StoredPlan,
  day: string,
  fix?: PlanFix,
): Promise<{ plan: Plan; test: TestInfo } | null> {
  const started = Date.now();
  const oldDinner = stored.plan.dinners.find((dinner) => dinner.day === day)!;
  const stream = createClient().beta.messages.stream({
    model: MODEL,
    max_tokens: 64000,
    betas: [FALLBACK_BETA],
    fallbacks: "default",
    // Low effort keeps swaps quick; the rules and the rest of the week are already worked out.
    output_config: { effort: "low", format: betaZodOutputFormat(PlanSchema) },
    messages: [
      {
        role: "user",
        content: buildSwapPrompt(family, stored, day, oldDinner.name) + (fix ? describeFix(fix) : ""),
      },
    ],
  });
  const response = await stream.finalMessage();

  const generated = response.parsed_output;
  const newDinner = generated?.dinners.find((dinner) => dinner.day === day);
  if (response.stop_reason === "refusal" || !generated || !newDinner) return null;

  const dinners = stored.plan.dinners.map((dinner) => {
    if (dinner.day === day) return newDinner;
    const regenerated = generated.dinners.find((g) => g.day === dinner.day);
    return {
      ...dinner,
      nightBefore: regenerated?.nightBefore ?? dinner.nightBefore ?? [],
      // Plans made before prices and ingredient lists were added get them now. The safety check
      // reads every dinner's ingredients, so these are checked too.
      cost: dinner.cost ?? regenerated?.cost ?? 0,
      ingredients: dinner.ingredients ?? regenerated?.ingredients ?? [],
    };
  });
  const { input_tokens, output_tokens } = response.usage;
  return {
    plan: { ...stored.plan, dinners, prepList: generated.prepList, groceryList: generated.groceryList },
    test: {
      model: response.model,
      inputTokens: input_tokens,
      outputTokens: output_tokens,
      costUsd: estimateCostUsd(response.model, input_tokens, output_tokens),
      seconds: (Date.now() - started) / 1000,
    },
  };
}

function errorResponse(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export async function POST(request: Request) {
  const keyProblem = apiKeyProblem();
  if (keyProblem) {
    return errorResponse(keyProblem, 500);
  }

  const parsed = SwapRequest.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return errorResponse("That swap didn't come through. Please try again.", 400);
  }
  const { planId, day } = parsed.data;

  const stored = await loadPlan(planId);
  if (!stored?.plan.dinners.some((dinner) => dinner.day === day)) {
    return errorResponse("We couldn't find that dinner. Try reloading the page.", 404);
  }

  // Plans made before the pantry and ratings existed don't have them saved.
  const family: Family = {
    ...stored.family,
    pantryItems: stored.family.pantryItems ?? [],
    feedback: stored.family.feedback ?? [],
  };

  try {
    const generate = (fix?: PlanFix) => swapDinner(family, stored, day, fix);
    // Only what the swap changed needs checking: the new dinner, the night-before steps, the lists,
    // and every dinner's ingredients (older plans get theirs filled in by the swap).
    const changed = (plan: Plan): Plan => ({
      ...plan,
      dinners: plan.dinners.map((d) => (d.day === day ? d : { ...d, name: "", tip: "", steps: [], minutes: 0 })),
      lunches: [],
    });
    const result = SAFETY_CHECK_ON ? await makeSafePlan(family, generate, changed) : await generate();
    if (!result) {
      return errorResponse("We couldn't swap that dinner this time. Please try again.", 502);
    }
    // A new dinner hasn't been made or skipped yet.
    const { [day]: _swappedOut, ...cooked } = stored.cooked ?? {};
    await updatePlan({ ...stored, plan: result.plan, swaps: (stored.swaps ?? 0) + 1, cooked });
    after(() =>
      logEvent({
        type: "swap",
        origin: requestOrigin(request),
        deviceId: requestDeviceId(request),
        costUsd: result.test.costUsd,
      }),
    );
    return Response.json({
      dish: result.plan.dinners.find((dinner) => dinner.day === day)!.name,
      test: result.test,
    });
  } catch (error) {
    if (error instanceof PlanSafetyError) {
      console.error("Swap failed the safety check:", JSON.stringify(error.rounds));
      after(() =>
        logEvent({ type: "swap-blocked", origin: requestOrigin(request), deviceId: requestDeviceId(request) }),
      );
      return errorResponse(
        "We couldn't find another dinner we're sure is safe for your family's allergies. Your dinner wasn't changed.",
        502,
      );
    }
    if (error instanceof StorageNotSetUpError) {
      return errorResponse("The app can't save plans yet: connect a Blob store in Vercel.", 500);
    }
    if (error instanceof Anthropic.AuthenticationError) {
      console.error("Swap failed: Claude rejected the API key:", error.message);
      return errorResponse(KEY_REJECTED, 500);
    }
    if (error instanceof Anthropic.RateLimitError) {
      return errorResponse("Too many requests at once. Wait a minute and try again.", 429);
    }
    console.error("Swap failed:", error);
    return errorResponse("We couldn't swap that dinner this time. Please try again.", 502);
  }
}
