import { z } from "zod";
import { adminSettings, saveAdminSettings } from "@/lib/admin-settings";
import { compareAllowed } from "@/lib/compare-access";
import { emailIsSetUp } from "@/lib/email";

const NOT_ALLOWED = { error: "That passcode didn't work." };

export async function GET(request: Request) {
  if (!compareAllowed(request)) return Response.json(NOT_ALLOWED, { status: 403 });
  const settings = await adminSettings();
  return Response.json({ weeklyEmailTo: settings.weeklyEmailTo ?? "", emailReady: await emailIsSetUp() });
}

// An empty address turns the Monday email off.
const ChangeSchema = z.object({ weeklyEmailTo: z.union([z.literal(""), z.email().max(200)]) });

export async function PUT(request: Request) {
  if (!compareAllowed(request)) return Response.json(NOT_ALLOWED, { status: 403 });
  const change = ChangeSchema.safeParse(await request.json().catch(() => null));
  if (!change.success) return Response.json({ error: "That doesn't look like an email address." }, { status: 400 });
  try {
    const settings = await saveAdminSettings({ weeklyEmailTo: change.data.weeklyEmailTo.trim() || undefined });
    return Response.json({ weeklyEmailTo: settings.weeklyEmailTo ?? "" });
  } catch (error) {
    console.error("Couldn't save admin settings:", error);
    return Response.json({ error: "Couldn't save. Try again in a minute." }, { status: 502 });
  }
}
