// Makes a picture of a dinner with Google's image AI ("Nano Banana"). Claude doesn't make pictures.
// Google renames these models often, so this tries the current ones in order and uses the first
// that answers.

const GOOGLE_API = process.env.GOOGLE_AI_BASE_URL ?? "https://generativelanguage.googleapis.com";
const MODELS = [
  "gemini-nano-banana-2.1",
  "gemini-3.1-flash-image",
  "gemini-3.1-flash-image-preview",
  "gemini-2.5-flash-image",
];
// Roughly what one picture costs, for the admin page's AI cost.
export const PICTURE_COST_USD = 0.05;

export class PictureError extends Error {}

type Picture = { bytes: Buffer; contentType: string; model: string };

// The picture comes back as base64 somewhere in Google's reply. Looks for it wherever it is, since
// the reply's layout has changed between versions.
function findImage(value: unknown): { data: string; mimeType: string } | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const mimeType = record.mimeType ?? record.mime_type;
  if (typeof record.data === "string" && typeof mimeType === "string" && mimeType.startsWith("image/")) {
    return { data: record.data, mimeType };
  }
  for (const child of Object.values(record)) {
    const found = findImage(child);
    if (found) return found;
  }
  return null;
}

function googleMessage(json: unknown) {
  const error = (json as { error?: { message?: string } } | null)?.error;
  return error?.message?.slice(0, 300) ?? "";
}

export function dishPrompt(name: string, ingredients: string[]) {
  return [
    `A realistic, appetizing photo of a home-cooked family dinner: ${name}.`,
    ingredients.length ? `It's made from only these ingredients: ${ingredients.join(", ")}.` : "",
    "Served simply on a plate on a kitchen table, in soft natural light, seen from slightly above.",
    "Show only those foods, with no extra garnishes or side dishes. A wide, landscape picture with no text, people or hands.",
  ]
    .filter(Boolean)
    .join(" ");
}

export async function makePicture(apiKey: string, prompt: string, preferredModel?: string): Promise<Picture> {
  const models = [...new Set([preferredModel, ...MODELS].filter((model): model is string => Boolean(model)))];
  for (const model of models) {
    const response = await fetch(`${GOOGLE_API}/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
      }),
      signal: AbortSignal.timeout(50_000),
    });
    const json = await response.json().catch(() => null);
    const message = googleMessage(json);
    // That model name doesn't exist (any more), or doesn't make pictures: try the next one.
    if (response.status === 404 || (response.status === 400 && /not (found|supported)|does not support/i.test(message))) {
      continue;
    }
    if (!response.ok) throw new PictureError(message || `Google said ${response.status}.`);
    const image = findImage(json);
    if (!image) throw new PictureError("Google answered but didn't send a picture.");
    return { bytes: Buffer.from(image.data, "base64"), contentType: image.mimeType, model };
  }
  throw new PictureError("None of Google's picture models answered. They may have been renamed.");
}
