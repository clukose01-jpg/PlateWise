"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";
import BudgetInput from "@/components/BudgetInput";
import { Logo } from "@/components/Illustrations";
import TabBar from "@/components/TabBar";
import { loginStatus, logInWithPassword, sendCode, setPassword, verifyCode } from "@/lib/account-client";
import { loadBudget, saveBudget, toBudget } from "@/lib/device";

// Email and password, or an emailed code the first time (or when she forgets her password).
// After a code, she's offered a password so next time she doesn't need one. A new account is then
// asked for a weekly grocery budget, which she can change later when she makes a plan.
type Step = "loading" | "unavailable" | "already" | "password" | "code" | "new-password" | "budget";

const MIN_PASSWORD_LENGTH = 8;

// Only go back to a page on this site.
function nextPage() {
  const next = new URLSearchParams(window.location.search).get("next");
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/more";
}

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("loading");
  const [email, setEmail] = useState("");
  const [password, setPasswordText] = useState("");
  const [code, setCode] = useState("");
  const [hadPassword, setHadPassword] = useState(false);
  const [budget, setBudget] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    loginStatus().then((status) => {
      if (!status.enabled) setStep("unavailable");
      else if (status.email) {
        setEmail(status.email);
        setStep("already");
      } else setStep("password");
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

  function passwordLogIn(event: FormEvent) {
    event.preventDefault();
    run(async () => {
      await logInWithPassword(email.trim(), password);
      router.push(nextPage());
    });
  }

  function emailCode() {
    if (!email.trim()) {
      setError("Type your email first.");
      return;
    }
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

  function codeLogIn(value = code) {
    run(async () => {
      const { hasPassword } = await verifyCode(email.trim(), value);
      setHadPassword(hasPassword);
      setPasswordText("");
      setStep("new-password");
    });
  }

  // New accounts get the budget question, unless she already set one on this device.
  function finishSignUp() {
    if (!hadPassword && loadBudget() === null) {
      setError(null);
      setStep("budget");
    } else {
      router.push(nextPage());
    }
  }

  function saveBudgetAndGo(event: FormEvent) {
    event.preventDefault();
    saveBudget(toBudget(budget));
    router.push(nextPage());
  }

  function savePassword(event: FormEvent) {
    event.preventDefault();
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Use at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    run(async () => {
      await setPassword(password);
      finishSignUp();
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

      {step === "password" && (
        <form className="card" onSubmit={passwordLogIn}>
          <label className="question" htmlFor="login-email">
            Your email
          </label>
          <input
            id="login-email"
            type="email"
            inputMode="email"
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            required
          />
          <label className="question" htmlFor="login-password">
            Password
          </label>
          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPasswordText(event.target.value)}
          />
          <button type="submit" className="primary" disabled={busy || !email.trim() || !password}>
            {busy ? "Logging in…" : "Log in"}
          </button>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <div className="code-option">
            <p className="hint">First time here, or forgot your password?</p>
            <button type="button" className="secondary" onClick={emailCode} disabled={busy}>
              Email me a code instead
            </button>
          </div>
        </form>
      )}

      {step === "code" && (
        <form
          className="card"
          onSubmit={(event) => {
            event.preventDefault();
            codeLogIn();
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
              if (digits.length === 6 && !busy) codeLogIn(digits);
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
              setStep("password");
              setError(null);
            }}
          >
            Use a different email
          </button>
        </form>
      )}

      {step === "new-password" && (
        <form className="card" onSubmit={savePassword}>
          <h2 className="section-title">{hadPassword ? "Set a new password?" : "Create a password"}</h2>
          <p>
            {hadPassword
              ? "You're logged in. If you forgot your password, make a new one here."
              : "You're logged in. With a password, next time you can log in on any device without waiting for a code."}
          </p>
          {/* Lets the phone's password manager save the email with the password. */}
          <input type="email" autoComplete="username" value={email} readOnly hidden />
          <label className="question" htmlFor="new-password">
            {hadPassword ? "New password" : "Password"}
          </label>
          <input
            id="new-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPasswordText(event.target.value)}
          />
          <p className="hint">At least {MIN_PASSWORD_LENGTH} characters.</p>
          <button type="submit" className="primary" disabled={busy || !password}>
            {busy ? "Saving…" : hadPassword ? "Save new password" : "Save password"}
          </button>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button type="button" className="link" onClick={finishSignUp} disabled={busy}>
            {hadPassword ? "Keep my old password" : "Skip for now"}
          </button>
        </form>
      )}

      {step === "budget" && (
        <form className="card" onSubmit={saveBudgetAndGo}>
          <h2 className="section-title">Weekly grocery budget?</h2>
          <p>
            Each plan will aim to keep the grocery list under it, and show what each dinner costs. You can change
            it any time when you make a plan.
          </p>
          <label className="question" htmlFor="signup-budget">
            Most you want to spend a week
          </label>
          <BudgetInput id="signup-budget" value={budget} onChange={setBudget} />
          <button type="submit" className="primary" disabled={!toBudget(budget)}>
            Save budget
          </button>
          <button type="button" className="link" onClick={() => router.push(nextPage())}>
            Skip for now
          </button>
        </form>
      )}

      <TabBar active="more" />
    </main>
  );
}
