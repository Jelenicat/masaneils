// src/Kalendar.js
import React, { useEffect, useState } from "react";
import { collection, getDocs, doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import "./Kalendar.css";

const daniUNedelji = ["Ponedeljak", "Utorak", "Sreda", "Četvrtak", "Petak", "Subota"];

const Kalendar = () => {
  const [termini, setTermini] = useState({});
  const [smena, setSmena] = useState("");
  const [izabrani, setIzabrani] = useState([]);
  const [usluga, setUsluga] = useState("");
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
    const sati = parseInt(vreme.split(":")[0]);

    if (smena === "jutro") {
      return (
        date >= ponedeljak &&
        date <= new Date(ponedeljak.getTime() + 5 * 24 * 60 * 60 * 1000) &&
        sati < 15 &&
        jeUdozvoljenomVremenuZaJutro()
      );
    } else if (smena === "popodne") {
      const max = new Date();
      max.setMonth(max.getMonth() + 2);
      return date >= danas && date <= max && sati >= 17;
    }
    return false;
  };

  const toggleTermin = (datum, vreme) => {
    const postoji = izabrani.find((t) => t.datum === datum && t.vreme === vreme);
    if (postoji) {
      setIzabrani(izabrani.filter((t) => !(t.datum === datum && t.vreme === vreme)));
    } else {
      setIzabrani([...izabrani, { datum, vreme, usluga }]);
    }
  };

  const sacuvaj = async () => {
    try {
      const snapshot = await getDocs(collection(db, "admin_kalendar"));
      const adminTermini = snapshot.docs.map((doc) => {
        const data = doc.data();
        const start = data.start.toDate ? data.start.toDate() : new Date(data.start);
        return {
          id: doc.id,
          datum: start.toISOString().split("T")[0],
          vreme: start.toTimeString().slice(0, 5),
        };
      });

      const promises = izabrani.map((termin) => {
        const match = adminTermini.find(
          (t) => t.datum === termin.datum && t.vreme === termin.vreme
        );
        if (!match) throw new Error(`Termin ${termin.datum} ${termin.vreme} nije pronađen.`);
        return setDoc(
          doc(db, "izboriTermina", `${korisnickoIme}_${termin.datum}_${termin.vreme}`),
          {
            korisnickoIme,
            datum: termin.datum,
            vreme: termin.vreme,
            usluga: termin.usluga,
            status: "izabrala",
            timestamp: new Date(),
            eventId: match.id,
          }
        );
      });

      await Promise.all(promises);
      alert("Uspešno sačuvano!");
      setIzabrani([]); // Clear selections after saving
    } catch (err) {
      console.error("Greška pri čuvanju:", err);
      alert(`Greška pri čuvanju: ${err.message}`);
    }
  };

  useEffect(() => {
    const fetchPodaci = async () => {
      try {
        setUcitava(true);
        const userDocRef = doc(db, "korisnici", korisnickoIme);
        const userDocSnap = await getDoc(userDocRef);
        if (!userDocSnap.exists()) {
          alert("Korisnik ne postoji.");
          return;
        }

        const userData = userDocSnap.data();
        setSmena(userData.smena || "");
        if (userData.smena !== "jutro" && userData.smena !== "popodne") {
          alert("Tvoj kalendar nije trenutno dostupan.");
          return;
        }

        const uslugaDocRef = doc(db, "izbor_usluge", korisnickoIme);
        const uslugaDocSnap = await getDoc(uslugaDocRef);
        if (uslugaDocSnap.exists()) {
          setUsluga(uslugaDocSnap.data().usluga || "");
        }

        const snapshot = await getDocs(collection(db, "admin_kalendar"));
        const raspored = {};

        snapshot.forEach((doc) => {
          const data = doc.data();
          if (data.start) {
            const d = data.start.toDate ? data.start.toDate() : new Date(data.start);
            const datum = d.toISOString().split("T")[0];
            const vreme = d.toTimeString().slice(0, 5);
            const tip = data.tip || "slobodan";

            if (!raspored[datum]) raspored[datum] = [];
            raspored[datum].push({ vreme, tip, id: doc.id });
          }
        });

        setTermini(raspored);
      } catch (err) {
        console.error("Greška:", err);
        alert("Greška pri učitavanju podataka.");
      } finally {
        setUcitava(false);
      }
    };

    if (korisnickoIme) {
      fetchPodaci();
    } else {
      alert("Niste prijavljeni.");
      setUcitava(false);
    }
  }, [korisnickoIme]);

  if (ucitava) {
    return (
      <div className="unesi-page">
        <div className="unesi-form">Učitavanje...</div>
      </div>
    );
  }

  if (!korisnickoIme) {
    return (
      <div className="unesi-page">
        <div className="unesi-form">Molimo prijavite se.</div>
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

  const maxRedova = Math.max(...Object.values(termini).map((arr) => arr.length), 0);

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
                const slot = sviZaDan[redniBroj] || {};
                const { vreme, tip } = slot;
                const selektovan = izabrani.find(
                  (t) => t.datum === datum && t.vreme === vreme
                );
                const dozvoljen = vreme && daLiJeDozvoljenTermin(datum, vreme);

                return (
                  <div
                    key={`${datum}-${vreme || redniBroj}`}
                    className={`termin ${
                      tip === "slobodan" && dozvoljen ? "klikabilan" : "disabled"
                    } ${selektovan ? "selektovan" : ""} ${
                      tip === "zauzet" || tip === "termin" ? "zauzeto" : ""
                    }`}
                    onClick={() =>
                      tip === "slobodan" && dozvoljen && vreme && toggleTermin(datum, vreme)
                    }
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