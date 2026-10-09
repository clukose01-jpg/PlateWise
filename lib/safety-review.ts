import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { createClient, estimateCostUsd, FALLBACK_BETA, MODEL } from "./claude";
import type { Problem } from "./food-check";
import type { Family, Plan, TestInfo } from "./plan-schema";

const Review = z.object({
  problems: z.array(
    z.object({
      where: z.string(),
      food: z.string(),
      reason: z.string(),
    }),
  ),
});

function buildReviewPrompt(family: Family, plan: Plan) {
  const kids = family.kids
    .filter((kid) => kid.refuses.trim())
    .map((kid, i) => `- ${kid.name.trim() || `Kid ${i + 1}`} won't eat: ${kid.refuses.trim()}`);
  return `You're double-checking a family's meal plan for food safety before the parent sees it.

Food allergies in this family: ${family.allergies.trim() || "none"}
${kids.length ? `Foods the kids won't eat:\n${kids.join("\n")}` : "The kids eat anything."}

The plan:
${JSON.stringify(plan, null, 1)}

Check every dinner name, tip, step and night-before step, every lunch, every Sunday prep step and every grocery item. Report each place where:
1. A food contains one of the family's allergens. Include hidden sources in common store-bought foods: regular soy sauce, teriyaki sauce, and most bread, buns, tortillas, pasta, noodles, crackers and breadcrumbs contain wheat; pesto usually has nuts and cheese; Worcestershire sauce and Caesar dressing have fish; mayonnaise and aioli have egg; butter, ranch and many sauces have milk; hummus and tahini have sesame.
2. A dinner or lunch uses a food a kid won't eat.

A food written as a safe version is fine, like "gluten-free soy sauce", "dairy-free cheese" or "egg-free mayo". So is a food that's clearly being left out, like "no onions". Report a problem only when the food really contains the allergen or the food a kid won't eat, not when it's a remote possibility. If everything is safe, return an empty list.`;
}

// A second, careful look at the finished plan by Claude, for allergens the word check can't know about.
export async function reviewPlan(family: Family, plan: Plan): Promise<{ problems: Problem[]; test: TestInfo }> {
  const started = Date.now();
  const response = await createClient().beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    betas: [FALLBACK_BETA],
    fallbacks: "default",
    // The safety net thinks more carefully than the planner.
    output_config: { effort: "medium", format: betaZodOutputFormat(Review) },
    messages: [{ role: "user", content: buildReviewPrompt(family, plan) }],
  });
  if (response.stop_reason === "refusal" || !response.parsed_output) {
    throw new Error("The safety review didn't return a result.");
  }
  const { input_tokens, output_tokens } = response.usage;
  return {
    problems: response.parsed_output.problems.map(({ where, food, reason }) => ({
      who: reason,
      food,
      where,
      text: "",
    })),
    test: {
      model: response.model,
      inputTokens: input_tokens,
      outputTokens: output_tokens,
      costUsd: estimateCostUsd(response.model, input_tokens, output_tokens),
      seconds: (Date.now() - started) / 1000,
    },
  };
}
