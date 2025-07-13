import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import { collection, getDocs, doc, setDoc, getDoc } from "firebase/firestore";
import { toast } from "react-toastify";
import { utcToZonedTime } from "date-fns-tz";
import { requestPermission } from "../firebase"; // Added for FCM integration

const Kalendar = ({ korisnickoIme }) => {
  const [izabrani, setIzabrani] = useState([]);
  const [dostupniTermini, setDostupniTermini] = useState([]);
  const [usluga, setUsluga] = useState("N/A");

  useEffect(() => {
    if (!korisnickoIme) {
      toast.error("Korisničko ime nije definisano.");
      return;
    }
    requestPermission().catch((err) => {
      toast.error("Greška prilikom postavljanja notifikacija: " + err.message);
    });
    const fetchTermini = async () => {
      try {
        const snapshot = await getDocs(collection(db, "admin_kalendar"));
        const now = utcToZonedTime(new Date(), "Europe/Belgrade");
        const termini = snapshot.docs
          .map((doc) => {
            const data = doc.data();
            const start = utcToZonedTime(data.start?.toDate?.() || new Date(data.start), "Europe/Belgrade");
            return {
              id: doc.id,
              datum: start.toISOString().split("T")[0],
              vreme: start.toTimeString().slice(0, 5),
              tip: data.tip,
            };
          })
          .filter((t) => t.tip === "slobodan" && t.start >= now);
        setDostupniTermini(termini);

        const uslugaDoc = await getDoc(doc(db, "izbor_usluge", korisnickoIme));
        if (uslugaDoc.exists()) {
          setUsluga(uslugaDoc.data().usluga || "N/A");
        }
      } catch (error) {
        console.error("Greška pri učitavanju termina:", error);
        toast.error("Greška pri učitavanju termina.");
      }
    };
    fetchTermini();
  }, [korisnickoIme]);

  const toggleTermin = (termin) => {
    setIzabrani((prev) =>
      prev.some((t) => t.datum === termin.datum && t.vreme === termin.vreme)
        ? prev.filter((t) => t.datum !== termin.datum || t.vreme !== termin.vreme)
        : [...prev, termin]
    );
  };

  const sacuvaj = async () => {
    if (!korisnickoIme) {
      toast.error("Korisničko ime nije definisano.");
      return;
    }
    try {
      const snapshot = await getDocs(collection(db, "admin_kalendar"));
      const adminTermini = snapshot.docs.reduce((acc, doc) => {
        const data = doc.data();
        const start = utcToZonedTime(data.start?.toDate?.() || new Date(data.start), "Europe/Belgrade");
        acc[doc.id] = { datum: start.toISOString().split("T")[0], vreme: start.toTimeString().slice(0, 5) };
        return acc;
      }, {});

      const uslugaDoc = await getDoc(doc(db, "izbor_usluge", korisnickoIme));
      const usluga = uslugaDoc.exists() ? uslugaDoc.data().usluga || "N/A" : "N/A";

      const promises = izabrani.map((termin) => {
        const match = Object.entries(adminTermini).find(
          ([id, t]) => t.datum === termin.datum && t.vreme === termin.vreme
        );
        if (!match) throw new Error(`Termin ${termin.datum} ${termin.vreme} nije pronađen.`);
        const [eventId] = match;
        return setDoc(
          doc(db, "izboriTermina", `${korisnickoIme}_${termin.datum}_${termin.vreme}`),
          {
            korisnickoIme,
            datum: termin.datum,
            vreme: termin.vreme,
            usluga,
            status: "izabrala",
            timestamp: utcToZonedTime(new Date(), "Europe/Belgrade"),
            eventId,
          }
        );
      });

      await Promise.all(promises);
      toast.success("Uspešno sačuvano!");
      setIzabrani([]); // Clear selections after saving
    } catch (err) {
      console.error("Greška pri čuvanju:", err);
      toast.error(`Greška pri čuvanju: ${err.message}`);
    }
  };

  return (
    <div className="kalendar">
      <h2>Izaberi termine</h2>
      <ul>
        {dostupniTermini.map((termin) => (
          <li key={`${termin.datum}-${termin.vreme}`}>
            <label>
              <input
                type="checkbox"
                checked={izabrani.some((t) => t.datum === termin.datum && t.vreme === termin.vreme)}
                onChange={() => toggleTermin(termin)}
              />
              {termin.datum} {termin.vreme} ({usluga})
            </label>
          </li>
        ))}
      </ul>
      <button onClick={sacuvaj} disabled={izabrani.length === 0}>
        Sačuvaj izbore
      </button>
    </div>
  );
};

export default Kalendar;