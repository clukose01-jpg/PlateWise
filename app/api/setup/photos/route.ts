import { z } from "zod";
import { compareAllowed } from "@/lib/compare-access";
import { makePicture, PICTURE_COST_USD, PictureError } from "@/lib/dish-photo";
import { logEvent } from "@/lib/events";
import { photoKey, removePhotoKey, savePhotoKey } from "@/lib/photo-settings";
import { sessionSecret } from "@/lib/session";

export const maxDuration = 60;

const NOT_ALLOWED = { error: "That passcode didn't work." };
const SaveRequest = z.object({ apiKey: z.string().trim().min(20).max(200) });
const TEST_PROMPT =
  "A realistic, appetizing photo of a home-cooked family dinner: spaghetti with tomato sauce, served on a plate on a kitchen table, seen from slightly above. A wide, landscape picture with no text, people or hands.";
// A test picture bigger than this isn't sent back to the page, to keep the reply small.
const MAX_PREVIEW_BYTES = 3_000_000;

// Turns Google's reply into what to do about it.
function advice(message: string) {
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

// Whether pictures are on. The key itself is never sent back.
export async function GET(request: Request) {
  if (!compareAllowed(request)) return Response.json(NOT_ALLOWED, { status: 403 });
  const key = await photoKey();
  return Response.json({ on: Boolean(key), fromVercel: Boolean(process.env.GOOGLE_AI_API_KEY), model: key?.model ?? null });
}

// Makes one test picture with the key, then saves it.
export async function POST(request: Request) {
  if (!compareAllowed(request)) return Response.json(NOT_ALLOWED, { status: 403 });
  if (!sessionSecret()) {
    return Response.json({ error: "SESSION_SECRET isn't set in Vercel yet." }, { status: 500 });
  }
  const parsed = SaveRequest.safeParse(await request.json().catch(() => null));
  if (!parsed.success || /\s/.test(parsed.data.apiKey)) {
    return Response.json({ error: "That doesn't look like a Google AI key. It's one long line of letters and numbers." }, { status: 400 });
  }
  try {
    const picture = await makePicture(parsed.data.apiKey, TEST_PROMPT);
    await savePhotoKey(parsed.data.apiKey, picture.model);
    await logEvent({ type: "photo", costUsd: PICTURE_COST_USD });
    const preview =
      picture.bytes.length <= MAX_PREVIEW_BYTES
        ? `data:${picture.contentType};base64,${picture.bytes.toString("base64")}`
        : null;
    return Response.json({ ok: true, model: picture.model, preview });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error("Picture key test failed:", detail);
    return Response.json(
      { error: error instanceof PictureError ? advice(detail) : "Couldn't reach Google. Try again in a minute.", detail },
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
