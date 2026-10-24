// Shows Freshly push messages; payload is { title, body, url, notificationId? } from convex/pushNode.ts.
self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.title || "Freshly", {
      body: data.body || "",
      data: { url: data.url || "/" },
      tag: data.notificationId || "freshly",
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(self.clients.openWindow(event.notification.data.url));
});
