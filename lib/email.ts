import nodemailer from "nodemailer";

// Sends the login code. Online it goes out from the app's own Gmail account, using an app password
// (or through Resend, if the app later gets its own website name). On your own computer the code is
// printed in the terminal instead.
export class EmailNotSetUpError extends Error {}

function gmail() {
  const user = process.env.GMAIL_USER?.trim();
  // Google shows app passwords in groups of four letters; the spaces don't matter.
  const pass = process.env.GMAIL_APP_PASSWORD?.replace(/\s/g, "");
  return user && pass ? { user, pass } : null;
}

export function emailIsSetUp() {
  return Boolean(process.env.RESEND_API_KEY || gmail()) || !process.env.VERCEL;
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

export async function sendLoginCode(email: string, code: string) {
  const resendKey = process.env.RESEND_API_KEY?.trim();
  const account = gmail();

  if (resendKey) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [email], ...message(code) }),
    });
    if (!response.ok) {
      throw new Error(`Resend said ${response.status}: ${await response.text().catch(() => "")}`);
    }
    return;
  }

  if (account) {
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST ?? "smtp.gmail.com",
      port: Number(process.env.SMTP_PORT ?? 465),
      secure: true,
      auth: account,
    });
    await transport.sendMail({ from: { name: "PlateWise", address: account.user }, to: email, ...message(code) });
    return;
  }

  if (process.env.VERCEL) throw new EmailNotSetUpError();
  console.log(`[local] PlateWise login code for ${email}: ${code}`);
}
