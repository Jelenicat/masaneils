import React, { useState, useEffect } from "react";
import { format, addDays } from "date-fns";
import { srLatn } from "date-fns/locale";
import {
  doc,
  getDoc,
  getDocs,
  collection,
  query,
  where,
  setDoc,
  deleteDoc,
} from "firebase/firestore";
import { db } from "../firebase";
import { toast } from "react-toastify";
import "../pages/MojKalendarAdmin.css";

// helper – npr. "petak 12.09.2025 14:00"
const formatSaDanom = (d) =>
  format(new Date(d), "EEEE dd.MM.yyyy HH:mm", { locale: srLatn });

// helper: ključ nedelje (npr. "2025-W38")
const weekKeyFor = (d) => {
  const x = new Date(d);
  const jan1 = new Date(x.getFullYear(), 0, 1);
  const days = Math.floor((x - jan1) / 86400000);
  const week = Math.ceil((days + jan1.getDay() + 1) / 7);
  return `${x.getFullYear()}-W${String(week).padStart(2, "0")}`;
};

const PonudiTermineModal = ({
  korisnice,
  izboriPoTerminu, // { eventId: [ { korisnickoIme, timestamp/createdAt/... }, ... ] }
  events,
  onClose,
  onConfirm,
  onSuggest,
  isLoading,
  selectedWeekStart,
}) => {
  const [selectedUser, setSelectedUser] = useState(null);
  const [selektovaniTermini, setSelektovaniTermini] = useState([]);
  const [usluga, setUsluga] = useState("N/A");
  const [adjustedTimes, setAdjustedTimes] = useState({});
  const [korisniceSaTerminima, setKorisniceSaTerminima] = useState([]);
  const [poruka, setPoruka] = useState("");

  // lokalna lista za prikaz (union prijavljenih)
  const [visibleKorisnice, setVisibleKorisnice] = useState(korisnice || []);
  // kad stignu nove korisnice iz parenta – spoji sa postojećim i dedupliraj
useEffect(() => {
  setVisibleKorisnice((prev) =>
    Array.from(new Set([...(prev || []), ...(korisnice || [])]))
  );
}, [korisnice]);


  // fallback timestamps iz izbor_usluge (createdAt/timestamp)
  const [izborUslugeTS, setIzborUslugeTS] = useState(new Map());

  // sortirana lista po tome ko je PRVA poslala (najraniji timestamp)
  const [orderedKorisnice, setOrderedKorisnice] = useState([]);

  // Ko već ima potvrđen termin u ovoj nedelji
  useEffect(() => {
    const fetchTerminirane = async () => {
      if (!selectedWeekStart) return;
      const weekEnd = addDays(selectedWeekStart, 7);

      const snapshot = await getDocs(
        query(
          collection(db, "admin_kalendar"),
          where("start", ">=", selectedWeekStart),
          where("start", "<", weekEnd),
          where("tip", "==", "termin")
        )
      );

      const saTerminima = new Set();
      snapshot.forEach((docu) => {
        const data = docu.data();
        if (data.clientUsername) {
          saTerminima.add(data.clientUsername);
        }
      });

      setKorisniceSaTerminima([...saTerminima]);
    };

    fetchTerminirane();
  }, [selectedWeekStart]);

  // ➕ Povuci sve korisnice koje imaju IKAKAV izbor u toj nedelji (čak i ako više nema slobodnih)
  useEffect(() => {
    if (!selectedWeekStart) return;
    let stale = false;

    (async () => {
      try {
        const weekStartISO = selectedWeekStart.toISOString().slice(0, 10);
        const weekEndISO = addDays(selectedWeekStart, 7).toISOString().slice(0, 10);

        // u izboriTermina polje "datum" je string "YYYY-MM-DD"
        const snap = await getDocs(
          query(
            collection(db, "izboriTermina"),
            where("datum", ">=", weekStartISO),
            where("datum", "<", weekEndISO)
          )
        );

        const fromChoices = new Set();
        snap.forEach((d) => {
          const x = d.data();
          if (x?.korisnickoIme) fromChoices.add(x.korisnickoIme);
        });

        if (!stale) {
          setVisibleKorisnice((prev) =>
            Array.from(new Set([...(prev || []), ...Array.from(fromChoices)]))
          );
        }
      } catch (e) {
        console.error("Greška izboriTermina:", e);
      }
    })();

    return () => { stale = true; };
  }, [selectedWeekStart]);

  // Usluga za selektovanu korisnicu
  useEffect(() => {
    const fetchUsluga = async () => {
      if (!selectedUser) return;
      try {
        const uslugaDoc = await getDoc(doc(db, "izbor_usluge", selectedUser));
        setUsluga(uslugaDoc.exists() ? uslugaDoc.data().usluga || "N/A" : "N/A");
      } catch (error) {
        console.error("Greška pri učitavanju usluge:", error);
        toast.error("Greška pri učitavanju usluge.");
      }
    };
    fetchUsluga();
  }, [selectedUser]);

  // Učitaj prijavljene iz izbor_usluge za tu nedelju
  // Radi i ako nema weekKey/createdAt – koristi i timestamp kao fallback
  useEffect(() => {
    if (!selectedWeekStart) return;
    let stale = false;

    (async () => {
      try {
        const weekKey = weekKeyFor(selectedWeekStart);
        const weekStart = new Date(selectedWeekStart);
        const weekEnd = addDays(weekStart, 7);

        // 1) po weekKey (ako postoji)
        const q1 = query(
          collection(db, "izbor_usluge"),
          where("weekKey", "==", weekKey)
        );
        const s1 = await getDocs(q1);

        // 2) fallback: po timestamp opsegu (pošto tvoji dokumenti često imaju "timestamp")
        const q2 = query(
          collection(db, "izbor_usluge"),
          where("timestamp", ">=", weekStart),
          where("timestamp", "<", weekEnd)
        );
        const s2 = await getDocs(q2);

        // merge oba seta
        const allDocs = [...s1.docs, ...s2.docs];
        const users = new Set();
        const tsMap = new Map();

        allDocs.forEach((d) => {
          const uid = d.id; // doc.id = korisničko ime
          users.add(uid);
          const data = d.data();

          // vreme za sortiranje: preferiraj createdAt ako postoji, inače timestamp
          let t = null;
          if (data?.createdAt?.toDate) t = data.createdAt.toDate().getTime();
          else if (data?.createdAt) t = new Date(data.createdAt).getTime();
          else if (data?.timestamp?.toDate) t = data.timestamp.toDate().getTime();
          else if (data?.timestamp) t = new Date(data.timestamp).getTime();

          if (t != null) {
            const prev = tsMap.get(uid);
            if (prev == null || t < prev) tsMap.set(uid, t);
          }
        });

        if (!stale) {
          setVisibleKorisnice((prev) =>
            Array.from(new Set([...(prev || []), ...Array.from(users)]))
          );
          setIzborUslugeTS(tsMap);
        }
      } catch (e) {
        console.error("Greška izbor_usluge:", e);
      }
    })();

    return () => {
      stale = true;
    };
  }, [selectedWeekStart]);

  // Izračunaj redosled (stabilno): TS iz izboriTermina > createdAt/timestamp iz izbor_usluge > ABC
  // Stabilno sortiranje: 1) najraniji ts iz izboriTermina, 2) fallback ts iz izbor_usluge, 3) ABC.
// Ako su ts jednaki – sekundarni tie-breaker je ime (stabilno).
useEffect(() => {
  if (!visibleKorisnice?.length) {
    setOrderedKorisnice([]);
    return;
  }

  const firstTs = new Map();
  Object.values(izboriPoTerminu || {}).forEach((arr = []) => {
    arr.forEach((i) => {
      const name = i?.korisnickoIme || i?.username || i?.user;
      if (!name) return;

      let t = null;
      if (i?.timestamp?.toDate) t = i.timestamp.toDate().getTime();
      else if (i?.timestamp) t = new Date(i.timestamp).getTime();
      else if (i?.createdAt?.toDate) t = i.createdAt.toDate().getTime();
      else if (i?.createdAt) t = new Date(i.createdAt).getTime();

      const prev = firstTs.get(name);
      if (t != null && (prev == null || t < prev)) firstTs.set(name, t);
    });
  });

  const sorted = [...visibleKorisnice].sort((a, b) => {
    const ta = firstTs.get(a) ?? izborUslugeTS.get(a) ?? null;
    const tb = firstTs.get(b) ?? izborUslugeTS.get(b) ?? null;

    if (ta != null && tb != null) {
      if (ta !== tb) return ta - tb;   // ranije → gore
      return a.localeCompare(b);       // tie-breaker
    }
    if (ta != null) return -1;
    if (tb != null) return 1;
    return a.localeCompare(b);
  });

  setOrderedKorisnice(sorted);
}, [visibleKorisnice, izboriPoTerminu, izborUslugeTS]);


  const getSlobodniTermini = () => {
    if (!selectedUser) return [];
    return events
      .filter(
        (e) =>
          e.tip === "slobodan" &&
          izboriPoTerminu[e.id]?.some((i) => i.korisnickoIme === selectedUser)
      )
      .sort((a, b) => a.start.getTime() - b.start.getTime());
  };

  const toggleTermin = (terminId) => {
    setSelektovaniTermini((prev) =>
      prev.includes(terminId)
        ? prev.filter((id) => id !== terminId)
        : [...prev, terminId]
    );
  };

  const adjustTime = (terminId, field, minutes) => {
    const termin = events.find((t) => t.id === terminId);
    if (!termin) return;

    const original = new Date(
      adjustedTimes[terminId]?.[field] || (field === "start" ? termin.start : termin.end)
    );

    const newTime = new Date(original.getTime() + minutes * 60000);
    setAdjustedTimes((prev) => ({
      ...prev,
      [terminId]: {
        ...prev[terminId],
        [field]: newTime,
      },
    }));
  };

  const sendSuggestion = async (korisnickoIme, termini) => {
    try {
      for (const t of termini) {
        await setDoc(doc(db, "ponudjeniTermini", t.id), {
          korisnickoIme,
          start: t.start,
          end: t.end,
          usluga: t.usluga,
          timestamp: new Date(),
          originalEventId: t.id,
        });
      }
    } catch (error) {
      console.error("Greška prilikom upisa predloga termina u Firestore:", error);
      toast.error("Greška pri snimanju predloga termina.");
    }
  };

  // ✖ pošalji "nema termina" i očisti korisnika
  const sendNoSlots = async (korisnickoIme) => {
    try {
      await fetch("https://notifikacija-api.vercel.app/api/posalji-notifikaciju", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          korisnickoIme,
          title: "Obaveštenje",
          body: "Žao mi je, nema slobodnih termina za ovu nedelju",
          click_action: "/ponudjeni",
        }),
      });

      const izboriSnap = await getDocs(
        query(collection(db, "izboriTermina"), where("korisnickoIme", "==", korisnickoIme))
      );
      for (const d of izboriSnap.docs) {
        await deleteDoc(d.ref);
      }

      const ponudjeniSnap = await getDocs(
        query(collection(db, "ponudjeniTermini"), where("korisnickoIme", "==", korisnickoIme))
      );
      for (const d of ponudjeniSnap.docs) {
        await deleteDoc(d.ref);
      }

      await deleteDoc(doc(db, "izbor_usluge", korisnickoIme));

      setVisibleKorisnice((prev) => prev.filter((k) => k !== korisnickoIme));
      if (selectedUser === korisnickoIme) setSelectedUser(null);

      toast.info(`Poslata poruka i uklonjena korisnica ${korisnickoIme}.`);
    } catch (e) {
      console.error("Greška pri slanju/čišćenju:", e);
      toast.error("Greška pri slanju obaveštenja ili čišćenju podataka.");
    }
  };

  const handleSuggest = async () => {
    if (!selectedUser || selektovaniTermini.length === 0) {
      toast.error("Izaberite korisnicu i barem jedan termin.");
      return;
    }

    try {
      const now = new Date();
      const odabrani = events
        .filter((t) => selektovaniTermini.includes(t.id))
        .map((t) => ({
          id: t.id,
          start: adjustedTimes[t.id]?.start || new Date(t.start),
          end: adjustedTimes[t.id]?.end || new Date(t.end),
          note: t.note || "",
          usluga,
        }))
        .filter((t) => t.start >= now);

      await sendSuggestion(selectedUser, odabrani);

      const notificationBody = odabrani
        .map((t) => `${formatSaDanom(t.start)} (${usluga})`)
        .join(", ");

      await fetch("https://notifikacija-api.vercel.app/api/posalji-notifikaciju", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          korisnickoIme: selectedUser,
          title: "Novi predlozi termina 💅",
          body: `Predloženi termini: ${notificationBody}`,
          click_action: `https://masaneils.vercel.app/ponudjeni/${selectedUser}`,
        }),
      });

      setPoruka("✅ Predlozi su poslati!");
      setTimeout(() => setPoruka(""), 3000);
      toast.success("Predlozi uspešno poslati!");
      onClose();
    } catch (error) {
      console.error("Greška pri slanju predloga:", error);
      toast.error("Greška pri slanju predloga terminiа.");
    }
  };

  const handleConfirm = async (terminId) => {
    if (!selectedUser) {
      toast.error("Izaberite korisnicu.");
      return;
    }
    try {
      await onConfirm(terminId, selectedUser);

      const termin = events.find((e) => e.id === terminId);
      if (termin) {
        await fetch("https://notifikacija-api.vercel.app/api/posalji-notifikaciju", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            korisnickoIme: selectedUser,
            title: "Termin je potvrđen ✅",
            body: `Vaš termin je zakazan za ${formatSaDanom(termin.start)}`,
            click_action: "/istorija",
          }),
        });
      }

      setVisibleKorisnice((prev) => prev.filter((k) => k !== selectedUser));

      toast.success("Termin potvrđen i poslata notifikacija!");
      onClose();
    } catch (error) {
      console.error("Greška pri potvrdi termina:", error);
      toast.error("Greška pri potvrdi termina.");
    }
  };

  const listaZaPrikaz = orderedKorisnice;

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-content">
        <div className="modal-header">
          {poruka && <p className="uspesna-poruka">{poruka}</p>}
          {isLoading && <p className="loading-text">⏳ Obrada u toku...</p>}
          <h3 id="modal-title">Predloži ili potvrdi termin</h3>
          <button className="close-button" onClick={onClose} aria-label="Zatvori modal">
            &times;
          </button>
        </div>

        {!selectedUser ? (
          <div className="user-list-container">
            <div className="scroll-lista-korisnica" aria-live="polite">
              {listaZaPrikaz.length > 0 ? (
                listaZaPrikaz.map((korisnica) => {
                  const imaTermin = korisniceSaTerminima.includes(korisnica);
                  return (
                    <div
                      key={`user-${korisnica}`}
                      className={`korisnica-item ${imaTermin ? "disabled" : ""}`}
                      onClick={() => !imaTermin && setSelectedUser(korisnica)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => e.key === "Enter" && !imaTermin && setSelectedUser(korisnica)}
                      aria-label={`Izaberi korisnicu ${korisnica}`}
                    >
                      {korisnica}
                      {imaTermin && <span className="info-tag">• već ima termin ove nedelje</span>}

                      {/* X – šalje poruku i uklanja korisnicu + briše izbore/predloge u bazi */}
                      <button
                        className="close-x"
                        title="Nema slobodnih termina"
                        onClick={(ev) => {
                          ev.stopPropagation();
                          sendNoSlots(korisnica); // 🔔 + Firestore čišćenje + UI update
                        }}
                      >
                        ×
                      </button>
                    </div>
                  );
                })
              ) : (
                <p className="no-users-message">Nema korisnica koje su izabrale termine.</p>
              )}
            </div>

            {/* Sekcija: Bez termina ove nedelje (vidljive dok ne klikneš X) */}
            {listaZaPrikaz.filter((k) => !korisniceSaTerminima.includes(k)).length > 0 && (
              <>
                <h4 style={{ marginTop: 16 }}>Bez termina ove nedelje</h4>
                <div className="scroll-lista-korisnica" aria-live="polite">
                  {listaZaPrikaz
                    .filter((k) => !korisniceSaTerminima.includes(k))
                    .map((korisnica) => (
                      <div key={`no-slot-${korisnica}`} className="korisnica-item">
                        {korisnica}
                        <span className="info-tag">• bez termina</span>
                        <button
                          className="close-x"
                          title="Nema slobodnih termina – pošalji obaveštenje i ukloni"
                          onClick={(ev) => {
                            ev.stopPropagation();
                            sendNoSlots(korisnica);
                          }}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                </div>
              </>
            )}
          </div>
        ) : (
          <>
            <div className="user-info">
              <h4>
                Termini za: <span className="user-name">{selectedUser}</span> ({usluga})
              </h4>
              <button
                className="back-button"
                onClick={() => setSelectedUser(null)}
                aria-label="Nazad na listu korisnica"
              >
                ← Nazad
              </button>
            </div>

            <div className="termini-container">
              {getSlobodniTermini().length > 0 ? (
                getSlobodniTermini().map((termin) => (
                  <div key={termin.id} className="termin-card">
                    <label className="termin-label">
                      <input
                        type="checkbox"
                        checked={selektovaniTermini.includes(termin.id)}
                        onChange={() => toggleTermin(termin.id)}
                      />
                      <span className="time-range">
                        {formatSaDanom(adjustedTimes[termin.id]?.start || new Date(termin.start))}{" "}
                        –{" "}
                        {format(adjustedTimes[termin.id]?.end || new Date(termin.end), "HH:mm", {
                          locale: srLatn,
                        })}
                      </span>
                    </label>

                    <div className="time-adjust-buttons">
                      <button onClick={() => adjustTime(termin.id, "start", -15)}>-</button>
                      <button onClick={() => adjustTime(termin.id, "start", 15)}>+</button>
                      <button onClick={() => adjustTime(termin.id, "end", -15)}>-</button>
                      <button onClick={() => adjustTime(termin.id, "end", 15)}>+</button>
                    </div>

                    <button onClick={() => handleConfirm(termin.id)} className="confirm-button" disabled={isLoading}>
                      ✅ Potvrdi
                    </button>
                  </div>
                ))
              ) : (
                <p className="no-terms-message">Nema slobodnih termina za ovu korisnicu.</p>
              )}
            </div>

            {getSlobodniTermini().length > 0 && (
              <button onClick={handleSuggest} className="suggest-button" disabled={isLoading || selektovaniTermini.length === 0}>
                📤 Pošalji predloge
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default PonudiTermineModal;
