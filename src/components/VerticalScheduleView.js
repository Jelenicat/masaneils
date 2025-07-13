// src/components/VerticalScheduleView.js
import React from "react";
import { addDays, format, isSameDay, startOfWeek } from "date-fns";
import "./VerticalScheduleView.css";

const dani = ["Ponedeljak", "Utorak", "Sreda", "Četvrtak", "Petak", "Subota"];
const sati = Array.from({ length: 13 }, (_, i) => 9 + i); // 9 h – 21 h

const VerticalScheduleView = ({
  events = [],
  selectedWeekStart = startOfWeek(new Date(), { weekStartsOn: 1 }),
  onSelectSlot,
  onSelectEvent,
  izboriPoTerminu = {},
  potvrdiTerminZaKorisnicu,
}) => {
  // Helper: vrati sve događaje za konkretan dan i sat
  const getEventsFor = (dayDate, hour) =>
    events.filter(
      (e) =>
        isSameDay(e.start, dayDate) &&
        new Date(e.start).getHours() === hour
    );

  const renderEvent = (event) => {
    const izbori = izboriPoTerminu[event.id] || [];
    return (
      <div
        key={event.id}
        className="event-item"
        style={{ backgroundColor: event.backgroundColor }}
        onClick={() => onSelectEvent && onSelectEvent(event)}
      >
        <span className="event-title">{event.title}</span>

        {/* Prikaz lista korisnica & dugme Potvrdi (samo za slobodan) */}
        {event.tip === "slobodan" && izbori.length > 0 && (
          <div className="izbori-lista">
            {izbori.map(({ korisnickoIme, usluga }) => (
              <div key={korisnickoIme} className="izbor-red">
                ✅ {korisnickoIme} ({usluga})
                {potvrdiTerminZaKorisnicu && (
                  <button
                    className="potvrdi-dugme"
                    onClick={(e) => {
                      e.stopPropagation();
                      potvrdiTerminZaKorisnicu(event.id, korisnickoIme);
                    }}
                  >
                    Potvrdi
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const handleEmptySlotClick = (dayDate, hour) => {
    // Kreiramo početak i kraj termina (1 h podrazumevano)
    const start = new Date(dayDate);
    start.setHours(hour, 0, 0, 0);
    const end = new Date(start);
    end.setHours(hour + 1);

    onSelectSlot &&
      onSelectSlot({
        start,
        end,
      });
  };

  return (
    <div className="vertical-schedule-grid">
      {/* Zaglavlje dana */}
      <div className="grid-header empty-cell" />
      {dani.map((_, i) => {
        const dayDate = addDays(selectedWeekStart, i);
        return (
          <div key={i} className="grid-header">
            {format(dayDate, "dd.MM")}
          </div>
        );
      })}

      {/* Redovi po satima */}
      {sati.map((hour) => (
        <React.Fragment key={hour}>
          {/* Prva kolona – oznaka sata */}
          <div className="grid-hour">{`${hour}:00`}</div>
          {dani.map((_, i) => {
            const dayDate = addDays(selectedWeekStart, i);
            const dnevniEventi = getEventsFor(dayDate, hour);

            return (
              <div
                key={`${hour}-${i}`}
                className="grid-cell"
                onClick={() => handleEmptySlotClick(dayDate, hour)}
              >
                {dnevniEventi.map(renderEvent)}
              </div>
            );
          })}
        </React.Fragment>
      ))}
    </div>
  );
};

export default VerticalScheduleView;
