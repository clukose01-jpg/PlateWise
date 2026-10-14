"use client";

import { type FormEvent, useEffect, useState } from "react";
import { HIGGSFIELD_MODEL } from "@/lib/photo-models";

type Provider = "higgsfield" | "google";
type Status = { on: boolean; provider: Provider | null; fromVercel: boolean };

const NAMES: Record<Provider, string> = { higgsfield: "Higgsfield", google: "Google" };

// The setup page's box for the key that makes dinner pictures: Higgsfield's or Google's.
export default function PhotoSetup({ code }: { code: string }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [provider, setProvider] = useState<Provider>("higgsfield");
  const [apiKey, setApiKey] = useState("");
  const [keyId, setKeyId] = useState("");
  const [keySecret, setKeySecret] = useState("");
  const [model, setModel] = useState(HIGGSFIELD_MODEL);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<{ provider: Provider; text: string } | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const [turnedOff, setTurnedOff] = useState(false);

  useEffect(() => {
    if (!code) return;
    fetch("/api/setup/photos", { headers: { "x-compare-code": code } })
      .then((response) => response.json())
      .then((result) => {
        if (result.error) return;
        setStatus(result);
        if (result.provider) setProvider(result.provider);
        if (result.provider === "higgsfield" && result.model) setModel(result.model);
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
        if (result.detail) setDetail({ provider: result.provider ?? provider, text: result.detail });
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
    const body =
      provider === "google"
        ? { provider, apiKey: apiKey.trim() }
        : { provider, keyId: keyId.trim(), keySecret: keySecret.trim(), model: model.trim() };
    const result = await call("POST", body);
    if (!result) return;
    setApiKey("");
    setKeyId("");
    setKeySecret("");
    setPreview(result.preview);
    setJustSaved(true);
    setTurnedOff(false);
    setStatus({ on: true, provider, fromVercel: false });
  }

  async function turnOff() {
    if (await call("DELETE")) {
      setStatus({ on: false, provider: null, fromVercel: false });
      setJustSaved(false);
      setTurnedOff(true);
      setPreview(null);
    }
  }

  // For Higgsfield, the whole "Key ID:Secret" line can go in the Key ID box alone.
  const ready =
    provider === "google" ? Boolean(apiKey.trim()) : Boolean(keyId.trim() && (keySecret.trim() || keyId.includes(":")));
  const replacing = status?.on && status.provider === provider;

  return (
    <section className="card photo-setup">
      <h2 className="section-title">Dinner pictures</h2>
      <p>
        Shows an AI-made picture of tonight&apos;s dinner on the Today screen. Each dinner&apos;s picture is only
        made once.
      </p>

      {justSaved && status?.provider && (
        <p className="reminder-on">It works. Pictures are on, made by {NAMES[status.provider]}.</p>
      )}
      {preview && <img className="photo-preview" src={preview} alt="A test picture of spaghetti" />}
      {status?.on && status.provider && !justSaved && (
        <p className="reminder-on">Pictures are on, made by {NAMES[status.provider]}.</p>
      )}
      {turnedOff && <p className="hint">Pictures are off. It can take a minute to stop everywhere.</p>}

      {status?.fromVercel ? (
        <p className="hint">The key is set in Vercel, so it&apos;s changed there.</p>
      ) : (
        <form onSubmit={save}>
          <p className="question">Make pictures with</p>
          <div className="reason-pills" role="radiogroup" aria-label="Make pictures with">
            {(["higgsfield", "google"] as const).map((option) => (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={provider === option}
                className={provider === option ? "pill selected" : "pill"}
                onClick={() => {
                  setProvider(option);
                  setError(null);
                  setDetail(null);
                  setJustSaved(false);
                  setPreview(null);
                }}
              >
                {option === "google" ? "Google (Nano Banana)" : "Higgsfield"}
              </button>
            ))}
          </div>

          {provider === "higgsfield" ? (
            <>
              {!replacing && (
                <ol className="setup-steps">
                  <li>Go to cloud.higgsfield.ai (Higgsfield Cloud) and sign in.</li>
                  <li>
                    Add some money to your balance there. You pay for each picture, and each model&apos;s price is
                    listed there.
                  </li>
                  <li>
                    Create an API key. Copy the Key ID and the Secret. The Secret is only shown once. If it&apos;s
                    shown as one line with a colon in it, paste the whole line into the Key ID box.
                  </li>
                </ol>
              )}
              <label className="question" htmlFor="higgsfield-id">
                {replacing ? "Replace the Higgsfield key: Key ID" : "Key ID"}
              </label>
              <input
                id="higgsfield-id"
                type="text"
                autoComplete="off"
                spellCheck={false}
                value={keyId}
                onChange={(event) => setKeyId(event.target.value)}
                placeholder="Paste the Key ID, or the whole key line"
              />
              <label className="question" htmlFor="higgsfield-secret">
                Secret
              </label>
              <input
                id="higgsfield-secret"
                type="password"
                autoComplete="off"
                value={keySecret}
                onChange={(event) => setKeySecret(event.target.value)}
                placeholder="Paste the Secret"
              />
              <label className="question" htmlFor="higgsfield-model">
                Picture model
              </label>
              <input
                id="higgsfield-model"
                type="text"
                autoComplete="off"
                spellCheck={false}
                value={model}
                onChange={(event) => setModel(event.target.value)}
              />
              <p className="hint">
                Flux Kontext Max makes realistic photos. Leave it, or paste another picture model&apos;s name from
                Higgsfield&apos;s catalog.
              </p>
            </>
          ) : (
            <>
              {!replacing && (
                <ol className="setup-steps">
                  <li>Go to aistudio.google.com/apikey and sign in with your Google account.</li>
                  <li>Tap Create API key, then copy it.</li>
                  <li>Paste it below. Google charges about 5 cents a picture, and needs billing turned on.</li>
                </ol>
              )}
              <label className="question" htmlFor="google-key">
                {replacing ? "Replace the Google AI key" : "Google AI key"}
              </label>
              <input
                id="google-key"
                type="password"
                autoComplete="off"
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                placeholder="Paste your key"
              />
            </>
          )}
          <p className="hint">We&apos;ll make one test picture with it before saving it.</p>
          <button type="submit" className="primary" disabled={busy || !ready}>
            {busy ? "Making a test picture… (up to a minute)" : "Save and test"}
          </button>
        </form>
      )}

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {detail && (
        <p className="hint">
          What {NAMES[detail.provider]} said: {detail.text}
        </p>
      )}
      {status?.on && !status.fromVercel && (
        <button type="button" className="link" onClick={turnOff} disabled={busy}>
          Turn pictures off
        </button>
      )}
    </section>
  );
}
