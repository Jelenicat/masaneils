import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import "./Podsetnik.css";
import {
  collection,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

const messaging = getMessaging();

const Podsetnik = () => {
  const [naslov, setNaslov] = useState("");
  const [opis, setOpis] = useState("");
  const [vreme, setVreme] = useState("");

  useEffect(() => {
    const korisnik = localStorage.getItem("korisnickoIme");

    if (korisnik === "masa") {
      Notification.requestPermission().then((permission) => {
        if (permission === "granted") {
          const vapidKey =
            process.env.REACT_APP_VAPID_KEY ||
            "gBBQDJdrolMbk2ln9gwrNwznoWLP7kSyssTL8qZ9d7o"; // fallback

          console.log("VAPID Key:", vapidKey);

          getToken(messaging, { vapidKey })
            .then((token) => {
              if (token) {
                console.log("✅ FCM token:", token);
                localStorage.setItem("fcmToken", token);
              } else {
                console.warn("⚠️ No FCM token received.");
              }
            })
            .catch((err) => console.error("FCM greška:", err));
        } else {
          console.warn("Notification permission denied.");
        }
      });

      onMessage(messaging, (payload) => {
        console.log("📩 Notifikacija dok je tab otvoren:", payload);
        new Notification(payload.notification.title, {
          body: payload.notification.body,
        });
      });
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, "podsetnici"), {
        naslov,
        opis,
        vreme,
        kreirao: "masa",
        timestamp: serverTimestamp(),
      });

      const token = localStorage.getItem("fcmToken");

      if (token) {
        await fetch(
          "https://notifikacija-api.vercel.app/api/posalji-notifikaciju", // promeni na svoj backend URL
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              token,
              title: naslov,
              body: opis,
            }),
          }
        );
      }

      alert("✅ Podsetnik je dodat!");
      setNaslov("");
      setOpis("");
      setVreme("");
    } catch (error) {
      console.error("Greška pri dodavanju podsetnika:", error);
    }
  };

  return (
    <div className="login-page">
      <form className="login-form" onSubmit={handleSubmit}>
        <h1>Dodaj novi podsetnik</h1>
        <input
          type="text"
          placeholder="Naslov"
          value={naslov}
          onChange={(e) => setNaslov(e.target.value)}
          required
        />
        <textarea
          placeholder="Opis"
          value={opis}
          onChange={(e) => setOpis(e.target.value)}
          required
        />
        <input
          type="datetime-local"
          value={vreme}
          onChange={(e) => setVreme(e.target.value)}
          required
        />
        <button type="submit">Sačuvaj</button>
      </form>
    </div>
  );
};

export default Podsetnik;
