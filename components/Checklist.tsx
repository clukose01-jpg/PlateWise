"use client";

import { useEffect, useState } from "react";

// A list she can tick off at the store. Ticks are remembered on this phone only.
export default function Checklist({ items, storageKey }: { items: string[]; storageKey: string }) {
  const [checked, setChecked] = useState<number[]>([]);

  useEffect(() => {
    let saved: number[] = [];
    try {
      saved = JSON.parse(localStorage.getItem(storageKey) ?? "[]");
    } catch {
      // Nothing saved, or this browser blocks storage.
    }
    // Keep any ticks made while the page was still loading.
    setChecked((current) => [...new Set([...saved, ...current])]);
  }, [storageKey]);

  // Saved only when she ticks something, so opening the page never overwrites saved ticks.
  function toggle(index: number) {
    setChecked((current) => {
      const next = current.includes(index)
        ? current.filter((i) => i !== index)
        : [...current, index];
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // Ticks just won't be remembered.
      }
      return next;
    });
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
