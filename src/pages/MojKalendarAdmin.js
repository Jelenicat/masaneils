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
import { utcToZonedTime, format } from "date-fns-tz";
import { startOfWeek, endOfWeek } from "date-fns";

import VerticalScheduleView from "../components/VerticalScheduleView";
import PonudiTermineModal from "../components/PonudiTermineModal";
import { requestPermission } from "../firebase"; // FCM integration

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

  // Request push notification permissions on mount
  useEffect(() => {
    requestPermission().catch((err) => {
      toast.error("Greška prilikom postavljanja notifikacija: " + err.message);
    });
  }, []);

  // Fetch events and korisnici koji su izabrali termine
  const fetchEvents = useCallback(async () => {
    try {
      const now = utcToZonedTime(new Date(), "Europe/Belgrade");

      const snapshot = await getDocs(collection(db, "admin_kalendar"));
      const izboriSnapshot = await getDocs(collection(db, "izboriTermina"));
      const izbori = izboriSnapshot.docs.map((doc) => doc.data());

      const uslugeSnapshot = await getDocs(collection(db, "izbor_usluge"));
      const usluge = uslugeSnapshot.docs.reduce((acc, doc) => {
        const data = doc.data();
        acc[data.korisnickoIme] = data.usluga;
        return acc;
      }, {});

      const loadedEvents = snapshot.docs
        .map((doc) => {
          const data = doc.data();
          const start = utcToZonedTime(
            data.start?.toDate?.() || new Date(data.start),
            "Europe/Belgrade"
          );
          const end = utcToZonedTime(
            data.end?.toDate?.() || new Date(data.end),
            "Europe/Belgrade"
          );
          if (start < now) return null; // Skip past events

          const izabrale = izbori
            .filter((izbor) => izbor.eventId === doc.id)
            .map(
              (izbor) => `${izbor.korisnickoIme} (${usluge[izbor.korisnickoIme] || "N/A"})`
            );

          let title = data.title || "Untitled Event";
          if (data.tip === "slobodan") {
            title = izabrale.length > 0 ? `slobodan (${izabrale.join(", ")})` : "slobodan";
          } else if (data.tip === "zauzet") {
            title = "zauzet";
          } else if (data.tip === "termin") {
            const vreme = start.toLocaleTimeString("sr-RS", {
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            });
            title = `💅 ${data.clientUsername || "Nepoznat korisnik"} (${vreme})`;
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

  // Save new or edited event
  const handleSaveEvent = async () => {
    if (!newEventData.tip || !newEventData.start || !newEventData.end) {
      toast.error("Molimo popunite sva obavezna polja.");
      return;
    }

    const now = utcToZonedTime(new Date(), "Europe/Belgrade");
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

  // Potvrdi termin za korisnicu uz transakciju i brisanje ostalih izbora
  const potvrdiTerminZaKorisnicu = async (eventId, korisnickoIme) => {
    if (!korisnickoIme) {
      toast.error("Korisničko ime nije definisano.");
      return;
    }
    try {
      await runTransaction(db, async (transaction) => {
        const eventRef = doc(db, "admin_kalendar", eventId);
        const eventSnapshot = await transaction.get(eventRef);
        if (!eventSnapshot.exists()) {
          throw new Error("Termin ne postoji.");
        }
        const eventData = eventSnapshot.data();
        const start = utcToZonedTime(
          eventData.start?.toDate?.() || new Date(eventData.start),
          "Europe/Belgrade"
        );

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

      // Slanje notifikacije korisnici
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          await fetch("https://notifikacija-api.vercel.app/api/posalji-notifikaciju", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              korisnickoIme,
              title: "Termin potvrđen",
              body: `Vaš termin je potvrđen za ${format(start, "dd.MM.yyyy HH:mm", {
                timeZone: "Europe/Belgrade",
              })}.`,
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

  // Slanje predloga termina korisnici
  const handleSendSuggestion = async () => {
    const { clientUsername } = newEventData;
    if (!clientUsername) {
      toast.error("Morate izabrati korisnicu.");
      return;
    }

    try {
      const izboriSnapshot = await getDocs(
        query(collection(db, "izboriTermina"), where("korisnickoIme", "==", clientUsername))
      );
      const slobodniTermini = await Promise.all(
        izboriSnapshot.docs.map(async (docSnap) => {
          const izbor = docSnap.data();
          const eventRef = doc(db, "admin_kalendar", izbor.eventId);
          const eventSnapshot = await getDoc(eventRef);
          if (eventSnapshot.exists()) {
            const eventData = eventSnapshot.data();
            return {
              id: izbor.eventId,
              start: utcToZonedTime(
                eventData.start?.toDate?.() || new Date(eventData.start),
                "Europe/Belgrade"
              ),
              end: utcToZonedTime(
                eventData.end?.toDate?.() || new Date(eventData.end),
                "Europe/Belgrade"
              ),
              note: eventData.note || "",
            };
          }
          return null;
        })
      ).then((results) => results.filter((t) => t !== null));

      setShowModal(false);
      setShowSuggestionModal(true);
      setSlobodniTermini(slobodniTermini);
    } catch (err) {
      console.error("Greška pri pripremi predloga:", err);
      toast.error("Greška prilikom pripreme predloga.");
    }
  };

  return (
    <div className="moj-kalendar-admin">
      <VerticalScheduleView
        selectedWeekStart={selectedWeekStart}
        onSelectSlot={(slot) => {
          setNewEventData({ ...INITIAL_EVENT_DATA, ...slot, tip: "slobodan" });
          setShowModal(true);
          setIsEditing(false);
        }}
      />

      {showModal && (
        <div className="modal-overlay show">
          <div className="modal-content">
            <h3>{isEditing ? "Izmeni termin" : "Dodaj novi termin"}</h3>

            <select
              value={newEventData.tip}
              onChange={(e) => setNewEventData({ ...newEventData, tip: e.target.value })}
            >
              <option value="">Izaberite tip</option>
              <option value="slobodan">Slobodan</option>
              <option value="zauzet">Zauzet</option>
              <option value="termin">Termin</option>
            </select>

            <input
              type="datetime-local"
              value={
                newEventData.start
                  ? format(newEventData.start, "yyyy-MM-dd'T'HH:mm", { timeZone: "Europe/Belgrade" })
                  : ""
              }
              onChange={(e) =>
                setNewEventData({
                  ...newEventData,
                  start: utcToZonedTime(new Date(e.target.value), "Europe/Belgrade"),
                })
              }
            />

            <input
              type="datetime-local"
              value={
                newEventData.end
                  ? format(newEventData.end, "yyyy-MM-dd'T'HH:mm", { timeZone: "Europe/Belgrade" })
                  : ""
              }
              onChange={(e) =>
                setNewEventData({
                  ...newEventData,
                  end: utcToZonedTime(new Date(e.target.value), "Europe/Belgrade"),
                })
              }
            />

            <input
              type="text"
              placeholder="Napomena"
              value={newEventData.note || ""}
              onChange={(e) => setNewEventData({ ...newEventData, note: e.target.value })}
            />

            {newEventData.tip === "termin" && (
              <input
                type="text"
                placeholder="Korisničko ime"
                value={newEventData.clientUsername || ""}
                onChange={(e) => setNewEventData({ ...newEventData, clientUsername: e.target.value })}
              />
            )}

            <button onClick={handleSaveEvent} disabled={isLoading}>
              {isLoading ? "Čekaj..." : isEditing ? "Sačuvaj izmene" : "Dodaj termin"}
            </button>

            {newEventData.tip === "slobodan" && (
              <button onClick={handleSendSuggestion} disabled={isLoading}>
                Pošalji predlog
              </button>
            )}

            <button
              onClick={() => {
                setShowModal(false);
                setNewEventData(INITIAL_EVENT_DATA);
                setIsEditing(false);
              }}
            >
              Zatvori
            </button>
          </div>
        </div>
      )}

      {showSuggestionModal && (
        <PonudiTermineModal
          korisnickoIme={newEventData.clientUsername}
          slobodniTermini={slobodniTermini}
          onClose={() => setShowSuggestionModal(false)}
        />
      )}
    </div>
  );
};

export default MojKalendarAdmin;
