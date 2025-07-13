// src/components/VerticalScheduleView.js
import React, { useMemo } from "react";
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
          const podsati = new Date(event.start);
          podsati.setMinutes(0);
          const startHour = podsati.getHours();
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
                  const rowSpan = Math.max(1, Math.ceil(durationMinutes / 60));

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
    </div>
  );
};

export default VerticalScheduleView;