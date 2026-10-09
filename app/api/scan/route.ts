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
import { MAX_PHOTOS_PER_SCAN } from "@/lib/photo-limits";

export const maxDuration = 120;

// The hosting service rejects uploads over 4.5 MB.
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
type PhotoType = (typeof PHOTO_TYPES)[number];

const FridgeItems = z.object({
  items: z.array(z.string()),
});

// Foods already on her list, so a new photo only adds what's new.
const KnownItems = z.array(z.string().max(100)).max(80);

function buildPrompt(photoCount: number, known: string[]) {
  const intro =
    photoCount === 1
      ? "This is a photo of part of a family's fridge, freezer or pantry."
      : `These are ${photoCount} photos of a family's fridge, freezer or pantry, showing different shelves or areas.`;

  return `${intro} List the foods you can clearly see that could go into a family lunch or dinner.

- Use short, everyday names a parent would write on a grocery list, like "chicken breasts", "baby spinach" or "cheddar cheese".
- List each food once, even if it shows up in more than one photo.
- Add an amount in brackets only when you can clearly see it and it matters for cooking, like "eggs (about 6)".
- Include sauces and condiments only when they're useful for cooking a meal, like "soy sauce" or "salsa".
- Skip drinks, except milk.
- If you can't tell what something is, leave it out. The parent will add anything you miss.
- If the photos don't show food, return an empty list.${
    known.length
      ? `\n- These foods are already on her list, so leave them out, along with close variants of them: ${known.join(", ")}.`
      : ""
  }`;
}

const COULD_NOT_READ = "We couldn't read that photo. Try another one, or type what you have.";

function isPhotoType(type: string): type is PhotoType {
  return (PHOTO_TYPES as readonly string[]).includes(type);
}

function errorResponse(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

function parseKnown(value: FormDataEntryValue | null): string[] {
  try {
    const parsed = KnownItems.safeParse(JSON.parse(String(value ?? "[]")));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

export async function POST(request: Request) {
  const keyProblem = apiKeyProblem();
  if (keyProblem) {
    return errorResponse(keyProblem, 500);
  }

  const form = await request.formData();
  const photos = form.getAll("photo").filter((entry): entry is File => entry instanceof File);
  if (photos.length === 0) {
    return errorResponse("No photo was sent.", 400);
  }
  if (photos.length > MAX_PHOTOS_PER_SCAN) {
    return errorResponse(`Please choose up to ${MAX_PHOTOS_PER_SCAN} photos at a time.`, 400);
  }
  if (!photos.every((photo) => isPhotoType(photo.type))) {
    return errorResponse("Please use JPG or PNG photos.", 415);
  }
  if (photos.reduce((total, photo) => total + photo.size, 0) > MAX_UPLOAD_BYTES) {
    return errorResponse("Those photos are too large. Try fewer at a time.", 413);
  }
  const known = parseKnown(form.get("known"));

  const images: Anthropic.Beta.BetaImageBlockParam[] = await Promise.all(
    photos.map(async (photo) => ({
      type: "image" as const,
      source: {
        type: "base64" as const,
        media_type: photo.type as PhotoType,
        data: Buffer.from(await photo.arrayBuffer()).toString("base64"),
      },
    })),
  );

  const client = createClient();
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
          content: [...images, { type: "text", text: buildPrompt(photos.length, known) }],
        },
      ],
    });

    if (response.stop_reason === "refusal" || !response.parsed_output) {
      return errorResponse(COULD_NOT_READ, 422);
    }

    // Leave out anything already on her list, and repeats within this scan.
    const seen = known.map((item) => item.toLowerCase());
    const items: string[] = [];
    for (const raw of response.parsed_output.items) {
      const item = raw.trim();
      if (item && !seen.includes(item.toLowerCase())) {
        seen.push(item.toLowerCase());
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
      console.error("Scan failed: Claude rejected the API key:", error.message);
      return errorResponse(KEY_REJECTED, 500);
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
