"use client";

import { useEffect, useState } from "react";
import { getCurrentPlanId } from "@/lib/device";
import {
  changeReminderHour,
  pushSupported,
  remindersOn,
  savedReminderHour,
  sendTestReminder,
  turnOffReminders,
  turnOnReminders,
} from "@/lib/push-client";
import { DEFAULT_REMINDER_HOUR, hourLabel, REMINDER_HOURS } from "@/lib/reminder-times";

type Setup = "loading" | "iphone-browser" | "unsupported" | "no-plan" | "ready";

export default function ReminderSettings() {
  const [setup, setSetup] = useState<Setup>("loading");
  const [on, setOn] = useState(false);
  const [planId, setPlanId] = useState<string | null>(null);
  const [hour, setHour] = useState(DEFAULT_REMINDER_HOUR);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const iphone = /iPhone|iPad|iPod/.test(navigator.userAgent);
    const installed =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    const plan = getCurrentPlanId();
    setPlanId(plan);
    setOn(remindersOn());
    setHour(savedReminderHour());
    // Apple only allows reminders from PlateWise once it's on the home screen.
    if (iphone && !installed) setSetup("iphone-browser");
    else if (!pushSupported()) setSetup("unsupported");
    else if (!plan) setSetup("no-plan");
    else setSetup("ready");
  }, []);

  async function run(action: () => Promise<void>, done: string) {
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      await action();
      setStatus(done);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
      setOn(remindersOn());
    }
  }

  return (
    <section className="card">
      <h2 className="section-title">Daily reminder</h2>
      <p>
        Weeknights around {hourLabel(hour)} your time, tonight&apos;s dinner. On Sundays, prep day or a nudge to
        plan the week.
      </p>

      {setup === "iphone-browser" && (
        <p className="quiet">
          On iPhone, first add PlateWise to your home screen (see below). Then open it from there and turn
          reminders on.
        </p>
      )}
      {setup === "unsupported" && (
        <p className="quiet">This browser can&apos;t show reminders. Try Chrome on Android or Safari on iPhone.</p>
      )}
      {setup === "no-plan" && <p className="quiet">Make your first plan, then turn reminders on here.</p>}

      {setup === "ready" && (
        <label className="reminder-time">
          Remind me at
          <select
            value={hour}
            disabled={busy}
            onChange={(event) => {
              const previous = hour;
              const next = Number(event.target.value);
              setHour(next);
              run(
                async () => {
                  try {
                    await changeReminderHour(planId, next);
                  } catch (err) {
                    // Not saved, so show the time that still applies.
                    setHour(previous);
                    throw err;
                  }
                },
                on ? `Saved. Reminders now come around ${hourLabel(next)}.` : `Reminders will come around ${hourLabel(next)}.`,
              );
            }}
          >
            {REMINDER_HOURS.map((h) => (
              <option key={h} value={h}>
                {hourLabel(h)}
              </option>
            ))}
          </select>
        </label>
      )}

      {setup === "ready" &&
        (on ? (
          <>
            <p className="reminder-on">Reminders are on for this device.</p>
            <button
              className="secondary"
              disabled={busy}
              onClick={() => run(sendTestReminder, "Test sent. It should pop up in a few seconds.")}
            >
              Send me a test
            </button>
            <button
              className="link"
              disabled={busy}
              onClick={() => run(turnOffReminders, "Reminders are off.")}
            >
              Turn off reminders
            </button>
          </>
        ) : (
          <button
            className="primary"
            disabled={busy}
            onClick={() => run(() => turnOnReminders(planId!, hour), "Reminders are on. Try “Send me a test.”")}
          >
            {busy ? "Turning on…" : "Turn on reminders"}
          </button>
        ))}

      {status && <p className="hint reminder-status">{status}</p>}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
