import React, { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { useNavigate } from "react-router-dom"; // ⬅ Dodaj
import "./AllProfiles.css";

const AllProfiles = () => {
  const [profiles, setProfiles] = useState([]);
  const [selectedUser, setSelectedUser] = useState("");
  const [userEvents, setUserEvents] = useState([]);
  const navigate = useNavigate(); // ⬅ Dodaj

  useEffect(() => {
    const fetchProfiles = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "korisnici"));
        const data = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setProfiles(data);
      } catch (error) {
        console.error("Greška pri učitavanju profila:", error);
      }
    };

    fetchProfiles();
  }, []);

  useEffect(() => {
    const fetchEvents = async () => {
      if (!selectedUser) return;
      try {
        const querySnapshot = await getDocs(collection(db, "admin_kalendar"));
        const data = querySnapshot.docs.map((doc) => doc.data());
        const userData = data.filter(
          (event) =>
            event.clientUsername === selectedUser && event.tip === "termin"
        );
        setUserEvents(userData);
      } catch (error) {
        console.error("Greška pri učitavanju termina:", error);
      }
    };

    fetchEvents();
  }, [selectedUser]);

  const ukupnoZarada = userEvents.reduce(
    (acc, curr) => acc + parseInt(curr.note || 0),
    0
  );

  return (
    <div className="all-profiles-page">
      <div className="all-profiles-box">
        <h1>Svi profili</h1>
        <select
          className="dropdown"
          value={selectedUser}
          onChange={(e) => setSelectedUser(e.target.value)}
        >
          <option value="">Izaberi korisnicu</option>
          {profiles.map((user) => (
            <option key={user.id} value={user.username}>
              {user.username}
            </option>
          ))}
        </select>

        {selectedUser && (
          <div className="rezultati-box">
            <table className="tabela-troskova">
              <thead>
                <tr>
                  <th>Datum</th>
                  <th>Početak</th>
                  <th>Kraj</th>
                  <th>Zarada (RSD)</th>
                </tr>
              </thead>
              <tbody>
                {userEvents.map((event, i) => (
                  <tr key={i}>
                    <td>{event.start?.slice(0, 10)}</td>
                    <td>{new Date(event.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                    <td>{new Date(event.end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                    <td>{event.note || "0"}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan="3"><strong>Ukupno</strong></td>
                  <td><strong>{ukupnoZarada} RSD</strong></td>
                </tr>
              </tfoot>
            </table>

       
          </div>
        )}
             {/* Dugme nazad */}
            <div className="nazad-container">
              <button className="nazad-dugme" onClick={() => navigate("/admin")}>
                ← Nazad
              </button>
            </div>
      </div>
    </div>
  );
};

export default AllProfiles;
