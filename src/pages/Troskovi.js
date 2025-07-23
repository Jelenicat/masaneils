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
    new Date().toISOString().slice(0, 7)
  );
  const [ukupnaGodisnjaZarada, setUkupnaGodisnjaZarada] = useState(0);
  const [ukupnoGodisnjiTroskovi, setUkupnoGodisnjiTroskovi] = useState(0);

  const [prikaz, setPrikaz] = useState("troskovi");
  const [ukupnoNokti, setUkupnoNokti] = useState(0);
  const [brojNokti, setBrojNokti] = useState(0);
  const [ukupnoEdukacija, setUkupnoEdukacija] = useState(0);
  const [brojEdukacija, setBrojEdukacija] = useState(0);

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

  const fetchStatistika = async () => {
    const kalendarRef = collection(db, "admin_kalendar");
    const querySnapshot = await getDocs(kalendarRef);
    const svi = querySnapshot.docs.map((doc) => doc.data());

    const filtrirani = svi.filter((e) => {
  if (!e.start) return false;
  const startDate = e.start.toDate ? e.start.toDate() : new Date(e.start);
  return startDate.toISOString().slice(0, 7) === selectedMesec;
});


    const nokti = filtrirani.filter((e) => e.tip === "termin");
    const edukacije = filtrirani.filter((e) => e.tip === "edukacija");

    setBrojNokti(nokti.length);
    setUkupnoNokti(nokti.reduce((acc, curr) => acc + parseInt(curr.cena || 0), 0));

    setBrojEdukacija(edukacije.length);
    setUkupnoEdukacija(edukacije.reduce((acc, curr) => acc + parseInt(curr.cena || 0), 0));
  };
const fetchGodisnjaZarada = async () => {
  try {
    const kalendarRef = collection(db, "admin_kalendar");
    const querySnapshot = await getDocs(kalendarRef);
    const svi = querySnapshot.docs.map((doc) => doc.data());

    const trenutnaGodina = new Date().getFullYear();

    const godisnjiTermini = svi.filter((e) => {
      if (!e.start) return false;
      const datum = e.start.toDate ? e.start.toDate() : new Date(e.start);
      return (
        datum.getFullYear() === trenutnaGodina &&
        (e.tip === "termin" || e.tip === "edukacija")
      );
    });

   const ukupnaZarada = godisnjiTermini.reduce(
  (acc, e) => acc + (parseInt(e.cena) || 0),
  0
);


    setUkupnaGodisnjaZarada(ukupnaZarada);

    // Troškovi
    const troskoviRef = collection(db, "troskovi");
    const troskoviSnapshot = await getDocs(troskoviRef);
    const sviTroskovi = troskoviSnapshot.docs.map((doc) => doc.data());

    const godisnjiTroskovi = sviTroskovi.filter((t) => {
      if (!t.datum) return false;
      const godina = new Date(t.datum).getFullYear();
      return godina === trenutnaGodina;
    });

    const ukupniTroskovi = godisnjiTroskovi.reduce(
      (acc, t) => acc + parseInt(t.cena || 0),
      0
    );

    setUkupnoGodisnjiTroskovi(ukupniTroskovi);
  } catch (error) {
    console.error("Greška pri učitavanju godišnjih podataka:", error);
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
    fetchStatistika();
      fetchGodisnjaZarada(); 
  }, [selectedMesec]);

  return (
    <div className="troskovi-page">
      <div className="troskovi-box">
        <h1>Pregled za mesec:</h1>
        <input
          type="month"
          value={selectedMesec}
          onChange={(e) => setSelectedMesec(e.target.value)}
          className="mesec-input"
        />

        <div className="finansije-dugmad">
          <button onClick={() => setPrikaz("troskovi")}>Troškovi</button>
          <button onClick={() => setPrikaz("nokti")}>Nokti</button>
          <button onClick={() => setPrikaz("edukacije")}>Edukacije</button>
        </div>

        {prikaz === "troskovi" && (
          <>
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
          </>
        )}

        {prikaz === "nokti" && (
          <div className="statistika-box">
            <p>Ukupno zakazanih termina za nokte: {brojNokti}</p>
            <p>Ukupna zarada: {ukupnoNokti} RSD</p>
          </div>
        )}

        {prikaz === "edukacije" && (
          <div className="statistika-box">
            <p>Ukupno edukacija: {brojEdukacija}</p>
            <p>Ukupna zarada: {ukupnoEdukacija} RSD</p>
          </div>
        )}

        <div className="ukupna-zarada">
          <h3>
            Ukupna mesečna zarada: {ukupnoNokti + ukupnoEdukacija - ukupno} RSD
          </h3>
          <h3>
  Ukupna godišnja zarada: {ukupnaGodisnjaZarada - ukupnoGodisnjiTroskovi} RSD
</h3>

        </div>

        <div className="dugme-nazad">
  <button onClick={() => window.history.back()}>Nazad</button>
</div>

      </div>
    </div>
  );
};

export default Troskovi;