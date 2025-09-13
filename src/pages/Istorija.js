// src/pages/Istorija.js
import React, { useEffect, useState } from "react";
import { db } from "../firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import "./Istorija.css";
import { useNavigate } from "react-router-dom";

const Istorija = () => {
  const korisnickoIme = localStorage.getItem("korisnickoIme");
  const [prosli, setProsli] = useState([]);   // lista prošlih
  const [buduci, setBuduci] = useState([]);   // lista budućih
  const [activeTab, setActiveTab] = useState("buduci"); // "prosli" | "buduci"
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
        const start = data.start?.toDate ? data.start.toDate() : new Date(data.start);
        return { id: doc.id, ...data, start };
      });

      // globalno sortiranje uzlazno po start
      const sortirani = svi.sort((a, b) => a.start - b.start);

      const sada = new Date();
      const prosliTermini = sortirani.filter((t) => t.start < sada);
      const buduciTermini = sortirani.filter((t) => t.start >= sada);

      // Prošli: najskoriji na vrhu → obrnuto
      setProsli([...prosliTermini].reverse());

      // Budući: uzlazno, najbliži prvi
      setBuduci(buduciTermini);
    };

    fetchTermini();
  }, [korisnickoIme]);

  const formatiraj = (date) =>
    date.toLocaleDateString("sr-RS", {
      weekday: "long",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }) + " u " + date.toLocaleTimeString("sr-RS", { hour: "2-digit", minute: "2-digit" });

  const listaZaPrikaz = activeTab === "prosli" ? prosli : buduci;

  return (
    <div className="istorija-stranica">
      <div className="istorija-box">
        <h2>Tvoji termini</h2>

        {/* TABOVI */}
        <div className="tabs">
          <button
            className={`tab ${activeTab === "prosli" ? "active" : ""}`}
            onClick={() => setActiveTab("prosli")}
          >
            Prošli
          </button>
          <button
            className={`tab ${activeTab === "buduci" ? "active" : ""}`}
            onClick={() => setActiveTab("buduci")}
          >
            Budući
          </button>
        </div>

        {/* LISTA TERMINA */}
        <ul>
          {listaZaPrikaz.length === 0 && (
            <li className="prazno">Nema termina za prikaz.</li>
          )}

          {listaZaPrikaz.map((t) => (
            <li key={t.id}>
              📅 {formatiraj(t.start)}
            </li>
          ))}
        </ul>

        <button className="nazad-dugme" onClick={() => navigate("/korisnik")}>
          Nazad
        </button>
      </div>
    </div>
  );
};

export default Istorija;
