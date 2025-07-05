import React, { useState } from "react";
import { db } from "../firebase";
import { doc, updateDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import "./UnesiPodatke.css";

const Verify = () => {
  const [brojTelefona, setBrojTelefona] = useState("");
  const [datumRodjenja, setDatumRodjenja] = useState("");
  const navigate = useNavigate();
  const username = localStorage.getItem("korisnickoIme");

  const handleSubmit = async () => {
    if (!brojTelefona || !datumRodjenja) return;

    try {
      const korisnikRef = doc(db, "korisnici", username);
      await updateDoc(korisnikRef, {
        brojTelefona,
        datumRodjenja,
      });

      navigate("/kalendar"); // ili bilo koja stranica za klijente
    } catch (error) {
      console.error("Greška pri ažuriranju korisnika:", error);
    }
  };

  return (
    <div className="verify-page">
      <h2>Unesi svoje podatke</h2>
      <input
        type="text"
        placeholder="Broj telefona"
        value={brojTelefona}
        onChange={(e) => setBrojTelefona(e.target.value)}
      />
      <input
        type="date"
        placeholder="Datum rođenja"
        value={datumRodjenja}
        onChange={(e) => setDatumRodjenja(e.target.value)}
      />
      <button onClick={handleSubmit}>Sačuvaj</button>
    </div>
  );
};

export default Verify;
