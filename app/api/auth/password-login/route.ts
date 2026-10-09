import { z } from "zod";
import { AccountDataSchema, EMPTY_DATA, logInWithPassword, normalizeEmail } from "@/lib/accounts";
import { errorResponse, loginIsSetUp } from "@/lib/auth-routes";
import { sessionCookie } from "@/lib/session";

const PasswordLogin = z.object({
  email: z.string().trim().max(200).email(),
  password: z.string().min(1).max(200),
  // What's on this device already, so nothing is lost when she logs in.
  device: AccountDataSchema.catch(EMPTY_DATA),
});

export async function POST(request: Request) {
  if (!(await loginIsSetUp())) {
    return errorResponse("Logging in isn't set up yet.", 503);
  }
  const parsed = PasswordLogin.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return errorResponse("Type your email and password.", 400);
  }
  try {
    const login = await logInWithPassword(normalizeEmail(parsed.data.email), parsed.data.password, parsed.data.device);
    if (login.result !== "ok") {
      return login.result === "locked"
        ? errorResponse("Too many wrong tries. Wait 15 minutes, or get a code by email.", 429)
        : // The same message whether or not the email has an account.
          errorResponse("That email and password don't match. Try again, or get a code by email.", 401);
    }
    return Response.json(
      { email: login.account.email, data: login.account.data, hasPassword: true },
      { headers: { "Set-Cookie": sessionCookie(login.account.id) } },
    );
  } catch (error) {
    console.error("Password login failed:", error);
    return errorResponse("Something went wrong. Please try again.", 502);
  }
}
