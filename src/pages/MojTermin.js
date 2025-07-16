import React from "react";
import { useLocation } from "react-router-dom";

const MojTermin = () => {
  const location = useLocation();
  const query = new URLSearchParams(location.search);
  const vreme = query.get("vreme");

  return (
    <div className="termin-info">
      <h2>📅 Tvoj sledeći termin</h2>
      {vreme ? (
        <p>Imaš zakazan termin: <strong>{new Date(vreme).toLocaleString()}</strong></p>
      ) : (
        <p>Nemaš definisano vreme termina.</p>
      )}
    </div>
  );
};

export default MojTermin;
