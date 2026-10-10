import { randomBytes } from "node:crypto";
import { listNames, readMany, writeJson } from "./store";
import type { Origin } from "./visitor";

// What testers type in the More tab's feedback box, for the admin page. One small file each.
export type Feedback = {
  text: string;
  at: string;
  // Who to reply to: the email she typed, or the account she's logged in with.
  email?: string;
  origin?: Origin;
  deviceId?: string;
  planId?: string;
};

export const MAX_FEEDBACK_LENGTH = 2000;

export async function saveFeedback(feedback: Omit<Feedback, "at">) {
  const at = new Date().toISOString();
  await writeJson(`feedback/${at.slice(0, 10)}/${at.replace(/[:.]/g, "-")}-${randomBytes(4).toString("hex")}.json`, {
    ...feedback,
    at,
  } satisfies Feedback);
}

export async function allFeedback(): Promise<Feedback[]> {
  const feedback = await readMany<Feedback>(await listNames("feedback/"));
  return feedback.sort((a, b) => b.at.localeCompare(a.at));
}
