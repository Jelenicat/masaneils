/* eslint-disable no-undef */
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

// PROMENI verziju kad god menjaš fajl, da forsira update kod korisnika
const SW_VERSION = "v7";

// ✅ Init Firebase
firebase.initializeApp({
  apiKey: "AIzaSyBpluULKCmNlrbfQLzbqms4Yfvw2p_3OQ8",
  authDomain: "masaneils.firebaseapp.com",
  projectId: "masaneils",
  messagingSenderId: "727570739394",
  appId: "1:727570739394:web:d45c2f5e2138d3077dcb5b",
});

const messaging = firebase.messaging();

// Brzo preuzmi kontrolu
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

// Helper: napravi apsolutni URL
function toAbsolute(raw) {
  try { return new URL(raw, self.location.origin).toString(); }
  catch { return self.location.origin + (raw || "/"); }
}

// 🔑 Ključ: napravi HASH deeplink koji UVEK spada u PWA scope (npr. https://app/#/ponudjeni/test1)
function toHashUrl(abs) {
  let path;
  try {
    const u = new URL(abs);
    path = u.pathname + u.search + u.hash; // npr. /ponudjeni/test1
  } catch {
    path = (abs || "/");
    if (!path.startsWith("/")) path = "/" + path;
  }
  const scope = (self.registration && self.registration.scope) || (self.location.origin + "/");
  const scopeTrim = scope.endsWith("/") ? scope.slice(0, -1) : scope;
  return `${scopeTrim}#${path}`;
}

// 🔔 Background data-only FCM → prikaži notifikaciju
messaging.onBackgroundMessage((payload) => {
  if (payload.notification) return; // ako je došao notification obj., browser prikazuje sam

  const title = payload?.data?.title || "Obaveštenje";
  const body  = payload?.data?.body  || "";
  const raw   = payload?.data?.click_action || payload?.data?.url || payload?.data?.link || "/";

  const absolute = toAbsolute(raw);
  const hashUrl  = toHashUrl(absolute); // ← uvek u scope

  self.registration.showNotification(title, {
    body,
    icon: "/icon-192x192.png",
    tag: hashUrl,                 // deduplikacija po destinaciji
    renotify: true,
    data: { absolute, hashUrl, swv: SW_VERSION },
  });
});

// 🖱️ Klik na notifikaciju → uvek otvori HASH deeplink (garantovano u PWA prozoru)
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const abs     = event.notification?.data?.absolute || "/";
  const hashUrl = toHashUrl(abs);
  event.waitUntil(self.clients.openWindow(hashUrl));
});
