"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { loginStatus, logOut } from "@/lib/account-client";

// On the More tab: log in to save everything, or see who's logged in. Hidden until login is set up.
export default function AccountCard() {
  const router = useRouter();
  const [status, setStatus] = useState<{ enabled: boolean; email: string | null } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    loginStatus().then(setStatus);
  }, []);

  if (!status?.enabled) return null;

  async function confirmLogOut() {
    setBusy(true);
    await logOut().catch(() => {});
    router.push("/");
  }

  if (!status.email) {
    return (
      <section className="card account-card">
        <h2 className="section-title">Save everything to an account</h2>
        <p>
          Log in with your email to keep your plans, pantry, family answers and ratings, and use them on any
          phone or computer.
        </p>
        <Link href="/login?next=/more" className="primary">
          Log in with email
        </Link>
      </section>
    );
  }

  return (
    <section className="card account-card">
      <h2 className="section-title">Your account</h2>
      <p>
        Logged in as <strong>{status.email}</strong>. Your plans, pantry, family answers and ratings save to your
        account, so they show up on any device you log into.
      </p>
      {confirming ? (
        <>
          <p className="hint">This takes your info off this device. It stays saved in your account.</p>
          <div className="confirm-buttons">
            <button type="button" className="secondary" onClick={confirmLogOut} disabled={busy}>
              {busy ? "Logging out…" : "Yes, log out"}
            </button>
            <button type="button" className="secondary" onClick={() => setConfirming(false)} disabled={busy}>
              Cancel
            </button>
          </div>
        </>
      ) : (
        <button type="button" className="link left" onClick={() => setConfirming(true)}>
          Log out
        </button>
      )}
    </section>
  );
}
