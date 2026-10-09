import Anthropic from "@anthropic-ai/sdk";
import { apiKeyProblem, KEY_REJECTED, PLAN_EFFORT } from "@/lib/claude";
import { FamilySchema } from "@/lib/plan-schema";
import { savePlan, StorageNotSetUpError } from "@/lib/plans";
import { writePlan } from "@/lib/write-plan";

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

  try {
    const result = await writePlan(family, PLAN_EFFORT);
    if (!result) {
      return errorResponse("We couldn't make a plan this time. Please try again.", 502);
    }
    const id = await savePlan({ family, plan: result.plan, test: result.test });
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
