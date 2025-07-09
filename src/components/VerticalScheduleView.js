import React, { useMemo } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import "./VerticalScheduleView.css";
import { format, isSameDay, startOfWeek, addDays, differenceInMinutes } from "date-fns";

const dani = ["Ponedeljak", "Utorak", "Sreda", "Četvrtak", "Petak", "Subota"];
const sati = Array.from({ length: 13 }, (_, i) => 9 + i); // 9h–21h

const getDayName = (date) => {
  const dan = new Date(date).getDay();
  return ["Nedelja", "Ponedeljak", "Utorak", "Sreda", "Četvrtak", "Petak", "Subota"][dan];
};

const VerticalScheduleView = ({
  events,
  selectedWeekStart,
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
  const groupedEvents = useMemo(() => {
    const groups = {};
    events.forEach((event) => {
      const day = getDayName(event.start);
      if (!groups[day]) groups[day] = [];
      groups[day].push(event);
    });
    return groups;
  }, [events]);

  const handleSlotClick = (dan, sat) => {
    const startOfSelectedWeek = startOfWeek(selectedWeekStart, { weekStartsOn: 1 });
    const dayIndex = dani.indexOf(dan);
    const startDate = new Date(startOfSelectedWeek);
    startDate.setDate(startOfSelectedWeek.getDate() + dayIndex);
    startDate.setHours(sat, 0, 0, 0);
    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
    onSelectSlot({ start: startDate, end: endDate });
  };

  return (
    <div className="vertical-schedule-view">
      {dani.map((dan) => {
        const currentDayDate = addDays(startOfWeek(selectedWeekStart, { weekStartsOn: 1 }), dani.indexOf(dan));
        const dayEvents = groupedEvents[dan] || [];
        const eventSlots = {};

        dayEvents.forEach((event) => {
          const startHour = new Date(event.start).getHours();
          const endHour = new Date(event.end).getHours();
          const endMinutes = new Date(event.end).getMinutes();
          for (let hour = startHour; hour <= endHour; hour++) {
            if (hour === startHour || hour < endHour || (hour === endHour && endMinutes > 0)) {
              eventSlots[hour] = event;
            }
          }
        });

        return (
          <div key={dan} className="dan-blok">
            <h3 className="naslov-dana">{dan}</h3>
            <div className="sati">
              {sati.map((sat) => {
                const event = eventSlots[sat];
                if (event) {
                  const startTime = format(new Date(event.start), "HH:mm");
                  const endTime = format(new Date(event.end), "HH:mm");
                  const durationMinutes = differenceInMinutes(new Date(event.end), new Date(event.start));
                  const rowSpan = Math.ceil(durationMinutes / 60);

                  return (
                    <React.Fragment key={sat}>
                      {sat === new Date(event.start).getHours() && (
                        <div
                          className="slot multi-hour-slot"
                          style={{ gridRow: `span ${rowSpan}` }}
                          onClick={() => onSelectEvent(event)}
                        >
                          <span className="sat">{`${startTime}–${endTime}`}</span>
                          <div className="sadrzaj">
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
                              {event.title}
                            </span>
                          </div>
                        </div>
                      )}
                    </React.Fragment>
                  );
                } else {
                  return (
                    <div
                      key={sat}
                      className="slot"
                      onClick={() => handleSlotClick(dan, sat)}
                      style={{ cursor: "pointer" }}
                    >
                      <span className="sat">{sat}:00</span>
                      <div className="sadrzaj">
                        <span className="prazno">-</span>
                      </div>
                    </div>
                  );
                }
              })}
            </div>
            <button
              className="dodaj-termin-dugme"
              onClick={() => {
                const startDate = new Date(currentDayDate);
                startDate.setHours(9, 0, 0, 0);
                const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
                onSelectSlot({ start: startDate, end: endDate });
              }}
            >
              ➕ Dodaj termin
            </button>
          </div>
        );
      })}

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