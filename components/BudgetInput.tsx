"use client";

import type { KeyboardEvent } from "react";

// A dollar box for the weekly grocery budget. Only digits go in; Enter finishes instead of sending
// the whole form.
export default function BudgetInput({
  id,
  value,
  onChange,
  onDone,
  autoFocus,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  onDone?: () => void;
  autoFocus?: boolean;
}) {
  function onKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" && onDone) {
      event.preventDefault();
      onDone();
    }
  }

  return (
    <div className="money">
      <span aria-hidden="true">$</span>
      <input
        id={id}
        inputMode="numeric"
        value={value}
        onChange={(event) => onChange(event.target.value.replace(/\D/g, "").slice(0, 4))}
        onKeyDown={onKey}
        placeholder="No limit"
        autoFocus={autoFocus}
        enterKeyHint="done"
      />
    </div>
  );
}
