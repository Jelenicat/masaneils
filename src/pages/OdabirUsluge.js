import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "../firebase";
import { doc, setDoc } from "firebase/firestore";
import { requestPermission } from "../firebase";
import "./OdabirUsluge.css";

const OdabirUsluge = () => {
  const [usluga, setUsluga] = useState("");
  const [materijal, setMaterijal] = useState("");
  const navigate = useNavigate();

  // ✅ Automatski traži dozvolu za notifikacije kad se korisnik uloguje
  useEffect(() => {
    const korisnickoIme = localStorage.getItem("korisnickoIme");
    if (korisnickoIme && korisnickoIme !== "masa") {
      requestPermission(); // Token se tada i snima
    }
  }, []);

  const handleSubmit = async () => {
    if (!usluga) return alert("Izaberi uslugu.");
    if (usluga === "Izlivanje" && !materijal)
      return alert("Izaberi da li imaš materijal.");

    localStorage.setItem("usluga", usluga);
    localStorage.setItem("materijal", materijal || "");

    const korisnickoIme = localStorage.getItem("korisnickoIme");

    try {
      const docRef = doc(db, "izbor_usluge", korisnickoIme);
      await setDoc(docRef, {
        korisnickoIme,
        usluga,
        materijal: usluga === "Izlivanje" ? materijal : "nije bitno",
        timestamp: new Date().toISOString(),
      });
      navigate("/kalendar");
    } catch (err) {
      console.error("Greška pri čuvanju u Firestore:", err);
      alert("Došlo je do greške pri čuvanju izbora.");
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
                setMaterijal("");
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
          </div>
        )}

        <button className="submit-button" onClick={handleSubmit}>
          Dalje
        </button>
      </div>
    </div>
  );
};

export default OdabirUsluge;
