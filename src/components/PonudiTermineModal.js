// PonudiTermineModal.js
import React, { useState } from "react";
import { db } from "../firebase";
import { doc, setDoc } from "firebase/firestore";

const PonudiTermineModal = ({ korisnickoIme, slobodniTermini, onClose }) => {
  const [selektovani, setSelektovani] = useState([]);

  const toggleTermin = (terminId) => {
    setSelektovani((prev) =>
      prev.includes(terminId)
        ? prev.filter((id) => id !== terminId)
        : [...prev, terminId]
    );
  };

  const handleSubmit = async () => {
    try {
      const odabrani = slobodniTermini.filter((t) =>
        selektovani.includes(t.id)
      );

      await setDoc(doc(db, "ponudjeniTermini", korisnickoIme), {
        termini: odabrani.map((t) => ({
          id: t.id,
          start: t.start.toISOString(),
          end: t.end.toISOString(),
          note: t.note || "",
        })),
        timestamp: Date.now(),
      });

      // 🔔 Slanje push notifikacije korisnici
      await fetch("https://notifikacija-api.vercel.app/api/posalji-notifikaciju", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          korisnickoIme,
          title: "Novi predlozi termina",
          body: "Admin vam je poslao nove termine. Pogledajte ih i izaberite jedan.",
          click_action: "https://masaneils.vercel.app/ponudjeni-termini",
        }),
      });

      onClose();
    } catch (error) {
      console.error("❌ Greška pri slanju predloga termina:", error);
      alert("Greška pri slanju predloga termina.");
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h3>Pošalji predloge korisnici: {korisnickoIme}</h3>
        <ul>
          {slobodniTermini.map((termin) => (
            <li key={termin.id} style={{ marginBottom: "10px" }}>
              <label>
                <input
                  type="checkbox"
                  checked={selektovani.includes(termin.id)}
                  onChange={() => toggleTermin(termin.id)}
                />
                {" "}
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
                })}`}
              </label>
              {termin.note && (
                <div style={{ fontSize: "12px", color: "#777", marginLeft: "22px" }}>
                  📝 {termin.note}
                </div>
              )}
            </li>
          ))}
        </ul>
        <button onClick={handleSubmit}>Pošalji</button>
        <button onClick={onClose} style={{ marginLeft: "10px" }}>
          Zatvori
        </button>
      </div>
    </div>
  );
};

export default PonudiTermineModal;
