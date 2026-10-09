import { adminSettings, saveAdminSettings } from "@/lib/admin-settings";
import { adminStats } from "@/lib/admin-stats";
import { compareAllowed } from "@/lib/compare-access";
import { EmailNotSetUpError, sendEmail } from "@/lib/email";
import { siteUrl, weeklyEmail } from "@/lib/weekly-email";

export const maxDuration = 60;

async function send(to: string, request: Request) {
  const email = weeklyEmail(await adminStats(), to, siteUrl(request));
  if (!(await sendEmail(email))) console.log(`[local] Monday email to ${to}: ${email.subject}\n${email.text}`);
}

// Called every Monday morning by Vercel's schedule (see vercel.json). Only Vercel knows the secret.
export async function GET(request: Request) {
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Not allowed." }, { status: 401 });
  }
  const settings = await adminSettings();
  if (!settings.weeklyEmailTo) return Response.json({ sent: false, reason: "No address saved." });
  // Vercel can call twice; only one email a day.
  const today = new Date().toISOString().slice(0, 10);
  if (settings.lastWeeklySentOn === today) return Response.json({ sent: false, reason: "Already sent today." });
  try {
    await send(settings.weeklyEmailTo, request);
    await saveAdminSettings({ lastWeeklySentOn: today });
    return Response.json({ sent: true });
  } catch (error) {
    console.error("Monday email failed:", error);
    return Response.json({ sent: false, reason: "Sending failed." }, { status: 502 });
  }
}

// The admin page's "Send me one now" button.
export async function POST(request: Request) {
  if (!compareAllowed(request)) return Response.json({ error: "That passcode didn't work." }, { status: 403 });
  const { weeklyEmailTo } = await adminSettings();
  if (!weeklyEmailTo) return Response.json({ error: "Save an email address first." }, { status: 400 });
  try {
    await send(weeklyEmailTo, request);
    return Response.json({ sentTo: weeklyEmailTo });
  } catch (error) {
    console.error("Monday email test failed:", error);
    const message =
      error instanceof EmailNotSetUpError
        ? "Email isn't set up yet. Set up the Gmail account on the setup page first."
        : "Gmail didn't send it. Try again in a minute.";
    return Response.json({ error: message }, { status: 502 });
  }
}
