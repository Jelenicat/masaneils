import React, { useState, useEffect } from "react";
import { db, requestPermission } from "../firebase";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  addDoc,
  runTransaction,
  query,
  where,
  deleteDoc,
  onSnapshot,
} from "firebase/firestore";
import { toast } from "react-toastify";
import { format, startOfWeek, addDays } from "date-fns";

import VerticalScheduleView from "../components/VerticalScheduleView";
import PonudiTermineModal from "../components/PonudiTermineModal";
import DodajTerminModal from "../components/DodajTerminModal";
import { useSearchParams } from "react-router-dom";

const EVENT_TYPES = {
  slobodan: { color: "#90ee90" },
  zauzet: { color: "#ff6347" },
  termin: { color: "#ffe4ec" },
  edukacija: { color: "#bfa0dc" },
  odmor: { color: "#a0c4ff" },
};

const INITIAL_EVENT_DATA = {
  id: null,
  tip: "",
  start: null,
  end: null,
  note: "",
  clientUsername: "",
  cena: "",
};

/** Lokalno parsiranje "YYYY-MM-DD" bez UTC klizanja */
function localDateFromYYYYMMDD(s) {
  if (!s) return null;
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 0, 0, 0, 0);
}

const MojKalendarAdmin = () => {
  const [searchParams] = useSearchParams();

  // Preferiraj ?week=YYYY-MM-DD; fallback je weekOffset
  const weekParam = searchParams.get("week");             // npr. "2025-09-15"
  const offsetParam = parseInt(searchParams.get("weekOffset") || "0", 10);

  // inicijalni ponedeljak
  const initialWeekStart = (() => {
    if (weekParam) {
      const monday = localDateFromYYYYMMDD(weekParam);
      if (monday && !isNaN(monday)) return monday; // ne snapuj ponovo
    }
    return addDays(startOfWeek(new Date(), { weekStartsOn: 1 }), offsetParam * 7);
  })();

  const [selectedWeekStart, setSelectedWeekStart] = useState(initialWeekStart);

  // reaguj na promenu URL-a (npr. dolazak iz notifikacije sa ?week=)
  useEffect(() => {
    if (weekParam) {
      const monday = localDateFromYYYYMMDD(weekParam);
      if (monday && !isNaN(monday)) {
        setSelectedWeekStart(monday);
        return;
      }
    }
    setSelectedWeekStart(
      addDays(startOfWeek(new Date(), { weekStartsOn: 1 }), offsetParam * 7)
    );
  }, [weekParam, offsetParam]);

  const [events, setEvents] = useState([]);
  const [izboriPoTerminu, setIzboriPoTerminu] = useState({});
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [newEventData, setNewEventData] = useState(INITIAL_EVENT_DATA);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestionModal, setShowSuggestionModal] = useState(false);
  const [korisniceKojeSuBirale, setKorisniceKojeSuBirale] = useState([]);

  const pomeriNedeljuUnazad = () =>
    setSelectedWeekStart((prev) => addDays(prev, -7));
  const pomeriNedeljuUnapred = () =>
    setSelectedWeekStart((prev) => addDays(prev, 7));

  useEffect(() => {
    requestPermission().catch((err) => {
      toast.error("Greška prilikom postavljanja notifikacija: " + err.message);
    });
  }, []);

  // Real-time: admin_kalendar + izboriTermina za izabranu nedelju
  useEffect(() => {
    const weekStart = selectedWeekStart;
    const weekEnd = addDays(weekStart, 7);

    const unsubEvents = onSnapshot(
      query(
        collection(db, "admin_kalendar"),
        where("start", ">=", weekStart),
        where("start", "<", weekEnd)
      ),
      async (snapshot) => {
        try {
          const loadedEvents = snapshot.docs
            .map((docu) => {
              const data = docu.data();
              const start = data.start?.toDate?.() || new Date(data.start);
              const end = data.end?.toDate?.() || new Date(data.end);

              const vremeOd = start.toLocaleTimeString("sr-RS", {
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
              });
              const vremeDo = end.toLocaleTimeString("sr-RS", {
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
              });

              let title = `${vremeOd}–${vremeDo} — `;
              if (data.tip === "slobodan") title += "slobodan";
              else if (data.tip === "zauzet") title += "zauzet";
              else if (data.tip === "termin") {
                title += `💅 ${data.clientUsername || "Nepoznat korisnik"}`;
                if (data.cena) title += ` — ${data.cena} RSD`;
              } else if (data.tip === "edukacija") title += "🎓 edukacija";
              else if (data.tip === "odmor") title += "odmor";

              return {
                ...data,
                id: docu.id,
                start,
                end,
                title,
                backgroundColor: EVENT_TYPES[data.tip]?.color || "#ddd",
              };
            })
            .filter(Boolean);

          setEvents(loadedEvents);
        } catch (e) {
          console.error("Greška u onSnapshot(admin_kalendar):", e);
          toast.error("Greška pri učitavanju kalendara.");
        } finally {
          setIsInitialLoading(false);
        }
      }
    );

    const unsubChoices = onSnapshot(
      query(
        collection(db, "izboriTermina"),
        where("status", "==", "izabrala"),
        where("datum", ">=", format(weekStart, "yyyy-MM-dd")),
        where("datum", "<", format(weekEnd, "yyyy-MM-dd"))
      ),
      async (snap) => {
        try {
          const izbori = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

          const uslugeSnapshot = await getDocs(collection(db, "izbor_usluge"));
          const usluge = uslugeSnapshot.docs.reduce((acc, d) => {
            const x = d.data();
            acc[x.korisnickoIme] = {
              usluga: x.usluga || "N/A",
              materijal: x.materijal || "nije_bitno",
              velicina: x.velicina || "nije_bitno",
            };
            return acc;
          }, {});

          const grupisano = izbori.reduce((acc, i) => {
            if (!acc[i.eventId]) acc[i.eventId] = [];
            const u = usluge[i.korisnickoIme] || {};
            acc[i.eventId].push({
              korisnickoIme: i.korisnickoIme,
              usluga: i.usluga || u.usluga || "",
              materijal: i.materijal || u.materijal || "",
              velicina: i.velicina || u.velicina || "",
              timestamp: i.timestamp ?? null,
              createdAt: i.createdAt ?? null,
              datum: i.datum ?? null,
            });
            return acc;
          }, {});

          setIzboriPoTerminu(grupisano);
          setKorisniceKojeSuBirale([...new Set(izbori.map((x) => x.korisnickoIme))]);
        } catch (e) {
          console.error("Greška u onSnapshot(izboriTermina):", e);
        }
      }
    );

    return () => {
      unsubEvents();
      unsubChoices();
    };
  }, [selectedWeekStart]);

  const potvrdiTerminZaKorisnicu = async (eventId, korisnickoIme) => {
    try {
      setIsLoading(true);

      const weekStart = selectedWeekStart;
      const weekEnd = addDays(weekStart, 7);

      const already = await getDocs(
        query(
          collection(db, "admin_kalendar"),
          where("start", ">=", weekStart),
          where("start", "<", weekEnd),
          where("tip", "==", "termin"),
          where("clientUsername", "==", korisnickoIme)
        )
      );
      if (!already.empty) {
        toast.warn(`Korisnica ${korisnickoIme} već ima termin ove nedelje.`);
        setIsLoading(false);
        return;
      }

      await runTransaction(db, async (transaction) => {
        const eventRef = doc(db, "admin_kalendar", eventId);
        transaction.update(eventRef, {
          tip: "termin",
          clientUsername: korisnickoIme,
          title: `💅 ${korisnickoIme}`,
          backgroundColor: EVENT_TYPES["termin"]?.color || "#ddd",
        });

        const qMyChoice = query(
          collection(db, "izboriTermina"),
          where("eventId", "==", eventId),
          where("korisnickoIme", "==", korisnickoIme)
        );
        const sMyChoice = await getDocs(qMyChoice);
        sMyChoice.forEach((d) => transaction.delete(d.ref));
      });

      const weekStartISO = format(weekStart, "yyyy-MM-dd");
      const weekEndISO = format(weekEnd, "yyyy-MM-dd");
      const qMyOtherChoices = query(
        collection(db, "izboriTermina"),
        where("korisnickoIme", "==", korisnickoIme),
        where("datum", ">=", weekStartISO),
        where("datum", "<", weekEndISO)
      );
      const sMyOtherChoices = await getDocs(qMyOtherChoices);
      for (const d of sMyOtherChoices.docs) {
        await deleteDoc(d.ref);
      }

      const ponudjeniSnap = await getDocs(
        query(
          collection(db, "ponudjeniTermini"),
          where("korisnickoIme", "==", korisnickoIme)
        )
      );
      for (const d of ponudjeniSnap.docs) {
        await deleteDoc(d.ref);
      }

      toast.success(`Termin potvrđen za ${korisnickoIme}`);
    } catch (error) {
      console.error("Greška pri potvrdi termina:", error);
      toast.error("Greška pri potvrdi termina");
    } finally {
      setIsLoading(false);
    }
  };

  const predloziTerminKorisnici = async (korisnickoIme, termini) => {
    try {
      setIsLoading(true);

      const weekStart = selectedWeekStart;
      const weekEnd = addDays(weekStart, 7);

      const existing = await getDocs(
        query(
          collection(db, "admin_kalendar"),
          where("start", ">=", weekStart),
          where("start", "<", weekEnd),
          where("tip", "==", "termin"),
          where("clientUsername", "==", korisnickoIme)
        )
      );
      if (!existing.empty) {
        toast.warn(`Korisnica ${korisnickoIme} već ima zakazan termin ove nedelje.`);
        setIsLoading(false);
        return;
      }

      for (const termin of termini) {
        await addDoc(collection(db, "ponudjeniTermini"), {
          originalEventId: termin.id,
          korisnickoIme,
          start: termin.start,
          end: termin.end,
          timestamp: new Date(),
        });
      }

      toast.success("Termini uspešno predloženi");
    } catch (error) {
      console.error("Greška pri predlogu termina:", error);
      toast.error("Greška pri predlogu termina");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveEvent = async () => {
    try {
      setIsLoading(true);
      const eventRef = isEditing
        ? doc(db, "admin_kalendar", newEventData.id)
        : collection(db, "admin_kalendar");
      const eventData = {
        tip: newEventData.tip,
        start: newEventData.start,
        end: newEventData.end,
        note: newEventData.note || "",
        clientUsername: newEventData.clientUsername || "",
        cena: newEventData.cena || "",
        backgroundColor: EVENT_TYPES[newEventData.tip]?.color || "#ddd",
      };

      if (isEditing) {
        await updateDoc(eventRef, eventData);
        toast.success("Termin uspešno ažuriran");
      } else {
        await addDoc(eventRef, eventData);
        toast.success("Termin uspešno dodat");
      }

      // Slanje notifikacije kada ručno dodaš termin sa korisnikom (opciono)
      if (
        !isEditing &&
        eventData.tip === "termin" &&
        eventData.clientUsername &&
        eventData.start instanceof Date &&
        !isNaN(eventData.start.getTime())
      ) {
        await fetch("https://notifikacija-api.vercel.app/api/posalji-notifikaciju", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            korisnickoIme: eventData.clientUsername,
            title: "💅 Novi termin zakazan",
            body: `Vaš termin je zakazan za ${eventData.start.toLocaleDateString("sr-RS", {
              weekday: "long",
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
            })} u ${eventData.start.toLocaleTimeString("sr-RS", {
              hour: "2-digit",
              minute: "2-digit",
            })}.`,
          }),
        });
      }

      setShowModal(false);
      setNewEventData(INITIAL_EVENT_DATA);
      setIsEditing(false);
    } catch (error) {
      console.error("Greška pri čuvanju termina:", error);
      toast.error("Greška pri čuvanju termina");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="moj-kalendar-admin">
      <button
        onClick={() => setShowSuggestionModal(true)}
        className="action-dugme"
        aria-label="Predloži ili potvrdi termin"
      >
        Predloži/Potvrdi termin
      </button>

      <VerticalScheduleView
        events={events}
        izboriPoTerminu={izboriPoTerminu}
        potvrdiTerminZaKorisnicu={potvrdiTerminZaKorisnicu}
        selectedWeekStart={selectedWeekStart}
        pomeriNedeljuUnazad={pomeriNedeljuUnazad}
        pomeriNedeljuUnapred={pomeriNedeljuUnapred}
        onSelectSlot={(slot) => {
          setNewEventData({ ...INITIAL_EVENT_DATA, ...slot, tip: "slobodan" });
          setShowModal(true);
          setIsEditing(false);
        }}
        onSelectEvent={(event) => {
          setNewEventData(event);
          setShowModal(true);
          setIsEditing(true);
        }}
        predloziTerminKorisnici={() => {
          setShowSuggestionModal(true);
        }}
      />

      {showModal && (
        <DodajTerminModal
          eventData={newEventData}
          onClose={() => {
            setShowModal(false);
            setNewEventData(INITIAL_EVENT_DATA);
            setIsEditing(false);
          }}
          onSave={handleSaveEvent}
          isEditing={isEditing}
          setEventData={setNewEventData}
          isLoading={isLoading}
          onDelete={async (id) => {
            try {
              setIsLoading(true);
              await deleteDoc(doc(db, "admin_kalendar", id));
              toast.success("Termin obrisan");
              setShowModal(false);
              setNewEventData(INITIAL_EVENT_DATA);
              setIsEditing(false);
            } catch (error) {
              toast.error("Greška pri brisanju termina");
              console.error("Greška:", error);
            } finally {
              setIsLoading(false);
            }
          }}
        />
      )}

      {showSuggestionModal && (
        <PonudiTermineModal
          korisnice={korisniceKojeSuBirale}
          izboriPoTerminu={izboriPoTerminu}
          events={events}
          onClose={() => setShowSuggestionModal(false)}
          onConfirm={potvrdiTerminZaKorisnicu}
          onSuggest={predloziTerminKorisnici}
          isLoading={isLoading}
          selectedWeekStart={selectedWeekStart}
        />
      )}
    </div>
  );
};

export default MojKalendarAdmin;
