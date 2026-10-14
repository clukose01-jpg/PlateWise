"use client";

import { useEffect, useState } from "react";

// Without signal, a plan opens from the copy saved on this device; this says so.
export default function OfflineNote() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (!offline) return null;
  return (
    <p className="offline-note" role="status">
      You&apos;re offline, so this is the copy saved on this device. Ticking things off still works.
    </p>
  );
}
