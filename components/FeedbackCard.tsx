"use client";

import { type FormEvent, useEffect, useState } from "react";
import { loginStatus } from "@/lib/account-client";
import { deviceHeaders, getCurrentPlanId } from "@/lib/device";

const MAX_LENGTH = 2000;

// The More tab's box for telling the person who makes PlateWise what's confusing, broken or missing.
export default function FeedbackCard() {
  const [text, setText] = useState("");
  const [email, setEmail] = useState("");
  const [accountEmail, setAccountEmail] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loginStatus().then((status) => setAccountEmail(status.email));
  }, []);

  async function send(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...deviceHeaders() },
        body: JSON.stringify({ text: text.trim(), email: email.trim(), planId: getCurrentPlanId() }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error);
      setText("");
      setSent(true);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "We couldn't send that. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card feedback-box" onSubmit={send}>
      <h2 className="section-title">Tell us what you think</h2>
      <p>Something confusing or broken, or an idea? It goes straight to the person who makes PlateWise.</p>
      <label className="visually-hidden" htmlFor="feedback-text">
        Your message
      </label>
      <textarea
        id="feedback-text"
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          setSent(false);
        }}
        placeholder="Type your message"
        maxLength={MAX_LENGTH}
        rows={4}
      />
      {accountEmail ? (
        <p className="hint">We&apos;ll reply to {accountEmail} if we have a question.</p>
      ) : (
        <>
          <label className="question" htmlFor="feedback-email">
            Your email, if you&apos;d like a reply
          </label>
          <input
            id="feedback-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Optional"
          />
        </>
      )}
      <button type="submit" className="primary" disabled={busy || !text.trim()}>
        {busy ? "Sending…" : "Send"}
      </button>
      {sent && <p className="reminder-on feedback-sent">Thank you! We got your message.</p>}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
