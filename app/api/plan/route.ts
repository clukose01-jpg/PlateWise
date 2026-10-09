import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import {
  apiKeyProblem,
  createClient,
  estimateCostUsd,
  FALLBACK_BETA,
  KEY_REJECTED,
  MODEL,
} from "@/lib/claude";
import { type Family, FamilySchema, PlanSchema } from "@/lib/plan-schema";
import { savePlan, StorageNotSetUpError } from "@/lib/plans";

// Writing a whole week can take a minute or two.
export const maxDuration = 300;

function describeFamily(family: Family) {
  const kids = family.kids.length;
  const eaters = `${family.adults} adult${family.adults === 1 ? "" : "s"}${
    kids ? ` and ${kids} kid${kids === 1 ? "" : "s"}` : ""
  }`;
  const kidLines = family.kids.map((kid, i) => {
    const name = kid.name.trim() || `Kid ${i + 1}`;
    const refuses = kid.refuses.trim();
    return `  - ${name}: ${refuses ? `won't eat ${refuses}` : "no foods listed"}`;
  });

  return [
    `- Eating: ${eaters}`,
    ...(kidLines.length ? ["- Kids:", ...kidLines] : []),
    `- Allergies: ${family.allergies.trim() || "none"}`,
    `- Longest she'll cook on a weeknight: ${family.maxMinutes} minutes`,
    `- Fresh food already in the fridge or freezer: ${family.fridgeItems.join(", ") || "nothing listed"}`,
    `- Already in the pantry: ${family.pantryItems.join(", ") || "nothing listed"}`,
  ].join("\n");
}

function buildPrompt(family: Family) {
  return `You're planning a week of dinners for a busy working parent. She shops once and preps on Sunday, so on weeknights there's nothing left to decide.

About the family:
${describeFamily(family)}

Make this plan:

1. Dinners for Monday to Friday. Each one is a single meal the whole family eats.
   - Never use an allergen, including hidden sources such as oils, sauces and packaged foods that often contain it.
   - Never use a food any kid won't eat.
   - Each dinner takes no more than ${family.maxMinutes} minutes on the night, counting the Sunday prep as already done. "minutes" is that time.
   - Use the fresh food she already has first, using it early in the week, and build on what's in her pantry.
   - Keep it varied: don't serve the same main ingredient on back-to-back nights.
   - Stick to meals kids usually like, made from ingredients any ordinary supermarket sells.
   - Give 3 to 6 short steps in plain words, and say when a step uses Sunday's prep.
   - Add a tip when it helps a picky eater, like serving the sauce on the side. Otherwise leave the tip empty.

2. ${
    family.lunches
      ? "Lunches for Monday to Friday that are simple and easy to pack. Leftovers from the night before are fine."
      : "No lunches. Leave the lunches list empty."
  }

3. A Sunday prep list: what to wash, chop, marinate or cook on Sunday so weeknights go fast.
   - Group it by the day the prep is for, and leave out days that need no prep.
   - Write each step as one short action of a few words, like "Chop 1 onion" or "Marinate the chicken". Put each action in its own step instead of joining several in one sentence.
   - Only prep ahead what stays safe and fresh until the day it's eaten. For later in the week, add a step to freeze it, or leave it for that day.

4. One grocery list for a single trip: everything the plan needs that isn't already in her fridge, freezer or pantry, with amounts for this household. Group it by store section: Produce, Meat and fish, Dairy and eggs, Bakery, Pantry, Frozen. Leave out empty sections. Assume she already has salt, pepper and cooking oil.`;
}

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

  const client = createClient();
  const started = Date.now();

  try {
    const stream = client.beta.messages.stream({
      model: MODEL,
      max_tokens: 64000,
      betas: [FALLBACK_BETA],
      fallbacks: "default",
      output_config: { effort: "medium", format: betaZodOutputFormat(PlanSchema) },
      messages: [{ role: "user", content: buildPrompt(family) }],
    });
    const response = await stream.finalMessage();

    if (response.stop_reason === "refusal" || !response.parsed_output) {
      return errorResponse("We couldn't make a plan this time. Please try again.", 502);
    }

    const { input_tokens, output_tokens } = response.usage;
    const id = await savePlan({
      family,
      plan: response.parsed_output,
      test: {
        model: response.model,
        inputTokens: input_tokens,
        outputTokens: output_tokens,
        costUsd: estimateCostUsd(response.model, input_tokens, output_tokens),
        seconds: (Date.now() - started) / 1000,
      },
    });
    return Response.json({ id });
  } catch (error) {
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
