"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ACCOUNT_CHANGED,
  accountEmail,
  accountName,
  isNewAccount,
  type LoginStatus,
  loginStatus,
} from "@/lib/account-client";

// Checked with the server once per app open. Until then, the device's own note of who's logged in
// shows straight away.
let checked: Promise<LoginStatus> | null = null;

type Shown = { email: string | null; name: string | null; enabled: boolean; next: string };

// Top right of each page: "Welcome back, Sarah" when she's logged in, so she can see it at a
// glance, or "Log in" when she isn't. Hidden until login is set up.
export default function AccountBadge() {
  const [shown, setShown] = useState<Shown | null>(null);

  useEffect(() => {
    let enabled = Boolean(accountEmail());
    const read = () =>
      setShown({
        email: accountEmail(),
        name: accountName(),
        enabled,
        next: window.location.pathname + window.location.search,
      });
    if (enabled) read();
    checked ??= loginStatus();
    checked.then((status) => {
      enabled = status.enabled;
      read();
    });
    window.addEventListener(ACCOUNT_CHANGED, read);
    return () => window.removeEventListener(ACCOUNT_CHANGED, read);
  }, []);

  if (!shown?.enabled) return null;

  if (!shown.email) {
    return (
      <Link href={`/login?next=${encodeURIComponent(shown.next)}`} className="account-badge logged-out">
        Log in
      </Link>
    );
  }

  const initial = (shown.name || shown.email).trim().charAt(0).toUpperCase();
  // Just the first word, so it fits beside the logo.
  const firstName = shown.name?.split(" ")[0];
  return (
    <Link href="/more" className="account-badge">
      <span className="badge-text">
        {shown.name ? (
          <>
            <span className="badge-hello">{isNewAccount() ? "Welcome," : "Welcome back,"}</span>
            <span className="badge-name">{firstName}</span>
          </>
        ) : (
          <span className="badge-hello">Logged in</span>
        )}
      </span>
      <span className="avatar" aria-hidden="true">
        {initial}
      </span>
    </Link>
  );
}
