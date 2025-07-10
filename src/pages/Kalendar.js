import React, { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  doc,
  getDoc,
  setDoc,
} from "firebase/firestore";
import { db } from "../firebase";
import "./Kalendar.css";

const daniUNedelji = ["Ponedeljak", "Utorak", "Sreda", "Četvrtak", "Petak", "Subota"];

const Kalendar = () => {
  const [termini, setTermini] = useState({});
  const [smena, setSmena] = useState("");
  const [izabrani, setIzabrani] = useState([]);
  const [ucitava, setUcitava] = useState(true);
  const korisnickoIme = localStorage.getItem("korisnickoIme");

  const danas = new Date();
  const ponedeljak = new Date(danas);
  ponedeljak.setDate(danas.getDate() + ((8 - danas.getDay()) % 7 || 7));

  const getDatumZaDan = (offset) => {
    const d = new Date(ponedeljak);
    d.setDate(ponedeljak.getDate() + offset);
    return d.toISOString().split("T")[0];
  };

  const jeUdozvoljenomVremenuZaJutro = () => {
    const sada = new Date();
    const dan = sada.getDay();
    const sati = sada.getHours();
    return (dan === 6 && sati >= 12) || (dan === 0 && sati < 15);
  };

  const daLiJeDozvoljenTermin = (datum, vreme) => {
    const date = new Date(`${datum}T${vreme}`);
    if (smena === "jutro") {
      return (
        date >= ponedeljak &&
        date <= new Date(ponedeljak.getTime() + 5 * 24 * 60 * 60 * 1000) &&
        parseInt(vreme.split(":")[0]) < 15 &&
        jeUdozvoljenomVremenuZaJutro()
      );
    }

    if (smena === "popodne") {
      const max = new Date();
      max.setMonth(max.getMonth() + 2);
      return date >= danas && date <= max;
    }

    return false;
  };

  const toggleTermin = (datum, vreme) => {
    const postoji = izabrani.find((t) => t.datum === datum && t.vreme === vreme);
    if (postoji) {
      setIzabrani(izabrani.filter((t) => !(t.datum === datum && t.vreme === vreme)));
    } else {
      setIzabrani([...izabrani, { datum, vreme }]);
    }
  };

  const sacuvaj = async () => {
  try {
    const snapshot = await getDocs(collection(db, "admin_kalendar"));
    const adminTermini = snapshot.docs.map(doc => {
      const data = doc.data();
      const start = data.start.toDate ? data.start.toDate() : new Date(data.start);
      const datum = start.toISOString().split("T")[0];
      const vreme = start.toTimeString().slice(0, 5);
      return { id: doc.id, datum, vreme };
    });

    const promises = izabrani.map((termin) => {
      const match = adminTermini.find(t => t.datum === termin.datum && t.vreme === termin.vreme);
      const eventId = match?.id || null;

      return setDoc(doc(db, "izboriTermina", `${korisnickoIme}_${termin.datum}_${termin.vreme}`), {
        korisnickoIme,
        ...termin,
        status: "izabrala",
        timestamp: new Date(),
        eventId, // ❗ važno da se upiše
      });
    });

    await Promise.all(promises);
    alert("Uspešno sačuvano!");
  } catch (err) {
    console.error("Greška pri čuvanju:", err);
    alert("Došlo je do greške.");
  }
};


  useEffect(() => {
    const fetchPodaci = async () => {
      try {
        const docRef = doc(db, "korisnici", korisnickoIme);
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) {
          alert("Korisnik ne postoji.");
          return;
        }

        const data = docSnap.data();
        setSmena(data.smena);
        if (data.smena !== "jutro" && data.smena !== "popodne") {
          alert("Tvoj kalendar nije trenutno dostupan.");
          return;
        }

        const snapshot = await getDocs(collection(db, "admin_kalendar"));
        const raspored = {};

        snapshot.forEach((doc) => {
          const data = doc.data();
          if (data.start) {
            const d = new Date(data.start.toDate ? data.start.toDate() : data.start);
            const datum = d.toISOString().split("T")[0];
            const vreme = d.toTimeString().slice(0, 5);
            const tip = data.tip || "slobodan";

            if (!raspored[datum]) raspored[datum] = [];
            raspored[datum].push({ vreme, tip });
          }
        });

        setTermini(raspored);
      } catch (err) {
        console.error("Greška:", err);
      } finally {
        setUcitava(false);
      }
    };

    fetchPodaci();
  }, [korisnickoIme]);

  if (ucitava) {
    return (
      <div className="unesi-page">
        <div className="unesi-form">Učitavanje...</div>
      </div>
    );
  }

  if (smena === "jutro" && !jeUdozvoljenomVremenuZaJutro()) {
    return (
      <div className="unesi-page">
        <div className="unesi-form">
          <h2>Izbor termina je dozvoljen od subote u 12h do nedelje u 15h.</h2>
        </div>
      </div>
    );
  }

  const maxRedova = Math.max(...Object.values(termini).map(arr => arr.length));

  return (
    <div className="unesi-page">
      <div className="unesi-form">
        <h2>Izaberi kada si slobodna</h2>
        <div className="tabela">
          <div className="red header">
            {daniUNedelji.map((dan, i) => (
              <div key={i} className="kolona-header">{dan}</div>
            ))}
          </div>
          {Array.from({ length: maxRedova }, (_, redniBroj) => (
            <div className="red" key={redniBroj}>
              {daniUNedelji.map((_, i) => {
                const datum = getDatumZaDan(i);
                const sviZaDan = termini[datum] || [];
                const slot = sviZaDan[redniBroj];
                const vreme = slot?.vreme;
                const tip = slot?.tip;
                const selektovan = izabrani.find(t => t.datum === datum && t.vreme === vreme);
                const dozvoljen = vreme && daLiJeDozvoljenTermin(datum, vreme);

                return (
                  <div
                    key={i}
                    className={`termin ${tip === "slobodan" && dozvoljen ? "klikabilan" : "disabled"} ${selektovan ? "selektovan" : ""} ${tip === "zauzet" || tip === "termin" ? "zauzeto" : ""}`}
                    onClick={() => tip === "slobodan" && dozvoljen && vreme && toggleTermin(datum, vreme)}
                  >
                    {vreme || ""}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        {izabrani.length > 0 && (
          <button className="sacuvaj-dugme" onClick={sacuvaj}>
            Sačuvaj termine
          </button>
        )}
      </div>
    </div>
  );
};

export default Kalendar;
