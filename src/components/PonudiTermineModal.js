// src/PonudiTermineModal.js
import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { toast } from "react-toastify";

const PonudiTermineModal = ({ korisnickoIme, slobodniTermini, onClose }) => {
  const [selektovani, setSelektovani] = useState([]);
  const [usluga, setUsluga] = useState("N/A");

  useEffect(() => {
    const fetchUsluga = async () => {
      try {
        const uslugaDoc = await getDoc(doc(db, "izbor_usluge", korisnickoIme));
        if (uslugaDoc.exists()) {
          setUsluga(uslugaDoc.data().usluga || "N/A");
        }
      } catch (error) {
        console.error("Greška pri učitavanju usluge:", error);
        toast.error("Greška pri učitavanju usluge.");
      }
    };
    if (korisnickoIme) {
      fetchUsluga();
    }
  }, [korisnickoIme]);

  const toggleTermin = (terminId) => {
    setSelektovani((prev) =>
      prev.includes(terminId)
        ? prev.filter((id) => id !== terminId)
        : [...prev, terminId]
    );
  };

  const handleSubmit = async () => {
    if (!korisnickoIme) {
      toast.error("Korisničko ime nije dostupno.");
      return;
    }
    if (selektovani.length === 0) {
      toast.error("Izaberite barem jedan termin.");
      return;
    }

    try {
      const odabrani = slobodniTermini.filter((t) => selektovani.includes(t.id));
      const terminiData = odabrani.map((t) => ({
        id: t.id,
        start: t.start,
        end: t.end,
        note: t.note || "",
        usluga,
      }));

      await setDoc(doc(db, "predlozeniTermini", korisnickoIme), {
        korisnica: korisnickoIme,
        termini: terminiData,
        timestamp: new Date(),
      });

      const notificationBody = odabrani
        .map((t) => `${new Date(t.start).toLocaleString("sr-RS")} (${usluga})`)
        .join(", ");

      await fetch("https://notifikacija-api.vercel.app/api/posalji-notifikaciju", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          korisnickoIme,
          title: "Novi predlozi termina 💅",
          body: `Predloženi termini: ${notificationBody}`,
          click_action: "https://masaneils.vercel.app/ponudjeni-termini",
        }),
      });

      toast.success("Predlozi uspešno poslati!");
      onClose();
    } catch (error) {
      console.error("Greška pri slanju predloga termina:", error);
      toast.error("Greška pri slanju predloga termina.");
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h3>Pošalji predloge korisnici: {korisnickoIme}</h3>
        {slobodniTermini?.length > 0 ? (
          <ul>
            {slobodniTermini.map((termin) => (
              <li key={termin.id} style={{ marginBottom: "10px" }}>
                <label>
                  <input
                    type="checkbox"
                   _room                    checked={selektovani.includes(termin.id)}
                    onChange={() => toggleTermin(termin.id)}
                  />
                  {`${new Date(termin.start).toLocaleDateString("sr-RS", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                  })}, ${new Date(termin.start).toLocaleTimeString("sr-RS", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })} – ${new Date(termin.end).toLocaleTimeString("sr-RS", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })} (${usluga})`}
                </label>
                {termin.note && (
                  <div style={{ fontSize: "12px", color: "#777", marginLeft: "22px" }}>
                    📝 {termin.note}
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p>Nema dostupnih slobodnih termina.</p>
        )}
        <div className="modal-buttons">
          <button onClick={handleSubmit} className="confirm-button">
            Pošalji
          </button>
          <button onClick={onClose} className="cancel-button" style={{ marginLeft: "10px" }}>
            Zatvori
          </button>
        </div>
      </div>
    </div>
  );
};

export default PonudiTermineModal;