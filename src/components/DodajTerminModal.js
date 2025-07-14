// src/components/DodajTerminModal.js
import React from "react";
import "./DodajTerminModal.css";

const DodajTerminModal = ({ eventData, onClose, onSave, setEventData, isEditing, isLoading }) => {
  const handleChange = (e) => {
    const { name, value } = e.target;
    setEventData((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2>{isEditing ? "Izmeni termin" : "Dodaj novi termin"}</h2>

        <label>Tip termina:</label>
        <select name="tip" value={eventData.tip} onChange={handleChange}>
          <option value="slobodan">Slobodan</option>
          <option value="zauzet">Zauzet</option>
          <option value="termin">Termin</option>
        </select>

        <label>Početak:</label>
        <input
          type="datetime-local"
          name="start"
          value={eventData.start ? new Date(eventData.start).toISOString().slice(0, 16) : ""}
          onChange={(e) =>
            setEventData((prev) => ({
              ...prev,
              start: new Date(e.target.value),
            }))
          }
        />

        <label>Kraj:</label>
        <input
          type="datetime-local"
          name="end"
          value={eventData.end ? new Date(eventData.end).toISOString().slice(0, 16) : ""}
          onChange={(e) =>
            setEventData((prev) => ({
              ...prev,
              end: new Date(e.target.value),
            }))
          }
        />

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
          <button onClick={onSave} disabled={isLoading}>
            {isEditing ? "Sačuvaj izmene" : "Dodaj"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DodajTerminModal;
