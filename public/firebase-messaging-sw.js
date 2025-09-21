/* eslint-disable no-undef */
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

// 🔁 podigni verziju pri svakoj izmeni da forsira update
const SW_VERSION = "v13";

// ✅ Init Firebase (tvoj projekat)
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

// ---------- BACKGROUND (data-only) → prikaži notifikaciju ----------
messaging.onBackgroundMessage((payload) => {
  const title = payload?.data?.title || payload?.notification?.title || "Obaveštenje";
  const body  = payload?.data?.body  || payload?.notification?.body  || "";

  // 🔥 Prosledi ceo payload.data da klik ima sve (link/url/click_action/weekKey/type…)
  self.registration.showNotification(title, {
    body,
    icon: "/icon-192x192.png",
    badge: "/icon-192x192.png",
    data: payload.data || {},
    renotify: true,
    tag: (payload?.data?.click_action || payload?.data?.url || payload?.data?.link || "") || undefined,
  });
});

// ---------- Klik na notifikaciju ----------
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const d = event.notification?.data || {};
  // prioritet: link → url → click_action → weekKey → fallback na admin/kalendar
  const deep =
    d.link || d.url || d.click_action ||
    (d.weekKey ? `/admin/kalendar?week=${d.weekKey}` : `/admin/kalendar`);

  // uvek apsolutni URL
  const abs = /^https?:\/\//i.test(deep) ? deep : (self.location.origin + deep);

  // debug – vidi u SW DevTools konzoli
  try {
    console.log("[SW v13 click] data =", d);
    console.log("[SW v13 click] open =", abs);
  } catch {}

  // UVEK otvori NOVI tab (ne fokusiramo postojeći prozor, ne šaljemo postMessage)
  event.waitUntil(self.clients.openWindow(abs));
});
