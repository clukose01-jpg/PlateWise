import { z } from "zod";
import { compareAllowed } from "@/lib/compare-access";
import { cleanAppPassword, testGmail } from "@/lib/email";
import { saveGmail, savedGmail } from "@/lib/email-settings";
import { sessionSecret } from "@/lib/session";

const SaveRequest = z.object({
  user: z.string().trim().max(200).email(),
  appPassword: z.string().max(100),
});

// What's set up so far. The password itself is never sent back.
export async function GET(request: Request) {
  if (!compareAllowed(request)) {
    return Response.json({ error: "That passcode didn't work." }, { status: 403 });
  }
  const saved = await savedGmail();
  return Response.json({
    user: saved?.user ?? process.env.GMAIL_USER ?? "",
    saved: Boolean(saved),
  });
}

// Checks the Gmail address and app password with Google, then saves them.
export async function POST(request: Request) {
  if (!compareAllowed(request)) {
    return Response.json({ error: "That passcode didn't work." }, { status: 403 });
  }
  if (!sessionSecret()) {
    return Response.json({ error: "SESSION_SECRET isn't set in Vercel yet." }, { status: 500 });
  }
  const parsed = SaveRequest.safeParse(await request.json().catch(() => null));
  const pass = parsed.success ? cleanAppPassword(parsed.data.appPassword) : "";
  if (!parsed.success || !/^[a-z]{16}$/i.test(pass)) {
    return Response.json(
      { error: "Check the Gmail address, and paste the 16-letter app password from Google." },
      { status: 400 },
    );
  }
  const account = { user: parsed.data.user.toLowerCase(), pass };
  try {
    await testGmail(account);
  } catch (error) {
    console.error("Gmail test failed:", error instanceof Error ? error.message : error);
    return Response.json(
      {
        error:
          "Google didn't accept that. Check the address is the Gmail you made the app password in, and that you copied all 16 letters.",
      },
      { status: 400 },
    );
  }
  await saveGmail(account);
  return Response.json({ ok: true });
}
