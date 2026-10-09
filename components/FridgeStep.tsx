"use client";

import { type ChangeEvent, type FormEvent, useEffect, useRef, useState } from "react";
import { deviceHeaders } from "@/lib/device";
import { MAX_PHOTOS_PER_SCAN, MAX_PHOTOS_TOTAL } from "@/lib/photo-limits";
import type { TestInfo } from "@/lib/plan-schema";
import { resizePhoto } from "@/lib/resize-photo";
import { FridgeDrawing } from "./Illustrations";

type Step = "start" | "scanning" | "list";

type Props = {
  items: string[];
  onItemsChange: (items: string[]) => void;
  pantry: string[];
  onPantryChange: (items: string[]) => void;
  onNext: () => void;
};

export default function FridgeStep({
  items,
  onItemsChange: setItems,
  pantry,
  onPantryChange: setPantry,
  onNext,
}: Props) {
  const [step, setStep] = useState<Step>("start");
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
  const everything = [...items, ...pantry];

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
    const used = `${files.length} photo${files.length === 1 ? "" : "s"}`;
    setError(null);
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
      body.append("photo", photo, "kitchen.jpg");
    }
    body.append("known", JSON.stringify(everything));

    try {
      const response = await fetch("/api/scan", { method: "POST", body, headers: deviceHeaders() });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);

      setPhotoUrls([...photoUrls, ...urls]);
      setItems([...items, ...result.fresh]);
      setPantry([...pantry, ...result.pantry]);
      setTestInfo(result.test);
      setTotalCostUsd((total) => total + (result.test.costUsd ?? 0));
      if (result.fresh.length + result.pantry.length === 0) {
        setNotice(
          everything.length === 0
            ? "We couldn't spot any food there. Try another photo, or type what you have."
            : "Nothing new in that photo. Everything we saw is already on your lists.",
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

  function showLists() {
    setError(null);
    setStep("list");
  }

  return (
    <>
      <section className="card">
        <h2>What&apos;s in your kitchen?</h2>

        {step === "start" && (
          <>
            <FridgeDrawing />
            {pantry.length === 0 ? (
              <p>
                Take a photo of each fridge shelf, the freezer and your pantry. We&apos;ll list
                what&apos;s inside, and you can fix anything we get wrong.
              </p>
            ) : (
              <p>
                Take a photo of each fridge shelf and the freezer. Your pantry from last time is
                saved ({pantry.length} item{pantry.length === 1 ? "" : "s"}), so only photograph it
                again if it&apos;s changed.
              </p>
            )}
            <button className="primary" onClick={takePhoto}>
              Take a photo
            </button>
            <button className="link" onClick={chooseSavedPhotos}>
              Choose saved photos
            </button>
            <button className="link" onClick={showLists}>
              {pantry.length === 0 ? "Or type what you have" : "Check my pantry or type what I have"}
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
            <p>Looking in your kitchen…</p>
          </div>
        )}

        {step === "list" && (
          <>
            {photoUrls.length > 0 && (
              <div className="thumbs">
                {photoUrls.map((url, i) => (
                  <img key={url} src={url} alt={`Kitchen photo ${i + 1}`} />
                ))}
              </div>
            )}
            {notice && <p className="notice">{notice}</p>}
            <p>
              {photoUrls.length > 0
                ? "Here's what we found. Remove anything that's wrong or used up, and add anything we missed."
                : "Add the food you have, and remove anything you've used up."}
            </p>

            <FoodList
              title="Fresh this week"
              hint="Fridge and freezer"
              items={items}
              allItems={everything}
              onChange={setItems}
              placeholder="Add fresh food"
              label="Add fresh food"
            />
            <FoodList
              title="Pantry"
              hint="Saved for next week"
              className="pantry"
              items={pantry}
              allItems={everything}
              onChange={setPantry}
              placeholder="Add pantry food"
              label="Add a pantry item"
            />

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

type FoodListProps = {
  title?: string;
  hint?: string;
  className?: string;
  items: string[];
  allItems: string[];
  onChange: (items: string[]) => void;
  placeholder: string;
  label: string;
};

export function FoodList({ title, hint, className, items, allItems, onChange, placeholder, label }: FoodListProps) {
  const [typing, setTyping] = useState("");

  function add(event: FormEvent) {
    event.preventDefault();
    const item = typing.trim();
    if (!item) return;
    if (!allItems.some((existing) => existing.toLowerCase() === item.toLowerCase())) {
      onChange([...items, item]);
    }
    setTyping("");
  }

  return (
    <div className="food-list">
      {title && (
        <h3>
          {title} {hint && <span className="hint">· {hint}</span>}
        </h3>
      )}
      {items.length > 0 && (
        <ul className={className ? `items ${className}` : "items"}>
          {items.map((item) => (
            <li key={item}>
              <span>{item}</span>
              <button
                aria-label={`Remove ${item}`}
                onClick={() => onChange(items.filter((existing) => existing !== item))}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      <form className="add" onSubmit={add}>
        <input
          value={typing}
          onChange={(event) => setTyping(event.target.value)}
          placeholder={placeholder}
          aria-label={label}
        />
        <button type="submit">Add</button>
      </form>
    </div>
  );
}
