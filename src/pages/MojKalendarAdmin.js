import React, { useState, useEffect } from "react";
import { Calendar, Views } from "react-big-calendar";
import { localizer } from "./localizer";
import { db } from "../firebase";
import {
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
} from "firebase/firestore";

import "react-big-calendar/lib/css/react-big-calendar.css";
import "./MojKalendarAdmin.css";

const MojKalendarAdmin = () => {
  const [events, setEvents] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [newEventData, setNewEventData] = useState({
    start: null,
    end: null,
    tip: "",
    note: "",
    allDay: false,
    clientUsername: "",
  });
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentView, setCurrentView] = useState(Views.WEEK);
  const [klijentkinje, setKlijentkinje] = useState([]);
  const [izabraniTermini, setIzabraniTermini] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const korisniciSnapshot = await getDocs(collection(db, "korisnici"));
        const allUsers = [];
        korisniciSnapshot.forEach((doc) => {
          const data = doc.data();
          if (data.rola === "radnica") {
            allUsers.push({ id: doc.id, username: data.username });
          }
        });
        setKlijentkinje(allUsers);

        const eventsSnapshot = await getDocs(collection(db, "admin_kalendar"));
        const loadedEvents = eventsSnapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            ...data,
            id: doc.id,
            start: new Date(data.start),
            end: new Date(data.end),
          };
        });
        setEvents(loadedEvents);

        const izboriSnapshot = await getDocs(collection(db, "izboriTermina"));
        const uslugeSnapshot = await getDocs(collection(db, "izbor_usluge"));

        const termini = await Promise.all(
          izboriSnapshot.docs.map(async (doc) => {
            const data = doc.data();
            if (!data.datum || !data.vreme || !data.korisnickoIme) return null;

            const datum = data.datum;
            const vreme = data.vreme;
            const korisnickoIme = data.korisnickoIme;

            const [sat, minut] = vreme.split(":").map(Number);
            const [god, mesec, dan] = datum.split("-").map(Number);
            const start = new Date(god, mesec - 1, dan, sat, minut);
            const end = new Date(start.getTime() + 60 * 60 * 1000); // +1h

            const userUslugaDoc = uslugeSnapshot.docs.find((d) => d.id === korisnickoIme);
            let usluga = "";
            if (userUslugaDoc) {
              const u = userUslugaDoc.data();
              usluga = `${u.usluga}${u.materijal === "Ne" ? " (bez materijala)" : ""}`;
            }

            return {
              id: doc.id,
              title: `🌱 ${korisnickoIme} – ${usluga}`,
              start,
              end,
              tip: "slobodan",
              korisnica: korisnickoIme,
              note: usluga,
            };
          })
        );

        setIzabraniTermini(termini.filter((t) => t !== null));
      } catch (error) {
        console.error("Greška pri učitavanju podataka:", error);
      }
    };

    fetchData();
  }, []);

  const handleSelectSlot = ({ start, end }) => {
    setNewEventData({
      start,
      end,
      tip: "",
      note: "",
      allDay: false,
      clientUsername: "",
    });
    setShowModal(true);
    setSelectedEvent(null);
  };

  const handleSelectEvent = (event) => {
    setSelectedEvent(event);
    setShowModal(true);
  };

  const handleDeleteEvent = async () => {
    if (!selectedEvent?.id) return;
    try {
      await deleteDoc(doc(db, "admin_kalendar", selectedEvent.id));
      setEvents((prev) => prev.filter((e) => e.id !== selectedEvent.id));
      setShowModal(false);
    } catch (error) {
      console.error("Greška pri brisanju:", error);
    }
  };

  const handleDrop = async (item) => {
    const { start, end, korisnica, note } = item;

    const newEvent = {
      title: `💅 ${korisnica}`,
      start,
      end,
      allDay: false,
      tip: "termin",
      note: note || "",
      clientUsername: korisnica,
    };

    try {
      const docRef = await addDoc(collection(db, "admin_kalendar"), {
        ...newEvent,
        start: start.toISOString(),
        end: end.toISOString(),
        createdAt: new Date().toISOString(),
      });
      setEvents((prev) => [...prev, { ...newEvent, id: docRef.id }]);
      setIzabraniTermini((prev) => prev.filter((t) => t.id !== item.id));
    } catch (error) {
      console.error("Greška pri dodavanju izabranog termina:", error);
    }
  };

  const handleAddEvent = async () => {
    const { tip, start, end, allDay, note, clientUsername } = newEventData;
    if (!tip) return;

    const eventData = {
      title: `${tip === "termin" ? "💅" : tip === "slobodan" ? "🌱" : "📌"} ${note || ""}`,
      start: allDay
        ? new Date(start.getFullYear(), start.getMonth(), start.getDate(), 0, 0)
        : start,
      end: allDay
        ? new Date(start.getFullYear(), start.getMonth(), start.getDate(), 23, 59)
        : end,
      allDay,
      tip,
      note: note || "",
      clientUsername: tip === "termin" ? clientUsername : "",
      createdAt: new Date().toISOString(),
    };

    try {
      const docRef = await addDoc(collection(db, "admin_kalendar"), {
        ...eventData,
        start: eventData.start.toISOString(),
        end: eventData.end.toISOString(),
      });
      setEvents((prev) => [...prev, { ...eventData, id: docRef.id }]);
      setShowModal(false);
      setNewEventData({ start: null, end: null, tip: "", note: "", allDay: false, clientUsername: "" });
    } catch (error) {
      console.error("Greška pri dodavanju događaja:", error);
    }
  };

  const eventStyleGetter = (event) => {
    let backgroundColor = "#ddd";
    if (event.tip === "termin") backgroundColor = "#ffe0ec";
    if (event.tip === "slobodan") backgroundColor = "#e3fce3";
    return {
      style: {
        backgroundColor,
        borderRadius: "5px",
        padding: "2px",
        color: "#333",
        border: "1px solid #ccc",
      },
    };
  };

  const today = new Date();
  const minTime = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 8, 0);
  const maxTime = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 22, 0);

  return (
    <div className="kalendar-admin-wrapper">
      <h2 style={{ textAlign: "center", fontFamily: "Playfair Display" }}>
        Adminov Kalendar
      </h2>

      <div className="izabrani-termini">
        {izabraniTermini.map((termin) => (
          <div
            key={termin.id}
            className="izabrani-termin"
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData("text/plain", JSON.stringify(termin));
            }}
          >
            {termin.title} ({termin.start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} - {termin.end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })})
          </div>
        ))}
      </div>

      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          const data = e.dataTransfer.getData("text/plain");
          if (data) {
            const item = JSON.parse(data);
            handleDrop(item);
          }
        }}
      >
        <Calendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          selectable
          onSelectSlot={handleSelectSlot}
          onSelectEvent={handleSelectEvent}
          views={[Views.WEEK, Views.DAY, Views.MONTH]}
          view={currentView}
          onView={setCurrentView}
          date={currentDate}
          onNavigate={setCurrentDate}
          step={15}
          timeslots={4}
          style={{ height: "80vh", background: "white", padding: "10px", borderRadius: "8px" }}
          min={minTime}
          max={maxTime}
          eventPropGetter={eventStyleGetter}
          culture="sr-RS"
        />
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>{selectedEvent ? "Detalji događaja" : "Dodaj događaj"}</h3>

            {!selectedEvent && (
              <>
                <select
                  value={newEventData.tip}
                  onChange={(e) =>
                    setNewEventData((prev) => ({ ...prev, tip: e.target.value }))
                  }
                >
                  <option value="">Izaberi tip</option>
                  <option value="termin">Termin</option>
                  <option value="obaveza">Obaveza</option>
                  <option value="slobodan">Slobodan termin</option>
                </select>

                {newEventData.tip === "termin" && (
                  <select
                    value={newEventData.clientUsername}
                    onChange={(e) =>
                      setNewEventData((prev) => ({
                        ...prev,
                        clientUsername: e.target.value,
                      }))
                    }
                    style={{
                      width: "100%",
                      padding: "10px",
                      margin: "10px 0",
                      fontSize: "16px",
                      border: "1px solid #ccc",
                      borderRadius: "10px",
                      fontFamily: "'Playfair Display', serif",
                    }}
                  >
                    <option value="">Izaberi klijentkinju</option>
                    {klijentkinje.map((user) => (
                      <option key={user.id} value={user.username}>
                        {user.username}
                      </option>
                    ))}
                  </select>
                )}

                {newEventData.tip !== "slobodan" && (
                  <textarea
                    placeholder="Napomena (opciono)"
                    value={newEventData.note}
                    onChange={(e) =>
                      setNewEventData((prev) => ({
                        ...prev,
                        note: e.target.value,
                      }))
                    }
                  />
                )}

                <div className="ceo-dan-checkbox">
                  <input
                    type="checkbox"
                    checked={newEventData.allDay}
                    onChange={(e) =>
                      setNewEventData((prev) => ({
                        ...prev,
                        allDay: e.target.checked,
                      }))
                    }
                  />
                  <label>Ceo dan</label>
                </div>
              </>
            )}

            <div className="modal-buttons">
              {!selectedEvent ? (
                <button className="btn-braon" onClick={handleAddEvent}>
                  Dodaj
                </button>
              ) : (
                <button className="btn-red" onClick={handleDeleteEvent}>
                  Obriši
                </button>
              )}
              <button className="btn-grey" onClick={() => setShowModal(false)}>
                Otkaži
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MojKalendarAdmin;
