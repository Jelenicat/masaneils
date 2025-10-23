import React, { useState, useEffect } from "react";
import { db, refreshFcmToken, onMessageListener } from "../firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import "./Podsetnik.css";

const Podsetnik = () => {
  const [naslov, setNaslov] = useState("");
  const [opis, setOpis] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    // ✅ Postavljamo admin korisnika (masa)
    localStorage.setItem("korisnickoIme", "masa");

    // ✅ Osvežavanje FCM tokena
    try {
      refreshFcmToken();
    } catch (err) {
      console.error("Greška pri refreshFcmToken:", err);
    }

    // ✅ Slušanje poruka dok je aplikacija otvorena
    let unsubscribe;
    try {
      unsubscribe = onMessageListener((payload) => {
        console.log("📩 Primljena notifikacija (foreground):", payload);

        const title = payload?.notification?.title || "Obaveštenje";
        const body = payload?.notification?.body || "";

        // 🔔 Prikaz notifikacije samo ako je dozvoljeno
        if (typeof Notification !== "undefined" && Notification.permission === "granted") {
          const notif = new Notification(title, { body });
          notif.onclick = () => {
            window.focus();
            navigate("/admin/podsetnik");
          };
        } else {
          // fallback ako nije dozvoljeno
          alert(`${title}${body ? " — " + body : ""}`);
          navigate("/admin/podsetnik");
        }
      });
    } catch (error) {
      console.error("Greška u onMessageListener:", error);
    }

    // 🧹 cleanup
    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const token = localStorage.getItem("fcmToken");

    if (!token) {
      alert("❌ Nije pronađen FCM token. Proveri da li su notifikacije dozvoljene.");
      return;
    }

    try {
      await addDoc(collection(db, "podsetnici"), {
        tekst: `${naslov} - ${opis}`,
        aktivan: true,
        korisnikToken: token,
        zadnjiPutPoslato: "",
        kreirao: "masa",
        timestamp: serverTimestamp(),
      });

      alert("✅ Podsetnik je uspešno sačuvan!");
      setNaslov("");
      setOpis("");
    } catch (error) {
      console.error("❌ Greška pri dodavanju podsetnika:", error);
      alert("Došlo je do greške. Pogledaj konzolu za detalje.");
    }
  };

  return (
    <div className="podsetnik-page">
      <form className="podsetnik-form" onSubmit={handleSubmit}>
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

        <button type="submit">Sačuvaj</button>

        <button
          type="button"
          className="nazad-dugme"
          onClick={() => navigate("/admin")}
        >
          ⬅ Nazad
        </button>
      </form>
    </div>
  );
};

export default Podsetnik;
