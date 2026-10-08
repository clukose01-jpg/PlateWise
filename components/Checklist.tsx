"use client";

import { useEffect, useRef, useState } from "react";

// A list she can tick off at the store. Ticks are remembered on this phone only.
export default function Checklist({ items, storageKey }: { items: string[]; storageKey: string }) {
  const [checked, setChecked] = useState<number[]>([]);
  const loaded = useRef(false);

  useEffect(() => {
    try {
      const saved: number[] = JSON.parse(localStorage.getItem(storageKey) ?? "[]");
      // Keep any ticks made while the page was still loading.
      setChecked((current) => [...new Set([...saved, ...current])]);
    } catch {
      // Nothing saved, or this browser blocks storage.
    }
    loaded.current = true;
  }, [storageKey]);

  useEffect(() => {
    if (!loaded.current) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(checked));
    } catch {
      // Ticks just won't be remembered.
    }
  }, [checked, storageKey]);

  function toggle(index: number) {
    setChecked((current) =>
      current.includes(index) ? current.filter((i) => i !== index) : [...current, index],
    );
  }

  return (
    <ul className="checklist">
      {items.map((item, i) => (
        <li key={i}>
          <label className={checked.includes(i) ? "done" : undefined}>
            <input type="checkbox" checked={checked.includes(i)} onChange={() => toggle(i)} />
            <span>{item}</span>
          </label>
        </li>
      ))}
    </ul>
  );
}
