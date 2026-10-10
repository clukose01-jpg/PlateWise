import { createHash } from "node:crypto";
import { dishPrompt, makePicture, PICTURE_COST_USD } from "@/lib/dish-photo";
import { logEvent } from "@/lib/events";
import { photoKey, rememberPhotoModel } from "@/lib/photo-settings";
import { loadPlan } from "@/lib/plans";
import { readBytes, writeBytes } from "@/lib/store";
import { requestDeviceId, requestOrigin } from "@/lib/visitor";

export const maxDuration = 60;

type Context = { params: Promise<{ id: string; day: string }> };

// A day's dinner picture for the Today tab. It's made the first time someone asks for it and saved,
// so each dinner is only paid for once. A swapped dinner has a new name, so it gets a new picture.
export async function GET(request: Request, { params }: Context) {
  const { id, day } = await params;
  const plan = await loadPlan(id);
  const dinner = plan?.plan.dinners.find((d) => d.day === day);
  if (!dinner) return new Response(null, { status: 404 });

  const dish = createHash("sha256").update(dinner.name).digest("hex").slice(0, 12);
  const file = `photos/${id}/${day}-${dish}`;
  const headers = { "Cache-Control": "private, max-age=604800, immutable" };

  const saved = await readBytes(file).catch(() => null);
  if (saved) return new Response(new Uint8Array(saved.bytes), { headers: { ...headers, "Content-Type": saved.contentType } });

  const key = await photoKey();
  if (!key) return new Response(null, { status: 404 });
  try {
    const picture = await makePicture(key.apiKey, dishPrompt(dinner.name, dinner.ingredients ?? []), key.model);
    await writeBytes(file, picture.bytes, picture.contentType);
    if (picture.model !== key.model) await rememberPhotoModel(picture.model).catch(() => {});
    await logEvent({
      type: "photo",
      origin: requestOrigin(request),
      deviceId: requestDeviceId(request),
      costUsd: PICTURE_COST_USD,
    });
    return new Response(new Uint8Array(picture.bytes), { headers: { ...headers, "Content-Type": picture.contentType } });
  } catch (error) {
    console.error("Dinner picture failed:", error);
    return new Response(null, { status: 502 });
  }
}
