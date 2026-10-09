import { z } from "zod";
import { compareAllowed } from "@/lib/compare-access";
import { cleanAppPassword, testGmail } from "@/lib/email";
import { saveGmail, savedGmail } from "@/lib/email-settings";
import { sessionSecret } from "@/lib/session";

// Turns Gmail's reply into what to do about it. Gmail's replies never include the password.
function explain(error: unknown) {
  const detail =
    error instanceof Error
      ? [error.message, (error as { response?: string }).response, (error as { code?: string }).code]
          .filter(Boolean)
          .join(" ")
      : String(error);
  let advice =
    "Google didn't accept it. Check the address is the Gmail you made the app password in, and that you copied all 16 letters.";
  if (/5\.7\.9|Application-specific password required/i.test(detail)) {
    advice =
      "Google wants an app password here, not the Gmail password. Make one at myaccount.google.com/apppasswords while signed in to this Gmail.";
  } else if (/5\.7\.8|Username and Password not accepted|BadCredentials|Invalid login/i.test(detail)) {
    advice =
      "Google said the address or app password is wrong. Make sure you created the app password while signed in to this Gmail (not another one), then copy all 16 letters.";
  } else if (/5\.7\.14|log in via your web browser|WebLoginRequired/i.test(detail)) {
    advice =
      "Google blocked the sign-in as unusual. Sign in to this Gmail in a browser, approve any security alert, wait a few minutes, then try again.";
  } else if (/ETIMEDOUT|ECONNREFUSED|ECONNRESET|ENOTFOUND|ESOCKET|timeout/i.test(detail)) {
    advice = "PlateWise couldn't reach Gmail just now. Try again in a minute.";
  }
  return { advice, detail: detail.replace(/\s+/g, " ").slice(0, 300) };
}

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
      {
        error:
          "That isn't an app password. It should be 16 letters from myaccount.google.com/apppasswords, not your Gmail password.",
      },
      { status: 400 },
    );
  }
  const account = { user: parsed.data.user.toLowerCase(), pass };
  try {
    await testGmail(account);
  } catch (error) {
    const { advice, detail } = explain(error);
    console.error("Gmail test failed:", detail);
    return Response.json({ error: advice, detail }, { status: 400 });
  }
  await saveGmail(account);
  return Response.json({ ok: true });
}
