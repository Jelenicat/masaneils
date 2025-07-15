// src/components/DodajTerminModal.js
import React from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import "./DodajTerminModal.css";

const DodajTerminModal = ({
  eventData,
  onClose,
  onSave,
  setEventData,
  isEditing,
  isLoading,
}) => {
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
          <option value="edukacija">Edukacija</option>
        </select>

        <label>Početak:</label>
        <DatePicker
          selected={eventData.start ? new Date(eventData.start) : null}
          onChange={(date) =>
            setEventData((prev) => ({
              ...prev,
              start: date,
            }))
          }
          showTimeSelect
          timeFormat="HH:mm"
          timeIntervals={15}
          dateFormat="dd.MM.yyyy HH:mm"
          placeholderText="Izaberi početak"
        />

        <label>Kraj:</label>
        <DatePicker
          selected={eventData.end ? new Date(eventData.end) : null}
          onChange={(date) =>
            setEventData((prev) => ({
              ...prev,
              end: date,
            }))
          }
          showTimeSelect
          timeFormat="HH:mm"
          timeIntervals={15}
          dateFormat="dd.MM.yyyy HH:mm"
          placeholderText="Izaberi kraj"
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
