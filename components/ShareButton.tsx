"use client";

import { useState } from "react";

export default function ShareButton() {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = window.location.origin + window.location.pathname;

    // On phones this opens the share sheet (Messages, WhatsApp, email…).
    if (navigator.share) {
      try {
        await navigator.share({ title: "This week's dinners", url });
      } catch {
        // She closed the share sheet.
      }
      return;
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this link:", url);
    }
  }

  return (
    <button className="primary" onClick={share}>
      {copied ? "Link copied" : "Share this plan"}
    </button>
  );
}
