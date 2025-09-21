/* eslint-disable no-undef */
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

// 🔁 podigni verziju pri svakoj izmeni da forsira update
const SW_VERSION = "v9";

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

// ---------- helpers ----------
function toAbsolute(raw) {
  try {
    return new URL(raw, self.location.origin).toString();
  } catch {
    return self.location.origin + (raw || "/");
  }
}

function extractPath(abs) {
  try {
    const u = new URL(abs);
    return u.pathname + u.search + u.hash; // npr. /admin/kalendar?week=2025-09-15
  } catch {
    return abs?.startsWith("/") ? abs : "/" + (abs || "");
  }
}

function toHashUrl(path) {
  // kada nema otvorenih tabova, otvori u PWA scope sa #/ruta (robusnije)
  const scope = (self.registration && self.registration.scope) || (self.location.origin + "/");
  const scopeTrim = scope.endsWith("/") ? scope.slice(0, -1) : scope;
  const p = path.startsWith("/") ? path : "/" + path;
  return `${scopeTrim}#${p}`;
}

function resolveUrlFromPayload(payload) {
  // preferiraj data.click_action / data.url / data.link
  const d = payload?.data || {};
  const raw =
    d.click_action ||
    d.url ||
    d.link ||
    "/";

  return {
    absolute: toAbsolute(raw),
    path: extractPath(toAbsolute(raw)),
    source: "data",
  };
}

function resolveUrlFromNotification(notification) {
  // neki browseri guraju sve pod FCM_MSG → notification.data.FCM_MSG.data.click_action
  const fcmMsg = (notification?.data && notification.data.FCM_MSG) || null;
  const raw =
    notification?.data?.url ||
    (fcmMsg && fcmMsg.data && (fcmMsg.data.click_action || fcmMsg.data.url || fcmMsg.data.link)) ||
    "/";

  return {
    absolute: toAbsolute(raw),
    path: extractPath(toAbsolute(raw)),
    source: "notification",
  };
}

// ---------- BACKGROUND (data-only) → prikaži notifikaciju ----------
messaging.onBackgroundMessage((payload) => {
  // Ako payload ima notification objekat, browser često sam prikaže — mi ćemo i dalje pokušati da setujemo data za klik fallback
  const title = payload?.data?.title || payload?.notification?.title || "Obaveštenje";
  const body  = payload?.data?.body  || payload?.notification?.body  || "";

  const { absolute, path } = resolveUrlFromPayload(payload);
  const hashUrl = toHashUrl(path);

  self.registration.showNotification(title, {
    body,
    icon: "/icon-192x192.png",
    badge: "/icon-192x192.png",
    tag: hashUrl, // deduplikacija po destinaciji
    renotify: true,
    data: { absolute, path, hashUrl, swv: SW_VERSION, FCM_MSG: payload }, // čuvamo payload kao fallback
  });
});

// ---------- Klik na notifikaciju ----------
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  // 1) pokušaj da izvučeš rutu iz data postavljenog prilikom showNotification
  let path = event.notification?.data?.path || null;
  let hashUrl = event.notification?.data?.hashUrl || null;

  // 2) fallback: izvuci iz notification.data.FCM_MSG ako postoji (kada browser sam prikaže notifikaciju)
  if (!path) {
    const { path: p2 } = resolveUrlFromNotification(event.notification || {});
    path = p2 || "/";
  }
  if (!hashUrl) {
    hashUrl = toHashUrl(path);
  }

  event.waitUntil((async () => {
    // Pronađi postojeći tab tvoje aplikacije
    try {
      const list = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const sameOrigin = list.filter((c) => c.url.startsWith(self.location.origin));
      if (sameOrigin.length) {
        const target = sameOrigin[sameOrigin.length - 1]; // poslednji aktivni tab aplikacije
        await target.focus();
        // Pošalji poruku app-u da internim routerom ode na path (SPA-friendly)
        try {
          target.postMessage({ __OPEN_ROUTE__: path, swv: SW_VERSION });
        } catch {}
        return;
      }
    } catch {
      // ignore
    }

    // Nema otvorenih tabova → otvori novi prozor direktno na hash deep-link (robustno za PWA)
    await self.clients.openWindow(hashUrl);
  })());
});
