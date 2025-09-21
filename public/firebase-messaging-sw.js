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
  // Ako je stigao notification objekat, Chrome će sam prikazati — ništa ne radimo
  if (payload.notification) return;

  const title = payload?.data?.title || "Obaveštenje";
  const body  = payload?.data?.body  || "";
  // šalji i apsolutni i relativni link – mi koristimo relativni unutar SPA
  const link  = payload?.data?.link || payload?.data?.click_action || "/";

  self.registration.showNotification(title, {
    body,
    icon: "/icon-192x192.png",
    data: { link }, // VAŽNO: ovde spremimo rutu
  });
});

// 🔔 2) Web Push fallback (ako server pošalje standardni push sa notification objektom)
self.addEventListener("push", (event) => {
  // Ako koristiš isključivo FCM data poruke, ovo neće ni biti potrebno,
  // ali je korisno kao fallback.
  try {
    const data = event.data?.json() || {};
    const title =
      data?.notification?.title || data?.data?.title || "Obaveštenje";
    const body  =
      data?.notification?.body  || data?.data?.body  || "";
    const link  =
      data?.data?.link ||
      data?.notification?.click_action ||
      "/";

    event.waitUntil(
      self.registration.showNotification(title, {
        body,
        icon: "/icon-192x192.png",
        data: { link },
      })
    );
  } catch {
    // no-op
  }
});

// 🖱️ 3) Klik na notifikaciju — fokusiraj neki tab i NAVIGIRAJ GA na rutu
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  // link je RELATIVAN za SPA (npr. /ponudjeni/test1); ako dobiješ apsolutni, izvuci path
  let link = event.notification?.data?.link || "/";
  try {
    if (link.startsWith("http")) link = new URL(link).pathname + new URL(link).search;
  } catch {}

  event.waitUntil((async () => {
    const allClients = await clients.matchAll({ type: "window", includeUncontrolled: true });

    if (allClients.length > 0) {
      // Fokusiraj prvi postojeći tab i navigiraj ga na željenu rutu
      const client = allClients[0];
      await client.focus();
      try { await client.navigate(link); } catch {} // navigate radi i ako je već fokusiran
      return;
    }

    // Nema otvorenih tabova – otvori novi prozor na željeni link (apsolutni)
    const absolute = self.origin ? self.origin + link : "https://masaneils.vercel.app" + link;
    await clients.openWindow(absolute);
  })());
});
