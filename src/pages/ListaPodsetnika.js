import React, { useEffect, useState } from "react";
import { db } from "../firebase";
import {
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  doc,
} from "firebase/firestore";
import "./ListaPodsetnika.css";

const ListaPodsetnika = () => {
  const [podsetnici, setPodsetnici] = useState([]);

  const ucitajPodsetnike = async () => {
    try {
      const q = query(
        collection(db, "podsetnici"),
        where("kreirao", "==", "masa"),
        where("aktivan", "==", true)
      );
      const querySnapshot = await getDocs(q);
      const podaci = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setPodsetnici(podaci);
    } catch (error) {
      console.error("Greška pri učitavanju podsetnika:", error);
    }
  };

  useEffect(() => {
    ucitajPodsetnike();
  }, []);

  const oznaciKaoGotovo = async (id) => {
    try {
      const docRef = doc(db, "podsetnici", id);
      await updateDoc(docRef, { aktivan: false });
      setPodsetnici((prev) => prev.filter((p) => p.id !== id));
    } catch (error) {
      console.error("Greška pri označavanju podsetnika kao gotovog:", error);
    }
  };

  return (
    <div className="lista-page">
      <div className="lista-form">
        <h2>Aktivni podsetnici</h2>
        {podsetnici.length === 0 ? (
          <p className="prazno-info">Nema aktivnih podsetnika.</p>
        ) : (
          <ul className="lista-ul">
            {podsetnici.map((p) => (
              <li key={p.id} className="lista-item">
                <div className="tekst">{p.tekst}</div>
                <button onClick={() => oznaciKaoGotovo(p.id)}>Gotovo</button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default ListaPodsetnika;
