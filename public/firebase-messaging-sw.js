importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyBpIuuLKCmLrbfQLzbqms4fvw2p_30o8",
  authDomain: "masaneils.firebaseapp.com",
  projectId: "masaneils",
  storageBucket: "masaneils.appspot.com",
  messagingSenderId: "72757073994",
  appId: "1:72757073994:web:d45c2f5e2138d077dcb5b"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function (payload) {
  console.log("[firebase-messaging-sw.js] Received background message ", payload);

  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
