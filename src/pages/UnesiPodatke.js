import React, { useState } from "react";
import { db } from "../firebase";
import { doc, setDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import "./UnesiPodatke.css";

const UnesiPodatke = () => {
  const [brojTelefona, setBrojTelefona] = useState("");
  const [datumRodjenja, setDatumRodjenja] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async () => {
    if (!brojTelefona || !datumRodjenja) {
      alert("Popuni oba polja!");
      return;
    }

    try {
      const korisnickoIme = localStorage.getItem("korisnickoIme");

      if (!korisnickoIme) {
        alert("Greška: korisničko ime nije pronađeno.");
        return;
      }

      const docRef = doc(db, "korisnici", korisnickoIme);

      await setDoc(
        docRef,
        {
          brojTelefona,
          datumRodjenja,
        },
        { merge: true }
      );

      alert("Uspešno sačuvano!");
      navigate("/kalendar");
    } catch (error) {
      console.error("Greška pri čuvanju podataka:", error);
      alert("Došlo je do greške prilikom čuvanja podataka.");
    }
  };

  return (
    <div className="unesi-page">
      <form className="unesi-form" onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
        <h2>Unesi dodatne podatke</h2>
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
        <button type="submit">Sačuvaj</button>
      </form>
    </div>
  );
};

export default UnesiPodatke;
