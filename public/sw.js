// PlateWise's service worker. It lets the app be installed on a phone's home screen
// and shows the daily dinner reminder.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

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

// Tapping the reminder opens PlateWise, reusing an open window if there is one.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url ?? "/", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const open = windows.find((client) => client.url.startsWith(self.location.origin));
      if (open) return open.navigate(url).then((client) => client?.focus());
      return self.clients.openWindow(url);
    }),
  );
});
