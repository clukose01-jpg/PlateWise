"use client";

import { useEffect, useRef, useState } from "react";

// A list she can tick off at the store. Ticks are remembered on this device only.
export default function Checklist({ items, storageKey }: { items: string[]; storageKey: string }) {
  const [checked, setChecked] = useState<number[]>([]);
  // The latest ticks, so quick taps in a row each build on the one before.
  const latest = useRef<number[]>([]);

  useEffect(() => {
    let saved: number[] = [];
    try {
      saved = JSON.parse(localStorage.getItem(storageKey) ?? "[]");
    } catch {
      // Nothing saved, or this browser blocks storage.
    }
    // Keep any ticks made while the page was still loading.
    latest.current = [...new Set([...saved, ...latest.current])];
    setChecked(latest.current);
  }, [storageKey]);

  // Saved the moment she taps, and never just from opening the page.
  function toggle(index: number) {
    const current = latest.current;
    const next = current.includes(index) ? current.filter((i) => i !== index) : [...current, index];
    latest.current = next;
    setChecked(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      // Ticks just won't be remembered.
    }
  }

  const ticked = checked;

  return (
    <ul className="checklist">
      {items.map((item, i) => (
        <li key={i}>
          <label className={ticked.includes(i) ? "done" : undefined}>
            <input type="checkbox" checked={ticked.includes(i)} onChange={() => toggle(i)} />
            <span>{item}</span>
          </label>
        </li>
      ))}
    </ul>
  );
}
