// src/pages/Istorija.js
import React, { useEffect, useState } from "react";
import { db } from "../firebase";
import {
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import "./Istorija.css";
import { useNavigate } from "react-router-dom";

const Istorija = () => {
  const korisnickoIme = localStorage.getItem("korisnickoIme");
  const [sledeci, setSledeci] = useState(null);
  const [prosli, setProsli] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchTermini = async () => {
      const q = query(
        collection(db, "admin_kalendar"),
        where("clientUsername", "==", korisnickoIme),
        where("tip", "==", "termin")
      );

      const snapshot = await getDocs(q);
      const svi = snapshot.docs.map((doc) => {
        const data = doc.data();
        const start = data.start.toDate ? data.start.toDate() : new Date(data.start);
        return {
          id: doc.id,
          start,
        };
      });

      // sortiraj po vremenu
      const sortirani = svi.sort((a, b) => a.start - b.start);

      const sada = new Date();
      const prosliTermini = sortirani.filter(t => t.start < sada);
      const buduciTermini = sortirani.filter(t => t.start >= sada);

      setProsli(prosliTermini.length > 0 ? prosliTermini[prosliTermini.length - 1] : null);
      setSledeci(buduciTermini.length > 0 ? buduciTermini[0] : null);
    };

    fetchTermini();
  }, [korisnickoIme]);

  const formatiraj = (date) => {
    return date.toLocaleDateString("sr-RS", {
      weekday: "long",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }) + " u " + date.toLocaleTimeString("sr-RS", { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="istorija-stranica">
      <div className="istorija-box">
        <h2>Tvoji termini</h2>
        <ul>
          {prosli && (
            <li>
              📅 {formatiraj(prosli.start)}
            </li>
          )}
          {sledeci && (
            <li>
              📅 {formatiraj(sledeci.start)}
            </li>
          )}
        </ul>
        <button className="nazad-dugme" onClick={() => navigate("/korisnik")}>
          Nazad
        </button>
      </div>
    </div>
  );
};

export default Istorija;
