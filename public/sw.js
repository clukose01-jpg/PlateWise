// PlateWise's service worker. It lets the app be installed on a phone's home screen, shows the
// daily dinner reminder, and keeps a copy of her plan so it opens without signal, like in a store.
const PAGES = "platewise-pages-v1";
const STATIC = "platewise-static-v1";
// Old copies of the app's files are dropped past this many.
const MAX_STATIC = 150;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) =>
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((name) => ![PAGES, STATIC].includes(name)).map((name) => caches.delete(name))))
      .then(() => self.clients.claim()),
  ),
);

// Pages that work from a saved copy: her plan, the opening screen and her profile. Not the admin,
// setup or login pages, and not making a new plan, which needs signal anyway.
function keepsCopy(url) {
  return url.pathname === "/" || url.pathname === "/more" || url.pathname.startsWith("/plan/");
}

async function trimStatic() {
  const cache = await caches.open(STATIC);
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - MAX_STATIC)).map((key) => cache.delete(key)));
}

// Saves a page, and the app's files it needs (scripts, styles, fonts), so it works without signal
// even if it was never opened before.
async function savePage(url) {
  const response = await fetch(url, { credentials: "same-origin" });
  if (!response.ok) return;
  const html = await response.clone().text();
  await (await caches.open(PAGES)).put(url, response);
  const files = [...new Set(html.match(/\/_next\/static\/[^"'\s)\\]+/g) ?? [])];
  const cache = await caches.open(STATIC);
  await Promise.all(
    files.map(async (file) => {
      if (await cache.match(file)) return;
      const asset = await fetch(file).catch(() => null);
      if (asset?.ok) await cache.put(file, asset);
    }),
  );
  await trimStatic();
}

// Shown for a page that needs signal, or one not saved yet.
const OFFLINE_PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>PlateWise</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;box-sizing:border-box;font-family:system-ui,sans-serif;font-size:17px;line-height:1.5;background:#fbf5ee;color:#2e2620;text-align:center}a{color:#4f7a4a;font-weight:600}@media (prefers-color-scheme:dark){body{background:#1c1b1a;color:#f2f0ed}a{color:#a9cf9b}}</style></head><body><div><p>You're offline, and this page needs signal.</p><p><a href="/">Open my plan</a></p></div></body></html>`;

function offlinePage() {
  return new Response(OFFLINE_PAGE, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // The app's own files never change once made (each version has new names), so a saved copy is
  // always right.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.open(STATIC).then(async (cache) => {
        const saved = await cache.match(request);
        if (saved) return saved;
        const response = await fetch(request);
        if (response.ok) {
          await cache.put(request, response.clone());
          trimStatic();
        }
        return response;
      }),
    );
    return;
  }

  if (request.mode !== "navigate") return;
  // Pages: always the latest when there's signal, and the saved copy when there isn't.
  if (keepsCopy(url)) {
    event.respondWith(
      fetch(request)
        .then(async (response) => {
          if (response.ok) await (await caches.open(PAGES)).put(url.href, response.clone());
          return response;
        })
        .catch(async () => (await caches.match(url.href, { cacheName: PAGES })) ?? offlinePage()),
    );
    return;
  }
  // Any other page without signal gets a kind message instead of the browser's error.
  event.respondWith(fetch(request).catch(() => offlinePage()));
});

// The app asks to save her plan's tabs when she opens it, and to forget saved pages when she
// deletes a plan or logs out.
self.addEventListener("message", (event) => {
  const message = event.data ?? {};
  if (message.type === "save-pages" && Array.isArray(message.urls)) {
    event.waitUntil(
      Promise.all(
        message.urls
          .map((path) => new URL(path, self.location.origin))
          .filter((url) => url.origin === self.location.origin && keepsCopy(url))
          .map((url) => savePage(url.href).catch(() => {})),
      ),
    );
  }
  if (message.type === "forget-pages") event.waitUntil(caches.delete(PAGES));
});

self.addEventListener("push", (event) => {
  let message = { title: "PlateWise", body: "Tap to see tonight's dinner.", url: "/" };
  try {
    message = { ...message, ...event.data.json() };
  } catch {
    // Show the default message.
  }
  event.waitUntil(
    self.registration.showNotification(message.title, {
      body: message.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: "platewise-daily",
      data: { url: message.url },
    }),
  );
});

// Tapping the reminder opens PlateWise, reusing an open window if there is one. The admin page
// has its own home screen icon, so its window is left alone.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url ?? "/", self.location.origin).href;
  const isAdmin = (client) => new URL(client.url).pathname.startsWith("/admin");
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const open = windows.find((client) => client.url.startsWith(self.location.origin) && !isAdmin(client));
      if (open) return open.navigate(url).then((client) => client?.focus());
      return self.clients.openWindow(url);
    }),
  );
});
