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
} from "firebase/firestore";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "./MojKalendarAdmin.css";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import VerticalScheduleView from "../components/VerticalScheduleView";

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
  const [prikaziVertical, setPrikaziVertical] = useState(false);
  const [events, setEvents] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [newEventData, setNewEventData] = useState(INITIAL_EVENT_DATA);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [korisnice, setKorisnice] = useState([]);
  const [currentDate, setCurrentDate] = useState(new Date());

  const fetchEvents = useCallback(async () => {
    try {
      const snapshot = await getDocs(collection(db, "admin_kalendar"));
      const loadedEvents = [];

      snapshot.forEach((doc) => {
        const data = doc.data();
        const start = data.start?.toDate?.() || new Date(data.start);
        const end = data.end?.toDate?.() || new Date(data.end);

        let title = "Untitled Event";

        if (typeof data.title === "string") {
          title = data.title;
        } else if (data.tip === "slobodan") {
          title = "slobodan";
        } else if (data.tip === "zauzet") {
          title = "zauzet";
        } else if (data.tip === "termin") {
          title = `💅 ${data.clientUsername || "Nepoznat korisnik"}`;
        }

        loadedEvents.push({
          id: doc.id,
          ...data,
          start,
          end,
          title,
        });
      });

      setEvents(loadedEvents);
    } catch (error) {
      console.error("Greška pri učitavanju kalendara:", error.message);
      toast.error("Greška pri učitavanju kalendara: " + error.message);
    } finally {
      setIsInitialLoading(false);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "admin_kalendar"), fetchEvents);
    return () => unsubscribe();
  }, [fetchEvents]);

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
        toast.error("Greška pri učitavanju korisnica: " + error.message);
      }
    };
    fetchKorisnice();
  }, []);

  const handleSelectSlot = ({ start, end }) => {
    setNewEventData({ ...INITIAL_EVENT_DATA, start, end });
    setIsEditing(false);
    setShowModal(true);
  };

  const handleSelectEvent = (event) => {
    if (!event) return;
    setNewEventData({ ...event });
    setIsEditing(true);
    setShowModal(true);
  };

  const handleSaveEvent = async () => {
    if (!newEventData.tip || !newEventData.start || !newEventData.end) {
      toast.error("Molimo popunite sva obavezna polja.");
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
      };

      if (isEditing) {
        await updateDoc(doc(db, "admin_kalendar", newEventData.id), eventData);
        toast.success("Termin uspešno izmenjen!");
      } else {
        await addDoc(collection(db, "admin_kalendar"), eventData);
        toast.success("Termin uspešno dodat!");
      }
      setShowModal(false);
      setNewEventData(INITIAL_EVENT_DATA);
    } catch (error) {
      toast.error("Greška pri čuvanju termina: " + error.message);
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
    } catch (error) {
      toast.error("Greška pri brisanju termina: " + error.message);
    }
  };

  const handleSendSuggestion = async () => {
    toast.info("Predlog poslat korisnicama!");
  };

  const eventStyleGetter = (event) => {
    const color = EVENT_TYPES[event.tip]?.color || "#ddd";
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

  const getStartOfWeek = (date) => {
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(date.setDate(diff));
  };

  useEffect(() => {
    setCurrentDate(getStartOfWeek(new Date()));
  }, []);

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
          events={events}
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
          date={currentDate}
          onNavigate={(newDate) => setCurrentDate(newDate)}
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

      {showModal && !prikaziVertical && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 className="text-xl font-bold mb-6 text-gray-800">
              {isEditing ? "Izmeni termin" : "Dodaj novi termin"}
            </h3>

            <div className="form-group">
              <label>
                Tip termina <span className="text-red-500">*</span>
              </label>
              <select
                value={newEventData.tip}
                onChange={(e) => setNewEventData({ ...newEventData, tip: e.target.value })}
              >
                <option value="">-- Izaberi tip --</option>
                <option value="slobodan">Slobodan</option>
                <option value="zauzet">Zauzet</option>
                <option value="termin">Termin</option>
                <option value="obaveza">Obaveza</option>
              </select>
            </div>

            {newEventData.tip === "termin" && (
              <div className="form-group">
                <label>
                  Korisnica <span className="text-red-500">*</span>
                </label>
                <select
                  value={newEventData.clientUsername || ""}
                  onChange={(e) =>
                    setNewEventData({ ...newEventData, clientUsername: e.target.value })
                  }
                >
                  <option value="">-- Izaberi korisnicu --</option>
                  {korisnice.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="form-group">
              <label>Napomena</label>
              <input
                type="text"
                value={newEventData.note}
                onChange={(e) => setNewEventData({ ...newEventData, note: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label>
                Početak <span className="text-red-500">*</span>
              </label>
              <DatePicker
                selected={newEventData.start}
                onChange={(date) => setNewEventData({ ...newEventData, start: date })}
                showTimeSelect
                timeIntervals={15}
                dateFormat="Pp"
                minTime={new Date(0, 0, 0, 8, 0)}
                maxTime={new Date(0, 0, 0, 22, 0)}
              />
            </div>

            <div className="form-group">
              <label>
                Kraj <span className="text-red-500">*</span>
              </label>
              <DatePicker
                selected={newEventData.end}
                onChange={(date) => setNewEventData({ ...newEventData, end: date })}
                showTimeSelect
                timeIntervals={15}
                dateFormat="Pp"
                minTime={new Date(0, 0, 0, 8, 0)}
                maxTime={new Date(0, 0, 0, 22, 0)}
              />
            </div>

            <div className="duration-presets">
              <button
                onClick={() => {
                  if (newEventData.start) {
                    setNewEventData({
                      ...newEventData,
                      end: new Date(newEventData.start.getTime() + 30 * 60 * 1000),
                    });
                  }
                }}
                className="duration-button"
              >
                30 min
              </button>
              <button
                onClick={() => {
                  if (newEventData.start) {
                    setNewEventData({
                      ...newEventData,
                      end: new Date(newEventData.start.getTime() + 60 * 60 * 1000),
                    });
                  }
                }}
                className="duration-button"
              >
                1 sat
              </button>
            </div>

            <div className="modal-buttons flex gap-3 mt-6 justify-center">
              <button
                onClick={handleSaveEvent}
                className="confirm-button bg-primary text-white px-6 py-3 rounded-lg font-semibold hover:bg-primary-hover transition disabled:opacity-50"
                disabled={isLoading}
              >
                {isLoading ? "Čuva se..." : "Sačuvaj"}
              </button>
              {isEditing && (
                <>
                  <button
                    onClick={handleSendSuggestion}
                    className="bg-blue-500 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-600 transition"
                  >
                    Pošalji predlog korisnicama
                  </button>
                  <button
                    onClick={handleDeleteEvent}
                    className="delete-button bg-red-500 text-white px-6 py-3 rounded-lg font-semibold hover:bg-red-600 transition"
                  >
                    Obriši
                  </button>
                </>
              )}
              <button
                onClick={() => setShowModal(false)}
                className="cancel-button bg-gray-200 text-gray-800 px-6 py-3 rounded-lg font-semibold hover:bg-gray-300 transition"
              >
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