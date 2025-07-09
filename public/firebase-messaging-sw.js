// public/firebase-messaging-sw.js
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

// Firebase inicijalizacija
firebase.initializeApp({
  apiKey: "AIzaSyBpluULKCmNlrbfQLzbqms4Yfvw2p_3OQ8",
  authDomain: "masaneils.firebaseapp.com",
  projectId: "masaneils",
  messagingSenderId: "727570739394",
  appId: "1:727570739394:web:d45c2f5e2138d3077dcb5b"
});

const messaging = firebase.messaging();

// Background poruke
messaging.onBackgroundMessage(function(payload) {
  console.log('[firebase-messaging-sw.js] Primljena background poruka:', payload);

  const notification = payload.notification || payload.data;

  const notificationTitle = notification.title || "Nova obaveštenja";
  const notificationOptions = {
    body: notification.body || "",
    icon: "/icon-192x192.png",
    data: {
     click_action: notification.click_action || "https://masaneils.vercel.app/ponudjeni-termini",

    },
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Kada korisnik klikne na notifikaciju
self.addEventListener("notificationclick", function(event) {
  const clickAction = event.notification?.data?.click_action || "https://masaneils.vercel.app";

  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(windowClients => {
      for (const client of windowClients) {
        if (client.url === clickAction && "focus" in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(clickAction);
      }
    })
  );
});
