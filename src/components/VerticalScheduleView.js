// src/components/VerticalScheduleView.js
import React, { useMemo } from "react";
import "react-datepicker/dist/react-datepicker.css";
import "./VerticalScheduleView.css";
import { format, isSameDay, startOfWeek, addDays, differenceInMinutes } from "date-fns";

const dani = ["Nedelja", "Ponedeljak", "Utorak", "Sreda", "Četvrtak", "Petak", "Subota"];
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
  izboriPoTerminu,
  potvrdiTerminZaKorisnicu,
}) => {
  const groupedEvents = useMemo(() => {
    const groups = {};
    (events || []).forEach((event) => {
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
    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // 1-hour default duration
    onSelectSlot({ start: startDate, end: endDate });
  };

  return (
    <div className="vertical-schedule-view">
      {dani.map((dan) => {
        const currentDayDate = addDays(startOfWeek(selectedWeekStart, { weekStartsOn: 1 }), dani.indexOf(dan));
        const dayEvents = groupedEvents[dan] || [];
        const eventSlots = {};

        dayEvents.forEach((event) => {
          const start = new Date(event.start);
          const end = new Date(event.end);
          const startHour = start.getHours();
          const endHour = end.getHours();
          const endMinutes = end.getMinutes();

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
                  const rowSpan = Math.max(1, Math.ceil(durationMinutes / 60));

                  return (
                    <React.Fragment key={sat}>
                      {sat === new Date(event.start).getHours() && (
                        <div
                          className="slot multi-hour-slot"
                          style={{ gridRow: `span ${rowSpan}` }}
                          onClick={() => {
                            setNewEventData(event);
                            setIsEditing(true);
                            setShowModal(true);
                          }}
                        >
                          <span className="sat">{`${startTime}–${endTime}`}</span>
                          <div className="sadrzaj">
                            <span
                              className="event-info"
                              style={{
                                backgroundColor: event.backgroundColor || "#f0f0f0",
                              }}
                            >
                              {event.title}
                            </span>
                            {event.tip === "slobodan" && izboriPoTerminu?.[event.id]?.length > 0 && (
                              <div className="potvrdi-dugmad">
                                {izboriPoTerminu[event.id].map((korisnica) => (
                                  <div key={korisnica.korisnickoIme} className="korisnica-red">
                                    ✅ {korisnica.korisnickoIme} ({korisnica.usluga})
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        potvrdiTerminZaKorisnicu(event.id, korisnica.korisnickoIme);
                                      }}
                                      className="potvrdi-dugme"
                                    >
                                      Potvrdi
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
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
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
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
              <input
                type="datetime-local"
                value={newEventData.start ? new Date(newEventData.start).toISOString().slice(0, 16) : ""}
                onChange={(e) =>
                  setNewEventData({ ...newEventData, start: new Date(e.target.value) })
                }
              />
            </div>
            <div className="form-group">
              <label>
                Kraj <span className="text-red-500">*</span>
              </label>
              <input
                type="datetime-local"
                value={newEventData.end ? new Date(newEventData.end).toISOString().slice(0, 16) : ""}
                onChange={(e) =>
                  setNewEventData({ ...newEventData, end: new Date(e.target.value) })
                }
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
                    className="suggest-button bg-blue-500 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-600 transition"
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