// src/OdabirUsluge.js
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "../firebase";
import { doc, setDoc, getDoc } from "firebase/firestore"; // dodato getDoc
import { requestPermission } from "../firebase";
import "./OdabirUsluge.css";

const OdabirUsluge = () => {
  const [usluga, setUsluga] = useState("");
  const [materijal, setMaterijal] = useState("");
  const navigate = useNavigate();
  const korisnickoIme = localStorage.getItem("korisnickoIme");
  const [velicina, setVelicina] = useState("");


  useEffect(() => {
    // Provera prijave i notifikacije
    if (korisnickoIme && korisnickoIme !== "masa") {
      requestPermission();
    } else if (!korisnickoIme) {
      alert("Molimo prijavite se.");
      navigate("/login");
    }

    // Ako smena nije postavljena, preuzmi je iz baze
    const fetchSmena = async () => {
      if (!localStorage.getItem("smena") && korisnickoIme) {
        try {
          const docRef = doc(db, "korisnici", korisnickoIme);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.smena) {
              localStorage.setItem("smena", data.smena);
            }
          }
        } catch (err) {
          console.error("Greška pri dohvatanju smene:", err);
        }
      }
    };

    fetchSmena();
  }, [korisnickoIme, navigate]);

  const handleSubmit = async () => {
    if (!usluga) {
      alert("Izaberi uslugu.");
      return;
    }
    if (usluga === "Izlivanje" && !materijal) {
      alert("Izaberi da li imaš materijal.");
      return;
    }
 
if (usluga === "Izlivanje" && !velicina) {
  alert("Izaberi veličinu (S, M, L, XL).");
  return;
}


    try {
      const docRef = doc(db, "izbor_usluge", korisnickoIme);
      await setDoc(docRef, {
        korisnickoIme,
        usluga,
        materijal: usluga === "Izlivanje" ? materijal : "nije_bitno",
        velicina: usluga === "Izlivanje" ? velicina : "nije_bitno",
        timestamp: new Date(),      
      });
      localStorage.setItem("usluga", usluga);
      localStorage.setItem("materijal", materijal || "nije_bitno");
      localStorage.setItem("velicina", velicina || "nije_bitno");

      navigate("/kalendar");
    } catch (err) {
      console.error("Greška pri čuvanju u Firestore:", err);
      alert(`Greška pri čuvanju: ${err.message}`);
    }
  };

  return (
    <div className="unesi-page">
      <div className="unesi-form">
        <h2>Odabir usluge</h2>
        <div className="radio-group">
          <p>Koju uslugu radiš?</p>
          <div className="button-group">
            <button
              className={usluga === "Korekcija" ? "active" : ""}
              onClick={() => {
                setUsluga("Korekcija");
                setMaterijal("nije_bitno");
              }}
            >
              Korekcija
            </button>
            <button
              className={usluga === "Izlivanje" ? "active" : ""}
              onClick={() => setUsluga("Izlivanje")}
            >
              Izlivanje
            </button>
          </div>
        </div>
        {usluga === "Izlivanje" && (
          <div className="radio-group">
            <p>Da li već imaš materijal?</p>
            <div className="button-group">
              <button
                className={materijal === "Da" ? "active" : ""}
                onClick={() => setMaterijal("Da")}
              >
                Da
              </button>
              <button
                className={materijal === "Ne" ? "active" : ""}
                onClick={() => setMaterijal("Ne")}
              >
                Ne
              </button>
            </div>
            {usluga === "Izlivanje" && (materijal === "Da" || materijal === "Ne") && (
  <div className="radio-group">
    <p>Izaberi veličinu</p>
    <div className="button-group">
    {["S", "M", "L", "XL"].map((v) => (
  <button
    key={v}
    className={`circle-button ${velicina === v ? "active" : ""}`}
    onClick={() => setVelicina(v)}
  >
    {v}
  </button>
))}

    </div>
  </div>
)}

          </div>
        )}
        <button className="submit-button" onClick={handleSubmit}>
          Dalje
        </button>
        <button onClick={() => navigate("/korisnik")} className="nazad-dugme">
          Nazad
        </button>
      </div>
    </div>
  );
};

export default OdabirUsluge;
