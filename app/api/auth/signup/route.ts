import { z } from "zod";
import { AccountDataSchema, EMPTY_DATA, normalizeEmail, signUp } from "@/lib/accounts";
import { errorResponse, loginIsSetUp } from "@/lib/auth-routes";
import { MIN_PASSWORD_LENGTH } from "@/lib/passwords";
import { sessionCookie } from "@/lib/session";

const SignUpRequest = z.object({
  email: z.string().trim().max(200).email(),
  password: z.string().max(200),
  // What's on this device already, so nothing is lost when she makes the account.
  device: AccountDataSchema.catch(EMPTY_DATA),
});

// Makes a new account with an email and password, and logs this device in. No code needed.
export async function POST(request: Request) {
  if (!(await loginIsSetUp())) {
    return errorResponse("Accounts aren't set up yet.", 503);
  }
  const parsed = SignUpRequest.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return errorResponse("That email doesn't look right. Check it and try again.", 400);
  }
  const email = normalizeEmail(parsed.data.email);
  const { password } = parsed.data;
  if (password.length < MIN_PASSWORD_LENGTH) {
    return errorResponse(`Use at least ${MIN_PASSWORD_LENGTH} characters for your password.`, 400);
  }
  if (password.trim().toLowerCase() === email) {
    return errorResponse("Pick a password other than your email.", 400);
  }
  try {
    const result = await signUp(email, password, parsed.data.device);
    if (result.result === "exists") {
      return Response.json(
        { error: "There's already an account with this email. Log in instead.", exists: true },
        { status: 409 },
      );
    }
    return Response.json(
      { email: result.account.email, data: result.account.data, hasPassword: true },
      { headers: { "Set-Cookie": sessionCookie(result.account.id) } },
    );
  } catch (error) {
    console.error("Sign up failed:", error);
    return errorResponse("Something went wrong. Please try again.", 502);
  }
}
