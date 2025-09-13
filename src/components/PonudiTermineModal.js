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
  // 🆕
  deleteDoc,
} from "firebase/firestore";
import { db } from "../firebase";
import { toast } from "react-toastify";
import "../pages/MojKalendarAdmin.css";

// helper – npr. "petak 12.09.2025 14:00"
const formatSaDanom = (d) =>
  format(new Date(d), "EEEE dd.MM.yyyy HH:mm", { locale: srLatn });

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

  // lokalna lista za prikaz (da uklanjamo samo pojedine korisnice)
  const [visibleKorisnice, setVisibleKorisnice] = useState(korisnice || []);
  useEffect(() => setVisibleKorisnice(korisnice || []), [korisnice]);

  // 🆕 sortirana lista po tome ko je PRVA poslala (najraniji "timestamp"/"createdAt")
  const [orderedKorisnice, setOrderedKorisnice] = useState([]);

  // Učitaj ko već ima potvrđen termin u ovoj nedelji
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
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.clientUsername) {
          saTerminima.add(data.clientUsername);
        }
      });

      setKorisniceSaTerminima([...saTerminima]);
    };

    fetchTerminirane();
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

  // 🆕 Izračunaj redosled korisnica po NAJRANIJEM slanju u tekućoj nedelji
  useEffect(() => {
    // Ako nemamo podatke, ostavi postojeći poredak
    if (!visibleKorisnice?.length) {
      setOrderedKorisnice([]);
      return;
    }

    // mapiraj korisnicu na najraniji timestamp
    const firstTs = new Map();

    // izboriPoTerminu: prolazimo kroz sve evente i njihove izbore
    Object.values(izboriPoTerminu || {}).forEach((arr) => {
      (arr || []).forEach((i, idx) => {
        const name = i?.korisnickoIme || i?.username || i?.user;
        if (!name) return;

        // podrži više formata vremena
        let t =
          i?.timestamp?.toDate?.() instanceof Date
            ? i.timestamp.toDate().getTime()
            : i?.timestamp !== undefined
            ? new Date(i.timestamp).getTime()
            : i?.createdAt?.toDate?.() instanceof Date
            ? i.createdAt.toDate().getTime()
            : i?.createdAt !== undefined
            ? new Date(i.createdAt).getTime()
            : Number.POSITIVE_INFINITY - idx;

        const prev = firstTs.get(name);
        if (prev == null || t < prev) firstTs.set(name, t);
      });
    });

    // Sortiraj samo korisnice koje su trenutno vidljive
    const sorted = [...visibleKorisnice].sort((a, b) => {
      const ta = firstTs.has(a) ? firstTs.get(a) : Number.POSITIVE_INFINITY;
      const tb = firstTs.has(b) ? firstTs.get(b) : Number.POSITIVE_INFINITY;
      if (ta !== tb) return ta - tb;
      return a.localeCompare(b);
    });

    setOrderedKorisnice(sorted);
  }, [visibleKorisnice, izboriPoTerminu]);

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
        // note NE šaljemo korisnicima u "ponudjeniTermini"
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
      // 1) notifikacija
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

      // 2) Firestore čišćenje: izboriTermina + ponudjeniTermini + izbor_usluge
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

      // dokument u izbor_usluge kod tebe je po ID = korisničko ime
      await deleteDoc(doc(db, "izbor_usluge", korisnickoIme));

      // 3) UI: ukloni iz lokalnog prikaza
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
      onClose(); // ostaje kao pre
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

      // notifikacija o potvrdi (sa danom)
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

      // ukloni SAMO tu korisnicu iz prikaza
      setVisibleKorisnice((prev) => prev.filter((k) => k !== selectedUser));

      toast.success("Termin potvrđen i poslata notifikacija!");
      onClose(); // ostaje kao pre
    } catch (error) {
      console.error("Greška pri potvrdi termina:", error);
      toast.error("Greška pri potvrdi termina.");
    }
  };

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
              {(orderedKorisnice.length ? orderedKorisnice : visibleKorisnice).length > 0 ? (
                (orderedKorisnice.length ? orderedKorisnice : visibleKorisnice).map((korisnica, index) => {
                  const imaTermin = korisniceSaTerminima.includes(korisnica);
                  return (
                    <div
                      key={korisnica + index}
                      className={`korisnica-item ${imaTermin ? "disabled" : ""}`}
                      onClick={() => !imaTermin && setSelectedUser(korisnica)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) =>
                        e.key === "Enter" && !imaTermin && setSelectedUser(korisnica)
                      }
                      aria-label={`Izaberi korisnicu ${korisnica}`}
                    >
                      {korisnica}
                      {imaTermin && (
                        <span className="info-tag">• već ima termin ove nedelje</span>
                      )}

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
                        {format(
                          adjustedTimes[termin.id]?.end || new Date(termin.end),
                          "HH:mm",
                          { locale: srLatn }
                        )}
                      </span>
                    </label>

                    <div className="time-adjust-buttons">
                      <button onClick={() => adjustTime(termin.id, "start", -15)}>-</button>
                      <button onClick={() => adjustTime(termin.id, "start", 15)}>+</button>
                      <button onClick={() => adjustTime(termin.id, "end", -15)}>-</button>
                      <button onClick={() => adjustTime(termin.id, "end", 15)}>+</button>
                    </div>

                    <button
                      onClick={() => handleConfirm(termin.id)}
                      className="confirm-button"
                      disabled={isLoading}
                    >
                      ✅ Potvrdi
                    </button>
                  </div>
                ))
              ) : (
                <p className="no-terms-message">Nema slobodnih termina za ovu korisnicu.</p>
              )}
            </div>

            {getSlobodniTermini().length > 0 && (
              <button
                onClick={handleSuggest}
                className="suggest-button"
                disabled={isLoading || selektovaniTermini.length === 0}
              >
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
