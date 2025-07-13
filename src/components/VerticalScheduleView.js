import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import { collection, getDocs, query, where } from "firebase/firestore";
import { toast } from "react-toastify";
import { utcToZonedTime } from "date-fns-tz";
import { startOfWeek } from "date-fns";

const VerticalScheduleView = ({ selectedWeekStart, onSelectSlot }) => {
  const dani = ["Ponedeljak", "Utorak", "Sreda", "Četvrtak", "Petak", "Subota", "Nedelja"];
  const sati = Array.from({ length: 15 }, (_, i) => 8 + i); // 8:00 - 22:00
  const [izboriPoTerminu, setIzboriPoTerminu] = useState({});
  const [usluge, setUsluge] = useState({});

  useEffect(() => {
    const fetchIzboriTermina = async () => {
      try {
        const snapshot = await getDocs(collection(db, "izboriTermina"));
        const uslugeSnapshot = await getDocs(collection(db, "izbor_usluge"));
        const uslugeMap = uslugeSnapshot.docs.reduce((acc, doc) => {
          const data = doc.data();
          acc[data.korisnickoIme] = data.usluga || "N/A";
          return acc;
        }, {});
        setUsluge(uslugeMap);

        const poTerminu = {};
        snapshot.docs.forEach((doc) => {
          const izbor = doc.data();
          if (izbor.eventId) {
            if (!poTerminu[izbor.eventId]) poTerminu[izbor.eventId] = [];
            poTerminu[izbor.eventId].push({
              korisnickoIme: izbor.korisnickoIme,
              usluga: uslugeMap[izbor.korisnickoIme] || "N/A",
            });
          }
        });
        setIzboriPoTerminu(poTerminu);
      } catch (error) {
        console.error("Greška pri učitavanju izbora termina:", error);
        toast.error("Greška pri učitavanju izbora termina.");
      }
    };
    fetchIzboriTermina();
  }, []);

  const handleSlotClick = (dan, sat) => {
    const startOfSelectedWeek = startOfWeek(selectedWeekStart, { weekStartsOn: 1 });
    const dayIndex = dani.indexOf(dan);
    const startDate = utcToZonedTime(new Date(startOfSelectedWeek), "Europe/Belgrade");
    startDate.setDate(startOfSelectedWeek.getDate() + dayIndex);
    startDate.setHours(sat, 0, 0, 0);
    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
    const now = utcToZonedTime(new Date(), "Europe/Belgrade");
    if (startDate < now) {
      toast.error("Ne možete izabrati termin u prošlosti.");
      return;
    }
    onSelectSlot({ start: startDate, end: endDate });
  };

  return (
    <div className="vertical-schedule">
      <div className="schedule-header">
        {dani.map((dan) => (
          <div key={dan} className="schedule-day">
            {dan}
          </div>
        ))}
      </div>
      <div className="schedule-body">
        {sati.map((sat) => (
          <div key={sat} className="schedule-row">
            {dani.map((dan) => (
              <div
                key={`${dan}-${sat}`}
                className="schedule-slot"
                onClick={() => handleSlotClick(dan, sat)}
              >
                <div className="slot-time">{sat}:00</div>
                <div className="potvrdi-dugmad">
                  {izboriPoTerminu[`${dan}-${sat}`]?.length > 0 ? (
                    izboriPoTerminu[`${dan}-${sat}`].slice(0, 3).map((korisnica) => (
                      <div
                        key={korisnica.korisnickoIme}
                        className="korisnica-red"
                        onClick={(e) => e.stopPropagation()}
                      >
                        ✅ {korisnica.korisnickoIme} ({korisnica.usluga})
                      </div>
                    ))
                  ) : (
                    <span className="prazno">Nema izbora</span>
                  )}
                  {izboriPoTerminu[`${dan}-${sat}`]?.length > 3 && (
                    <button
                      className="potvrdi-dugme"
                      onClick={(e) => {
                        e.stopPropagation();
                        alert(
                          `Još korisnika: ${izboriPoTerminu[`${dan}-${sat}`]
                            .slice(3)
                            .map((k) => k.korisnickoIme)
                            .join(", ")}`
                        );
                      }}
                    >
                      Prikaži više
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

export default VerticalScheduleView;