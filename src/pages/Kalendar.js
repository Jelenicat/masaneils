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
    await fetchSlobodniTermini();
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

  const fetchSlobodniTermini = async () => {
    try {
      const snapshot = await getDocs(collection(db, "admin_kalendar"));
      const svi = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      const slobodni = svi.filter((t) => t.tip === "slobodan");

   const sada = new Date();
const day = sada.getDay(); // 0 = nedelja, 1 = ponedeljak...
const daysToNextMonday = ((8 - day) % 7) || 7;
const firstMonday = new Date(sada);
firstMonday.setDate(sada.getDate() + daysToNextMonday);

// dodaj offsetNedelja kao nedelje posle tog ponedeljka
const startOfWeek = new Date(firstMonday);
startOfWeek.setDate(firstMonday.getDate() + (offsetNedelja - 1) * 7);
startOfWeek.setHours(0, 0, 0, 0);


      startOfWeek.setHours(0, 0, 0, 0);

      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(endOfWeek.getDate() + 5);
      endOfWeek.setHours(23, 59, 59, 999);

      const terminiZaPrikaz = slobodni.filter((t) => {
        if (vecIzabraniTerminiIDs.includes(t.id)) return false;

        const start = new Date(
  t.start.toDate ? t.start.toDate().getTime() : new Date(t.start).getTime()
);

        const startTime = start.getTime();
        const localHour = start.getHours();
        const localMinute = start.getMinutes();

        if (startTime < startOfWeek.getTime() || startTime > endOfWeek.getTime()) {
          return false;
        }

        if (smena === "jutro") {
          const dan = sada.getDay();
          const satNow = sada.getHours();
          const minutNow = sada.getMinutes();
          const dozvoljenoVreme =
            (dan === 6 && (satNow > 12 || (satNow === 12 && minutNow >= 0))) ||
            (dan === 0 && satNow < 15);

          if (!dozvoljenoVreme) return false;

          return localHour < 15 || (localHour === 15 && localMinute === 0);
        }

        if (smena === "popodne") {
          const osamNedeljaKasnije = new Date();
          osamNedeljaKasnije.setDate(osamNedeljaKasnije.getDate() + 56);
          return (
            startTime >= sada.getTime() &&
            startTime <= osamNedeljaKasnije.getTime() &&
            (localHour > 17 || (localHour === 17 && localMinute >= 0))
          );
        }

        return false;
      });

      setDostupniTermini(terminiZaPrikaz);
    } catch (err) {
      toast.error("Greška pri učitavanju termina.");
    }
  };

  const toggleOdabir = (termin) => {
const toggleOdabir = (termin) => {
  if (vecIzabraniTerminiIDs.includes(termin.id)) return;

  const start = new Date(termin.start.toDate ? termin.start.toDate() : termin.start);
  const danas = new Date();

  const day = danas.getDay();
  const daysToNextMonday = ((8 - day) % 7) || 7;
  const firstMonday = new Date(danas);
  firstMonday.setDate(danas.getDate() + daysToNextMonday);
  firstMonday.setHours(0, 0, 0, 0);

  const endOfNextWeek = new Date(firstMonday);
  endOfNextWeek.setDate(endOfNextWeek.getDate() + 6);
  endOfNextWeek.setHours(23, 59, 59, 999);

  const isUNarednojNedelji = start >= firstMonday && start <= endOfNextWeek;
  const danTermina = start.getDay(); // 0=nedelja, 6=subota
  const sat = start.getHours();

  if (smena === "jutro" && !isUNarednojNedelji) {
    toast.warn("Možeš birati samo termine iz naredne nedelje.");
    return;
  }

  if (smena === "popodne") {
    const osamNedeljaKasnije = new Date();
    osamNedeljaKasnije.setDate(danas.getDate() + 56);
    if (
      start < danas ||
      start > osamNedeljaKasnije ||
     !(sat >= 17 || (danTermina === 6 && sat < 17))

    ) {
      toast.warn("Popodnevna smena može birati samo termine posle 17h ili subotom.");
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
        const startDate = termin.start.toDate
          ? termin.start.toDate()
          : new Date(termin.start);

        await addDoc(collection(db, "izboriTermina"), {
          korisnickoIme,
          eventId: termin.id,
          datum: startDate.toISOString().split("T")[0],
          timestamp: serverTimestamp(),
          status: "izabrala",
        });
      }

      toast.success("Termini uspešno sačuvani!");
      setIzabrani([]);
      await fetchVecIzabraniTermini(); // 🔥 odmah osveži izbore
      fetchSlobodniTermini();
    } catch (err) {
      toast.error("Greška pri slanju termina.");
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

  return (
    <div className="kalendar">
      <div className="kalendar-inner">
        <h2>Izabrana usluga: <span>{usluga}</span></h2>
      <h3>Dostupni termini za {offsetNedelja === 0 ? "ovu" : offsetNedelja === 1 ? "narednu" : `${offsetNedelja}. nedelju`}:</h3>


        <div className="navigation-buttons">
          <button onClick={() => setOffsetNedelja((prev) => prev - 1)}>⬅ Prethodna</button>
          <button onClick={() => setOffsetNedelja((prev) => prev + 1)}>Sledeća ➡</button>
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

  const sada = new Date();
  const day = sada.getDay();
  const daysToNextMonday = ((8 - day) % 7) || 7;
  const firstMonday = new Date(sada);
  firstMonday.setDate(sada.getDate() + daysToNextMonday);

  const datum = new Date(firstMonday);
  datum.setDate(datum.getDate() + (offsetNedelja - 1) * 7 + index);

  return datum.toLocaleDateString("sr-RS", {
    day: "2-digit",
    month: "2-digit",
  });
})()
}
  </span>
</div>

              {grupisaniPoDanu[dan].length === 0 ? (
                <div className="prazno">—</div>
              ) : (
                grupisaniPoDanu[dan].map((t) => (
                  <div
                    key={t.id}
                    className={`termin-kocka ${
                      izabrani.find((z) => z.id === t.id) ? "selected" : ""
                    } ${vecIzabraniTerminiIDs.includes(t.id) ? "disabled" : ""}`}
                    onClick={() => toggleOdabir(t)}
                  >
                    {t.vreme}
                  </div>
                ))
              )}
            </div>
          ))}
        </div>

        <button
          className="submit"
          disabled={izabrani.length === 0}
          onClick={handleSubmit}
        >
          Pošalji izbore
        </button>
        <button className="nazad-dugme" onClick={() => navigate("/odabir-usluge")}>
  Nazad
</button>
      </div>
    </div>
  );
};

export default Kalendar;
