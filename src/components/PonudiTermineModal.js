import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import { doc, setDoc, getDoc, getDocs, query, where, collection } from "firebase/firestore";
import { toast } from "react-toastify";
import { format } from "date-fns";
import { sr } from "date-fns/locale";

const PonudiTermineModal = ({ korisnickoIme, slobodniTermini, onClose }) => {
  const [selektovani, setSelektovani] = useState([]);
  const [usluga, setUsluga] = useState("N/A");
  const [adjustedTimes, setAdjustedTimes] = useState({});

  useEffect(() => {
    const fetchUsluga = async () => {
      try {
        const uslugaDoc = await getDoc(doc(db, "izbor_usluge", korisnickoIme));
        if (uslugaDoc.exists()) {
          setUsluga(uslugaDoc.data().usluga || "N/A");
        }
      } catch (error) {
        console.error("Greška pri učitavanju usluge:", error);
        toast.error("Greška pri učitavanju usluge.");
      }
    };
    if (korisnickoIme) {
      fetchUsluga();
    }
  }, [korisnickoIme]);

  const toggleTermin = (terminId) => {
    setSelektovani((prev) =>
      prev.includes(terminId) ? prev.filter((id) => id !== terminId) : [...prev, terminId]
    );
  };

  const adjustTime = (terminId, field, minutes) => {
    setAdjustedTimes((prev) => {
      const termin = slobodniTermini.find((t) => t.id === terminId);
      if (!termin) return prev;
      const newTime = new Date(field === "start" ? termin.start : termin.end);
      newTime.setMinutes(newTime.getMinutes() + minutes);
      return {
        ...prev,
        [terminId]: {
          ...prev[terminId],
          [field]: newTime,
        },
      };
    });
  };

  const handleSubmit = async () => {
    if (!korisnickoIme) {
      toast.error("Korisničko ime nije dostupno.");
      return;
    }
    if (selektovani.length === 0) {
      toast.error("Izaberite barem jedan termin.");
      return;
    }

    try {
      const now = new Date();
      const odabrani = slobodniTermini
        .filter((t) => selektovani.includes(t.id))
        .map((t) => ({
          id: t.id,
          start: adjustedTimes[t.id]?.start || new Date(t.start),
          end: adjustedTimes[t.id]?.end || new Date(t.end),
          note: t.note || "",
          usluga,
        }))
        .filter((t) => t.start >= now);

      const allEvents = await getDocs(collection(db, "admin_kalendar"));
      const overlaps = odabrani.some((t1) =>
        allEvents.docs.some((doc) => {
          const event = doc.data();
          if (event.tip === "termin" || event.tip === "zauzet") {
            const start = new Date(event.start?.toDate?.() || event.start);
            const end = new Date(event.end?.toDate?.() || event.end);
            return t1.id !== doc.id && t1.start < end && t1.end > start;
          }
          return false;
        })
      );

      if (overlaps) {
        toast.error("Neki od predloženih termina se preklapaju sa postojećim terminima.");
        return;
      }

      await setDoc(doc(db, "predlozeniTermini", korisnickoIme), {
        korisnica: korisnickoIme,
        termini: odabrani,
        timestamp: new Date(),
      });

      const notificationBody = odabrani
        .map((t) =>
          `${format(t.start, "dd.MM.yyyy HH:mm", { locale: sr })} (${usluga})`
        )
        .join(", ");

      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          await fetch("https://notifikacija-api.vercel.app/api/posalji-notifikaciju", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              korisnickoIme,
              title: "Novi predlozi termina 💅",
              body: `Predloženi termini: ${notificationBody}`,
              click_action: "https://masaneils.vercel.app/ponudjeni-termini",
            }),
          });
          break;
        } catch (err) {
          if (attempt === 2) {
            console.error("Neuspešno slanje notifikacije:", err);
            toast.warn("Predlozi poslati, ali notifikacija nije poslata.");
          }
          await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
        }
      }

      toast.success("Predlozi uspešno poslati!");
      onClose();
    } catch (error) {
      console.error("Greška pri slanju predloga termina:", error);
      toast.error("Greška pri slanju predloga termina.");
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h3>Pošalji predloge korisnici: {korisnickoIme}</h3>
        {slobodniTermini?.length > 0 ? (
          <ul>
            {slobodniTermini.map((termin) => (
              <li key={termin.id} style={{ marginBottom: "20px" }}>
                <label>
                  <input
                    type="checkbox"
                    checked={selektovani.includes(termin.id)}
                    onChange={() => toggleTermin(termin.id)}
                  />
                  <span>
                    {format(adjustedTimes[termin.id]?.start || new Date(termin.start), "dd.MM.yyyy HH:mm", { locale: sr })}
                    {" – "}
                    {format(adjustedTimes[termin.id]?.end || new Date(termin.end), "HH:mm", { locale: sr })}
                    {" ("}
                    {usluga}
                    {")"}
                  </span>
                </label>
                <div style={{ marginLeft: "22px", marginTop: "5px" }}>
                  <button onClick={() => adjustTime(termin.id, "start", -30)} className="duration-button">-30 min</button>
                  <button onClick={() => adjustTime(termin.id, "start", 30)} className="duration-button">+30 min</button>
                  <button onClick={() => adjustTime(termin.id, "end", -30)} className="duration-button">-30 min (kraj)</button>
                  <button onClick={() => adjustTime(termin.id, "end", 30)} className="duration-button">+30 min (kraj)</button>
                </div>
                {termin.note && (
                  <div style={{ fontSize: "12px", color: "#777", marginLeft: "22px" }}>
                    📝 {termin.note}
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p>Nema dostupnih slobodnih termina.</p>
        )}
        <div className="modal-buttons">
          <button onClick={handleSubmit} className="confirm-button">Pošalji</button>
          <button onClick={onClose} className="cancel-button" style={{ marginLeft: "10px" }}>Zatvori</button>
        </div>
      </div>
    </div>
  );
};

export default PonudiTermineModal;
