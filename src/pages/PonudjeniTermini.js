import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import {
  doc,
  getDoc,
  runTransaction,
  query,
  collection,
  getDocs,
  where,
} from "firebase/firestore";
import { toast } from "react-toastify";
import { format } from "date-fns";
import { sr } from "date-fns/locale";
import { requestPermission } from "../firebase";
import "./PonudjeniTermini.css";

const PonudjeniTermini = ({ korisnickoIme }) => {
  const [ponudjeni, setPonudjeni] = useState([]);
  const [loading, setLoading] = useState(true);
  const [potvrdaLoading, setPotvrdaLoading] = useState(false);

  useEffect(() => {
    requestPermission().catch((err) => {
      toast.error("Greška prilikom postavljanja notifikacija: " + err.message);
    });
  }, []);

  useEffect(() => {
    if (!korisnickoIme) {
      toast.error("Korisničko ime nije definisano.");
      return;
    }
    const fetchPonudjeniTermini = async () => {
      try {
        const docSnap = await getDoc(
          doc(db, "predlozeniTermini", korisnickoIme)
        );
        if (docSnap.exists()) {
          const data = docSnap.data();
          const now = new Date();
          setPonudjeni(
            data.termini.filter((t) => new Date(t.start) >= now)
          );
        }
      } catch (error) {
        console.error("Greška pri učitavanju predloženih termina:", error);
        toast.error("Greška pri učitavanju predloženih termina.");
      } finally {
        setLoading(false);
      }
    };
    fetchPonudjeniTermini();
  }, [korisnickoIme]);

  const potvrdiTermin = async (termin) => {
    setPotvrdaLoading(true);
    try {
      await runTransaction(db, async (transaction) => {
        const eventRef = doc(db, "admin_kalendar", termin.id);
        const eventSnapshot = await transaction.get(eventRef);
        if (!eventSnapshot.exists()) {
          throw new Error("Termin ne postoji.");
        }

        transaction.update(eventRef, {
          start: new Date(termin.start),
          end: new Date(termin.end),
          note: termin.note || "",
          tip: "termin",
          title: `💅 ${korisnickoIme}`,
          status: "potvrđen",
          clientUsername: korisnickoIme,
          backgroundColor: "#f8e9dd",
        });

        const izboriSnap = await getDocs(
          query(
            collection(db, "izboriTermina"),
            where("korisnickoIme", "==", korisnickoIme)
          )
        );
        izboriSnap.docs.forEach((docSnap) => {
          transaction.delete(docSnap.ref);
        });

        const predloziSnap = await getDocs(
          query(
            collection(db, "predlozeniTermini"),
            where("korisnica", "==", korisnickoIme)
          )
        );
        predloziSnap.docs.forEach((docSnap) => {
          transaction.delete(docSnap.ref);
        });
      });

      await fetch("https://notifikacija-api.vercel.app/api/posalji-notifikaciju", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          korisnickoIme: "masa",
          title: "Potvrđen termin",
          body: `Korisnica ${korisnickoIme} je potvrdila termin: ${format(
            new Date(termin.start),
            "dd.MM.yyyy HH:mm",
            { locale: sr }
          )} (${termin.usluga})`,
          click_action: "https://masaneils.vercel.app/admin",
        }),
      });

      toast.success("Uspešno si potvrdila termin!");
      setPonudjeni([]);
    } catch (err) {
      console.error("Greška pri potvrdi termina:", err);
      toast.error("Greška pri potvrdi termina.");
    } finally {
      setPotvrdaLoading(false);
    }
  };

  return (
    <div className="ponudjeni-termini">
      <h2>Predloženi termini</h2>

      {loading ? (
        <p className="loading-text">Učitavanje...</p>
      ) : ponudjeni.length === 0 ? (
        <p className="empty-text">Nema trenutno predloženih termina.</p>
      ) : (
        <ul>
          {ponudjeni.map((termin) => (
            <li key={termin.id} className="termin-card">
              <p className="termin-datum">
                {format(new Date(termin.start), "EEEE, dd. MMMM yyyy", {
                  locale: sr,
                })}
                <br />
                {format(new Date(termin.start), "HH:mm", { locale: sr })} –{" "}
                {format(new Date(termin.end), "HH:mm", { locale: sr })}
              </p>
              <p className="termin-usluga">Usluga: {termin.usluga}</p>
              {termin.note && <p className="termin-note">📝 {termin.note}</p>}
              <p className="termin-napomena">
                Napomena: Odabirom ovog termina, svi ostali vaši izbori će biti
                obrisani.
              </p>
              <button
                onClick={() => {
                  if (
                    window.confirm(
                      "Da li ste sigurni da želite potvrditi ovaj termin?"
                    )
                  ) {
                    potvrdiTermin(termin);
                  }
                }}
                disabled={potvrdaLoading}
                className="btn-potvrdi"
              >
                {potvrdaLoading ? "Potvrđujem..." : "Izaberi ovaj"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default PonudjeniTermini;
