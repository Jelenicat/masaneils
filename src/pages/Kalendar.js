// Izmenjeni Kalendar.js
import React, { useEffect, useState } from "react";
import { db } from "../firebase";
import {
  collection,
  getDocs,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { toast } from "react-toastify";
import "./Kalendar.css";
import { useNavigate } from "react-router-dom";

const daniUNedelji = ["Ponedeljak", "Utorak", "Sreda", "Četvrtak", "Petak", "Subota"];

const Kalendar = () => {
  const korisnickoIme = localStorage.getItem("korisnickoIme");
  const smena = localStorage.getItem("smena");
  const usluga = localStorage.getItem("usluga") || "";
  const materijal = localStorage.getItem("materijal") || "nije_bitno";
  const velicina = localStorage.getItem("velicina") || "nije_bitno";
  const navigate = useNavigate();
  const [dostupniTermini, setDostupniTermini] = useState([]);
  const [izabrani, setIzabrani] = useState([]);
  const [offsetNedelja, setOffsetNedelja] = useState(1);
  const [vecIzabraniTerminiIDs, setVecIzabraniTerminiIDs] = useState([]);

  useEffect(() => {
    const fetchSve = async () => {
      if (!korisnickoIme || !smena || !usluga) {
        toast.error("Nedostaju korisnički podaci.");
        return;
      }
      await fetchVecIzabraniTermini();
      await fetchTermini();
    };
    fetchSve();
  }, [offsetNedelja]);

  const fetchVecIzabraniTermini = async () => {
    try {
      const snapshot = await getDocs(collection(db, "izboriTermina"));
      const korisnikovi = snapshot.docs
        .filter((doc) => doc.data().korisnickoIme === korisnickoIme)
        .map((doc) => doc.data().eventId);
      setVecIzabraniTerminiIDs(korisnikovi);
    } catch (err) {
      console.error("❌ Greška pri dohvatu već izabranih termina:", err);
    }
  };

  const fetchTermini = async () => {
    try {
      
      const snapshot = await getDocs(collection(db, "admin_kalendar"));
      const svi = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      const sviRelevantni = svi.filter((t) => ["slobodan", "edukacija", "odmor"].includes(t.tip));

      const sada = new Date();
      const day = sada.getDay();
      const daysToNextMonday = ((8 - day) % 7) || 7;
      const firstMonday = new Date(sada);
      firstMonday.setDate(sada.getDate() + daysToNextMonday);
      firstMonday.setHours(0, 0, 0, 0);

      const startOfWeek = new Date(firstMonday);
      startOfWeek.setDate(startOfWeek.getDate() + (offsetNedelja - 1) * 7);

      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(endOfWeek.getDate() + 5);
      endOfWeek.setHours(23, 59, 59, 999);

const filtrirani = sviRelevantni.filter((t) => {
  const start = new Date(t.start.toDate ? t.start.toDate().getTime() : new Date(t.start).getTime());
  const startTime = start.getTime();
  const localHour = start.getHours();
  const danTermina = start.getDay(); // 0 = nedelja, 6 = subota

  if (startTime < startOfWeek.getTime() || startTime > endOfWeek.getTime()) return false;

  // Uvek prikazuj edukaciju i odmor
  if (t.tip === "edukacija" || t.tip === "odmor") return true;

  if (t.tip === "slobodan") {
    if (vecIzabraniTerminiIDs.includes(t.id)) return false;

    if (smena === "jutro") {
      // jutro vidi samo termine pre 15h
      return localHour < 15;
    }

   if (smena === "popodne") {
  return true;
}
  }

  return false;
});


      setDostupniTermini(filtrirani);
    } catch (err) {
      toast.error("Greška pri učitavanju termina.");
    }
  };

  const grupisaniPoDanu = {};
  daniUNedelji.forEach((dan) => {
    grupisaniPoDanu[dan] = [];
  });

  dostupniTermini.forEach((termin) => {
    const start = termin.start.toDate ? termin.start.toDate() : new Date(termin.start);
    const dan = daniUNedelji[start.getDay() - 1];
    if (grupisaniPoDanu[dan]) {
      grupisaniPoDanu[dan].push({
        ...termin,
        vreme: start.toLocaleTimeString("sr-RS", { hour: "2-digit", minute: "2-digit" }),
      });
    }
  });

const toggleOdabir = (termin) => {
  if (termin.tip !== "slobodan" || vecIzabraniTerminiIDs.includes(termin.id)) return;

  const sada = new Date();
  const start = new Date(termin.start.toDate ? termin.start.toDate() : termin.start);

  const danUNedelji = sada.getDay(); // 0 - nedelja, 6 - subota
  const sat = sada.getHours();
  const minut = sada.getMinutes();

  const daysToNextMonday = ((8 - danUNedelji) % 7) || 7;
  const firstMonday = new Date(sada);
  firstMonday.setDate(sada.getDate() + daysToNextMonday);
  firstMonday.setHours(0, 0, 0, 0);

  const startOfNextWeek = new Date(firstMonday);
  const endOfNextWeek = new Date(firstMonday);
  endOfNextWeek.setDate(endOfNextWeek.getDate() + 5);
  endOfNextWeek.setHours(23, 59, 59, 999);

  if (smena === "jutro") {
    const isUNarednojNedelji = start >= startOfNextWeek && start <= endOfNextWeek;
    const isDozvoljenoVreme =
      (danUNedelji === 6 && (sat > 12 || (sat === 12 && minut >= 0))) || // subota od 12h
      (danUNedelji === 0 && sat <= 23); // nedelja do 23h

    if (!isUNarednojNedelji) {
      toast.warn("Možeš birati samo termine iz naredne nedelje.");
      return;
    }

    if (!isDozvoljenoVreme) {
      toast.warn("Možeš birati samo subotom od 12h do nedelje u 23h.");
      return;
    }

    if (start.getHours() >= 15) {
      toast.warn("Jutarnja smena može birati samo termine pre 15h.");
      return;
    }
  }

  if (smena === "popodne") {
    const osamNedeljaKasnije = new Date();
    osamNedeljaKasnije.setDate(sada.getDate() + 56);

    if (start < sada || start > osamNedeljaKasnije) {
      toast.warn("Možeš birati samo termine u narednih 8 nedelja.");
      return;
    }

   
  }

  const postoji = izabrani.find((t) => t.id === termin.id);
  if (postoji) {
    setIzabrani(izabrani.filter((t) => t.id !== termin.id));
  } else {
    setIzabrani([...izabrani, termin]);
  }
};


  const handleSubmit = async () => {
    if (!usluga || !materijal) {
      toast.error("Nedostaju podaci o usluzi.");
      return;
    }
    try {
      for (const termin of izabrani) {
        const startDate = termin.start.toDate ? termin.start.toDate() : new Date(termin.start);
        await addDoc(collection(db, "izboriTermina"), {
          korisnickoIme,
          eventId: termin.id,
          datum: startDate.toISOString().split("T")[0],
          timestamp: serverTimestamp(),
          status: "izabrala",
        });
      }
      toast.success("Termini uspesno sacuvani!");
      setIzabrani([]);
      await fetchVecIzabraniTermini();
      fetchTermini();
    } catch (err) {
      toast.error("Greska pri slanju termina.");
    }
  };

  return (
    <div className="kalendar">
      <div className="kalendar-inner">
        <h2>
          Izabrana usluga: <span>{usluga}</span>
          {usluga === "Izlivanje" && (
            <span> – {materijal === "Da" ? "Ima materijal" : "Nema materijal"} – Veličina: {velicina}</span>
          )}
        </h2>
        <div className="navigation-buttons">
  <button className="nedelja-dugme" onClick={() => setOffsetNedelja((prev) => prev - 1)}>⬅ Prethodna</button>
  <button className="nedelja-dugme" onClick={() => setOffsetNedelja((prev) => prev + 1)}>Sledeća ➡</button>
</div>

        <div className="nedelja-grid">
          {daniUNedelji.map((dan) => (
            <div key={dan} className="dan-kocka">
             <div className="naslov-dana">
  {dan}
  <br />
  <span className="datum-dana">
    {(() => {
      const index = daniUNedelji.indexOf(dan);
      const danas = new Date();
      const day = danas.getDay();
      const daysToNextMonday = ((8 - day) % 7) || 7;
      const firstMonday = new Date(danas);
      firstMonday.setDate(danas.getDate() + daysToNextMonday);
      const datum = new Date(firstMonday);
      datum.setDate(datum.getDate() + (offsetNedelja - 1) * 7 + index);
      return datum.toLocaleDateString("sr-RS", { day: "2-digit", month: "2-digit" });
    })()}
  </span>
</div>

              {grupisaniPoDanu[dan].length === 0 ? (
                <div className="prazno">—</div>
              ) : (
                grupisaniPoDanu[dan].map((t) => (
                  <div
                    key={t.id}
                   className={`termin-kocka ${t.tip} ${izabrani.find((z) => z.id === t.id) ? "selected" : ""} ${vecIzabraniTerminiIDs.includes(t.id) ? "disabled" : ""}`}

                   onClick={() => {
  if (!vecIzabraniTerminiIDs.includes(t.id)) {
    toggleOdabir(t);
  }
}}

                  >
                    {t.tip === "slobodan" ? t.vreme : t.tip.toUpperCase()}
                  </div>
                ))
              )}
            </div>
          ))}
        </div>
        <button className="submit" disabled={izabrani.length === 0} onClick={handleSubmit}>Pošalji izbore</button>
        <button className="nazad-dugme" onClick={() => navigate("/odabir-usluge")}>Nazad</button>
      </div>
    </div>
  );
};

export default Kalendar;