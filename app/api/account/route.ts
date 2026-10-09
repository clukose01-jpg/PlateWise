import { z } from "zod";
import { AccountDataSchema, loadAccount, saveAccountData, withLivePlan } from "@/lib/accounts";
import { errorResponse } from "@/lib/auth-routes";
import { sessionAccountId } from "@/lib/session";

const MAX_BODY_BYTES = 200_000;

async function currentAccount(request: Request) {
  const id = sessionAccountId(request);
  return id ? loadAccount(id) : null;
}

// Everything saved to her account, for a device that just opened the app.
export async function GET(request: Request) {
  const account = await currentAccount(request);
  if (!account) return errorResponse("Not logged in.", 401);
  // If her current plan was deleted on another device, open to her newest plan that still exists.
  const { data, changed } = await withLivePlan(account.data);
  if (changed) await saveAccountData(account, data);
  return Response.json({ email: account.email, data });
}

// Saves this device's copy after a change, like a new rating or pantry item.
export async function PUT(request: Request) {
  const account = await currentAccount(request);
  if (!account) return errorResponse("Not logged in.", 401);
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return errorResponse("That's too much to save at once.", 413);
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return errorResponse("That didn't come through.", 400);
  }
  const parsed = z.object({ data: AccountDataSchema }).safeParse(body);
  if (!parsed.success) return errorResponse("That didn't come through.", 400);
  try {
    await saveAccountData(account, parsed.data.data);
    return Response.json({ ok: true });
  } catch (error) {
    console.error("Saving account failed:", error);
    return errorResponse("We couldn't save that. It'll try again next time.", 502);
  }
}
