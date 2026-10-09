import nodemailer from "nodemailer";
import { type GmailAccount, savedGmail } from "./email-settings";

// Sends login codes and the admin's Monday email. Online they go out from the app's own Gmail
// account, using an app password set in Vercel or saved on the setup page (or through Resend, if the
// app later gets its own website name). On your own computer they're printed in the terminal instead.
export class EmailNotSetUpError extends Error {}

// Google shows app passwords in groups of four letters; the spaces don't matter.
export function cleanAppPassword(text: string) {
  return text.replace(/\s/g, "");
}

async function gmail(): Promise<GmailAccount | null> {
  const user = process.env.GMAIL_USER?.trim();
  const pass = cleanAppPassword(process.env.GMAIL_APP_PASSWORD ?? "");
  if (user && pass) return { user, pass };
  return savedGmail();
}

export async function emailIsSetUp() {
  return Boolean(process.env.RESEND_API_KEY || (await gmail())) || !process.env.VERCEL;
}

function gmailTransport(account: GmailAccount) {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT ?? 465),
    secure: true,
    auth: account,
    connectionTimeout: 15_000,
  });
}

// Signs in to Gmail and sends the account a note, to prove it works before it's saved.
export async function testGmail(account: GmailAccount) {
  await gmailTransport(account).sendMail({
    from: { name: "PlateWise", address: account.user },
    to: account.user,
    subject: "PlateWise can send login codes now",
    text: "This is a test from PlateWise's setup page. Login codes will come from this address.",
  });
}

function message(code: string) {
  return {
    subject: `${code} is your PlateWise code`,
    text: `Your PlateWise login code is ${code}\n\nType it into PlateWise to log in. It works for 10 minutes.\n\nIf you didn't ask for this, you can ignore this email.`,
    html: `<div style="font-family:system-ui,sans-serif;font-size:16px;color:#2e2620">
<p>Your PlateWise login code is</p>
<p style="font-size:32px;font-weight:700;letter-spacing:6px;margin:8px 0 16px">${code}</p>
<p>Type it into PlateWise to log in. It works for 10 minutes.</p>
<p style="color:#75685e;font-size:14px">If you didn't ask for this, you can ignore this email.</p>
</div>`,
  };
}

export type Email = { to: string; subject: string; text: string; html: string };

// Sends one email from the app's Gmail (or Resend). Returns false on your own computer when no
// email account is set up, so the caller can print it instead.
export async function sendEmail(email: Email): Promise<boolean> {
  const resendKey = process.env.RESEND_API_KEY?.trim();
  const account = await gmail();

  if (resendKey) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: process.env.EMAIL_FROM, ...email, to: [email.to] }),
    });
    if (!response.ok) {
      throw new Error(`Resend said ${response.status}: ${await response.text().catch(() => "")}`);
    }
    return true;
  }

  if (account) {
    await gmailTransport(account).sendMail({ from: { name: "PlateWise", address: account.user }, ...email });
    return true;
  }

  if (process.env.VERCEL) throw new EmailNotSetUpError();
  return false;
}

export async function sendLoginCode(email: string, code: string) {
  if (!(await sendEmail({ to: email, ...message(code) }))) {
    console.log(`[local] PlateWise login code for ${email}: ${code}`);
  }
}
