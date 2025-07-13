// VerticalScheduleView.js
import React, { useState, useEffect } from "react";
import { format } from "date-fns";
import { db } from "../firebase";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
} from "firebase/firestore";
import "./VerticalScheduleView.css";

const VerticalScheduleView = ({ events }) => {
  const [showModal, setShowModal] = useState(false);
  const [newEventData, setNewEventData] = useState({});
  const [isEditing, setIsEditing] = useState(false);
  const [izboriPoTerminu, setIzboriPoTerminu] = useState({});

  useEffect(() => {
    const fetchIzbori = async () => {
      const izboriSnapshot = await getDocs(collection(db, "izboriTermina"));
      const izboriMap = {};

      izboriSnapshot.forEach((doc) => {
        const data = doc.data();
        if (!izboriMap[data.eventId]) {
          izboriMap[data.eventId] = [];
        }
        izboriMap[data.eventId].push({
          korisnickoIme: data.korisnickoIme,
          usluga: data.usluga,
        });
      });

      setIzboriPoTerminu(izboriMap);
    };

    fetchIzbori();
  }, []);

  const handleAddClick = () => {
    setNewEventData({ title: "", tip: "slobodan" });
    setIsEditing(false);
    setShowModal(true);
  };

  const handleSaveEvent = () => {
    // Ovde dodaj Firestore logiku ako treba
    console.log("Saving event:", newEventData);
    setShowModal(false);
  };

  const handleEditEvent = (event) => {
    setNewEventData(event);
    setIsEditing(true);
    setShowModal(true);
  };

  return (
    <div>
      <button onClick={handleAddClick} className="add-button">
        + Dodaj termin
      </button>

      <div className="schedule-grid">
        {["Ponedeljak", "Utorak", "Sreda", "Cetvrtak", "Petak", "Subota"].map(
          (dan) => (
            <div key={dan} className="day-column">
              <h4>{dan}</h4>
              {events
                .filter(
                  (e) =>
                    format(new Date(e.start), "eeee") === dan.toLowerCase()
                )
                .map((event) => (
                  <div
                    key={event.id}
                    className="event-box"
                    onClick={() => handleEditEvent(event)}
                  >
                    <div>{event.title}</div>
                    {(izboriPoTerminu[event.id] || []).map((k) => (
                      <div
                        key={k.korisnickoIme}
                        className="korisnik-info"
                      >
                        {k.korisnickoIme} ({k.usluga})
                      </div>
                    ))}
                  </div>
                ))}
            </div>
          )
        )}
      </div>

      {showModal && (
        <div className="modal">
          <div className="modal-content">
            <h3>{isEditing ? "Izmeni termin" : "Dodaj novi termin"}</h3>
            <input
              type="text"
              value={newEventData.title || ""}
              onChange={(e) =>
                setNewEventData({ ...newEventData, title: e.target.value })
              }
              placeholder="Naziv termina"
            />
            <button onClick={handleSaveEvent}>Sačuvaj</button>
            <button onClick={() => setShowModal(false)}>Zatvori</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default VerticalScheduleView;