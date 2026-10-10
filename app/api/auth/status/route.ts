import { currentAccount } from "@/lib/accounts";
import { loginIsSetUp } from "@/lib/auth-routes";

// Whether login is switched on, and who's logged in on this device.
export async function GET(request: Request) {
  const account = await currentAccount(request);
  return Response.json({
    enabled: await loginIsSetUp(),
    email: account?.email ?? null,
    hasPassword: Boolean(account?.passwordHash),
  });
}
