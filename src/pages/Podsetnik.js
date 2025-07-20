import React, { useState, useEffect } from "react";
import {
  db,
  refreshFcmToken,
  onMessageListener,
} from "../firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import "./Podsetnik.css";

const Podsetnik = () => {
  const [naslov, setNaslov] = useState("");
  const [opis, setOpis] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    // 🚨 Postavljamo masa kao lokalno korisničko ime (radi tokena)
    localStorage.setItem("korisnickoIme", "masa");

    // 🔄 Osvetli token ako nije već u localStorage
    refreshFcmToken();

    // 🎧 Slušanje poruka dok je aplikacija otvorena
onMessageListener().then((payload) => {
  console.log("📩 Primljena notifikacija dok je tab otvoren:", payload);

  // Prikazujemo nativnu notifikaciju
  const notification = new Notification(payload.notification.title, {
    body: payload.notification.body,
  });

  // Kada korisnik klikne na notifikaciju, preusmeri ga
  notification.onclick = () => {
    window.focus(); // Fokus na prozor ako je u pozadini
    navigate("/podsetnici");
  };
});

  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const token = localStorage.getItem("fcmToken");

    if (!token) {
      alert("❌ Nije pronađen FCM token. Proveri da li si dozvolila notifikacije.");
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
