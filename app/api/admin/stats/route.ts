import { adminStats } from "@/lib/admin-stats";
import { compareAllowed } from "@/lib/compare-access";

// The numbers for the admin page. Like the setup page, it only works with the passcode.
export async function GET(request: Request) {
  if (!compareAllowed(request)) {
    return Response.json({ error: "That passcode didn't work." }, { status: 403 });
  }
  try {
    return Response.json(await adminStats(), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Admin stats failed:", error);
    return Response.json({ error: "Couldn't add up the numbers. Try again in a minute." }, { status: 500 });
  }
}
