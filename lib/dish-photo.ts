import { HIGGSFIELD_MODEL } from "./photo-models";
import type { PhotoKey } from "./photo-settings";

// Makes a picture of a dinner, with Google's image AI ("Nano Banana") or Higgsfield's, whichever has
// a key on the setup page. Claude doesn't make pictures.
//
// Google renames its models often, so this tries the current ones in order and uses the first that
// answers. Higgsfield works on a picture in the background: the app asks for one, then checks back
// every couple of seconds until it's ready.

const GOOGLE_API = process.env.GOOGLE_AI_BASE_URL ?? "https://generativelanguage.googleapis.com";
const HIGGSFIELD_API = process.env.HIGGSFIELD_BASE_URL ?? "https://api.higgsfield.ai";
export { HIGGSFIELD_MODEL } from "./photo-models";
// How long to wait for Higgsfield before giving up on a picture.
const HIGGSFIELD_WAIT_MS = 100_000;
const MODELS = [
  "gemini-nano-banana-2.1",
  "gemini-3.1-flash-image",
  "gemini-3.1-flash-image-preview",
  "gemini-2.5-flash-image",
];
// Roughly what one picture costs, for the admin page's AI cost. Higgsfield's price depends on the
// model; this is about what Flux Kontext Max costs.
export const PICTURE_COST_USD = { google: 0.05, higgsfield: 0.08 } as const;

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

export function makePicture(key: PhotoKey, prompt: string): Promise<Picture> {
  return key.provider === "higgsfield"
    ? makeHiggsfieldPicture(key.apiKey, prompt, key.model || HIGGSFIELD_MODEL)
    : makeGooglePicture(key.apiKey, prompt, key.model);
}

async function makeGooglePicture(apiKey: string, prompt: string, preferredModel?: string): Promise<Picture> {
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

type HiggsfieldRequest = { status?: string; request_id?: string; images?: { url?: string }[]; detail?: unknown };

function higgsfieldMessage(status: number, json: HiggsfieldRequest | null) {
  const detail = (typeof json?.detail === "string" ? json.detail : json?.detail ? JSON.stringify(json.detail) : "").slice(0, 200);
  // Higgsfield's own words go along too, shown on the setup page.
  const theySaid = detail ? ` (${status}: ${detail})` : ` (${status})`;
  if (status === 401) return `Higgsfield says that key isn't right.${theySaid}`;
  if (status === 403) return `Higgsfield says there isn't enough money on the account.${theySaid}`;
  if (status === 404) return `Higgsfield doesn't have that picture model.${theySaid}`;
  return (detail || `Higgsfield said ${status}.`).slice(0, 300);
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// credentials is "KEY_ID:KEY_SECRET", the way Higgsfield's console gives them.
async function makeHiggsfieldPicture(credentials: string, prompt: string, model: string): Promise<Picture> {
  const headers = {
    Authorization: `Key ${credentials}`,
    "Content-Type": "application/json",
    "User-Agent": "PlateWise/1.0 (+https://plate-wise-one.vercel.app)",
  };
  const ask = (body: object) =>
    fetch(`${HIGGSFIELD_API}/${model}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });
  // A wide picture, the shape of the Today screen's frame. Some models don't take a shape, so they
  // get just the description.
  let response = await ask({ prompt, aspect_ratio: "16:9" });
  if (response.status === 422) response = await ask({ prompt });
  let request = (await response.json().catch(() => null)) as HiggsfieldRequest | null;
  if (!response.ok || !request?.request_id) throw new PictureError(higgsfieldMessage(response.status, request));

  const until = Date.now() + HIGGSFIELD_WAIT_MS;
  while (request.status !== "completed") {
    if (request.status === "failed") throw new PictureError("Higgsfield couldn't make the picture.");
    if (request.status === "nsfw") throw new PictureError("Higgsfield's safety filter stopped the picture.");
    if (Date.now() > until) throw new PictureError("Higgsfield took too long to make the picture.");
    await wait(2000);
    const check = await fetch(`${HIGGSFIELD_API}/requests/${request.request_id}/status`, {
      headers,
      signal: AbortSignal.timeout(15_000),
    }).catch(() => null);
    // A hiccup on their side: check again.
    if (!check || check.status >= 500) continue;
    const json = (await check.json().catch(() => null)) as HiggsfieldRequest | null;
    if (!check.ok || !json) throw new PictureError(higgsfieldMessage(check.status, json));
    request = { ...json, request_id: json.request_id ?? request.request_id };
  }

  const url = request.images?.[0]?.url;
  if (!url || !/^https?:\/\//.test(url)) throw new PictureError("Higgsfield finished but didn't send a picture.");
  const image = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  const contentType = image.headers.get("content-type")?.split(";")[0] ?? "";
  if (!image.ok || !contentType.startsWith("image/")) throw new PictureError("Couldn't download Higgsfield's picture.");
  return { bytes: Buffer.from(await image.arrayBuffer()), contentType, model };
}
