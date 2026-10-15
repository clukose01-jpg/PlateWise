"use client";

import { type FormEvent, useEffect, useState } from "react";
import { deviceHeaders, loadMadePlans } from "@/lib/device";
import { PLANNED_PRICE, WOULD_PAY, type WouldPay } from "@/lib/price";

const KEY = "platewise.priceCheck";
const WEEK_MS = 7 * 86_400_000;
// After "Not now" twice, it stops asking.
const MAX_LATER = 2;
const PRICE = `$${PLANNED_PRICE.toFixed(2)}`;
const LABELS: Record<WouldPay, string> = { yes: "Yes", maybe: "Maybe", no: "No" };

type Saved = { answered?: boolean; later?: number; until?: string };

function readSaved(): Saved {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    return saved && typeof saved === "object" ? saved : {};
  } catch {
    return {};
  }
}

function writeSaved(saved: Saved) {
  try {
    localStorage.setItem(KEY, JSON.stringify(saved));
  } catch {
    // Without storage it may ask again next time, which is fine.
  }
}

// Asked once her first plan is a week old: long enough to know whether it's worth paying for.
// Only people who made plans here are asked, not someone opening a plan they were sent, and
// never on the admin's own devices.
function shouldAsk(now = Date.now()) {
  try {
    if (localStorage.getItem("platewise.adminCode")) return false;
    const saved = readSaved();
    if (saved.answered || (saved.later ?? 0) >= MAX_LATER) return false;
    if (saved.until && Date.parse(saved.until) > now) return false;
    const first = Math.min(...loadMadePlans().map((plan) => Date.parse(plan.createdAt)).filter(Number.isFinite));
    return now - first >= WEEK_MS;
  } catch {
    return false;
  }
}

// "9.99", "$10" or "" (not sure). Undefined means it isn't a price.
function toDollars(text: string): number | null | undefined {
  const cleaned = text.replace(/[$,\s]/g, "");
  if (!cleaned) return null;
  const dollars = Number(cleaned);
  return Number.isFinite(dollars) && dollars >= 0 && dollars <= 1000 ? Math.round(dollars * 100) / 100 : undefined;
}

// Three quick questions at the bottom of Today, so the admin can see what families would pay.
// Add ?pricecheck to a plan's address to preview it; answers from a preview aren't sent.
export default function PriceCheck() {
  const [shown, setShown] = useState(false);
  const [preview, setPreview] = useState(false);
  const [wouldPay, setWouldPay] = useState<WouldPay | null>(null);
  const [tooExpensive, setTooExpensive] = useState("");
  const [greatDeal, setGreatDeal] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const previewing = new URLSearchParams(window.location.search).has("pricecheck");
    setPreview(previewing);
    setShown(previewing || shouldAsk());
  }, []);

  if (!shown) return null;

  function later() {
    const saved = readSaved();
    writeSaved({ later: (saved.later ?? 0) + 1, until: new Date(Date.now() + WEEK_MS).toISOString() });
    setShown(false);
  }

  async function send(event: FormEvent) {
    event.preventDefault();
    const high = toDollars(tooExpensive);
    const low = toDollars(greatDeal);
    if (!wouldPay) return setError("Pick yes, maybe or no first.");
    if (high === undefined || low === undefined) return setError("Use a number for the prices, like 9.99.");
    setError(null);
    if (preview) return setDone(true);
    setBusy(true);
    try {
      const response = await fetch("/api/price-check", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...deviceHeaders() },
        body: JSON.stringify({ wouldPay, tooExpensive: high, greatDeal: low }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error);
      writeSaved({ answered: true });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "We couldn't send that. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <section className="card price-check" role="status">
        <h2 className="section-title">Thank you</h2>
        <p className="quiet">That really helps decide what PlateWise should cost.</p>
        {preview && <p className="hint">This was a preview, so nothing was sent.</p>}
      </section>
    );
  }

  return (
    <form className="card price-check" onSubmit={send}>
      <h2 className="section-title">Would you pay for PlateWise?</h2>
      <p className="quiet">It&apos;s free while we test it. Three quick questions help decide what it should cost.</p>

      <fieldset>
        <legend className="question">Would you keep using it if it cost {PRICE} a month?</legend>
        <div className="pills">
          {WOULD_PAY.map((choice) => (
            <label key={choice} className={wouldPay === choice ? "pill selected" : "pill"}>
              <input
                type="radio"
                name="wouldPay"
                value={choice}
                checked={wouldPay === choice}
                onChange={() => setWouldPay(choice)}
              />
              {LABELS[choice]}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="question" htmlFor="too-expensive">
        At what price a month would it feel too expensive?
      </label>
      <div className="money">
        <span aria-hidden="true">$</span>
        <input
          id="too-expensive"
          inputMode="decimal"
          value={tooExpensive}
          onChange={(event) => setTooExpensive(event.target.value)}
          maxLength={8}
        />
      </div>

      <label className="question" htmlFor="great-deal">
        At what price a month would it feel like a great deal?
      </label>
      <div className="money">
        <span aria-hidden="true">$</span>
        <input
          id="great-deal"
          inputMode="decimal"
          value={greatDeal}
          onChange={(event) => setGreatDeal(event.target.value)}
          maxLength={8}
        />
      </div>
      <p className="hint">Leave a price blank if you&apos;re not sure.</p>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="primary" disabled={busy}>
        {busy ? "Sending…" : "Send answers"}
      </button>
      <button type="button" className="link" onClick={later}>
        Not now
      </button>
    </form>
  );
}
