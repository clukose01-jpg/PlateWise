import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { estimateCostUsd, FALLBACK_BETA, MODEL } from "@/lib/claude";

export const maxDuration = 60;

const MAX_PHOTO_BYTES = 4 * 1024 * 1024;
const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
type PhotoType = (typeof PHOTO_TYPES)[number];

const FridgeItems = z.object({
  items: z.array(z.string()),
});

const PROMPT = `This is a photo of the inside of a family's fridge. List the foods you can clearly see that could go into a family lunch or dinner.

- Use short, everyday names a parent would write on a grocery list, like "chicken breasts", "baby spinach" or "cheddar cheese".
- Add an amount in brackets only when you can clearly see it and it matters for cooking, like "eggs (about 6)".
- Include sauces and condiments only when they're useful for cooking a meal, like "soy sauce" or "salsa".
- Skip drinks, except milk.
- If you can't tell what something is, leave it out. The parent will add anything you miss.
- If the photo doesn't show food, return an empty list.`;

const COULD_NOT_READ = "We couldn't read that photo. Try another one, or type what you have.";

function isPhotoType(type: string): type is PhotoType {
  return (PHOTO_TYPES as readonly string[]).includes(type);
}

function errorResponse(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return errorResponse("The app isn't set up yet: ANTHROPIC_API_KEY is missing.", 500);
  }

  const form = await request.formData();
  const photo = form.get("photo");
  if (!(photo instanceof File)) {
    return errorResponse("No photo was sent.", 400);
  }
  if (!isPhotoType(photo.type)) {
    return errorResponse("Please use a JPG or PNG photo.", 415);
  }
  if (photo.size > MAX_PHOTO_BYTES) {
    return errorResponse("That photo is too large. Try a smaller one.", 413);
  }

  const data = Buffer.from(await photo.arrayBuffer()).toString("base64");
  const client = new Anthropic();
  const started = Date.now();

  try {
    const response = await client.beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      betas: [FALLBACK_BETA],
      fallbacks: "default",
      output_config: { effort: "medium", format: betaZodOutputFormat(FridgeItems) },
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: photo.type, data } },
            { type: "text", text: PROMPT },
          ],
        },
      ],
    });

    if (response.stop_reason === "refusal" || !response.parsed_output) {
      return errorResponse(COULD_NOT_READ, 422);
    }

    const items: string[] = [];
    for (const raw of response.parsed_output.items) {
      const item = raw.trim();
      if (item && !items.some((existing) => existing.toLowerCase() === item.toLowerCase())) {
        items.push(item);
      }
    }
    const { input_tokens, output_tokens } = response.usage;

    return Response.json({
      items,
      test: {
        model: response.model,
        inputTokens: input_tokens,
        outputTokens: output_tokens,
        costUsd: estimateCostUsd(response.model, input_tokens, output_tokens),
        seconds: (Date.now() - started) / 1000,
      },
    });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      return errorResponse("The app's ANTHROPIC_API_KEY isn't working. Check it in your settings.", 500);
    }
    if (error instanceof Anthropic.RateLimitError) {
      return errorResponse("Too many scans at once. Wait a minute and try again.", 429);
    }
    if (error instanceof Anthropic.APIError) {
      console.error("Scan failed:", error.status, error.message);
      return errorResponse("Something went wrong. Please try again.", 502);
    }
    // The model's reply didn't match the expected list format.
    console.error("Scan failed:", error);
    return errorResponse(COULD_NOT_READ, 422);
  }
}
