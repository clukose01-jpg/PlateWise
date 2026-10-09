import { loadAccount } from "@/lib/accounts";
import { loginIsSetUp } from "@/lib/auth-routes";
import { sessionAccountId } from "@/lib/session";

// Whether login is switched on, and who's logged in on this device.
export async function GET(request: Request) {
  const id = sessionAccountId(request);
  const account = id ? await loadAccount(id) : null;
  return Response.json({ enabled: await loginIsSetUp(), email: account?.email ?? null });
}
