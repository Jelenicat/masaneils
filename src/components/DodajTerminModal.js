import React, { useState, useEffect } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import "./DodajTerminModal.css";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";

const vremeOpcije = [
  "08:00", "08:15", "08:30", "08:45",
  "09:00", "09:15", "09:30", "09:45",
  "10:00", "10:15", "10:30", "10:45",
  "11:00", "11:15", "11:30", "11:45",
  "12:00", "12:15", "12:30", "12:45",
  "13:00", "13:15", "13:30", "13:45",
  "14:00", "14:15", "14:30", "14:45",
  "15:00", "15:15", "15:30", "15:45",
  "16:00", "16:15", "16:30", "16:45",
  "17:00", "17:15", "17:30", "17:45",
  "18:00", "18:15", "18:30", "18:45",
  "19:00", "19:15", "19:30", "19:45",
  "20:00", "20:15", "20:30", "20:45",
  "21:00"
];

const combineDateAndTime = (date, timeStr) => {
  if (!date || !timeStr) return null;
  const [h, m] = timeStr.split(":");
  const combined = new Date(date);
  combined.setHours(parseInt(h, 10));
  combined.setMinutes(parseInt(m, 10));
  return combined;
};

const DodajTerminModal = ({
  eventData,
  onClose,
  onSave,
  setEventData,
  isEditing,
  isLoading,
  onDelete,
}) => {
  const [datum, setDatum] = useState(eventData.start ? new Date(eventData.start) : null);
  const [vremePocetak, setVremePocetak] = useState(eventData.start ? formatTime(eventData.start) : "");
  const [vremeKraj, setVremeKraj] = useState(eventData.end ? formatTime(eventData.end) : "");
const [korisnici, setKorisnici] = useState([]);
useEffect(() => {
  const fetchKorisnici = async () => {
    const snapshot = await getDocs(collection(db, "korisnici"));
    const lista = snapshot.docs
      .map((doc) => doc.id)
      .filter((id) => id !== "masa"); // ❌ Ukloni admina
    setKorisnici(lista);
  };
  fetchKorisnici();
}, []);



  useEffect(() => {
    const noviStart = combineDateAndTime(datum, vremePocetak);
    const noviEnd = combineDateAndTime(datum, vremeKraj);
    setEventData(prev => ({
      ...prev,
      start: noviStart,
      end: noviEnd
    }));
  }, [datum, vremePocetak, vremeKraj]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setEventData((prev) => ({ ...prev, [name]: value }));
  };

  function formatTime(date) {
    const d = new Date(date);
    const h = d.getHours().toString().padStart(2, "0");
    const m = d.getMinutes().toString().padStart(2, "0");
    return `${h}:${m}`;
  }

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2>{isEditing ? "Izmeni termin" : "Dodaj novi termin"}</h2>

        <label>Tip termina:</label>
        <select name="tip" value={eventData.tip} onChange={handleChange}>
          <option value="slobodan">Slobodan</option>
          <option value="zauzet">Zauzet</option>
          <option value="termin">Termin</option>
          <option value="edukacija">Edukacija</option>
          <option value="odmor">Odmor</option>
        </select>

        <label>📆 Datum:</label>
        <DatePicker
          selected={datum}
          onChange={(date) => setDatum(date)}
          dateFormat="dd.MM.yyyy"
          placeholderText="Izaberi datum"
          minDate={new Date()}
        />

        <label>🕒 Početak:</label>
        <select value={vremePocetak} onChange={(e) => setVremePocetak(e.target.value)}>
          <option value="">-- Odaberi vreme --</option>
          {vremeOpcije.map((v) => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>

        <label>🕓 Kraj:</label>
        <select value={vremeKraj} onChange={(e) => setVremeKraj(e.target.value)}>
          <option value="">-- Odaberi vreme --</option>
          {vremeOpcije.map((v) => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>

{eventData.tip === "termin" && (
  <>
    <label>Izaberi klijenta:</label>
    <select
      name="clientUsername"
      value={eventData.clientUsername || ""}
      onChange={handleChange}
    >
      <option value="">-- Odaberi klijenta --</option>
      {korisnici.map((korisnik) => (
        <option key={korisnik} value={korisnik}>
          {korisnik}
        </option>
      ))}
    </select>
  </>
)}


        {(eventData.tip === "termin" || eventData.tip === "edukacija") && (
          <>
            <label>Cena (RSD):</label>
            <input
              type="number"
              name="cena"
              value={eventData.cena || ""}
              onChange={handleChange}
              placeholder="Unesi iznos (npr. 2000)"
              min="0"
            />
          </>
        )}

        <label>Napomena (opciono):</label>
        <input
          type="text"
          name="note"
          value={eventData.note || ""}
          onChange={handleChange}
        />

        <div className="modal-buttons">
          <button onClick={onClose}>Otkaži</button>
          <button onClick={onSave} disabled={isLoading || !datum || !vremePocetak || !vremeKraj}>
            {isEditing ? "Sačuvaj izmene" : "Dodaj"}
          </button>
          {isEditing && (
            <button
              onClick={() => {
                if (window.confirm("Da li sigurno želiš da obrišeš ovaj termin?")) {
                  onDelete(eventData.id);
                }
              }}
              className="delete-button"
            >
              Obriši termin
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default DodajTerminModal;
