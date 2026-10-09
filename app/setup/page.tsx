"use client";

// A private page for setting up the Gmail account that sends login codes, so it doesn't have to be
// done in Vercel's settings. It needs the same passcode as the speed test page.

import { type FormEvent, useEffect, useState } from "react";
import { Logo } from "@/components/Illustrations";

export default function SetupPage() {
  const [code, setCode] = useState("");
  const [user, setUser] = useState("");
  const [appPassword, setAppPassword] = useState("");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const passcode = new URLSearchParams(window.location.search).get("code") ?? "";
    setCode(passcode);
    fetch("/api/setup/email", { headers: { "x-compare-code": passcode } })
      .then((r) => r.json())
      .then((result) => {
        if (result.error) setError(result.error);
        else {
          setUser(result.user);
          setSaved(result.saved);
        }
      })
      .catch(() => setError("Couldn't load. Check your connection."));
  }, []);

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setDetail(null);
    try {
      const response = await fetch("/api/setup/email", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-compare-code": code },
        body: JSON.stringify({ user, appPassword }),
      });
      const result = await response.json();
      if (!response.ok) {
        setDetail(result.detail ?? null);
        throw new Error(result.error);
      }
      setAppPassword("");
      setSaved(true);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login">
      <header>
        <Logo />
        <h1 className="plan-title">Login email setup</h1>
        <p className="tagline">The Gmail account that sends login codes. Only you have this page&apos;s link.</p>
      </header>

      {done ? (
        <section className="card">
          <p className="reminder-on">It works. Login is switched on.</p>
          <p>
            Google accepted the password, and we sent a test email to <strong>{user}</strong>. Families can now
            log in from the More tab.
          </p>
        </section>
      ) : (
        <form className="card" onSubmit={save}>
          {saved && <p className="hint">A password is already saved. Saving a new one replaces it.</p>}
          <label className="question" htmlFor="gmail-user">
            Gmail address
          </label>
          <input
            id="gmail-user"
            type="email"
            value={user}
            onChange={(event) => setUser(event.target.value)}
            placeholder="platewise.meal@gmail.com"
            required
          />
          <label className="question" htmlFor="gmail-password">
            App password from Google
          </label>
          <input
            id="gmail-password"
            type="password"
            autoComplete="off"
            value={appPassword}
            onChange={(event) => setAppPassword(event.target.value)}
            placeholder="16 letters, like abcd efgh ijkl mnop"
            required
          />
          <p className="hint">We&apos;ll check it with Google and send a test email before saving it.</p>
          <button type="submit" className="primary" disabled={busy || !user || !appPassword}>
            {busy ? "Checking with Google…" : "Save and test"}
          </button>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          {detail && <p className="hint">What Google said: {detail}</p>}
        </form>
      )}
    </main>
  );
}
