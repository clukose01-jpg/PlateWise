import type Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { createClient, type Effort, estimateCostUsd, FALLBACK_BETA, MODEL } from "./claude";
import type { TestInfo } from "./plan-schema";

export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
export type PhotoType = (typeof PHOTO_TYPES)[number];

export function isPhotoType(type: string): type is PhotoType {
  return (PHOTO_TYPES as readonly string[]).includes(type);
}

// "pantry" foods are remembered on her device for next week; "fresh" ones are for this week only.
const KitchenItems = z.object({
  items: z.array(z.object({ name: z.string(), kind: z.enum(["fresh", "pantry"]) })),
});

// Foods already on her lists, so a new photo only adds what's new.
export const KnownItems = z.array(z.string().max(100)).max(160);

function buildPrompt(photoCount: number, known: string[]) {
  const intro =
    photoCount === 1
      ? "This is a photo of part of a family's kitchen: a fridge shelf, the freezer or the pantry."
      : `These are ${photoCount} photos of a family's kitchen, showing different fridge shelves, the freezer or the pantry.`;

  return `${intro} List the foods you can clearly see that could go into a family lunch or dinner.

- Use short, everyday names a parent would write on a grocery list, like "chicken breasts", "baby spinach" or "cheddar cheese".
- List each food once, even if it shows up in more than one photo.
- Add an amount in brackets only when you can clearly see it and it matters for cooking, like "eggs (about 6)".
- Include sauces and condiments only when they're useful for cooking a meal, like "soy sauce" or "salsa".
- Skip drinks, except milk.
- If you can't tell what something is, leave it out. The parent will add anything you miss.
- Mark each food as "pantry" or "fresh":
  - "pantry" is for long-lasting staples a family keeps stocked for weeks, like dry pasta, rice, flour, canned and jarred food, spices, oils, sauces and condiments, and frozen vegetables.
  - "fresh" is for food that gets used up within a week or two, like fruit, vegetables, meat, fish, dairy, eggs, bread, leftovers and frozen meat.
- If the photos don't show food, return an empty list.${
    known.length
      ? `\n- These foods are already on her list, so leave them out, along with close variants of them: ${known.join(", ")}.`
      : ""
  }`;
}

export type KitchenScan = { fresh: string[]; pantry: string[]; test: TestInfo };

// Asks Claude what food is in the photos. Returns null if Claude declined or found nothing usable.
export async function scanKitchen(
  images: Anthropic.Beta.BetaImageBlockParam[],
  known: string[],
  effort: Effort,
): Promise<KitchenScan | null> {
  const started = Date.now();
  const response = await createClient().beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    betas: [FALLBACK_BETA],
    fallbacks: "default",
    output_config: { effort, format: betaZodOutputFormat(KitchenItems) },
    messages: [
      {
        role: "user",
        content: [...images, { type: "text", text: buildPrompt(images.length, known) }],
      },
    ],
  });

  if (response.stop_reason === "refusal" || !response.parsed_output) return null;

  // Leave out anything already on her lists, and repeats within this scan.
  const seen = known.map((item) => item.toLowerCase());
  const fresh: string[] = [];
  const pantry: string[] = [];
  for (const { name, kind } of response.parsed_output.items) {
    const item = name.trim();
    if (item && !seen.includes(item.toLowerCase())) {
      seen.push(item.toLowerCase());
      (kind === "pantry" ? pantry : fresh).push(item);
    }
  }
  const { input_tokens, output_tokens } = response.usage;
  return {
    fresh,
    pantry,
    test: {
      model: response.model,
      inputTokens: input_tokens,
      outputTokens: output_tokens,
      costUsd: estimateCostUsd(response.model, input_tokens, output_tokens),
      seconds: (Date.now() - started) / 1000,
    },
  };
}

// Turns uploaded photos into what Claude reads.
export async function toImageBlocks(photos: File[]): Promise<Anthropic.Beta.BetaImageBlockParam[]> {
  return Promise.all(
    photos.map(async (photo) => ({
      type: "image" as const,
      source: {
        type: "base64" as const,
        media_type: photo.type as PhotoType,
        data: Buffer.from(await photo.arrayBuffer()).toString("base64"),
      },
    })),
  );
}
