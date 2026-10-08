"use client";

import { useEffect, useState } from "react";

// A list she can tick off at the store. Ticks are remembered on this phone only.
export default function Checklist({ items, storageKey }: { items: string[]; storageKey: string }) {
  const [checked, setChecked] = useState<number[]>([]);

  useEffect(() => {
    try {
      setChecked(JSON.parse(localStorage.getItem(storageKey) ?? "[]"));
    } catch {
      // Nothing saved, or this browser blocks storage.
    }
  }, [storageKey]);

  function toggle(index: number) {
    const next = checked.includes(index)
      ? checked.filter((i) => i !== index)
      : [...checked, index];
    setChecked(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      // Ticks just won't be remembered.
    }
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
