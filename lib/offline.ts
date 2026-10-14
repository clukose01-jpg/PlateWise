// Keeps a copy of her plan's tabs on this device, so they open without signal, like in a store
// (the service worker in public/sw.js does the saving).

function tell(message: object) {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  navigator.serviceWorker.ready.then((registration) => registration.active?.postMessage(message)).catch(() => {});
}

export function savePlanForOffline(planId: string) {
  const tabs = ["today", "week", "groceries"].map((tab) => `/plan/${planId}?tab=${tab}`);
  tell({ type: "save-pages", urls: [...tabs, "/", "/more"] });
}

// After a plan is deleted, or she logs out, saved pages shouldn't open any more.
export function forgetOfflinePages() {
  tell({ type: "forget-pages" });
}
