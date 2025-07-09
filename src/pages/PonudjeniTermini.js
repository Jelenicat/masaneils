// src/pages/PonudjeniTermini.js
import React, { useEffect, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  deleteDoc,
  getDocs,
  addDoc,
} from "firebase/firestore";
import { db } from "../firebase";

const PonudjeniTermini = () => {
  const [ponudjeni, setPonudjeni] = useState([]);
  const [loading, setLoading] = useState(true);
  const korisnickoIme = localStorage.getItem("korisnickoIme");

  useEffect(() => {
    const fetchTermini = async () => {
      if (!korisnickoIme) return;

      const docRef = doc(db, "ponudjeniTermini", korisnickoIme);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        setPonudjeni(docSnap.data().termini || []);
      }

      setLoading(false);
    };

    fetchTermini();
  }, [korisnickoIme]);

  const potvrdiTermin = async (termin) => {
    try {
      await addDoc(collection(db, "admin_kalendar"), {
        start: new Date(termin.start),
        end: new Date(termin.end),
        note: termin.note || "",
        tip: "termin",
        title: `💅 ${korisnickoIme}`,
        status: "potvrđen",
        clientUsername: korisnickoIme,
      });

      const izboriSnap = await getDocs(collection(db, "izboriTermina"));
      for (const docSnap of izboriSnap.docs) {
        const data = docSnap.data();
        if (data.korisnickoIme === korisnickoIme) {
          await deleteDoc(docSnap.ref);
        }
      }

      await deleteDoc(doc(db, "ponudjeniTermini", korisnickoIme));

      await fetch("https://notifikacija-api.vercel.app/api/posalji-notifikaciju", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          korisnickoIme: "masa",
          title: "Potvrđen termin",
          body: `Korisnica ${korisnickoIme} je izabrala termin.`,
          click_action: "https://masaneils.vercel.app/admin",
        }),
      });

      alert("Uspešno si izabrala termin!");
      setPonudjeni([]);
    } catch (err) {
      console.error("Greška pri potvrdi termina:", err);
      alert("Došlo je do greške pri potvrdi termina.");
    }
  };

  if (loading) return <p className="text-center mt-4">Učitavanje...</p>;

  if (!ponudjeni.length) {
    return <p className="text-center mt-4">Nema ponuđenih termina.</p>;
  }

  return (
    <div className="p-6 max-w-xl mx-auto">
      <h2 className="text-2xl font-bold mb-4 text-center">Izaberi jedan od ponuđenih termina</h2>

      <ul className="space-y-4">
        {ponudjeni.map((termin, index) => {
          const start = new Date(termin.start);
          const end = new Date(termin.end);

          return (
            <li
              key={index}
              className="bg-white rounded-xl shadow-md p-4 flex flex-col items-center"
            >
              <p className="font-semibold text-center">
                {start.toLocaleDateString("sr-RS", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
                <br />
                {start.toLocaleTimeString("sr-RS", {
                  hour: "2-digit",
                  minute: "2-digit",
                })} – {end.toLocaleTimeString("sr-RS", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>

              {termin.note && (
                <p className="text-sm text-gray-600 mt-1 text-center">📝 {termin.note}</p>
              )}

              <button
                onClick={() => potvrdiTermin(termin)}
                className="mt-3 px-4 py-2 bg-pink-500 text-white rounded-lg hover:bg-pink-600"
              >
                Izaberi ovaj
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default PonudjeniTermini;
