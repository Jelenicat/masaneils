import React, { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  query,
  where,
  addDoc,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { db } from "../firebase";
import "./Troskovi.css";

const Troskovi = () => {
  const [opis, setOpis] = useState("");
  const [datum, setDatum] = useState("");
  const [cena, setCena] = useState("");
  const [troskovi, setTroskovi] = useState([]);
  const [ukupno, setUkupno] = useState(0);
  const [selectedMesec, setSelectedMesec] = useState(
    new Date().toISOString().slice(0, 7) // format "YYYY-MM"
  );

  const fetchTroskovi = async (mesec) => {
    try {
      const troskoviRef = collection(db, "troskovi");
      const q = query(troskoviRef, where("mesec", "==", mesec));
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setTroskovi(data);
      const suma = data.reduce((acc, curr) => acc + parseInt(curr.cena), 0);
      setUkupno(suma);
    } catch (error) {
      console.error("Greška pri učitavanju troškova:", error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!opis || !datum || !cena) return;

    try {
      await addDoc(collection(db, "troskovi"), {
        opis,
        datum,
        cena,
        mesec: datum.slice(0, 7),
      });

      setOpis("");
      setDatum("");
      setCena("");
      fetchTroskovi(selectedMesec);
    } catch (error) {
      console.error("Greška pri dodavanju:", error);
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteDoc(doc(db, "troskovi", id));
      setTroskovi((prev) => prev.filter((t) => t.id !== id));
    } catch (error) {
      console.error("Greška pri brisanju:", error);
    }
  };

  useEffect(() => {
    fetchTroskovi(selectedMesec);
  }, [selectedMesec]);

  return (
    <div className="troskovi-page">
      <div className="troskovi-box">
        <h1>Troškovi za mesec:</h1>
        <input
          type="month"
          value={selectedMesec}
          onChange={(e) => setSelectedMesec(e.target.value)}
          className="mesec-input"
        />

        <form className="unos-forma" onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Opis kupovine"
            value={opis}
            onChange={(e) => setOpis(e.target.value)}
          />
          <input
            type="date"
            value={datum}
            onChange={(e) => setDatum(e.target.value)}
          />
          <input
            type="number"
            placeholder="Cena (RSD)"
            value={cena}
            onChange={(e) => setCena(e.target.value)}
          />
          <button type="submit">Dodaj trošak</button>
        </form>

        <table className="tabela-troskova">
          <thead>
            <tr>
              <th>Opis</th>
              <th>Datum</th>
              <th>Cena (RSD)</th>
              <th>Akcija</th>
            </tr>
          </thead>
          <tbody>
            {troskovi.map((t) => (
              <tr key={t.id}>
                <td>{t.opis}</td>
                <td>{t.datum}</td>
                <td>{t.cena}</td>
                <td>
                  <button
                    className="obrisi-dugme"
                    onClick={() => handleDelete(t.id)}
                  >
                    X
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan="3">
                <strong>Ukupno</strong>
              </td>
              <td>
                <strong>{ukupno} RSD</strong>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};

export default Troskovi;
