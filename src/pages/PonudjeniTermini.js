import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
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
const safeDate = (d) => {
  if (!d) return new Date("Invalid");
  return d.toDate ? d.toDate() : new Date(d);
};


const PonudjeniTermini = ({ korisnickoIme: propIme }) => {
  const { korisnickoIme: urlIme } = useParams();
const [korisnickoIme, setKorisnickoIme] = useState(urlIme || propIme || localStorage.getItem("korisnickoIme"));

  const [ponudjeni, setPonudjeni] = useState([]);

  const fetchPonudjeniTermini = async () => {
    try {
      const q = query(
        collection(db, "ponudjeniTermini"),
        where("korisnickoIme", "==", korisnickoIme)
      );
      const querySnapshot = await getDocs(q);

      const now = new Date();
      const termini = querySnapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .filter((t) => {
          const start = t.start.toDate ? t.start.toDate() : new Date(t.start);
          return start >= now;
        });

      setPonudjeni(termini);
    } catch (error) {
      console.error("Greška pri učitavanju predloženih termina:", error);
      toast.error("Greška pri učitavanju predloženih termina.");
    }
  };

  useEffect(() => {
    console.log("🔎 Korisničko ime:", korisnickoIme); // Dodaj ovo
    if (!korisnickoIme) {
      toast.error("Korisničko ime nije definisano.");
      return;
    }
    localStorage.setItem("korisnickoIme", korisnickoIme);

    requestPermission().catch((err) => {
      toast.error("Greška pri postavljanju notifikacija: " + err.message);
    });

    fetchPonudjeniTermini();
  }, [korisnickoIme]);

const potvrdiTermin = async (termin) => {
  try {
    await runTransaction(db, async (transaction) => {
      const praviId = termin.originalEventId || termin.id;
      const eventRef = doc(db, "admin_kalendar", praviId);

      const eventSnapshot = await transaction.get(eventRef);
      if (!eventSnapshot.exists()) {
        throw new Error("Termin ne postoji.");
      }

      transaction.update(eventRef, {
        start: termin.start.toDate ? termin.start.toDate() : new Date(termin.start),
        end: termin.end.toDate ? termin.end.toDate() : new Date(termin.end),
        note: termin.note || "",
        tip: "termin",
        title: `💅 ${korisnickoIme}`,
        status: "potvrđen",
        clientUsername: korisnickoIme,
        backgroundColor: "#fdf2e9",
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
          collection(db, "ponudjeniTermini"),
          where("korisnickoIme", "==", korisnickoIme)
        )
      );
      predloziSnap.docs.forEach((docSnap) => {
        transaction.delete(docSnap.ref);
      });
    });

    // Obavesti admina
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
        click_action: `https://masaneils.vercel.app/ponudjeni/${korisnickoIme}`,
      }),
    });

    // ✅ Pokaži poruku i ukloni prikaz termina
    toast.success("Uspešno ste izabrali termin! ✅");
    setPonudjeni([]);

  } catch (err) {
    console.error("Greška pri potvrdi termina:", err);
    toast.error("Greška pri potvrdi termina.");
  }
};


  return (
    <div className="ponudjeni-termini">
      <h2>Predloženi termini</h2>
      {ponudjeni.length === 0 ? (
        <p className="nema-termina">Hvala! Uspešno ste izabrali termin. 🎉</p>

      ) : (
        <ul>
          {ponudjeni.map((termin) => (
            <li key={termin.id} className="termin-card">
              <p className="termin-datum">
                {format(safeDate(termin.start), "EEEE, dd. MMMM yyyy", { locale: sr })}
                <br />
                {format(safeDate(termin.start), "HH:mm", { locale: sr })} {" – "}
                {format(safeDate(termin.end), "HH:mm", { locale: sr })}
              </p>
              <p className="termin-usluga">Usluga: {termin.usluga}</p>
              {termin.note && <p className="termin-note">📝 {termin.note}</p>}
              <p className="termin-info">
                Napomena: Odabirom ovog termina, svi ostali vaši izbori će biti obrisani.
              </p>
          
              
              <button
                onClick={() => {
                  if (
                    window.confirm(
                      "Da li ste sigurni da želite potvrditi ovaj termin? Svi ostali izbori će biti obrisani."
                    )
                  ) {
                    potvrdiTermin(termin);
                  }
                }}
                className="potvrdi-dugme"
              >
                Izaberi ovaj
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default PonudjeniTermini;