import Anthropic from "@anthropic-ai/sdk";
import { apiKeyProblem, KEY_REJECTED, SCAN_EFFORT } from "@/lib/claude";
import { isPhotoType, KnownItems, scanKitchen, toImageBlocks } from "@/lib/kitchen-scan";
import { MAX_PHOTOS_PER_SCAN } from "@/lib/photo-limits";

export const maxDuration = 120;

// The hosting service rejects uploads over 4.5 MB.
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

const COULD_NOT_READ = "We couldn't read that photo. Try another one, or type what you have.";

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

  try {
    const result = await scanKitchen(await toImageBlocks(photos), known, SCAN_EFFORT);
    if (!result) {
      return errorResponse(COULD_NOT_READ, 422);
    }
    return Response.json(result);
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
