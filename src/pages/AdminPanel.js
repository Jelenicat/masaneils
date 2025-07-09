import React from "react";
import { useNavigate } from "react-router-dom";
import "./AdminPanel.css";
import { removeFcmToken, removeTokenFromFirestore } from "../firebase";

const AdminPanel = () => {
  const navigate = useNavigate();

  const handleLogout = async () => {
    const username = localStorage.getItem("korisnickoIme");

    if (username) {
      await removeTokenFromFirestore(username); // 🧹 obrisi iz Firestore baze
    }

    removeFcmToken(); // 🧹 obrisi iz localStorage
    localStorage.removeItem("korisnickoIme"); // obrisi username
    navigate("/"); // vrati na Home
  };

  return (
    <div className="admin-page">
      <div className="admin-panel">
        <h1>Admin Panel</h1>
        <ul className="admin-menu">
          <li onClick={() => navigate("/admin/lista")}>📋 Lista svih profila</li>
          <li onClick={() => navigate("/podsetnici")}>📝 Lista podsetnik</li>
          <li onClick={() => navigate("/admin/troskovi")}>💸 Troškovi</li>
          <li onClick={() => navigate("/admin/kalendar")}>📅 Moj kalendar</li>
          <li onClick={() => navigate("/admin/podsetnik")}>⏰ Dodaj podsetnik</li>
        </ul>
        <button onClick={handleLogout} className="logout-button">🚪 Odjavi se</button>
      </div>
    </div>
  );
};

export default AdminPanel;
