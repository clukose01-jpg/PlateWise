import { z } from "zod";
import { currentAccount, deleteAccount } from "@/lib/accounts";
import { errorResponse } from "@/lib/auth-routes";
import { clearedSessionCookie } from "@/lib/session";

const DeleteRequest = z.object({
  // The plans this device made, by plan, in case any never reached the account.
  ownerKeys: z.record(z.string().max(40), z.string().max(100)).catch({}),
});

// "Delete my account" on the Profile tab. This device is logged out afterwards.
export async function POST(request: Request) {
  const account = await currentAccount(request);
  if (!account) return errorResponse("Log in first.", 401);
  const parsed = DeleteRequest.safeParse(await request.json().catch(() => ({})));
  try {
    const result = await deleteAccount(account, parsed.success ? parsed.data.ownerKeys : {});
    return Response.json({ ok: true, ...result }, { headers: { "Set-Cookie": clearedSessionCookie() } });
  } catch (error) {
    console.error("Deleting account failed:", error);
    return errorResponse("We couldn't delete your account. Please try again.", 502);
  }
}
