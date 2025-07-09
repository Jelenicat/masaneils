import React from "react";
import "./VerticalScheduleView.css";

const dani = ["Ponedeljak", "Utorak", "Sreda", "Četvrtak", "Petak", "Subota"];
const sati = Array.from({ length: 13 }, (_, i) => 9 + i); // 9h–21h

// Konverzija broja dana u naziv
const getDayName = (date) => {
  const dan = new Date(date).getDay();
  return ["Nedelja", "Ponedeljak", "Utorak", "Sreda", "Četvrtak", "Petak", "Subota"][dan];
};

const VerticalScheduleView = ({ events }) => {
  return (
    <div className="vertical-schedule-view">
      {dani.map((dan) => (
        <div key={dan} className="dan-blok">
          <h3 className="naslov-dana">{dan}</h3>
          <div className="sati">
            {sati.map((sat) => {
              const event = events.find((e) => {
                const startDate = new Date(e.start);
                const eventDan = getDayName(startDate);
                const eventSat = startDate.getHours();
                return eventDan === dan && eventSat === sat;
              });

              return (
                <div key={sat} className="slot">
                  <span className="sat">{sat}:00</span>
                  <div className="sadrzaj">
                    {event ? (
                      <span
                        className="event-info"
                        style={{
                          backgroundColor: event.tip === "slobodan"
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
    </div>
  );
};

export default VerticalScheduleView;
