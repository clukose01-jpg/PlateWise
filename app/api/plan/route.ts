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
import { buildPlanPrompt } from "@/lib/plan-prompt";
import { FamilySchema, PlanSchema } from "@/lib/plan-schema";
import { savePlan, StorageNotSetUpError } from "@/lib/plans";

// Writing a whole week can take a minute or two.
export const maxDuration = 300;

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
      messages: [{ role: "user", content: buildPlanPrompt(family) }],
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
