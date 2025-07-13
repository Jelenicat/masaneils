// src/pages/MojKalendarAdmin.js
import React, { useState, useEffect, useCallback } from "react";
import { Calendar, Views, momentLocalizer } from "react-big-calendar";
import moment from "moment";
import { db } from "../firebase";
import {
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  updateDoc,
  onSnapshot,
  query,
  where,
  setDoc,
  getDoc,
  serverTimestamp,
} from "firebase/firestore";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "./MojKalendarAdmin.css";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import VerticalScheduleView from "../components/VerticalScheduleView";
import { startOfWeek, endOfWeek, isWithinInterval, addDays } from "date-fns";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

const localizer = momentLocalizer(moment);

const EVENT_TYPES = {
  slobodan: { color: "#e0f7e0" },
  zauzet: { color: "#f7e0e0" },
  termin: { color: "#ffe4ec" },
  obaveza: { color: "#f0f0f0" },
};

const INITIAL_EVENT_DATA = {
  start: null,
  end: null,
  tip: "",
  note: "",
  id: null,
  clientUsername: "",
};

const MojKalendarAdmin = () => {
  const korisnickoIme = localStorage.getItem("korisnickoIme");
  const [prikaziVertical, setPrikaziVertical] = useState(false);
  const [events, setEvents] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [newEventData, setNewEventData] = useState(INITIAL_EVENT_DATA);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [korisnice, setKorisnice] = useState([]);
  const [izboriPoTerminu, setIzboriPoTerminu] = useState({});
  const [selectedWeekStart, setSelectedWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));

  const fetchEvents = useCallback(async () => {
    try {
      const snapshot = await getDocs(collection(db, "admin_kalendar"));
      const izboriSnapshot = await getDocs(collection(db, "izboriTermina"));
      const izbori = izboriSnapshot.docs.map((doc) => doc.data());
      const uslugeSnapshot = await getDocs(collection(db, "izbor_usluge"));
      const usluge = uslugeSnapshot.docs.reduce((acc, doc) => {
        const data = doc.data();
        acc[data.korisnickoIme] = data.usluga;
        return acc;
      }, {});

      const loadedEvents = snapshot.docs.map((doc) => {
        const data = doc.data();
        const start = data.start?.toDate?.() || new Date(data.start);
        const end = data.end?.toDate?.() || new Date(data.end);
        const izabrale = izbori
          .filter((izbor) => izbor.eventId === doc.id)
          .map((izbor) => `${izbor.korisnickoIme} (${usluge[izbor.korisnickoIme] || "N/A"})`);

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
      });

      console.log("Fetched events:", loadedEvents); // Debug log
      setEvents(loadedEvents);
    } catch (error) {
      console.error("Greška pri učitavanju kalendara:", error);
      toast.error("Greška pri učitavanju kalendara.");
    } finally {
      setIsInitialLoading(false);
    }
  }, []);

  const fetchIzboriTermina = useCallback(async () => {
    try {
      const snapshot = await getDocs(collection(db, "izboriTermina"));
      const uslugeSnapshot = await getDocs(collection(db, "izbor_usluge"));
      const usluge = uslugeSnapshot.docs.reduce((acc, doc) => {
        const data = doc.data();
        acc[data.korisnickoIme] = data.usluga;
        return acc;
      }, {});

      const poTerminu = {};
      snapshot.docs.forEach((doc) => {
        const izbor = doc.data();
        if (izbor.eventId) {
          if (!poTerminu[izbor.eventId]) poTerminu[izbor.eventId] = [];
          poTerminu[izbor.eventId].push({
            korisnickoIme: izbor.korisnickoIme,
            usluga: usluge[izbor.korisnickoIme] || "N/A",
          });
        }
      });
      setIzboriPoTerminu(poTerminu);
    } catch (error) {
      console.error("Greška pri učitavanju izbora termina:", error);
      toast.error("Greška pri učitavanju izbora termina.");
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "admin_kalendar"), async () => {
      try {
        await fetchIzboriTermina();
        await fetchEvents();
      } catch (error) {
        console.error("Greška pri sinhronizaciji podataka:", error);
        toast.error("Greška pri ažuriranju kalendara u realnom vremenu.");
      }
    });
    return () => unsubscribe();
  }, [fetchEvents, fetchIzboriTermina]);

  useEffect(() => {
    const fetchKorisnice = async () => {
      try {
        const snapshot = await getDocs(collection(db, "korisnici"));
        const list = snapshot.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }))
          .filter((user) => user.rola === "radnica")
          .map((user) => user.username);
        setKorisnice(list);
      } catch (error) {
        console.error("Greška pri učitavanju korisnica:", error);
        toast.error("Greška pri učitavanju korisnica.");
      }
    };
    fetchKorisnice();
  }, []);

  const handleSelectSlot = ({ start, end }) => {
    const now = new Date();
    if (start < now) {
      toast.error("Početak termina ne može biti u prošlosti.");
      return;
    }
    setNewEventData({ ...INITIAL_EVENT_DATA, start, end });
    setIsEditing(false);
    setShowModal(true);
  };

  const handleSelectEvent = (event) => {
    if (!event) return;
    setNewEventData({ ...event });
    setIsEditing(true);
    setShowModal(true);
    console.log("handleSelectEvent triggered:", event); // Debug log
  };

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
      };

      if (isEditing) {
        await updateDoc(doc(db, "admin_kalendar", newEventData.id), eventData);
        toast.success("Termin uspešno izmenjen!");
      } else {
        const docRef = await addDoc(collection(db, "admin_kalendar"), eventData);
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

  const handleDeleteEvent = async () => {
    try {
      await deleteDoc(doc(db, "admin_kalendar", newEventData.id));
      toast.success("Termin uspešno obrisan!");
      setShowModal(false);
      setNewEventData(INITIAL_EVENT_DATA);
      await fetchEvents();
    } catch (error) {
      console.error("Greška pri brisanju termina:", error);
      toast.error("Greška pri brisanju termina.");
    }
  };

  const handleSendSuggestion = async () => {
    try {
      const { start, end, clientUsername, id, note } = newEventData;
      if (!start || !end || !clientUsername || !id) {
        toast.error("Morate izabrati termin i korisnicu.");
        return;
      }

      const uslugeSnapshot = await getDocs(
        query(collection(db, "izbor_usluge"), where("korisnickoIme", "==", clientUsername))
      );
      const usluga = uslugeSnapshot.docs[0]?.data()?.usluga || "N/A";

      await setDoc(doc(db, "predlozeniTermini", `${clientUsername}_${id}`), {
        eventId: id,
        korisnica: clientUsername,
        start,
        end,
        note: note || "",
        usluga,
        status: "pending",
        timestamp: serverTimestamp(),
      });

      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          await fetch("https://notifikacija-api.vercel.app/api/posalji-notifikaciju", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              korisnickoIme: clientUsername,
              title: "Novi predlog termina 💅",
              body: `Predlog za ${moment(start).format("DD.MM.YYYY HH:mm")} (${usluga})`,
              click_action: "https://masaneils.vercel.app/ponudjeni-termini",
            }),
          });
          break;
        } catch (err) {
          if (attempt === 2) throw err;
          await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
        }
      }

      toast.success("Predlog poslat korisnici!");
      setShowModal(false);
      setNewEventData(INITIAL_EVENT_DATA);
    } catch (err) {
      console.error("Greška pri slanju predloga:", err);
      toast.error("Greška prilikom slanja predloga. Pokušajte ponovo.");
    }
  };

  const potvrdiTerminZaKorisnicu = async (eventId, korisnickoIme) => {
    try {
      const eventRef = doc(db, "admin_kalendar", eventId);
      const eventSnapshot = await getDoc(eventRef);
      const eventData = eventSnapshot.data();
      const start = eventData.start?.toDate?.() || new Date(eventData.start);

      await updateDoc(eventRef, {
        tip: "termin",
        clientUsername: korisnickoIme,
        title: `💅 ${korisnickoIme}`,
        backgroundColor: "#ffe4ec",
      });

      const izboriSnapshot = await getDocs(
        query(collection(db, "izboriTermina"), where("korisnickoIme", "==", korisnickoIme))
      );
      const brisanjaNjenih = izboriSnapshot.docs.map((doc) => deleteDoc(doc.ref));

      const sviIzboriZaOvajTermin = await getDocs(
        query(collection(db, "izboriTermina"), where("eventId", "==", eventId))
      );
      const brisanjaDrugih = sviIzboriZaOvajTermin.docs.map((doc) => deleteDoc(doc.ref));

      await Promise.all([...brisanjaNjenih, ...brisanjaDrugih]);

      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          await fetch("https://notifikacija-api.vercel.app/api/posalji-notifikaciju", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              korisnickoIme,
              title: "Termin potvrđen",
              body: `Vaš termin je potvrđen za ${moment(start).format("DD.MM.YYYY HH:mm")}.`,
              click_action: "https://masaneils.vercel.app/ponudjeni-termini",
            }),
          });
          break;
        } catch (err) {
          if (attempt === 2) throw err;
          await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
        }
      }

      toast.success(`Termin potvrđen za ${korisnickoIme}.`);
      await fetchEvents();
      await fetchIzboriTermina();
    } catch (err) {
      console.error("Greška pri potvrdi termina:", err);
      toast.error("Greška pri potvrdi termina. Pokušajte ponovo.");
    }
  };

  const eventStyleGetter = (event) => {
    const color = event.backgroundColor || EVENT_TYPES[event.tip]?.color || "#ddd";
    return {
      style: {
        backgroundColor: color,
        borderRadius: "8px",
        padding: "8px",
        color: "#2d2d2d",
        border: "1px solid #ccc",
        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
        fontSize: "0.95rem",
      },
    };
  };

  return (
    <div className="kalendar-admin-wrapper">
      <div style={{ marginBottom: "20px", textAlign: "center" }}>
        <button
          onClick={() => setPrikaziVertical((prev) => !prev)}
          className="bg-pink-500 text-white px-6 py-3 rounded hover:bg-pink-600 transition"
        >
          {prikaziVertical ? "Vrati na kalendar" : "Prikaži dan po dan"}
        </button>
      </div>

      {isInitialLoading ? (
        <p>Učitavanje...</p>
      ) : prikaziVertical ? (
        <VerticalScheduleView
          events={events.filter((event) =>
            isWithinInterval(new Date(event.start), {
              start: selectedWeekStart,
              end: endOfWeek(selectedWeekStart, { weekStartsOn: 1 }),
            })
          )}
          selectedWeekStart={selectedWeekStart}
          onSelectSlot={handleSelectSlot}
          onSelectEvent={handleSelectEvent}
          showModal={showModal}
          setShowModal={setShowModal}
          newEventData={newEventData}
          setNewEventData={setNewEventData}
          isEditing={isEditing}
          setIsEditing={setIsEditing}
          korisnice={korisnice}
          handleSaveEvent={handleSaveEvent}
          handleDeleteEvent={handleDeleteEvent}
          handleSendSuggestion={handleSendSuggestion}
          isLoading={isLoading}
          izboriPoTerminu={izboriPoTerminu}
          potvrdiTerminZaKorisnicu={potvrdiTerminZaKorisnicu}
        />
      ) : (
        <Calendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          titleAccessor="title"
          defaultView={Views.DAY}
          views={[Views.WEEK, Views.DAY]}
          date={new Date()}
          onNavigate={(newDate) => {
            setSelectedWeekStart(startOfWeek(newDate, { weekStartsOn: 1 }));
          }}
          style={{ height: "calc(100vh - 100px)", margin: "10px" }}
          onSelectEvent={handleSelectEvent}
          onSelectSlot={handleSelectSlot}
          selectable
          eventPropGetter={eventStyleGetter}
          messages={{
            week: "Nedelja",
            day: "Dan",
            today: "Danas",
            previous: "<",
            next: ">",
          }}
        />
      )}
      <div style={{ display: "flex", gap: "10px", marginBottom: "10px" }}>
        <button onClick={() => setSelectedWeekStart(addDays(selectedWeekStart, -7))}>
          ⟵ Prethodna nedelja
        </button>
        <button onClick={() => setSelectedWeekStart(addDays(selectedWeekStart, 7))}>
          Sledeća nedelja ⟶
        </button>
      </div>

      <h3 style={{ marginTop: "30px", fontSize: "18px", color: "#c89b8c" }}>
        Prikaz nedelje: {selectedWeekStart.toLocaleDateString()} –{" "}
        {endOfWeek(selectedWeekStart, { weekStartsOn: 1 }).toLocaleDateString()}
      </h3>
    </div>
  );
};

export default MojKalendarAdmin;