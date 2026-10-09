import { z } from "zod";
import { StorageNotSetUpError } from "@/lib/plans";
import {
  DEFAULT_TIME_ZONE,
  deleteReminder,
  pushIsSetUp,
  saveReminder,
  SubscriptionSchema,
  TimeZoneSchema,
} from "@/lib/reminders";

const TurnOn = z.object({
  subscription: SubscriptionSchema,
  planId: z.string().max(40),
  // Older versions of the app didn't send it; those sign-ups were all in Eastern time.
  timeZone: TimeZoneSchema.catch(DEFAULT_TIME_ZONE),
});
const TurnOff = z.object({ endpoint: z.string().max(1000) });

function errorResponse(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

// The public half of the reminder key, which phones need to sign up.
export async function GET() {
  if (!pushIsSetUp()) {
    return errorResponse("Reminders aren't set up on this app yet.", 503);
  }
  return Response.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
}

// Turns reminders on for a phone, or updates which plan and time zone they follow.
export async function POST(request: Request) {
  const parsed = TurnOn.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return errorResponse("That didn't come through. Please try again.", 400);
  }
  try {
    await saveReminder(parsed.data.subscription, parsed.data.planId, parsed.data.timeZone);
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof StorageNotSetUpError) {
      return errorResponse("The app can't save reminders yet: connect a Blob store in Vercel.", 500);
    }
    console.error("Saving reminder failed:", error);
    return errorResponse("Something went wrong. Please try again.", 502);
  }
}

export async function DELETE(request: Request) {
  const parsed = TurnOff.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return errorResponse("That didn't come through. Please try again.", 400);
  }
  await deleteReminder(parsed.data.endpoint);
  return Response.json({ ok: true });
}
