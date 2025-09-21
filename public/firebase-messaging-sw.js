/* eslint-disable no-undef */
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

// podigni verziju pri svakoj izmeni da forsira update
const SW_VERSION = "v8";

// ✅ Init Firebase
firebase.initializeApp({
  apiKey: "AIzaSyBpluULKCmNlrbfQLzbqms4Yfvw2p_3OQ8",
  authDomain: "masaneils.firebaseapp.com",
  projectId: "masaneils",
  messagingSenderId: "727570739394",
  appId: "1:727570739394:web:d45c2f5e2138d3077dcb5b",
});

const messaging = firebase.messaging();

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

// helpers
function toAbsolute(raw) {
  try { return new URL(raw, self.location.origin).toString(); }
  catch { return self.location.origin + (raw || "/"); }
}
function extractPath(abs) {
  try {
    const u = new URL(abs);
    return u.pathname + u.search + u.hash; // npr. /ponudjeni/test1
  } catch {
    return abs.startsWith("/") ? abs : "/" + abs;
  }
}
function toHashUrl(path) {
  const scope = (self.registration && self.registration.scope) || (self.location.origin + "/");
  const scopeTrim = scope.endsWith("/") ? scope.slice(0, -1) : scope;
  const p = path.startsWith("/") ? path : "/" + path;
  return `${scopeTrim}#${p}`;
}

// 🔔 Background data-only FCM → prikaži notifikaciju
messaging.onBackgroundMessage((payload) => {
  if (payload.notification) return; // browser sam prikazuje ako postoji notification obj.

  const title = payload?.data?.title || "Obaveštenje";
  const body  = payload?.data?.body  || "";
  const raw   = payload?.data?.click_action || payload?.data?.url || payload?.data?.link || "/";

  const absolute = toAbsolute(raw);
  const path     = extractPath(absolute);   // SPA ruta
  const hashUrl  = toHashUrl(path);         // uvek u PWA scope

  self.registration.showNotification(title, {
    body,
    icon: "/icon-192x192.png",
    tag: hashUrl,                 // deduplikacija po destinaciji
    renotify: true,
    data: { absolute, path, hashUrl, swv: SW_VERSION },
  });
});

// 🖱️ Klik na notifikaciju
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const path    = event.notification?.data?.path || "/";
  const hashUrl = event.notification?.data?.hashUrl || toHashUrl(path);

  event.waitUntil((async () => {
    // 1) ako postoji otvoren tab istog origin-a → fokus + poruka app-u da navigira
    try {
      const list = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const sameOrigin = list.filter(c => c.url.startsWith(self.location.origin));
      if (sameOrigin.length) {
        const target = sameOrigin[sameOrigin.length - 1]; // poslednji aktivni
        await target.focus();
        try { target.postMessage({ __OPEN_ROUTE__: path }); } catch {}
        return;
      }
    } catch { /* ignore */ }

    // 2) nema otvorenih tabova → otvori novi prozor (hash deeplink da padne u PWA)
    await self.clients.openWindow(hashUrl);
  })());
});
