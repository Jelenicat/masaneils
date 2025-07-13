import React from "react";
import "./VerticalScheduleView.css";

const VerticalScheduleView = ({
  events = [],
  izboriPoTerminu = {},
  potvrdiTerminZaKorisnicu,
}) => {
  if (events.length === 0) return <p>Nema dostupnih termina za prikaz.</p>;

  return (
    <div className="vertical-schedule">
      {events.map((event) => (
        <div key={event.id} className="event-block">
          <div className="event-header">
            <strong>{event.title}</strong>{" "}
            <span style={{ color: "#555", fontSize: 12 }}>
              ({new Date(event.start).toLocaleString("sr-RS")})
            </span>
          </div>
          <div className="potvrdi-dugmad">
            {(izboriPoTerminu[event.id] || []).length > 0 ? (
              izboriPoTerminu[event.id].map((korisnica) => (
                <div key={korisnica.korisnickoIme} className="korisnica-red">
                  ✅ {korisnica.korisnickoIme} ({korisnica.usluga})
                  <button
                    className="potvrdi-dugme"
                    onClick={() =>
                      potvrdiTerminZaKorisnicu(event.id, korisnica.korisnickoIme)
                    }
                  >
                    Potvrdi
                  </button>
                </div>
              ))
            ) : (
              <div className="nema-izbora">Nema izbora za ovaj termin</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default VerticalScheduleView;
