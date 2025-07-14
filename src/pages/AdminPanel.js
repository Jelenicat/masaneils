import React from "react";
import { useNavigate } from "react-router-dom";
import "./AdminPanel.css";
import { removeFcmToken, removeTokenFromFirestore } from "../firebase";

const AdminPanel = () => {
  const navigate = useNavigate();

  const handleLogout = async () => {
    const username = localStorage.getItem("korisnickoIme");

    if (username) {
      await removeTokenFromFirestore(username); // 🧹 Remove from Firestore
    }

    removeFcmToken(); // 🧹 Remove from localStorage
    localStorage.removeItem("korisnickoIme"); // Remove username
    navigate("/"); // Return to Home
  };

  return (
    <div className="admin-page" role="main" aria-label="Admin Panel">
      <div className="admin-panel">
        <ul className="admin-menu">
          <li onClick={() => navigate("/admin/lista")} aria-label="Lista svih profila">📋 Lista svih profila</li>
          <li onClick={() => navigate("/podsetnici")} aria-label="Lista podsetnika">📝 Lista podsetnik</li>
          <li onClick={() => navigate("/admin/troskovi")} aria-label="Troškovi">💸 Troškovi</li>
          <li onClick={() => navigate("/admin/kalendar")} aria-label="Moj kalendar">📅 Moj kalendar</li>
          <li onClick={() => navigate("/admin/podsetnik")} aria-label="Dodaj podsetnik">⏰ Dodaj podsetnik</li>
        </ul>
        <button onClick={handleLogout} className="logout-button" aria-label="Odjavi se">🚪 Odjavi se</button>
      </div>
    </div>
  );
};

export default AdminPanel;