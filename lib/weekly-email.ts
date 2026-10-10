import type { AdminStats } from "./admin-stats";
import type { Email } from "./email";

// The Monday email: last week's numbers in a few lines, with a link to the admin page.

function money(usd: number) {
  return usd < 1 ? `${(usd * 100).toFixed(1)}¢` : `$${usd.toFixed(2)}`;
}

function plural(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`;
}

function escape(text: string) {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

export function weeklyEmail(stats: AdminStats, to: string, siteUrl: string): Email {
  const t = stats.totals;
  const rows: [string, string][] = [
    ["Plans made", `${t.plansLast7} (${t.plansPrev7} the week before)`],
    ["Dinners made", `${stats.test.madeLast7} (${stats.test.skippedLast7} skipped)`],
    ["New families", String(t.newFamiliesLast7)],
    ["Families who came back", String(t.returningLast7)],
    ["New accounts", String(t.accountsLast7)],
    ["AI cost", money(t.costLast7)],
  ];
  const places = stats.placesLast7
    .map((place) => (place.label === "Everything else" ? `${place.count} elsewhere` : `${place.label} (${place.count})`))
    .join(", ");
  const safety =
    t.blockedLast7 === 0
      ? "The allergy safety check didn't have to stop anything."
      : `The allergy safety check stopped ${plural(t.blockedLast7, "plan or swap", "plans or swaps")} before anyone saw it.`;
  const link = `${siteUrl}/admin`;
  // The newest few messages from the More tab's feedback box, shortened.
  const messages = stats.feedback
    .filter((item) => Date.now() - Date.parse(item.at) < 7 * 24 * 60 * 60 * 1000)
    .slice(0, 3)
    .map((item) => (item.text.length > 200 ? `${item.text.slice(0, 200)}…` : item.text));
  const messagesLine =
    stats.feedbackLast7 === 0
      ? "No new messages from testers."
      : `${plural(stats.feedbackLast7, "new message", "new messages")} from testers${stats.feedbackLast7 > messages.length ? ", the newest:" : ":"}`;

  const text = [
    "Here's how PlateWise did in the last 7 days.",
    "",
    ...rows.map(([label, value]) => `${label}: ${value}`),
    "",
    `Where people were: ${places || "no places yet"}`,
    "",
    safety,
    "",
    messagesLine,
    ...messages.map((message) => `- "${message}"`),
    "",
    `See everything: ${link}`,
  ].join("\n");

  const html = `<div style="font-family:system-ui,sans-serif;font-size:16px;color:#2e2620;max-width:480px">
<p>Here's how PlateWise did in the last 7 days.</p>
<table style="border-collapse:collapse;width:100%;margin:8px 0 16px">
${rows
  .map(
    ([label, value]) =>
      `<tr><td style="padding:6px 12px 6px 0;border-bottom:1px solid #ede1d3">${label}</td><td style="padding:6px 0;border-bottom:1px solid #ede1d3;text-align:right;font-weight:600">${escape(value)}</td></tr>`,
  )
  .join("\n")}
</table>
<p><strong>Where people were:</strong> ${escape(places || "no places yet")}</p>
<p>${safety}</p>
<p>${messagesLine}</p>
${messages.length ? `<ul>${messages.map((message) => `<li>${escape(message)}</li>`).join("")}</ul>` : ""}
<p><a href="${link}" style="color:#4f7a4a;font-weight:600">See everything on the admin page</a></p>
</div>`;

  return {
    to,
    subject: `PlateWise last week: ${plural(t.plansLast7, "plan", "plans")}, ${plural(t.newFamiliesLast7, "new family", "new families")}`,
    text,
    html,
  };
}

// The link in the email goes to the live site, even when a test is sent from a preview.
export function siteUrl(request: Request) {
  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return production ? `https://${production}` : new URL(request.url).origin;
}
