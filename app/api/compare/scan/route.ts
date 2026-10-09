import { apiKeyProblem } from "@/lib/claude";
import { compareAllowed } from "@/lib/compare-access";
import { isPhotoType, scanKitchen, toImageBlocks } from "@/lib/kitchen-scan";
import { MAX_PHOTOS_PER_SCAN } from "@/lib/photo-limits";

export const maxDuration = 120;

// Reads the same photos the way the app does, at the chosen thinking level.
export async function POST(request: Request) {
  if (!compareAllowed(request)) {
    return Response.json({ error: "That passcode didn't work." }, { status: 403 });
  }
  const keyProblem = apiKeyProblem();
  if (keyProblem) {
    return Response.json({ error: keyProblem }, { status: 500 });
  }
  const form = await request.formData();
  const effort = form.get("effort") === "low" ? "low" : "medium";
  const photos = form.getAll("photo").filter((entry): entry is File => entry instanceof File);
  if (photos.length === 0 || photos.length > MAX_PHOTOS_PER_SCAN || !photos.every((p) => isPhotoType(p.type))) {
    return Response.json({ error: `Choose 1 to ${MAX_PHOTOS_PER_SCAN} photos.` }, { status: 400 });
  }
  try {
    const result = await scanKitchen(await toImageBlocks(photos), [], effort);
    if (!result) {
      return Response.json({ error: "Claude couldn't read those photos." }, { status: 422 });
    }
    return Response.json({ seconds: result.test.seconds, costUsd: result.test.costUsd, fresh: result.fresh, pantry: result.pantry });
  } catch (error) {
    console.error("Compare scan failed:", error);
    return Response.json({ error: "Something went wrong reading the photos." }, { status: 502 });
  }
}
