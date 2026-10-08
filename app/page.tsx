"use client";

import { type ChangeEvent, type FormEvent, useEffect, useRef, useState } from "react";
import { resizePhoto } from "@/lib/resize-photo";

type Step = "start" | "scanning" | "list";

type TestInfo = {
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number | null;
  seconds: number;
};

export default function Home() {
  const [step, setStep] = useState<Step>("start");
  const [items, setItems] = useState<string[]>([]);
  const [newItem, setNewItem] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null); // the photo the list came from
  const [scanningUrl, setScanningUrl] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [testMode, setTestMode] = useState(false);
  const [testInfo, setTestInfo] = useState<TestInfo | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  // Add ?test to the address to see what each scan cost.
  useEffect(() => {
    setTestMode(new URLSearchParams(window.location.search).has("test"));
  }, []);

  function choosePhoto() {
    fileInput.current?.click();
  }

  async function onPhotoChosen(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    const stepBefore = step;
    setError(null);
    setNotice(null);
    setTestInfo(null);
    const url = URL.createObjectURL(file);
    setScanningUrl(url);
    setStep("scanning");

    let photo: Blob = file;
    try {
      photo = await resizePhoto(file);
    } catch {
      // Send the original photo; the server will say if it can't use it.
    }

    const body = new FormData();
    body.append("photo", photo, "fridge.jpg");

    try {
      const response = await fetch("/api/scan", { method: "POST", body });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);

      if (photoUrl) URL.revokeObjectURL(photoUrl);
      setPhotoUrl(url);
      setItems(result.items);
      setTestInfo(result.test);
      if (result.items.length === 0) {
        setNotice("We couldn't spot any food in that photo. Try another photo, or type what you have.");
      }
      setStep("list");
    } catch (err) {
      setError(
        err instanceof Error && err.message ? err.message : "Something went wrong. Please try again.",
      );
      URL.revokeObjectURL(url);
      setStep(stepBefore);
    } finally {
      setScanningUrl(null);
    }
  }

  function startTyping() {
    setError(null);
    setStep("list");
  }

  function removeItem(item: string) {
    setItems(items.filter((existing) => existing !== item));
  }

  function addItem(event: FormEvent) {
    event.preventDefault();
    const item = newItem.trim();
    if (!item) return;
    if (!items.some((existing) => existing.toLowerCase() === item.toLowerCase())) {
      setItems([...items, item]);
    }
    setNewItem("");
  }

  return (
    <main>
      <header>
        <h1>PlateWise</h1>
        <p className="tagline">Plan the week&apos;s dinners in a few minutes.</p>
      </header>

      <section className="card">
        <h2>What&apos;s in your fridge?</h2>

        {step === "start" && (
          <>
            <p>
              Take one photo of your open fridge. We&apos;ll list what&apos;s inside, and you can
              fix anything we get wrong.
            </p>
            <button className="primary" onClick={choosePhoto}>
              Take a photo
            </button>
            <button className="link" onClick={startTyping}>
              Or type what you have
            </button>
          </>
        )}

        {step === "scanning" && (
          <div className="scanning" role="status">
            {scanningUrl && <img src={scanningUrl} alt="Your fridge photo" />}
            <p>Looking in your fridge…</p>
          </div>
        )}

        {step === "list" && (
          <>
            {photoUrl && <img className="thumb" src={photoUrl} alt="Your fridge photo" />}
            {notice ? (
              <p className="notice">{notice}</p>
            ) : (
              <p>
                {photoUrl
                  ? "Here's what we found. Remove anything that's wrong and add anything we missed."
                  : "Type a few things you'd like to use up this week."}
              </p>
            )}

            {items.length > 0 && (
              <ul className="items">
                {items.map((item) => (
                  <li key={item}>
                    <span>{item}</span>
                    <button aria-label={`Remove ${item}`} onClick={() => removeItem(item)}>
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <form className="add" onSubmit={addItem}>
              <input
                value={newItem}
                onChange={(event) => setNewItem(event.target.value)}
                placeholder="Add an item, like rice"
                aria-label="Add an item"
                autoFocus={!photoUrl}
              />
              <button type="submit">Add</button>
            </form>

            <button className="secondary" onClick={choosePhoto}>
              {photoUrl ? "Take another photo" : "Take a photo instead"}
            </button>
          </>
        )}

        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}

        <input ref={fileInput} type="file" accept="image/*" hidden onChange={onPhotoChosen} />
      </section>

      {testMode && testInfo && (
        <p className="test-info">
          Test info: {testInfo.seconds.toFixed(1)}s · {testInfo.inputTokens.toLocaleString()} tokens
          in · {testInfo.outputTokens.toLocaleString()} out ·{" "}
          {testInfo.costUsd === null ? "cost unknown" : `≈ $${testInfo.costUsd.toFixed(4)}`} ·{" "}
          {testInfo.model}
        </p>
      )}

      <p className="next">Next up: your week of dinners. Coming soon.</p>
    </main>
  );
}
