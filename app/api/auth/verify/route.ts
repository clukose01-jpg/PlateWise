import { z } from "zod";
import { AccountDataSchema, checkLoginCode, EMPTY_DATA, logIn, normalizeEmail } from "@/lib/accounts";
import { errorResponse, loginIsSetUp } from "@/lib/auth-routes";
import { sessionCookie } from "@/lib/session";

const Verify = z.object({
  email: z.string().trim().max(200).email(),
  code: z.string().trim().regex(/^\d{6}$/),
  // What's on this device already, so nothing is lost when she logs in.
  device: AccountDataSchema.catch(EMPTY_DATA),
});

export async function POST(request: Request) {
  if (!loginIsSetUp()) {
    return errorResponse("Logging in isn't set up yet.", 503);
  }
  const parsed = Verify.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return errorResponse("Type the 6-digit code from the email.", 400);
  }
  const email = normalizeEmail(parsed.data.email);
  const result = await checkLoginCode(email, parsed.data.code);
  if (result === "wrong") {
    return errorResponse("That code isn't right. Check the email and try again.", 401);
  }
  if (result === "expired") {
    return errorResponse("That code has expired. Tap \"Send a new code\".", 401);
  }
  try {
    const account = await logIn(email, parsed.data.device);
    return Response.json(
      { email: account.email, data: account.data },
      { headers: { "Set-Cookie": sessionCookie(account.id) } },
    );
  } catch (error) {
    console.error("Logging in failed:", error);
    return errorResponse("Something went wrong. Please try again.", 502);
  }
}
