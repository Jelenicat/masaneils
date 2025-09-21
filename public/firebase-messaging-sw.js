/* eslint-disable no-undef */
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

// ✅ Init
firebase.initializeApp({
  apiKey: "AIzaSyBpluULKCmNlrbfQLzbqms4Yfvw2p_3OQ8",
  authDomain: "masaneils.firebaseapp.com",
  projectId: "masaneils",
  messagingSenderId: "727570739394",
  appId: "1:727570739394:web:d45c2f5e2138d3077dcb5b",
});

const messaging = firebase.messaging();

// (opciono) odmah preuzmi kontrolu kad se SW update-uje
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
self.addEventListener("install", () => self.skipWaiting());

// 🔔 1) FCM background poruke BEZ notification objekta
messaging.onBackgroundMessage((payload) => {
  // Ako je stigao notification objekat, Chrome će ga sam prikazati — ne radimo ništa
  if (payload.notification) return;

  const title = payload?.data?.title || "Obaveštenje";
  const body  = payload?.data?.body  || "";

  // Preferiraj click_action, pa url/link, pa "/"
  let clickAction = payload?.data?.click_action || payload?.data?.url || payload?.data?.link || "/";

  // Ako je istog origin-a → konvertuj u relativnu rutu (SPA-friendly)
  try {
    const u = new URL(clickAction, self.location.origin);
    clickAction = (u.origin === self.location.origin)
      ? (u.pathname + u.search + u.hash)
      : u.toString();
  } catch {
    // ostavi kako je
  }

  self.registration.showNotification(title, {
    body,
    icon: "/icon-192x192.png",
    tag: "abeauty-notify",   // pomaže protiv dupliranja istog tipa
    renotify: true,
    data: { click_action: clickAction },
  });
});

// 🔔 2) (opciono) Web Push fallback — ako server pošalje standardni notification objekat
// ovde nije potrebno ništa specijalno; browser će prikazati notifikaciju

// 🖱️ 3) Klik na notifikaciju — fokusiraj tab i pošalji poruku da SPA navigira
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  // Izvuci rutu/URL iz raznih mesta (zavisno kako FCM spakuje data)
  let clickAction =
    event.notification?.data?.click_action ||
    event.notification?.data?.url ||
    event.notification?.data?.link ||
    event.notification?.data?.FCM_MSG?.data?.click_action ||
    "/";

  // Normalizuj — relativno za isti origin, inače apsolutno
  try {
    const u = new URL(clickAction, self.location.origin);
    clickAction = (u.origin === self.location.origin)
      ? (u.pathname + u.search + u.hash)
      : u.toString();
  } catch {
    // ostavi kako je
  }

  event.waitUntil((async () => {
    // Probaj da fokusiraš postojeći tab iste aplikacije
    const allClients = await clients.matchAll({ type: "window", includeUncontrolled: true });
    const sameOrigin = allClients.find(c => c.url.startsWith(self.location.origin));

    if (sameOrigin) {
      await sameOrigin.focus();
      // Pošalji poruku SPA-u da on uradi useNavigate (bez reloada)
      try {
        sameOrigin.postMessage({ __OPEN_ROUTE__: clickAction });
      } catch {}
      return;
    }

    // Nema otvorenih tabova → otvori novi prozor (apsolutni URL)
    const absolute = clickAction.startsWith("http")
      ? clickAction
      : (self.location.origin + clickAction);
    await clients.openWindow(absolute);
  })());
});
