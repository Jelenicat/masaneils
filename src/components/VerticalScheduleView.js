import React from "react";
import "./VerticalScheduleView.css";
import { format, isSameDay, isWithinInterval, parseISO, startOfWeek, addDays } from "date-fns";

const dani = ["Ponedeljak", "Utorak", "Sreda", "Četvrtak", "Petak", "Subota"];

const getDayName = (date) => {
  const dan = new Date(date).getDay();
  return ["Nedelja", "Ponedeljak", "Utorak", "Sreda", "Četvrtak", "Petak", "Subota"][dan];
};

const VerticalScheduleView = ({ events, selectedWeekStart, onEditEvent, onAddEvent }) => {
  const startOfSelectedWeek = startOfWeek(selectedWeekStart, { weekStartsOn: 1 });
  const endOfSelectedWeek = addDays(startOfSelectedWeek, 6);

  const filteredEvents = events.filter((event) => {
    const start = new Date(event.start);
    return isWithinInterval(start, { start: startOfSelectedWeek, end: endOfSelectedWeek });
  });

  return (
    <div className="vertical-schedule-view">
      {dani.map((dan, index) => {
        const currentDayDate = addDays(startOfSelectedWeek, index);
        const dayEvents = filteredEvents
          .filter((e) => isSameDay(new Date(e.start), currentDayDate))
          .sort((a, b) => new Date(a.start) - new Date(b.start));

        return (
          <div key={dan} className="dan-blok">
            <h3 className="naslov-dana">{dan}</h3>
            <div className="sati">
              {dayEvents.length > 0 ? (
                dayEvents.map((event) => {
                  const startTime = format(new Date(event.start), "HH:mm");
                  const endTime = format(new Date(event.end), "HH:mm");
                  return (
                    <div
                      key={event.id}
                      className="slot"
                      onClick={() => onEditEvent(event)}
                    >
                      <span className="event-info" style={{
                        backgroundColor:
                          event.tip === "slobodan"
                            ? "#e0f7e0"
                            : event.tip === "zauzet"
                            ? "#f7e0e0"
                            : event.tip === "termin"
                            ? "#ffe4ec"
                            : "#f0f0f0",
                      }}>
                        {event.tip === "termin"
                          ? `💅 ${event.clientUsername || "Zakazano"}`
                          : event.tip === "zauzet"
                          ? "📌"
                          : `🟢 slobodan ${startTime} – ${endTime}`}
                      </span>
                    </div>
                  );
                })
              ) : (
                <span className="prazno">Nema termina</span>
              )}
            </div>
            <button
              className="dodaj-termin-dugme"
              onClick={() => onAddEvent(currentDayDate)}
            >
              ➕ Dodaj termin
            </button>
          </div>
        );
      })}
    </div>
  );
};

export default VerticalScheduleView;
