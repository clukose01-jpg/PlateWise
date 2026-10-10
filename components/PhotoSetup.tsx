"use client";

import { type FormEvent, useEffect, useState } from "react";

type Status = { on: boolean; fromVercel: boolean };

// The setup page's box for the Google AI key that makes dinner pictures.
export default function PhotoSetup({ code }: { code: string }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const [turnedOff, setTurnedOff] = useState(false);

  useEffect(() => {
    if (!code) return;
    fetch("/api/setup/photos", { headers: { "x-compare-code": code } })
      .then((response) => response.json())
      .then((result) => {
        if (!result.error) setStatus(result);
      })
      .catch(() => {});
  }, [code]);

  async function call(method: "POST" | "DELETE", body?: unknown) {
    setBusy(true);
    setError(null);
    setDetail(null);
    try {
      const response = await fetch("/api/setup/photos", {
        method,
        headers: { "Content-Type": "application/json", "x-compare-code": code },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok) {
        setDetail(result.detail ?? null);
        throw new Error(result.error);
      }
      return result;
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "Something went wrong. Please try again.");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    const result = await call("POST", { apiKey: apiKey.trim() });
    if (!result) return;
    setApiKey("");
    setPreview(result.preview);
    setJustSaved(true);
    setTurnedOff(false);
    setStatus({ on: true, fromVercel: false });
  }

  async function turnOff() {
    if (await call("DELETE")) {
      setStatus({ on: false, fromVercel: false });
      setJustSaved(false);
      setTurnedOff(true);
      setPreview(null);
    }
  }

  return (
    <section className="card photo-setup">
      <h2 className="section-title">Dinner pictures</h2>
      <p>
        Shows an AI-made picture of tonight&apos;s dinner on the Today screen. Google charges about 5 cents a
        picture, and each dinner&apos;s picture is only made once.
      </p>

      {justSaved && <p className="reminder-on">It works. Pictures are on.</p>}
      {preview && <img className="photo-preview" src={preview} alt="A test picture of spaghetti" />}
      {status?.on && !justSaved && <p className="reminder-on">Pictures are on.</p>}
      {turnedOff && <p className="hint">Pictures are off. It can take a minute to stop everywhere.</p>}

      {status?.fromVercel ? (
        <p className="hint">The key is set in Vercel, so it&apos;s changed there.</p>
      ) : (
        <form onSubmit={save}>
          {!status?.on && (
            <ol className="setup-steps">
              <li>Go to aistudio.google.com/apikey and sign in with your Google account.</li>
              <li>Tap Create API key, then copy it.</li>
              <li>Paste it below.</li>
            </ol>
          )}
          <label className="question" htmlFor="google-key">
            {status?.on ? "Replace the Google AI key" : "Google AI key"}
          </label>
          <input
            id="google-key"
            type="password"
            autoComplete="off"
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            placeholder="Paste your key"
          />
          <p className="hint">We&apos;ll make one test picture with it before saving it.</p>
          <button type="submit" className="primary" disabled={busy || !apiKey.trim()}>
            {busy ? "Making a test picture…" : "Save and test"}
          </button>
        </form>
      )}

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {detail && <p className="hint">What Google said: {detail}</p>}
      {status?.on && !status.fromVercel && (
        <button type="button" className="link" onClick={turnOff} disabled={busy}>
          Turn pictures off
        </button>
      )}
    </section>
  );
}
