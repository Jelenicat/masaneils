// src/firebase.js
import firebase from "firebase/compat/app";
import "firebase/compat/messaging";
import "firebase/compat/firestore";

// ⛔ modular importi nisu potrebni u compat režimu

const firebaseConfig = {
  apiKey: "AIzaSyBpluULKCmNlrbfQLzbqms4Yfvw2p_3OQ8",
  authDomain: "masaneils.firebaseapp.com",
  projectId: "masaneils",
  storageBucket: "masaneils.appspot.com",
  messagingSenderId: "727570739394",
  appId: "1:727570739394:web:d45c2f5e2138d3077dcb5b",
};

// ✅ Init
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const messaging = firebase.messaging();
const db = firebase.firestore();
const VAPID_KEY =
  "BEab5BdgPuxs7N5qEQlF--KlryMsnv3lhS8LGcQtyG_tMjNrZBGhpTzVqmDaw75p5Nb-0QB19cY00WPYwbn6GIM";

// 🧹 Lokalno brisanje tokena
const removeFcmToken = () => {
  console.log("🗑️ Brišem lokalni FCM token");
  localStorage.removeItem("fcmToken");
};

// 🔥 Brisanje tokena iz Firestore (COMPAT)
const removeTokenFromFirestore = async (korisnickoIme) => {
  try {
    await db.collection("fcmTokens").doc(korisnickoIme).delete();
    console.log("🗑️ Token obrisan iz Firestore za:", korisnickoIme);
  } catch (error) {
    console.error("❌ Greška pri brisanju tokena iz Firestore:", error);
  }
};

// 🎧 Foreground listener (vraća unsubscribe)
const onMessageListener = (cb) => {
  return messaging.onMessage((payload) => {
    if (typeof cb === "function") cb(payload);
  });
};

// 🔄 Ako nema token, traži novi
const refreshFcmToken = async () => {
  const existingToken = localStorage.getItem("fcmToken");
  if (!existingToken) {
    console.log("🔄 Nema tokena – tražim novi...");
    await requestPermission();
  }
};

// 📲 Traženje dozvole + čuvanje FCM tokena
const requestPermission = async () => {
  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      console.warn("❌ Korisnik nije dozvolio notifikacije.");
      return;
    }

    const registration =
      (await navigator.serviceWorker.getRegistration()) ||
      (await navigator.serviceWorker.register("/firebase-messaging-sw.js"));

    const token = await messaging.getToken({
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    });

    if (!token) {
      console.warn("⚠️ Token nije dobijen.");
      return;
    }

    const prev = localStorage.getItem("fcmToken");
    if (prev !== token) {
      // token se promenio → snimi lokalno i u Firestore
      console.log("✅ Novi FCM token:", token);
      localStorage.setItem("fcmToken", token);

      const korisnickoIme = localStorage.getItem("korisnickoIme");
      if (korisnickoIme) {
        await db.collection("fcmTokens").doc(korisnickoIme).set({ token });
      }
    } else {
      console.log("ℹ️ Token nepromenjen.");
    }
  } catch (err) {
    console.error("🔥 Greška prilikom traženja dozvole / dobijanja tokena:", err);
  }
};

/**
 * 📤 Slanje notifikacije preko backend API-ja
 * - koristi RELATIVAN path (npr. "/ponudjeni/jelena") da foreground i SW lepo odrade SPA navigaciju
 * - u payload šaljemo i click_action i url i link (radi kompatibilnosti)
 */
const sendNotification = async (korisnickoIme, { title, body, path }) => {
  try {
    // Normalizuj na relativnu rutu (ako nije apsolutni URL)
    let rel = "/";
    if (typeof path === "string" && path.trim()) {
      rel = path.startsWith("http")
        ? path // ako baš proslediš apsolutni, ostavi ga
        : (path.startsWith("/") ? path : `/${path}`);
    }

    await fetch("https://notifikacija-api.vercel.app/api/posalji-notifikaciju", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        korisnickoIme,
        title,
        body,
        click_action: rel, // 👈 primarno polje
        url: rel,          // 👈 fallback polje
        link: rel,         // 👈 još jedan fallback (radi različitih klijenata)
      }),
    });
    console.log("✅ Notifikacija poslata korisniku:", korisnickoIme, rel);
  } catch (error) {
    console.error("❌ Greška pri slanju notifikacije:", error);
  }
};

export {
  db,
  messaging,
  VAPID_KEY,
  removeFcmToken,
  onMessageListener,   // koristi se u App.js
  refreshFcmToken,
  requestPermission,
  removeTokenFromFirestore,
  sendNotification,
};
