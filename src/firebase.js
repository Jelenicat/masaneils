// src/firebase.js
import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";
import { getFirestore } from "firebase/firestore"; // ✅ dodaj ovo

// Firebase konfiguracija
const firebaseConfig = {
  apiKey: "AIzaSyBpluULKCmNlrbfQLzbqms4Yfvw2p_3OQ8",
  authDomain: "masaneils.firebaseapp.com",
  projectId: "masaneils",
  storageBucket: "masaneils.firebasestorage.app",
  messagingSenderId: "727570739394",
  appId: "1:727570739394:web:d45c2f5e2138d3077dcb5b",
};

const VAPID_KEY = "gBBQDJdrolMbk2ln9gwrNwznoWLP7kSyssTL8qZ9d7o";

const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);
const db = getFirestore(app); // ✅ ovde je `db`

export const requestPermission = async () => {
  try {
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      const token = await getToken(messaging, { vapidKey: VAPID_KEY });
      console.log("✅ Token za notifikacije:", token);
      return token;
    } else {
      console.log("❌ Dozvola za notifikacije nije data.");
    }
  } catch (err) {
    console.error("⚠️ Greška prilikom dobijanja dozvole:", err);
  }
};

export const onMessageListener = () =>
  new Promise((resolve) => {
    onMessage(messaging, (payload) => {
      console.log("📩 Poruka stigla dok je aplikacija otvorena:", payload);
      resolve(payload);
    });
  });

export { db, messaging }; // ✅ exportuj `db` i `messaging`
export default app;
