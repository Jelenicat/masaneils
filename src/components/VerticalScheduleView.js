import React from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import "./VerticalScheduleView.css";

const dani = ["Ponedeljak", "Utorak", "Sreda", "Četvrtak", "Petak", "Subota"];
const sati = Array.from({ length: 13 }, (_, i) => 9 + i); // 9h–21h

// Convert day number to name
const getDayName = (date) => {
  const dan = new Date(date).getDay();
  return ["Nedelja", "Ponedeljak", "Utorak", "Sreda", "Četvrtak", "Petak", "Subota"][dan];
};

// Get the current week's Monday
const getMonday = () => {
  const today = new Date();
  const day = today.getDay();
  const diff = today.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(today.setDate(diff));
};

const VerticalScheduleView = ({
  events,
  onSelectSlot,
  onSelectEvent,
  showModal,
  setShowModal,
  newEventData,
  setNewEventData,
  isEditing,
  setIsEditing,
  korisnice,
  handleSaveEvent,
  handleDeleteEvent,
  handleSendSuggestion,
  isLoading,
}) => {
  // Handle slot selection
  const handleSlotClick = (dan, sat) => {
    const monday = getMonday();
    const dayIndex = dani.indexOf(dan);
    const startDate = new Date(monday);
    startDate.setDate(monday.getDate() + dayIndex);
    startDate.setHours(sat, 0, 0, 0);
    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // Default to 1 hour
    onSelectSlot({ start: startDate, end: endDate });
  };

  return (
    <div className="vertical-schedule-view">
      {dani.map((dan) => (
        <div key={dan} className="dan-blok">
          <h3 className="naslov-dana">{dan}</h3>
          <div className="sati">
            {sati.map((sat) => {
              const event = events.find((e) => {
                const startDate = new Date(e.start);
                const endDate = new Date(e.end);
                const eventDan = getDayName(startDate);
                const eventStartHour = startDate.getHours();
                const eventEndHour = endDate.getHours();
                const eventEndMinutes = endDate.getMinutes();

                return (
                  eventDan === dan &&
                  ((eventStartHour === sat) ||
                    (eventStartHour < sat && eventEndHour > sat) ||
                    (eventEndHour === sat && eventEndMinutes > 0))
                );
              });

              return (
                <div
                  key={sat}
                  className="slot"
                  onClick={() => (event ? onSelectEvent(event) : handleSlotClick(dan, sat))}
                  style={{ cursor: "pointer" }}
                >
                  <span className="sat">{sat}:00</span>
                  <div className="sadrzaj">
                    {event ? (
                      <span
                        className="event-info"
                        style={{
                          backgroundColor:
                            event.tip === "slobodan"
                              ? "#e0f7e0"
                              : event.tip === "zauzet"
                              ? "#f7e0e0"
                              : event.tip === "termin"
                              ? "#ffe4ec"
                              : "#f0f0f0",
                        }}
                      >
                        {event.tip === "termin"
                          ? `💅 ${event.clientUsername || "Zakazano"}`
                          : event.tip === "slobodan"
                          ? "slobodan"
                          : event.tip === "zauzet"
                          ? "zauzet"
                          : event.title}
                      </span>
                    ) : (
                      <span className="prazno">-</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 className="text-xl font-bold mb-6 text-gray-800">
              {isEditing ? "Izmeni termin" : "Dodaj novi termin"}
            </h3>

            <div className="form-group">
              <label>
                Tip termina <span className="text-red-500">*</span>
              </label>
              <select
                value={newEventData.tip}
                onChange={(e) => setNewEventData({ ...newEventData, tip: e.target.value })}
              >
                <option value="">-- Izaberi tip --</option>
                <option value="slobodan">Slobodan</option>
                <option value="zauzet">Zauzet</option>
                <option value="termin">Termin</option>
                <option value="obaveza">Obaveza</option>
              </select>
            </div>

            {newEventData.tip === "termin" && (
              <div className="form-group">
                <label>
                  Korisnica <span className="text-red-500">*</span>
                </label>
                <select
                  value={newEventData.clientUsername || ""}
                  onChange={(e) =>
                    setNewEventData({ ...newEventData, clientUsername: e.target.value })
                  }
                >
                  <option value="">-- Izaberi korisnicu --</option>
                  {korisnice.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="form-group">
              <label>Napomena</label>
              <input
                type="text"
                value={newEventData.note}
                onChange={(e) => setNewEventData({ ...newEventData, note: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label>
                Početak <span className="text-red-500">*</span>
              </label>
              <DatePicker
                selected={newEventData.start}
                onChange={(date) => setNewEventData({ ...newEventData, start: date })}
                showTimeSelect
                timeIntervals={15}
                dateFormat="Pp"
                minTime={new Date(0, 0, 0, 8, 0)}
                maxTime={new Date(0, 0, 0, 22, 0)}
              />
            </div>

            <div className="form-group">
              <label>
                Kraj <span className="text-red-500">*</span>
              </label>
              <DatePicker
                selected={newEventData.end}
                onChange={(date) => setNewEventData({ ...newEventData, end: date })}
                showTimeSelect
                timeIntervals={15}
                dateFormat="Pp"
                minTime={new Date(0, 0, 0, 8, 0)}
                maxTime={new Date(0, 0, 0, 22, 0)}
              />
            </div>

            <div className="duration-presets">
              <button
                onClick={() => {
                  if (newEventData.start) {
                    setNewEventData({
                      ...newEventData,
                      end: new Date(newEventData.start.getTime() + 30 * 60 * 1000),
                    });
                  }
                }}
                className="duration-button"
              >
                30 min
              </button>
              <button
                onClick={() => {
                  if (newEventData.start) {
                    setNewEventData({
                      ...newEventData,
                      end: new Date(newEventData.start.getTime() + 60 * 60 * 1000),
                    });
                  }
                }}
                className="duration-button"
              >
                1 sat
              </button>
            </div>

            <div className="modal-buttons flex gap-3 mt-6 justify-center">
              <button
                onClick={handleSaveEvent}
                className="confirm-button bg-primary text-white px-6 py-3 rounded-lg font-semibold hover:bg-primary-hover transition disabled:opacity-50"
                disabled={isLoading}
              >
                {isLoading ? "Čuva se..." : "Sačuvaj"}
              </button>
              {isEditing && (
                <>
                  <button
                    onClick={handleSendSuggestion}
                    className="bg-blue-500 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-600 transition"
                  >
                    Pošalji predlog korisnicama
                  </button>
                  <button
                    onClick={handleDeleteEvent}
                    className="delete-button bg-red-500 text-white px-6 py-3 rounded-lg font-semibold hover:bg-red-600 transition"
                  >
                    Obriši
                  </button>
                </>
              )}
              <button
                onClick={() => setShowModal(false)}
                className="cancel-button bg-gray-200 text-gray-800 px-6 py-3 rounded-lg font-semibold hover:bg-gray-300 transition"
              >
                Otkaži
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VerticalScheduleView;