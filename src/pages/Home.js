import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import "./Home.css";

const Home = () => {
  const [username, setUsername] = useState("");
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    const trimmedUsername = username.trim();
    if (trimmedUsername === "") return;

    localStorage.setItem("korisnickoIme", trimmedUsername);

    if (trimmedUsername === "masa") {
      navigate("/admin");
    } else {
      try {
        const docRef = doc(db, "korisnici", trimmedUsername);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.brojTelefona && data.datumRodjenja) {
            navigate("/odabir-usluge"); // ← IDI PRVO OVDE
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
      <form className="login-form" onSubmit={handleLogin}>
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
