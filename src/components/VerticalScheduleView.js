import React from "react";
import "./VerticalScheduleView.css";

const dani = ["Ponedeljak", "Utorak", "Sreda", "Četvrtak", "Petak", "Subota"];

// Funkcija da dobiješ dan iz datuma
const getDayName = (date) => {
  const dan = new Date(date).getDay();
  return ["Nedelja", "Ponedeljak", "Utorak", "Sreda", "Četvrtak", "Petak", "Subota"][dan];
};

// Format vremena (9:00, 13:15 itd.)
const formatTime = (date) => {
  const d = new Date(date);
  const hours = d.getHours();
  const minutes = d.getMinutes();
  return `${hours}:${minutes.toString().padStart(2, "0")}`;
};

const VerticalScheduleView = ({ events }) => {
  return (
    <div className="vertical-schedule-view">
      {dani.map((dan) => {
        const dnevniEventi = events
          .filter((e) => getDayName(e.start) === dan)
          .sort((a, b) => new Date(a.start) - new Date(b.start));

        return (
          <div key={dan} className="dan-blok">
            <h3 className="naslov-dana">{dan}</h3>
            <div className="sati">
              {dnevniEventi.length > 0 ? (
                dnevniEventi.map((event) => (
                  <div key={event.id} className="slot">
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
                        ? `🟢 slobodan ${formatTime(event.start)} – ${formatTime(event.end)}`
                        : event.tip === "zauzet"
                        ? `🔴 zauzet ${formatTime(event.start)} – ${formatTime(event.end)}`
                        : event.title}
                    </span>
                  </div>
                ))
              ) : (
                <p className="prazno">Nema unetih termina</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default VerticalScheduleView;
