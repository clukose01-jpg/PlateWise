"use client";

import { type ChangeEvent, type FormEvent, useEffect, useRef, useState } from "react";
import { MAX_PHOTOS_PER_SCAN, MAX_PHOTOS_TOTAL } from "@/lib/photo-limits";
import type { TestInfo } from "@/lib/plan-schema";
import { resizePhoto } from "@/lib/resize-photo";
import { FridgeDrawing } from "./Illustrations";

type Step = "start" | "scanning" | "list";

type Props = {
  items: string[];
  onItemsChange: (items: string[]) => void;
  onNext: () => void;
};

export default function FridgeStep({ items, onItemsChange: setItems, onNext }: Props) {
  const [step, setStep] = useState<Step>("start");
  const [newItem, setNewItem] = useState("");
  const [photoUrls, setPhotoUrls] = useState<string[]>([]); // photos already scanned
  const [scanningUrls, setScanningUrls] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [testMode, setTestMode] = useState(false);
  const [testInfo, setTestInfo] = useState<TestInfo | null>(null);
  const [totalCostUsd, setTotalCostUsd] = useState(0);
  const cameraInput = useRef<HTMLInputElement>(null);
  const savedPhotoInput = useRef<HTMLInputElement>(null);

  const photosLeft = MAX_PHOTOS_TOTAL - photoUrls.length;

  // Add ?test to the address to see what each scan cost.
  useEffect(() => {
    setTestMode(new URLSearchParams(window.location.search).has("test"));
  }, []);

  function takePhoto() {
    cameraInput.current?.click();
  }

  function chooseSavedPhotos() {
    savedPhotoInput.current?.click();
  }

  async function onPhotosChosen(event: ChangeEvent<HTMLInputElement>) {
    const chosen = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (chosen.length === 0) return;

    const files = chosen.slice(0, Math.min(MAX_PHOTOS_PER_SCAN, photosLeft));
    const stepBefore = step;
    setError(null);
    const used = `${files.length} photo${files.length === 1 ? "" : "s"}`;
    setNotice(
      chosen.length <= files.length
        ? null
        : files.length < photosLeft
          ? `We used the first ${used}. You can add the rest after this.`
          : `We used the first ${used}. That's the most for one plan.`,
    );
    setTestInfo(null);
    const urls = files.map((file) => URL.createObjectURL(file));
    setScanningUrls(urls);
    setStep("scanning");

    const body = new FormData();
    for (const file of files) {
      let photo: Blob = file;
      try {
        photo = await resizePhoto(file, files.length > 1 ? 1600 : 2048);
      } catch {
        // Send the original photo; the server will say if it can't use it.
      }
      body.append("photo", photo, "fridge.jpg");
    }
    body.append("known", JSON.stringify(items));

    try {
      const response = await fetch("/api/scan", { method: "POST", body });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);

      setPhotoUrls([...photoUrls, ...urls]);
      setItems([...items, ...result.items]);
      setTestInfo(result.test);
      setTotalCostUsd((total) => total + (result.test.costUsd ?? 0));
      if (result.items.length === 0) {
        setNotice(
          items.length === 0
            ? "We couldn't spot any food there. Try another photo, or type what you have."
            : "Nothing new in that photo. Everything we saw is already on your list.",
        );
      }
      setStep("list");
    } catch (err) {
      setError(
        err instanceof Error && err.message ? err.message : "Something went wrong. Please try again.",
      );
      urls.forEach((url) => URL.revokeObjectURL(url));
      setStep(stepBefore);
    } finally {
      setScanningUrls([]);
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
    <>
      <section className="card">
        <h2>What&apos;s in your fridge?</h2>

        {step === "start" && (
          <>
            <FridgeDrawing />
            <p>
              Take a photo of each shelf, the door and the freezer. We&apos;ll list what&apos;s
              inside, and you can fix anything we get wrong.
            </p>
            <button className="primary" onClick={takePhoto}>
              Take a photo
            </button>
            <button className="link" onClick={chooseSavedPhotos}>
              Choose saved photos
            </button>
            <button className="link" onClick={startTyping}>
              Or type what you have
            </button>
            <button className="link" onClick={onNext}>
              Skip this step
            </button>
          </>
        )}

        {step === "scanning" && (
          <div className="scanning" role="status">
            <div className="thumbs">
              {scanningUrls.map((url, i) => (
                <img key={url} src={url} alt={`Photo ${i + 1} being read`} />
              ))}
            </div>
            <p>Looking in your fridge…</p>
          </div>
        )}

        {step === "list" && (
          <>
            {photoUrls.length > 0 && (
              <div className="thumbs">
                {photoUrls.map((url, i) => (
                  <img key={url} src={url} alt={`Fridge photo ${i + 1}`} />
                ))}
              </div>
            )}
            {notice && <p className="notice">{notice}</p>}
            <p>
              {photoUrls.length > 0
                ? "Here's what we found. Remove anything that's wrong and add anything we missed."
                : "Type a few things you'd like to use up this week."}
            </p>

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
                autoFocus={photoUrls.length === 0}
              />
              <button type="submit">Add</button>
            </form>

            {photosLeft > 0 && (
              <>
                <button className="secondary" onClick={takePhoto}>
                  {photoUrls.length > 0 ? "Add another photo" : "Take a photo instead"}
                </button>
                <button className="link" onClick={chooseSavedPhotos}>
                  Add saved photos
                </button>
              </>
            )}
            <button className="primary next-step" onClick={onNext}>
              Next
            </button>
          </>
        )}

        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}

        {/* capture opens the phone's camera straight away instead of the file browser. */}
        <input
          ref={cameraInput}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          onChange={onPhotosChosen}
        />
        <input
          ref={savedPhotoInput}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={onPhotosChosen}
        />
      </section>

      {testMode && testInfo && (
        <p className="test-info">
          Test info: last scan {testInfo.seconds.toFixed(1)}s ·{" "}
          {testInfo.inputTokens.toLocaleString()} tokens in ·{" "}
          {testInfo.outputTokens.toLocaleString()} out ·{" "}
          {testInfo.costUsd === null ? "cost unknown" : `≈ $${testInfo.costUsd.toFixed(4)}`} · all{" "}
          {photoUrls.length} photo{photoUrls.length === 1 ? "" : "s"} so far ≈ $
          {totalCostUsd.toFixed(4)} · {testInfo.model}
        </p>
      )}
    </>
  );
}
