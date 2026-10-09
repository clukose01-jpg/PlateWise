// Sends the login code. Online it goes through Resend (resend.com); on your own computer the code
// is printed in the terminal instead.
export class EmailNotSetUpError extends Error {}

export function emailIsSetUp() {
  return Boolean(process.env.RESEND_API_KEY) || !process.env.VERCEL;
}

export async function sendLoginCode(email: string, code: string) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    if (process.env.VERCEL) throw new EmailNotSetUpError();
    console.log(`[local] PlateWise login code for ${email}: ${code}`);
    return;
  }
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey.trim()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM ?? "PlateWise <login@tryplatewise.com>",
      to: [email],
      subject: `${code} is your PlateWise code`,
      text: `Your PlateWise login code is ${code}\n\nType it into PlateWise to log in. It works for 10 minutes.\n\nIf you didn't ask for this, you can ignore this email.`,
      html: `<div style="font-family:system-ui,sans-serif;font-size:16px;color:#2e2620">
<p>Your PlateWise login code is</p>
<p style="font-size:32px;font-weight:700;letter-spacing:6px;margin:8px 0 16px">${code}</p>
<p>Type it into PlateWise to log in. It works for 10 minutes.</p>
<p style="color:#75685e;font-size:14px">If you didn't ask for this, you can ignore this email.</p>
</div>`,
    }),
  });
  if (!response.ok) {
    throw new Error(`Resend said ${response.status}: ${await response.text().catch(() => "")}`);
  }
}
