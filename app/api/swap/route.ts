import Anthropic from "@anthropic-ai/sdk";
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
import { PlanSchema, WEEKDAYS } from "@/lib/plan-schema";
import { loadPlan, type StoredPlan, StorageNotSetUpError, updatePlan } from "@/lib/plans";

export const maxDuration = 300;

const SwapRequest = z.object({ planId: z.string().max(40), day: z.enum(WEEKDAYS) });

function buildSwapPrompt(stored: StoredPlan, day: string, dish: string) {
  // Plans made before the pantry and ratings existed don't have them saved.
  const family = {
    ...stored.family,
    pantryItems: stored.family.pantryItems ?? [],
    feedback: stored.family.feedback ?? [],
  };
  return `${buildPlanPrompt(family)}

This is the plan you made for them:
${JSON.stringify(stored.plan)}

They'd like a different dinner on ${day} instead of "${dish}". Make the plan again with only that change:
- Pick a new ${day} dinner that follows every rule above. Don't use "${dish}" or anything close to it, and don't repeat another dinner already in the week.
- Keep every other dinner and lunch exactly as it is.
- Update the Sunday prep list, the night-before steps and the grocery list so they match the new week.`;
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
  const oldDinner = stored?.plan.dinners.find((dinner) => dinner.day === day);
  if (!stored || !oldDinner) {
    return errorResponse("We couldn't find that dinner. Try reloading the page.", 404);
  }

  const client = createClient();
  const started = Date.now();

  try {
    const stream = client.beta.messages.stream({
      model: MODEL,
      max_tokens: 64000,
      betas: [FALLBACK_BETA],
      fallbacks: "default",
      // Low effort keeps swaps quick; the rules and the rest of the week are already worked out.
      output_config: { effort: "low", format: betaZodOutputFormat(PlanSchema) },
      messages: [{ role: "user", content: buildSwapPrompt(stored, day, oldDinner.name) }],
    });
    const response = await stream.finalMessage();

    const generated = response.parsed_output;
    const newDinner = generated?.dinners.find((dinner) => dinner.day === day);
    if (response.stop_reason === "refusal" || !generated || !newDinner) {
      return errorResponse("We couldn't swap that dinner this time. Please try again.", 502);
    }

    // Keep the rest of the week exactly as it was, even if Claude reworded something.
    const dinners = stored.plan.dinners.map((dinner) =>
      dinner.day === day
        ? newDinner
        : {
            ...dinner,
            nightBefore:
              generated.dinners.find((g) => g.day === dinner.day)?.nightBefore ?? dinner.nightBefore ?? [],
          },
    );
    await updatePlan({
      ...stored,
      plan: { ...stored.plan, dinners, prepList: generated.prepList, groceryList: generated.groceryList },
    });

    const { input_tokens, output_tokens } = response.usage;
    return Response.json({
      dish: newDinner.name,
      test: {
        model: response.model,
        inputTokens: input_tokens,
        outputTokens: output_tokens,
        costUsd: estimateCostUsd(response.model, input_tokens, output_tokens),
        seconds: (Date.now() - started) / 1000,
      },
    });
  } catch (error) {
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
