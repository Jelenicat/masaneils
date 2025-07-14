import React, { useState, useCallback, useEffect } from "react";
import { db } from "../firebase";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  addDoc,
  runTransaction,
  query,
  where,
} from "firebase/firestore";
import { toast } from "react-toastify";
import { format, startOfWeek, addDays, parse } from "date-fns";

import VerticalScheduleView from "../components/VerticalScheduleView";
import PonudiTermineModal from "../components/PonudiTermineModal";
import { requestPermission } from "../firebase";
import DodajTerminModal from "../components/DodajTerminModal";

const EVENT_TYPES = {
  slobodan: { color: "#90ee90" },
  zauzet: { color: "#ff6347" },
  termin: { color: "#ffe4ec" },
};

const INITIAL_EVENT_DATA = {
  id: null,
  tip: "",
  start: null,
  end: null,
  note: "",
  clientUsername: "",
};

const MojKalendarAdmin = () => {
  const [events, setEvents] = useState([]);
  const [izboriPoTerminu, setIzboriPoTerminu] = useState({});
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [selectedWeekStart, setSelectedWeekStart] = useState(
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [showModal, setShowModal] = useState(false);
  const [newEventData, setNewEventData] = useState(INITIAL_EVENT_DATA);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestionModal, setShowSuggestionModal] = useState(false);
  const [korisniceKojeSuBirale, setKorisniceKojeSuBirale] = useState([]);

  useEffect(() => {
    requestPermission().catch((err) => {
      toast.error("Greška prilikom postavljanja notifikacija: " + err.message);
    });
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [selectedWeekStart]);

  const pomeriNedeljuUnazad = () => setSelectedWeekStart((prev) => addDays(prev, -7));
  const pomeriNedeljuUnapred = () => setSelectedWeekStart((prev) => addDays(prev, 7));

  const fetchEvents = useCallback(async () => {
    try {
      const now = new Date();
      const weekEnd = addDays(selectedWeekStart, 7);
      const snapshot = await getDocs(
        query(
          collection(db, "admin_kalendar"),
          where("start", ">=", selectedWeekStart),
          where("start", "<", weekEnd)
        )
      );
      const izboriSnapshot = await getDocs(
        query(collection(db, "izboriTermina"), where("status", "==", "izabrala"))
      );
      const izbori = izboriSnapshot.docs.map((doc) => ({
        ...doc.data(),
        id: doc.id, // Include document ID if needed later
      }));

      console.log("Fetched izbori:", izbori); // Debug log

      const uslugeSnapshot = await getDocs(collection(db, "izbor_usluge"));
      const usluge = uslugeSnapshot.docs.reduce((acc, doc) => {
        const data = doc.data();
        acc[data.korisnickoIme] = data.usluga;
        return acc;
      }, {});

      const izboriGrupisani = izbori.reduce((acc, izbor) => {
        if (!acc[izbor.eventId]) acc[izbor.eventId] = [];
        acc[izbor.eventId].push({
          korisnickoIme: izbor.korisnickoIme,
          usluga: usluge[izbor.korisnickoIme] || "N/A",
        });
        return acc;
      }, {});
      setIzboriPoTerminu(izboriGrupisani);

      const korisnice = [...new Set(izbori.map((i) => i.korisnickoIme))];
      console.log("Korisnice koje su birale:", korisnice); // Debug log
      setKorisniceKojeSuBirale(korisnice);

      const loadedEvents = snapshot.docs
        .map((doc) => {
          const data = doc.data();
          const start = data.start?.toDate?.() || new Date(data.start);
          const end = data.end?.toDate?.() || new Date(data.end);
          if (start < now) return null;

          const izabrale = izbori
            .filter((izbor) => izbor.eventId === doc.id)
            .map((izbor) => `${izbor.korisnickoIme} (${usluge[izbor.korisnickoIme] || "N/A"})`);

          const vremeOd = start.toLocaleTimeString("sr-RS", { hour: "2-digit", minute: "2-digit", hour12: false });
          const vremeDo = end.toLocaleTimeString("sr-RS", { hour: "2-digit", minute: "2-digit", hour12: false });

          let title = `${vremeOd}–${vremeDo} — `;
          if (data.tip === "slobodan") {
            title += izabrale.length > 0 ? `slobodan (${izabrale.join(", ")})` : "slobodan";
          } else if (data.tip === "zauzet") {
            title += "zauzet";
          } else if (data.tip === "termin") {
            title += `💅 ${data.clientUsername || "Nepoznat korisnik"}`;
          }

          return {
             ...data,
  id: doc.id,
            start,
            end,
            title,
            backgroundColor: EVENT_TYPES[data.tip]?.color || "#ddd",
          };
        })
        .filter(Boolean);

      console.log("Loaded events:", loadedEvents); // Debug log
      setEvents(loadedEvents);
    } catch (error) {
      console.error("Greška pri učitavanju kalendara:", error);
      toast.error("Greška pri učitavanju kalendara.");
    } finally {
      setIsInitialLoading(false);
    }
  }, [selectedWeekStart]);

  const potvrdiTerminZaKorisnicu = async (eventId, korisnickoIme) => {
    try {
      setIsLoading(true);
      await runTransaction(db, async (transaction) => {
        const eventRef = doc(db, "admin_kalendar", eventId);
        transaction.update(eventRef, {
          tip: "termin",
          clientUsername: korisnickoIme,
        });

        const izboriSnapshot = await getDocs(collection(db, "izboriTermina"));
        izboriSnapshot.docs.forEach((izborDoc) => {
          const data = izborDoc.data();
          if (data.korisnickoIme === korisnickoIme || (data.eventId === eventId && data.korisnickoIme !== korisnickoIme)) {
            transaction.delete(izborDoc.ref);
          }
        });
      });

      toast.success(`Termin potvrđen za ${korisnickoIme}`);
      await fetchEvents();
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
        backgroundColor: EVENT_TYPES[newEventData.tip]?.color || "#ddd",
      };

      if (isEditing) {
        await updateDoc(eventRef, eventData);
        toast.success("Termin uspešno ažuriran");
      } else {
        await addDoc(eventRef, eventData);
        toast.success("Termin uspešno dodat");
      }
      setShowModal(false);
      setNewEventData(INITIAL_EVENT_DATA);
      setIsEditing(false);
      await fetchEvents();
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
        predloziTerminKorisnici={(event, korisnickoIme) => {
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
        />
      )}
    </div>
  );
};

export default MojKalendarAdmin;