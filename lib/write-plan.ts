import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { createClient, type Effort, estimateCostUsd, FALLBACK_BETA, MODEL } from "./claude";
import { buildPlanPrompt } from "./plan-prompt";
import { type Family, type Plan, PlanSchema, type TestInfo } from "./plan-schema";
import { describeFix, type PlanFix } from "./safe-plan";

// Asks Claude for the week's plan, or to fix one. Returns null if Claude declined or the reply didn't fit.
export async function writePlan(
  family: Family,
  effort: Effort,
  fix?: PlanFix,
): Promise<{ plan: Plan; test: TestInfo } | null> {
  const started = Date.now();
  const stream = createClient().beta.messages.stream({
    model: MODEL,
    max_tokens: 64000,
    betas: [FALLBACK_BETA],
    fallbacks: "default",
    output_config: { effort, format: betaZodOutputFormat(PlanSchema) },
    messages: [{ role: "user", content: buildPlanPrompt(family) + (fix ? describeFix(fix) : "") }],
  });
  const response = await stream.finalMessage();

  if (response.stop_reason === "refusal" || !response.parsed_output) return null;

  const { input_tokens, output_tokens } = response.usage;
  return {
    plan: response.parsed_output,
    test: {
      model: response.model,
      inputTokens: input_tokens,
      outputTokens: output_tokens,
      costUsd: estimateCostUsd(response.model, input_tokens, output_tokens),
      seconds: (Date.now() - started) / 1000,
    },
  };
}
