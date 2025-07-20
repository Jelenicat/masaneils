import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db, refreshFcmToken } from "../firebase";
import "./Home.css";

const Home = () => {
  const [username, setUsername] = useState("");
  const navigate = useNavigate();

  // 🔁 Ako postoji korisničko ime u localStorage – automatski loguj
  useEffect(() => {
    const korisnickoIme = localStorage.getItem("korisnickoIme");
    if (korisnickoIme) {
      refreshFcmToken(); // 🔄 Zatraži novi FCM token ako nema

      if (korisnickoIme === "masa") {
        navigate("/admin");
      } else {
        const docRef = doc(db, "korisnici", korisnickoIme);
        getDoc(docRef).then((docSnap) => {
          if (
            docSnap.exists() &&
            docSnap.data().brojTelefona &&
            docSnap.data().datumRodjenja
          ) {
            // ➕ Ako postoji click_action u URL-u, idi tamo
            const url = new URL(window.location.href);
            const pathname = url.pathname;

            console.log("🔁 Navigiram na:", pathname); // Za debag

            navigate(pathname || "/korisnik");
          } else {
            navigate("/unesi-podatke");
          }
        });
      }
    }
  }, [navigate]);

  // 👤 Ručno logovanje
  const handleLogin = async (e) => {
    e.preventDefault();
    const trimmedUsername = username.trim();
    if (!trimmedUsername) return;

    localStorage.setItem("korisnickoIme", trimmedUsername);
    await refreshFcmToken(); // 🔄 Zatraži novi FCM token pri logovanju

    if (trimmedUsername === "masa") {
      navigate("/admin");
    } else {
      try {
        const docRef = doc(db, "korisnici", trimmedUsername);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.brojTelefona && data.datumRodjenja) {
            navigate("/korisnik");
          } else {
            navigate("/unesi-podatke");
          }
        } else {
          alert("Korisnik ne postoji u bazi.");
        }
      } catch (error) {
        console.error("Greška pri proveri korisnika:", error);
        alert("Došlo je do greške. Pokušaj ponovo.");
      }
    }
  };

  return (
    <div className="login-page">
      <form className="home-form" onSubmit={handleLogin}>
        <h1>Dobrodošla!</h1>
        <input
          type="text"
          placeholder="Unesi korisničko ime"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <button type="submit">Prijavi se</button>
      </form>
    </div>
  );
};

export default Home;
