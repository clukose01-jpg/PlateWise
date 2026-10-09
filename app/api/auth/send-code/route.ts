import { z } from "zod";
import { newLoginCode, normalizeEmail, TooManyCodesError } from "@/lib/accounts";
import { errorResponse, loginIsSetUp } from "@/lib/auth-routes";
import { sendLoginCode } from "@/lib/email";

const SendCode = z.object({ email: z.string().trim().max(200).email() });

// Emails a 6-digit login code. It says the same thing whether or not the email has an account.
export async function POST(request: Request) {
  if (!loginIsSetUp()) {
    return errorResponse("Logging in isn't set up yet.", 503);
  }
  const parsed = SendCode.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return errorResponse("That email doesn't look right. Check it and try again.", 400);
  }
  const email = normalizeEmail(parsed.data.email);
  try {
    const code = await newLoginCode(email);
    await sendLoginCode(email, code);
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof TooManyCodesError) {
      return errorResponse("We just sent you a code. Check your email, or wait a minute and try again.", 429);
    }
    console.error("Sending login code failed:", error);
    return errorResponse("We couldn't send the email. Please try again.", 502);
  }
}
