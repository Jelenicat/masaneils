// src/pages/Istorija.js
import React, { useEffect, useState } from "react";
import { db } from "../firebase";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
} from "firebase/firestore";
import "./Istorija.css";
import { useNavigate } from "react-router-dom";

const Istorija = () => {
  const korisnickoIme = localStorage.getItem("korisnickoIme");
  const [termini, setTermini] = useState([]);
const navigate = useNavigate();
  useEffect(() => {
    const fetchTermini = async () => {
      const q = query(
        collection(db, "admin_kalendar"),
        where("clientUsername", "==", korisnickoIme),
        where("tip", "==", "termin")
      );

      const snapshot = await getDocs(q);
      const podaci = snapshot.docs.map((doc) => {
        const data = doc.data();
        const start = data.start.toDate ? data.start.toDate() : new Date(data.start);
        return {
          id: doc.id,
          datum: start.toLocaleDateString("sr-RS"),
          vreme: start.toLocaleTimeString("sr-RS", { hour: "2-digit", minute: "2-digit" }),
          note: data.note || "",
        };
      });

      setTermini(podaci);
    };

    fetchTermini();
  }, [korisnickoIme]);

  return (
    <div className="istorija-stranica">
      <div className="istorija-box">
        <h2>Tvoji prethodni termini</h2>
        {termini.length === 0 ? (
          <p>Nemate zakazanih termina.</p>
        ) : (
          <ul>
            {termini.map((t) => (
              <li key={t.id}>
                📅 {t.datum} u {t.vreme} {t.note && `– ${t.note}`}
              </li>
            ))}
          </ul>
          
        )}
        <button className="nazad-dugme" onClick={() => navigate("/korisnik")}>
             Nazad
</button>

      </div>
    </div>
  );
};

export default Istorija;
