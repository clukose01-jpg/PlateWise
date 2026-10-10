import { z } from "zod";
import { currentAccount } from "@/lib/accounts";
import { MAX_FEEDBACK_LENGTH, saveFeedback } from "@/lib/feedback";
import { requestDeviceId, requestOrigin } from "@/lib/visitor";

const FeedbackRequest = z.object({
  text: z.string().trim().min(1).max(MAX_FEEDBACK_LENGTH),
  email: z.union([z.literal(""), z.email().max(200)]).optional(),
  planId: z.string().max(40).nullable().optional(),
});

// The More tab's "Tell us what you think" box. It goes to the admin page.
export async function POST(request: Request) {
  const parsed = FeedbackRequest.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: `Type a message first (up to ${MAX_FEEDBACK_LENGTH} characters), and check your email if you added one.` },
      { status: 400 },
    );
  }
  const account = await currentAccount(request);
  try {
    await saveFeedback({
      text: parsed.data.text,
      email: parsed.data.email?.trim().toLowerCase() || account?.email,
      origin: requestOrigin(request),
      deviceId: requestDeviceId(request),
      planId: parsed.data.planId ?? undefined,
    });
    return Response.json({ ok: true });
  } catch (error) {
    console.error("Saving feedback failed:", error);
    return Response.json({ error: "We couldn't send that. Please try again." }, { status: 502 });
  }
}
