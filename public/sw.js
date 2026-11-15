const CACHE = "thoviet-v1.2";
const CORE = ["/", "/index.html", "/style.css", "/shared.js", "/data.js", "/manifest.webmanifest", "/icon-192.png", "/icon-512.png"];
self.addEventListener("install", e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting())));
self.addEventListener("activate", e => e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin || u.pathname.startsWith("/api/")) return;
  if (e.request.mode === "navigate") {
    e.respondWith(fetch(e.request).then(r => { if (r.ok) caches.open(CACHE).then(c => c.put(e.request, r.clone())); return r; }).catch(() => caches.match(e.request).then(r => r || caches.match("/index.html"))));
  }
});
self.addEventListener("push", e => {
  let data = {};
  try { data = e.data ? e.data.json() : {}; } catch { data = { body: e.data?.text?.() || "Bạn có cập nhật mới trên ThợViệt." }; }
  const title = data.title || "ThợViệt";
  const options = { body: data.body || "Bạn có thông báo mới.", icon: data.icon || "/icon-192.png", badge: data.badge || "/icon-192.png", tag: data.tag || "thoviet-update", renotify: true, data: { url: data.url || "/", ...(data.data || {}) }, actions: [{ action: "open", title: "Mở ThợViệt" }] };
  e.waitUntil(self.registration.showNotification(title, options));
});
self.addEventListener("notificationclick", e => {
  e.notification.close();
  const url = new URL(e.notification.data?.url || "/", self.location.origin).href;
  e.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
    for (const client of list) if (new URL(client.url).origin === self.location.origin) return client.navigate(url).then(c => c?.focus());
    return clients.openWindow(url);
  }));
});
