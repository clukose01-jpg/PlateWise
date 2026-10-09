"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { forgetPlan, getOwnerKey } from "@/lib/device";

// At the bottom of the week. The device that made the plan can delete it for everyone; anyone
// else it was shared with can only take it off their own device.
export default function DeletePlan({ planId }: { planId: string }) {
  const router = useRouter();
  const [ownerKey, setOwnerKey] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const box = useRef<HTMLElement>(null);

  useEffect(() => {
    setOwnerKey(getOwnerKey(planId));
  }, [planId]);

  // The question appears at the very bottom, so bring it up above the tab bar.
  useEffect(() => {
    if (confirming) box.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [confirming]);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      if (ownerKey) {
        const response = await fetch(`/api/plan/${planId}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ownerKey }),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error);
      }
      forgetPlan(planId);
      router.push(`/new?cleared=${ownerKey ? "deleted" : "removed"}`);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "Something went wrong. Please try again.");
      setBusy(false);
    }
  }

  if (!confirming) {
    return (
      <div className="delete-plan">
        <button type="button" className="danger-link" onClick={() => setConfirming(true)}>
          {ownerKey ? "Delete this plan" : "Remove this plan from this device"}
        </button>
      </div>
    );
  }

  return (
    <section
      ref={box}
      className="card delete-plan confirm-delete"
      role="alertdialog"
      aria-labelledby="delete-title"
    >
      <h2 id="delete-title" className="section-title">
        {ownerKey ? "Delete this week's plan?" : "Remove this plan from this device?"}
      </h2>
      <p>
        {ownerKey
          ? "It will be gone for you and anyone you shared it with, and it can't be undone. Your pantry, family answers and ratings stay saved, so making a new one is quick."
          : "It will still open from its link for anyone who has it. Your pantry, family answers and ratings stay saved."}
      </p>
      <div className="confirm-buttons">
        <button type="button" className="danger" onClick={confirm} disabled={busy}>
          {busy ? "Deleting…" : ownerKey ? "Yes, delete it" : "Yes, remove it"}
        </button>
        <button type="button" className="secondary" onClick={() => setConfirming(false)} disabled={busy}>
          Keep it
        </button>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
