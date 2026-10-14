"use client";

import { useState } from "react";
import { ShareIcon } from "./Illustrations";

type Section = { section: string; items: string[] };

// Ticks are saved by section, as the place of each item in it (see Checklist).
function tickedIn(planId: string, section: string): number[] {
  try {
    const saved = JSON.parse(localStorage.getItem(`platewise.${planId}.grocery.${section}`) ?? "[]");
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

// What's left to buy, by store section, ready to paste into a message or note.
function listText(planId: string, sections: Section[]) {
  let ticked = 0;
  const groups = sections
    .map(({ section, items }) => {
      const done = tickedIn(planId, section);
      ticked += done.length;
      const left = items.filter((_, i) => !done.includes(i));
      return left.length ? `${section}\n${left.map((item) => `- ${item}`).join("\n")}` : "";
    })
    .filter(Boolean);
  if (!groups.length) return null;
  const title = ticked ? "Still to get, from PlateWise:" : "Grocery list, from PlateWise:";
  const link = `${window.location.origin}/plan/${planId}?tab=groceries`;
  return `${title}\n\n${groups.join("\n\n")}\n\nThe whole plan: ${link}`;
}

// "Send list" on the Groceries tab: the phone's share sheet (Messages, Notes, WhatsApp…), or a copy
// on a computer. Items already ticked off are left out.
export default function SendList({ planId, sections }: { planId: string; sections: Section[] }) {
  const [status, setStatus] = useState<string | null>(null);

  async function send() {
    const text = listText(planId, sections);
    if (!text) {
      setStatus("Everything's ticked off, so there's nothing left to send.");
      return;
    }
    setStatus(null);
    if (navigator.share) {
      try {
        await navigator.share({ title: "Grocery list", text });
      } catch {
        // She closed the share sheet.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setStatus("Copied. Paste it into a message or note.");
    } catch {
      window.prompt("Copy the list:", text);
    }
  }

  return (
    <div className="send-list">
      <button type="button" className="secondary" onClick={send}>
        <ShareIcon />
        Send list
      </button>
      {status && (
        <p className="hint" role="status">
          {status}
        </p>
      )}
    </div>
  );
}
