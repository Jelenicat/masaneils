import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import "./UnesiPodatke.css";

const UnesiPodatke = () => {
  const [brojTelefona, setBrojTelefona] = useState("");
  const [datumRodjenja, setDatumRodjenja] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const fetchSmena = async () => {
      const korisnickoIme = localStorage.getItem("korisnickoIme");
      if (!korisnickoIme) return;

      const docRef = doc(db, "korisnici", korisnickoIme);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.smena) {
          localStorage.setItem("smena", data.smena);
        }
      }
    };

    fetchSmena();
  }, []);

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
        { brojTelefona, datumRodjenja },
        { merge: true }
      );

      alert("Uspešno sačuvano!");
      navigate("/korisnik");
    } catch (error) {
      console.error("Greška pri čuvanju podataka:", error);
      alert("Došlo je do greške prilikom čuvanja podataka.");
    }
  };

  return (
    <div className="unesi-page">
      <form
        className="unesi-form"
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
      >
        <h2>📱 Unesi dodatne podatke</h2>

        <label htmlFor="telefon">Broj telefona</label>
        <input
          id="telefon"
          type="text"
          placeholder="Na primer: 0612345678"
          value={brojTelefona}
          onChange={(e) => setBrojTelefona(e.target.value)}
        />

        <label htmlFor="datum">Datum rođenja</label>
        <input
          id="datum"
          type="date"
          value={datumRodjenja}
          onChange={(e) => setDatumRodjenja(e.target.value)}
        />

        <button type="submit">Sačuvaj</button>
      </form>
    </div>
  );
};

export default UnesiPodatke;
