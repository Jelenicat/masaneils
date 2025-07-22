import React, { useState, useEffect } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import "./DodajTerminModal.css";

const vremeOpcije = [
  "08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
  "12:00", "12:30", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30",
  "16:00", "16:30", "17:00", "17:30", "18:00", "18:30", "19:00", "19:30",
  "20:00", "20:30", "21:00"
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
            <label>Korisničko ime klijenta:</label>
            <input
              type="text"
              name="clientUsername"
              value={eventData.clientUsername || ""}
              onChange={handleChange}
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
