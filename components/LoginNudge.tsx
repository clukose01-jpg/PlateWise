"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { loginStatus } from "@/lib/account-client";

const DISMISSED_KEY = "platewise.loginNudgeDismissed";

// On the Week tab, for someone not logged in: a gentle offer to save their plans.
export default function LoginNudge({ planId }: { planId: string }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(DISMISSED_KEY) === "1";
    } catch {
      // Show it.
    }
    if (dismissed) return;
    loginStatus().then((status) => setShow(status.enabled && !status.email));
  }, []);

  function notNow() {
    setShow(false);
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // It'll show again next time.
    }
  }

  if (!show) return null;

  return (
    <section className="card login-nudge">
      <h2 className="section-title">Save your plans</h2>
      <p>Log in with your email so your plans, pantry and ratings are saved, and open on any device.</p>
      <div className="confirm-buttons">
        <Link href={`/login?next=${encodeURIComponent(`/plan/${planId}?tab=week`)}`} className="primary">
          Log in
        </Link>
        <button type="button" className="secondary" onClick={notNow}>
          Not now
        </button>
      </div>
    </section>
  );
}
