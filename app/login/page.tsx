"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";
import { Logo } from "@/components/Illustrations";
import TabBar from "@/components/TabBar";
import { loginStatus, sendCode, verifyCode } from "@/lib/account-client";

type Step = "loading" | "unavailable" | "email" | "code" | "already";

// Only go back to a page on this site.
function nextPage() {
  const next = new URLSearchParams(window.location.search).get("next");
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/more";
}

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("loading");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    loginStatus().then((status) => {
      if (!status.enabled) setStep("unavailable");
      else if (status.email) {
        setEmail(status.email);
        setStep("already");
      } else setStep("email");
    });
  }, []);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function emailCode(event?: FormEvent) {
    event?.preventDefault();
    run(async () => {
      await sendCode(email.trim());
      setCode("");
      setNotice(null);
      setStep("code");
    });
  }

  function resend() {
    run(async () => {
      await sendCode(email.trim());
      setNotice("We sent a new code.");
    });
  }

  function logIn(value = code) {
    run(async () => {
      await verifyCode(email.trim(), value);
      router.push(nextPage());
    });
  }

  return (
    <main className="login">
      <header>
        <Logo />
        <h1 className="plan-title">Log in</h1>
        <p className="tagline">Save your plans, pantry, family answers and ratings, and use them on any device.</p>
      </header>

      {step === "unavailable" && (
        <section className="card">
          <p className="quiet">Logging in isn&apos;t available yet. Everything is still saved on this device.</p>
        </section>
      )}

      {step === "already" && (
        <section className="card">
          <p>
            You&apos;re logged in as <strong>{email}</strong>.
          </p>
          <Link href="/more" className="secondary">
            Go to your account
          </Link>
        </section>
      )}

      {step === "email" && (
        <form className="card" onSubmit={emailCode}>
          <label className="question" htmlFor="login-email">
            Your email
          </label>
          <input
            id="login-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            required
          />
          <p className="hint">We&apos;ll email you a 6-digit code. There&apos;s no password to remember.</p>
          <button type="submit" className="primary" disabled={busy || !email.trim()}>
            {busy ? "Sending…" : "Email me a code"}
          </button>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
        </form>
      )}

      {step === "code" && (
        <form
          className="card"
          onSubmit={(event) => {
            event.preventDefault();
            logIn();
          }}
        >
          <label className="question" htmlFor="login-code">
            Enter the code
          </label>
          <p>
            We sent a 6-digit code to <strong>{email}</strong>. It can take a minute, so check your spam folder
            too.
          </p>
          <input
            id="login-code"
            className="code-input"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(event) => {
              const digits = event.target.value.replace(/\D/g, "").slice(0, 6);
              setCode(digits);
              // Log in as soon as all 6 digits are in, including when the phone fills them in.
              if (digits.length === 6 && !busy) logIn(digits);
            }}
            placeholder="••••••"
          />
          <button type="submit" className="primary" disabled={busy || code.length !== 6}>
            {busy ? "Logging in…" : "Log in"}
          </button>
          {notice && <p className="hint center">{notice}</p>}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button type="button" className="link" onClick={resend} disabled={busy}>
            Send a new code
          </button>
          <button
            type="button"
            className="link"
            onClick={() => {
              setStep("email");
              setError(null);
            }}
          >
            Use a different email
          </button>
        </form>
      )}

      <TabBar active="more" />
    </main>
  );
}
