import { z } from "zod";
import { compareAllowed } from "@/lib/compare-access";
import { HIGGSFIELD_MODEL, makePicture, PICTURE_COST_USD, PictureError } from "@/lib/dish-photo";
import { logEvent } from "@/lib/events";
import { type PhotoKey, photoKey, removePhotoKey, savePhotoKey } from "@/lib/photo-settings";
import { sessionSecret } from "@/lib/session";

// Higgsfield can take a minute or so to make the test picture.
export const maxDuration = 120;

const NOT_ALLOWED = { error: "That passcode didn't work." };
const SaveRequest = z.discriminatedUnion("provider", [
  z.object({ provider: z.literal("google"), apiKey: z.string().trim().min(20).max(200) }),
  z.object({
    provider: z.literal("higgsfield"),
    keyId: z.string().trim().max(400),
    keySecret: z.string().trim().max(400).default(""),
    model: z.string().trim().max(120).optional(),
  }),
]);
const TEST_PROMPT =
  "A realistic, appetizing photo of a home-cooked family dinner: spaghetti with tomato sauce, served on a plate on a kitchen table, seen from slightly above. A wide, landscape picture with no text, people or hands.";
// A test picture bigger than this isn't sent back to the page, to keep the reply small.
const MAX_PREVIEW_BYTES = 3_000_000;

// Turns Google's reply into what to do about it.
function googleAdvice(message: string) {
  if (/api key not valid|invalid api key|API_KEY_INVALID/i.test(message)) {
    return "Google says that key isn't right. Copy it again from aistudio.google.com/apikey, all of it.";
  }
  if (/billing|quota|RESOURCE_EXHAUSTED|exceeded|free tier|429/i.test(message)) {
    return "Google says making pictures needs billing turned on for this key. In Google AI Studio, open Billing, add a payment method, then try again.";
  }
  if (/permission|denied|403/i.test(message)) {
    return "Google says this key isn't allowed to make pictures. Make a new key in Google AI Studio and try again.";
  }
  return "Google didn't make the test picture.";
}

function higgsfieldAdvice(message: string) {
  if (/key isn't right/.test(message)) {
    return "Higgsfield says that key isn't right. Copy the Key ID and the Secret again from the Higgsfield console.";
  }
  if (/enough money/.test(message)) {
    return "Higgsfield says there's no money on the account yet. In the Higgsfield console, add some to your balance, then try again.";
  }
  if (/doesn't have that picture model/.test(message)) {
    return "Higgsfield doesn't know that picture model. Check its name in Higgsfield's catalog, or leave the model box as it was.";
  }
  if (/safety filter/.test(message)) return "Higgsfield's safety filter stopped the test picture. Try again.";
  return "Higgsfield didn't make the test picture.";
}

// Higgsfield's key is a Key ID and a Secret, sent as "KEY_ID:KEY_SECRET". Its console can show them
// as one line with a colon, which can be pasted into either box.
function higgsfieldCredentials(keyId: string, keySecret: string): string | null {
  const id = keyId.trim();
  const secret = keySecret.trim();
  let parts: [string, string] | null = null;
  if (id.includes(":")) {
    const [first, ...rest] = id.split(":");
    parts = [first, rest.join(":")];
  } else if (secret.startsWith(`${id}:`)) {
    parts = [id, secret.slice(id.length + 1)];
  } else if (!id && secret.includes(":")) {
    const [first, ...rest] = secret.split(":");
    parts = [first, rest.join(":")];
  } else {
    parts = [id, secret];
  }
  const [cleanId, cleanSecret] = parts.map((part) => part.trim());
  if (cleanId.length < 4 || cleanSecret.length < 4 || /[\s:]/.test(cleanId) || /\s/.test(cleanSecret)) return null;
  return `${cleanId}:${cleanSecret}`;
}

// Whether pictures are on, and with whom. The key itself is never sent back.
export async function GET(request: Request) {
  if (!compareAllowed(request)) return Response.json(NOT_ALLOWED, { status: 403 });
  const key = await photoKey();
  return Response.json({
    on: Boolean(key),
    provider: key?.provider ?? null,
    fromVercel: Boolean(key?.fromVercel),
    model: key?.model ?? null,
  });
}

// Makes one test picture with the key, then saves it.
export async function POST(request: Request) {
  if (!compareAllowed(request)) return Response.json(NOT_ALLOWED, { status: 403 });
  if (!sessionSecret()) {
    return Response.json({ error: "SESSION_SECRET isn't set in Vercel yet." }, { status: 500 });
  }
  const parsed = SaveRequest.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Something's missing. Paste the key again." }, { status: 400 });
  }
  const body = parsed.data;
  let key: PhotoKey;
  if (body.provider === "google") {
    if (/\s/.test(body.apiKey)) {
      return Response.json({ error: "That doesn't look like a Google AI key. It's one long line of letters and numbers." }, { status: 400 });
    }
    key = { provider: "google", apiKey: body.apiKey };
  } else {
    const credentials = higgsfieldCredentials(body.keyId, body.keySecret);
    if (!credentials) {
      return Response.json(
        { error: "That doesn't look like a Higgsfield key. Paste the Key ID and the Secret, or the whole key line with the colon in it." },
        { status: 400 },
      );
    }
    const model = body.model?.replace(/^\/+/, "") || HIGGSFIELD_MODEL;
    if (!/^[\w.\-/]+$/.test(model)) {
      return Response.json({ error: "That model name doesn't look right. Leave the box as it was to use the usual one." }, { status: 400 });
    }
    key = { provider: "higgsfield", apiKey: credentials, model };
  }
  const name = key.provider === "google" ? "Google" : "Higgsfield";
  try {
    const picture = await makePicture(key, TEST_PROMPT);
    await savePhotoKey(key.provider, key.apiKey, picture.model);
    await logEvent({ type: "photo", costUsd: PICTURE_COST_USD[key.provider] });
    const preview =
      picture.bytes.length <= MAX_PREVIEW_BYTES
        ? `data:${picture.contentType};base64,${picture.bytes.toString("base64")}`
        : null;
    return Response.json({ ok: true, provider: key.provider, model: picture.model, preview });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error("Picture key test failed:", detail);
    const advice = key.provider === "google" ? googleAdvice(detail) : higgsfieldAdvice(detail);
    return Response.json(
      { error: error instanceof PictureError ? advice : `Couldn't reach ${name}. Try again in a minute.`, detail, provider: key.provider },
      { status: 400 },
    );
  }
}

// Turns pictures off.
export async function DELETE(request: Request) {
  if (!compareAllowed(request)) return Response.json(NOT_ALLOWED, { status: 403 });
  await removePhotoKey();
  return Response.json({ ok: true });
}
