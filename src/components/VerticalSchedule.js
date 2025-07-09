import React from "react";
import "./VerticalSchedule.css"; // dodaćemo stilove ovde

const dani = ["Ponedeljak", "Utorak", "Sreda", "Četvrtak", "Petak", "Subota"];
const sati = Array.from({ length: 13 }, (_, i) => 9 + i); // 9h do 21h

const VerticalSchedule = () => {
  return (
    <div className="vertical-schedule">
      {dani.map((dan) => (
        <div key={dan} className="day-block">
          <h2 className="day-title">{dan}</h2>
          <div className="hour-list">
            {sati.map((sat) => (
              <div key={sat} className="hour-slot">
                <span className="hour-label">{sat}:00</span>
                {/* Ovde možeš dodati dugme ili sadržaj */}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default VerticalSchedule;
