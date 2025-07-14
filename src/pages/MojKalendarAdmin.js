// src/pages/MojKalendarAdmin.js
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
  getDoc,
} from "firebase/firestore";
import { toast } from "react-toastify";
import { format, startOfWeek, addDays } from "date-fns";

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
  const [slobodniTermini, setSlobodniTermini] = useState([]);

  useEffect(() => {
    requestPermission().catch((err) => {
      toast.error("Greška prilikom postavljanja notifikacija: " + err.message);
    });
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [selectedWeekStart]);

  const pomeriNedeljuUnazad = () => {
    setSelectedWeekStart((prev) => addDays(prev, -7));
  };

  const pomeriNedeljuUnapred = () => {
    setSelectedWeekStart((prev) => addDays(prev, 7));
  };

  const fetchEvents = useCallback(async () => {
    try {
      const now = new Date();

      const snapshot = await getDocs(collection(db, "admin_kalendar"));
      const izboriSnapshot = await getDocs(collection(db, "izboriTermina"));
      const izbori = izboriSnapshot.docs.map((doc) => doc.data());

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

      const loadedEvents = snapshot.docs
        .map((doc) => {
          const data = doc.data();
          const start = data.start?.toDate?.() || new Date(data.start);
          const end = data.end?.toDate?.() || new Date(data.end);
          if (start < now) return null;

          const izabrale = izbori
            .filter((izbor) => izbor.eventId === doc.id)
            .map(
              (izbor) => `${izbor.korisnickoIme} (${usluge[izbor.korisnickoIme] || "N/A"})`
            );

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

if (data.tip === "slobodan") {
  title += izabrale.length > 0 ? `slobodan (${izabrale.join(", ")})` : "slobodan";
} else if (data.tip === "zauzet") {
  title += "zauzet";
} else if (data.tip === "termin") {
  title += `💅 ${data.clientUsername || "Nepoznat korisnik"}`;
}


          return {
            id: doc.id,
            ...data,
            start,
            end,
            title,
            backgroundColor: EVENT_TYPES[data.tip]?.color || "#ddd",
          };
        })
        .filter((event) => event !== null);

      setEvents(loadedEvents);
    } catch (error) {
      console.error("Greška pri učitavanju kalendara:", error);
      toast.error("Greška pri učitavanju kalendara.");
    } finally {
      setIsInitialLoading(false);
    }
  }, []);

  const handleSaveEvent = async () => {
    if (!newEventData.tip || !newEventData.start || !newEventData.end) {
      toast.error("Molimo popunite sva obavezna polja.");
      return;
    }

    const now = new Date();
    if (newEventData.start < now) {
      toast.error("Početak termina ne može biti u prošlosti.");
      return;
    }

    setIsLoading(true);
    try {
      const eventData = {
        ...newEventData,
        title:
          newEventData.tip === "slobodan"
            ? "slobodan"
            : newEventData.tip === "zauzet"
            ? "zauzet"
            : newEventData.tip === "termin"
            ? `💅 ${newEventData.clientUsername || "Nepoznat korisnik"}`
            : newEventData.note || "Untitled Event",
        backgroundColor: EVENT_TYPES[newEventData.tip]?.color || "#ddd",
        id: newEventData.id || null,
      };

      if (isEditing) {
        await updateDoc(doc(db, "admin_kalendar", newEventData.id), eventData);
        toast.success("Termin uspešno izmenjen!");
      } else {
        const docRef = await addDoc(collection(db, "admin_kalendar"), {
          ...eventData,
          id: null,
        });
        await updateDoc(doc(db, "admin_kalendar", docRef.id), {
          id: docRef.id,
        });
        toast.success("Termin uspešno dodat!");
      }

      setShowModal(false);
      setNewEventData(INITIAL_EVENT_DATA);
      await fetchEvents();
    } catch (error) {
      console.error("Greška pri čuvanju termina:", error);
      toast.error("Greška pri čuvanju termina.");
    } finally {
      setIsLoading(false);
    }
  };

  const potvrdiTerminZaKorisnicu = async (eventId, korisnickoIme) => {
    if (!korisnickoIme) {
      toast.error("Korisničko ime nije definisano.");
      return;
    }

    try {
      let start;
      await runTransaction(db, async (transaction) => {
        const eventRef = doc(db, "admin_kalendar", eventId);
        const eventSnapshot = await transaction.get(eventRef);
        if (!eventSnapshot.exists()) {
          throw new Error("Termin ne postoji.");
        }
        const eventData = eventSnapshot.data();

        start = eventData.start?.toDate?.() || new Date(eventData.start);

        transaction.update(eventRef, {
          tip: "termin",
          clientUsername: korisnickoIme,
          title: `💅 ${korisnickoIme}`,
          backgroundColor: "#ffe4ec",
        });

        const izboriSnapshot = await getDocs(
          query(collection(db, "izboriTermina"), where("korisnickoIme", "==", korisnickoIme))
        );
        izboriSnapshot.docs.forEach((docSnap) => {
          transaction.delete(docSnap.ref);
        });

        const sviIzboriZaOvajTermin = await getDocs(
          query(collection(db, "izboriTermina"), where("eventId", "==", eventId))
        );
        sviIzboriZaOvajTermin.docs.forEach((docSnap) => {
          transaction.delete(docSnap.ref);
        });

        const predloziSnapshot = await getDocs(
          query(collection(db, "predlozeniTermini"), where("korisnica", "==", korisnickoIme))
        );
        predloziSnapshot.docs.forEach((docSnap) => {
          transaction.delete(docSnap.ref);
        });
      });

      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          await fetch("https://notifikacija-api.vercel.app/api/posalji-notifikaciju", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              korisnickoIme,
              title: "Termin potvrđen",
              body: `Vaš termin je potvrđen za ${format(start, "dd.MM.yyyy HH:mm")}.`,
              click_action: "https://masaneils.vercel.app/ponudjeni-termini",
            }),
          });
          break;
        } catch (err) {
          if (attempt === 2) {
            console.error("Neuspešno slanje notifikacije:", err);
            toast.warn("Termin potvrđen, ali notifikacija nije poslata.");
          }
          await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
        }
      }

      toast.success(`Termin potvrđen za ${korisnickoIme}.`);
      await fetchEvents();
    } catch (err) {
      console.error("Greška pri potvrdi termina:", err);
      toast.error("Greška pri potvrdi termina. Pokušajte ponovo.");
    }
  };

return (
  <div className="moj-kalendar-admin">
    <VerticalScheduleView
      events={events}
      izboriPoTerminu={izboriPoTerminu}
      potvrdiTerminZaKorisnicu={potvrdiTerminZaKorisnicu}
      selectedWeekStart={selectedWeekStart}
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
      pomeriNedeljuUnazad={pomeriNedeljuUnazad}
      pomeriNedeljuUnapred={pomeriNedeljuUnapred}
    />

    {/* MODAL ZA DODAVANJE I IZMENU TERMINA */}
    {showModal && (
      <DodajTerminModal
        eventData={newEventData}
        onClose={() => setShowModal(false)}
        onSave={handleSaveEvent}
        isEditing={isEditing}
        setEventData={setNewEventData}
        isLoading={isLoading}
      />
    )}
  </div>
);

};

export default MojKalendarAdmin;
