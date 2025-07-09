// src/pages/Korisnik.js
import React from "react";
import { useNavigate } from "react-router-dom";
import {
  removeFcmToken,
  removeTokenFromFirestore,
} from "../firebase"; // ako koristiš FCM tokene
import "./Korisnik.css";

const Korisnik = () => {
  const navigate = useNavigate();

  const handleZakazi = () => {
    navigate("/odabir-usluge");
  };

  const handleDrugaFunkcija = () => {
    alert("Ova funkcionalnost će uskoro biti dostupna!");
  };

  const handleLogout = async () => {
    try {
      const korisnickoIme = localStorage.getItem("korisnickoIme");

      // 🗑️ Obriši FCM token ako koristiš notifikacije
      if (korisnickoIme) {
        await removeTokenFromFirestore(korisnickoIme);
      }
      removeFcmToken();

      // 🧹 Obriši lokalno korisničko ime
      localStorage.removeItem("korisnickoIme");

      // ↩️ Vrati na početnu stranicu
      navigate("/");
    } catch (error) {
      console.error("Greška pri odjavi:", error);
    }
  };

  return (
    <div className="korisnik-page">
      <div className="korisnik-box">
        <h2>Dobrodošla!</h2>
        <p>Izaberi šta želiš da radiš:</p>
        <div className="korisnik-dugmad">
          <button onClick={handleZakazi}>Zakazi termin</button>
          <button onClick={handleDrugaFunkcija}>Još nešto (uskoro)</button>
          <button onClick={handleLogout} className="odjava-dugme">Odjavi se</button>
        </div>
      </div>
    </div>
  );
};

export default Korisnik;
