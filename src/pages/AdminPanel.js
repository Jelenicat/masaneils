import React from "react";
import { useNavigate } from "react-router-dom";
import "./AdminPanel.css";

const AdminPanel = () => {
  const navigate = useNavigate();

  return (
    <div className="admin-page">
      <div className="admin-panel">
        <h1>Admin Panel</h1>
        <ul className="admin-menu">
          <li onClick={() => navigate("/admin/lista")}>📋 Lista svih profila</li>
          <li onClick={() => navigate("/admin/troskovi")}>💸 Troškovi</li>
          <li onClick={() => navigate("/admin/kalendar")}>📅 Moj kalendar</li>
          <li onClick={() => navigate("/admin/podsetnik")}>⏰ Podsetnik</li>
        </ul>
      </div>
    </div>
  );
};

export default AdminPanel;
