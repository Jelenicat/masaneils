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
    return (dan === 6 && sati >= 12) || (dan === 0 && sati < 18);
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
      return (
        date >= danas &&
        date <= max &&
        parseInt(vreme.split(":")[0]) >= 17
      );
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
      const promises = izabrani.map((termin) =>
        setDoc(doc(db, "izboriTermina", `${korisnickoIme}_${termin.datum}_${termin.vreme}`), {
          korisnickoIme,
          ...termin,
          status: "slobodna",
          timestamp: new Date(),
        })
      );
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
          if (
            data.tip === "slobodan" &&
            data.clientUsername == null &&
            data.start
          ) {
            const d = new Date(data.start.toDate ? data.start.toDate() : data.start);
            const datum = d.toISOString().split("T")[0];
            const vreme = d.toTimeString().slice(0, 5);

            if (!raspored[datum]) raspored[datum] = [];
            raspored[datum].push(vreme);
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
          {[0, 1, 2, 3, 4].map((redniBroj) => (
            <div className="red" key={redniBroj}>
              {daniUNedelji.map((_, i) => {
                const datum = getDatumZaDan(i);
                const sviZaDan = termini[datum] || [];
                const vreme = sviZaDan[redniBroj];
                const selektovan = izabrani.find(t => t.datum === datum && t.vreme === vreme);
                const dozvoljen = vreme && daLiJeDozvoljenTermin(datum, vreme);
                return (
                  <div
                    key={i}
                    className={`termin ${dozvoljen ? "klikabilan" : "disabled"} ${selektovan ? "selektovan" : ""}`}
                    onClick={() => dozvoljen && vreme && toggleTermin(datum, vreme)}
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
