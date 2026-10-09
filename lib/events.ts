import { randomBytes } from "node:crypto";
import { writeJson } from "./store";
import type { Origin } from "./visitor";

// Things worth counting on the admin page that aren't saved anywhere else: photo scans, swaps,
// and plans the safety check wouldn't show. One small file each, written after the reply has gone.
export type EventType = "scan" | "swap" | "plan-blocked" | "swap-blocked";

export type AppEvent = {
  type: EventType;
  at: string;
  origin?: Origin;
  deviceId?: string;
  costUsd?: number | null;
};

export async function logEvent(event: Omit<AppEvent, "at">) {
  const at = new Date().toISOString();
  try {
    await writeJson(`events/${at.slice(0, 10)}/${at.replace(/[:.]/g, "-")}-${randomBytes(4).toString("hex")}.json`, {
      ...event,
      at,
    } satisfies AppEvent);
  } catch (error) {
    // Counting is never worth breaking the app over.
    console.error("Couldn't record event:", error);
  }
}
