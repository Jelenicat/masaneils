// src/firebase.js
import firebase from "firebase/compat/app";
import "firebase/compat/messaging";
import "firebase/compat/firestore";

// ⛔ OBRIŠI OVO: modular importi ne trebaju u compat režimu
// import { doc, setDoc, deleteDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBpluULKCmNlrbfQLzbqms4Yfvw2p_3OQ8",
  authDomain: "masaneils.firebaseapp.com",
  projectId: "masaneils",
  storageBucket: "masaneils.appspot.com",
  messagingSenderId: "727570739394",
  appId: "1:727570739394:web:d45c2f5e2138d3077dcb5b",
};

// ✅ Inicijalizacija
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const messaging = firebase.messaging();
const db = firebase.firestore();
const VAPID_KEY =
  "BEab5BdgPuxs7N5qEQlF--KlryMsnv3lhS8LGcQtyG_tMjNrZBGhpTzVqmDaw75p5Nb-0QB19cY00WPYwbn6GIM";

// 🧹 Brisanje lokalnog tokena
const removeFcmToken = () => {
  console.log("🗑️ Brišem lokalni FCM token");
  localStorage.removeItem("fcmToken");
};

// 🔥 Brisanje tokena iz Firestore baze (COMPAT način)
const removeTokenFromFirestore = async (korisnickoIme) => {
  try {
    await db.collection("fcmTokens").doc(korisnickoIme).delete();
    console.log("🗑️ Token obrisan iz Firestore za:", korisnickoIme);
  } catch (error) {
    console.error("❌ Greška pri brisanju tokena iz Firestore:", error);
  }
};

// 🎧 Trajni foreground listener: registruje callback i vraća unsubscribe
const onMessageListener = (cb) => {
  return messaging.onMessage((payload) => {
    if (typeof cb === "function") cb(payload);
  });
};

// 🔄 Provera i osvežavanje tokena ako nije već sačuvan
const refreshFcmToken = async () => {
  const existingToken = localStorage.getItem("fcmToken");
  if (!existingToken) {
    console.log("🔄 Nema tokena – tražim novi...");
    await requestPermission();
  }
};

// 📲 Traženje dozvole i čuvanje FCM tokena (COMPAT + postojeći SW ako postoji)
const requestPermission = async () => {
  try {
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      const registration =
        (await navigator.serviceWorker.getRegistration()) ||
        (await navigator.serviceWorker.register("/firebase-messaging-sw.js"));

      const token = await messaging.getToken({
        vapidKey: VAPID_KEY,
        serviceWorkerRegistration: registration,
      });

      if (token) {
        console.log("✅ FCM token:", token);
        localStorage.setItem("fcmToken", token);

        const korisnickoIme = localStorage.getItem("korisnickoIme");
        if (korisnickoIme) {
          // COMPAT upis
          await db.collection("fcmTokens").doc(korisnickoIme).set({ token });
        }
      } else {
        console.warn("⚠️ Token nije dobijen.");
      }
    } else {
      console.warn("❌ Korisnik nije dozvolio notifikacije.");
    }
  } catch (err) {
    console.error("🔥 Greška prilikom traženja dozvole za notifikacije:", err);
  }
};

// 📤 Slanje notifikacije putem backend API-ja
const sendNotification = async (korisnickoIme, { title, body, path }) => {
  try {
    const click_action = `https://masaneils.vercel.app${path}`;
    await fetch("https://notifikacija-api.vercel.app/api/posalji-notifikaciju", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ korisnickoIme, title, body, click_action }),
    });
    console.log("✅ Notifikacija poslata korisniku:", korisnickoIme);
  } catch (error) {
    console.error("❌ Greška pri slanju notifikacije:", error);
  }
};

export {
  db,
  messaging,
  VAPID_KEY,
  removeFcmToken,
  onMessageListener,   // <-- koristi u App.js
  refreshFcmToken,
  requestPermission,
  removeTokenFromFirestore,
  sendNotification,
};
