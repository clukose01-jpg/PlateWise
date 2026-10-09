// PlateWise's service worker. It lets the app be installed on a phone's home screen.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
