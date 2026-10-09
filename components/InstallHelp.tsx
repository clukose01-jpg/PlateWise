"use client";

import { useEffect, useState } from "react";

// Chrome on Android offers its own install prompt; Safari on iPhone doesn't, so we explain the steps.
type InstallPromptEvent = Event & { prompt: () => Promise<void> };

export default function InstallHelp() {
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    setInstalled(standalone);

    function onInstallPrompt(event: Event) {
      event.preventDefault();
      setInstallEvent(event as InstallPromptEvent);
    }
    window.addEventListener("beforeinstallprompt", onInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onInstallPrompt);
  }, []);

  return (
    <section className="card">
      <h2 className="section-title">Add to your home screen</h2>
      {installed ? (
        <p className="quiet">PlateWise is on your home screen. Open it from there to go straight to today.</p>
      ) : (
        <>
          <p>Open PlateWise like an app, straight to today&apos;s dinner, with no browser bar.</p>
          {installEvent && (
            <button className="primary install" onClick={() => installEvent.prompt()}>
              Add to home screen
            </button>
          )}
          <ul className="install-steps">
            <li>
              <strong>iPhone:</strong> in Safari, tap the Share button, then <em>Add to Home Screen</em>.
            </li>
            <li>
              <strong>Android:</strong> in Chrome, tap the ⋮ menu, then <em>Add to Home screen</em> or{" "}
              <em>Install app</em>.
            </li>
          </ul>
        </>
      )}
    </section>
  );
}
