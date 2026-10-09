import { z } from "zod";
import { loadAccount, setPassword } from "@/lib/accounts";
import { errorResponse } from "@/lib/auth-routes";
import { MIN_PASSWORD_LENGTH } from "@/lib/passwords";
import { sessionAccountId } from "@/lib/session";

const SetPassword = z.object({ password: z.string().max(200) });

// Creates or changes her password. She has to be logged in, which means she proved the email is
// hers with a code (or already knew the password).
export async function POST(request: Request) {
  const id = sessionAccountId(request);
  const account = id ? await loadAccount(id) : null;
  if (!account) return errorResponse("Log in first.", 401);
  const parsed = SetPassword.safeParse(await request.json().catch(() => null));
  if (!parsed.success || parsed.data.password.length < MIN_PASSWORD_LENGTH) {
    return errorResponse(`Use at least ${MIN_PASSWORD_LENGTH} characters.`, 400);
  }
  if (parsed.data.password.trim().toLowerCase() === account.email) {
    return errorResponse("Pick something other than your email.", 400);
  }
  try {
    await setPassword(account, parsed.data.password);
    return Response.json({ ok: true });
  } catch (error) {
    console.error("Setting password failed:", error);
    return errorResponse("We couldn't save that. Please try again.", 502);
  }
}
