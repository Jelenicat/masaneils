// src/components/VerticalScheduleView.js
import React from "react";
import { addDays, format, isSameDay } from "date-fns";
import { srLatn } from "date-fns/locale";
import "./VerticalScheduleView.css";

const dani = ["Ponedeljak", "Utorak", "Sreda", "Četvrtak", "Petak", "Subota"];

const VerticalScheduleView = ({
  selectedWeekStart,
  events = [],
  onSelectSlot,
  onSelectEvent,
  izboriPoTerminu = {},
  potvrdiTerminZaKorisnicu,
  pomeriNedeljuUnazad,
  pomeriNedeljuUnapred,
}) => {
  const getEventsForDay = (dayDate) =>
    events
      .filter((event) => isSameDay(event.start, dayDate))
      .sort((a, b) => a.start - b.start);

  return (
    <div className="vertical-week-view">
      <div className="week-nav">
        <button onClick={pomeriNedeljuUnazad}>←</button>
        <span>
          {selectedWeekStart
            ? `${format(selectedWeekStart, "dd.MM")}–${format(addDays(selectedWeekStart, 5), "dd.MM.yyyy")}`
            : "Nedeljni prikaz"}
        </span>
        <button onClick={pomeriNedeljuUnapred}>→</button>
      </div>

      {dani.map((dan, i) => {
        const currentDate = addDays(selectedWeekStart, i);
        const dailyEvents = getEventsForDay(currentDate);

        return (
          <div key={i} className="day-block">
            <div className="day-header">
              <h4>
                {dan} {format(currentDate, "dd. MMM", { locale: srLatn })}
              </h4>
              <button
                className="add-button"
                onClick={() => {
               const start = new Date(currentDate);
start.setHours(9, 0, 0, 0);
const end = new Date(currentDate);
end.setHours(10, 0, 0, 0);

                  onSelectSlot({ start, end });
                }}
              >
                Dodaj termin
              </button>
            </div>

            {dailyEvents.length === 0 ? (
              <p className="no-events">Nema termina</p>
            ) : (
              dailyEvents.map((event) => {
                const izbori = izboriPoTerminu[event.id] || [];
                return (
                  <div
                    key={event.id}
                    className="event-item"
                    style={{ backgroundColor: event.backgroundColor }}
                    onClick={() => onSelectEvent && onSelectEvent(event)}
                  >
                    {event.title}


                    {event.tip === "slobodan" && izbori.length > 0 && (
                      <div className="izbori-lista">
                        {izbori.map(({ korisnickoIme, usluga }) => (
                          <div key={korisnickoIme} className="izbor-red">
                            ✅ {korisnickoIme} ({usluga})
                            <button
                              className="potvrdi-dugme"
                              onClick={(e) => {
                                e.stopPropagation();
                                potvrdiTerminZaKorisnicu(event.id, korisnickoIme);
                              }}
                            >
                              Potvrdi
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        );
      })}
    </div>
  );
};

export default VerticalScheduleView;
