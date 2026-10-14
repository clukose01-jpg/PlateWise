import { z } from "zod";
import { currentAccount, setName } from "@/lib/accounts";
import { errorResponse } from "@/lib/auth-routes";

const SetName = z.object({ name: z.string().max(200) });

// Adds or changes her first name, shown as "Welcome back" at the top of the app.
export async function POST(request: Request) {
  const account = await currentAccount(request);
  if (!account) return errorResponse("Log in first.", 401);
  const parsed = SetName.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse("That didn't come through. Please try again.", 400);
  try {
    const saved = await setName(account, parsed.data.name);
    return Response.json({ name: saved.name ?? null });
  } catch (error) {
    console.error("Saving name failed:", error);
    return errorResponse("We couldn't save that. Please try again.", 502);
  }
}
