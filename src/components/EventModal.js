// src/components/EventModal.js
import React from "react";
import "./EventModal.css"; // ako želiš dodatni CSS

const EventModal = ({
  show,
  onClose,
  eventData,
  setEventData,
  isEditing,
  setIsEditing,
  onSave,
}) => {
  if (!show) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setEventData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = () => {
    if (onSave) onSave();
    setIsEditing(false);
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h3>{isEditing ? "Izmeni termin" : "Dodaj termin"}</h3>

        <label>Tip termina:</label>
        <select
          name="tip"
          value={eventData.tip}
          onChange={handleChange}
        >
          <option value="">Odaberi...</option>
          <option value="slobodan">Slobodan</option>
          <option value="zauzet">Zauzet</option>
          <option value="termin">Potvrđen termin</option>
          <option value="obaveza">Obaveza</option>
        </select>

        <label>Napomena:</label>
        <input
          type="text"
          name="note"
          value={eventData.note || ""}
          onChange={handleChange}
        />

        <button onClick={handleSubmit}>
          {isEditing ? "Sačuvaj izmene" : "Dodaj"}
        </button>
        <button onClick={onClose} style={{ marginLeft: "10px" }}>
          Otkaži
        </button>
      </div>
    </div>
  );
};

export default EventModal;
