/* eslint-disable no-undef */
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

// 🔁 menjaš kad deployuješ da forsira update SW-a
const SW_VERSION = "v4";

// ✅ Init
firebase.initializeApp({
  apiKey: "AIzaSyBpluULKCmNlrbfQLzbqms4Yfvw2p_3OQ8",
  authDomain: "masaneils.firebaseapp.com",
  projectId: "masaneils",
  messagingSenderId: "727570739394",
  appId: "1:727570739394:web:d45c2f5e2138d3077dcb5b",
});

const messaging = firebase.messaging();

// odmah preuzmi kontrolu kad se SW update-uje
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
self.addEventListener("install", () => self.skipWaiting());

// 🔔 Background FCM poruke BEZ notification objekta → prikaži notifikaciju
messaging.onBackgroundMessage((payload) => {
  // ako je došao notification objekat, browser će ga sam prikazati
  if (payload.notification) return;

  const title = payload?.data?.title || "Obaveštenje";
  const body  = payload?.data?.body  || "";

  // uzmi odredište iz više mogućih polja
  const rawLink =
    payload?.data?.click_action ||
    payload?.data?.url ||
    payload?.data?.link ||
    "/";

  // ✅ napravi APSOLUTNI URL (ključ za pouzdano otvaranje na telefonu)
  let absolute;
  try {
    const u = new URL(rawLink, self.location.origin);
    absolute = u.toString();
  } catch {
    absolute = self.location.origin + rawLink;
  }

  self.registration.showNotification(title, {
    body,
    icon: "/icon-192x192.png",
    tag: absolute,                     // deduplikacija po destinaciji
    renotify: true,
    data: { absolute, swv: SW_VERSION }
  });
});

// 🖱️ Klik na notifikaciju → uvek otvori/redi­rektuj prozor na apsolutni URL
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  let absolute =
    event.notification?.data?.absolute ||
    event.notification?.data?.click_action ||
    event.notification?.data?.url ||
    event.notification?.data?.link ||
    "/";

  // normalizuj opet na apsolutni
  try {
    const u = new URL(absolute, self.location.origin);
    absolute = u.toString();
  } catch {
    absolute = self.location.origin + absolute;
  }

  event.waitUntil((async () => {
    // Najstabilnije na Android/PWA: uvek otvoriti/redi­rektovati
    await self.clients.openWindow(absolute);
  })());
});
