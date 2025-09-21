// src/components/VerticalScheduleView.js
import React from "react";
import { addDays, format, isSameDay } from "date-fns";
import { srLatn } from "date-fns/locale";
import "./VerticalScheduleView.css";

const dani = [
  "Ponedeljak",
  "Utorak",
  "Sreda",
  "Četvrtak",
  "Petak",
  "Subota",
  "Nedelja",
];

// helper: izvuci unix ms iz različitih oblika timestamp-a
const ts = (x) => {
  if (!x) return null;
  if (typeof x?.toDate === "function") return x.toDate().getTime(); // Firestore Timestamp
  const d = new Date(x);
  return isNaN(d) ? null : d.getTime();
};

const VerticalScheduleView = ({
  selectedWeekStart,
  events = [],
  onSelectSlot,
  onSelectEvent,
  izboriPoTerminu = {},
  pomeriNedeljuUnazad,
  pomeriNedeljuUnapred,
}) => {
  const getEventsForDay = (dayDate) =>
    events
      .filter((event) => isSameDay(event.start, dayDate))
      .sort((a, b) => a.start - b.start);

  // Ko već ima potvrđen termin ove nedelje – NE prikazujemo ih u zelenoj listi
  const alreadyScheduled = new Set(
    (events || [])
      .filter((e) => e.tip === "termin" && e.clientUsername)
      .map((e) => e.clientUsername)
  );

  return (
    <div className="vertical-week-view">
      <div className="week-nav">
        <button onClick={pomeriNedeljuUnazad}>←</button>
        <span>
          {selectedWeekStart
            ? `${format(selectedWeekStart, "dd.MM")}–${format(
                addDays(selectedWeekStart, 6),
                "dd.MM.yyyy"
              )}`
            : "Nedeljni prikaz"}
        </span>
        <button onClick={pomeriNedeljuUnapred}>→</button>
      </div>

      {dani.map((dan, i) => {
        const currentDate = addDays(selectedWeekStart, i);
        const dailyEvents = getEventsForDay(currentDate);

        return (
          <div key={format(currentDate, "yyyy-MM-dd")} className="day-block">
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
                  onSelectSlot?.({ start, end });
                }}
              >
                Dodaj termin
              </button>
            </div>

            {dailyEvents.length === 0 ? (
              <p className="no-events">Nema termina</p>
            ) : (
              dailyEvents.map((event) => {
                // Prijave za ovaj slot:
                // 1) dedupe po korisniku
                // 2) sakrij one sa već potvrđenim terminom
                // 3) sort po vremenu prijave (najraniji gore)
                const izbori = (izboriPoTerminu[event.id] || [])
                  .filter(
                    (v, idx, arr) =>
                      arr.findIndex((x) => x.korisnickoIme === v.korisnickoIme) === idx
                  )
                  .filter((i) => !alreadyScheduled.has(i.korisnickoIme))
                  .slice()
                  .sort((a, b) => {
                    const ta = ts(a.timestamp) ?? ts(a.createdAt) ?? null;
                    const tb = ts(b.timestamp) ?? ts(b.createdAt) ?? null;
                    if (ta != null && tb != null) return ta - tb; // najraniji prvi
                    if (ta != null && tb == null) return -1;
                    if (ta == null && tb != null) return 1;
                    return (a.korisnickoIme || "").localeCompare(b.korisnickoIme || "");
                  });

                return (
                  <div
                    key={event.id}
                    className="event-item"
                    style={{ backgroundColor: event.backgroundColor }}
                    onClick={() => onSelectEvent?.(event)}
                  >
                    {event.title}

                    {event.tip === "slobodan" && izbori.length > 0 && (
                      <div className="izbori-lista">
                        {izbori.map(({ korisnickoIme, usluga, materijal, velicina }) => (
                          <div
                            key={`${event.id}-${korisnickoIme}`}
                            className="izbor-red"
                          >
                            ✅ {korisnickoIme} (
                            {usluga}
                            {usluga !== "Korekcija" && materijal ? ` – ${materijal}` : ""}
                            {usluga !== "Korekcija" && velicina ? ` – ${velicina}` : ""}
                            )
                          </div>
                        ))}
                      </div>
                    )}

                    {event.note && <div className="napomena">📝 {event.note}</div>}
                  </div>
                );
              })
            )}
          </div>
        );
      })}

      <div style={{ textAlign: "center", marginTop: 30 }}>
        <button
          className="nazad-dugme"
          onClick={() => {
            window.location.href = "/admin";
          }}
        >
          Nazad
        </button>
      </div>
    </div>
  );
};

export default VerticalScheduleView;
