// src/pages/PonudjeniTermini.js
import React, { useEffect, useState } from "react";
import { collection, doc, getDocs, deleteDoc, updateDoc, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { toast } from "react-toastify";

const PonudjeniTermini = () => {
  const [ponudjeni, setPonudjeni] = useState([]);
  const [loading, setLoading] = useState(true);
  const korisnickoIme = localStorage.getItem("korisnickoIme");

  useEffect(() => {
    const fetchTermini = async () => {
      if (!korisnickoIme) {
        toast.error("Niste prijavljeni.");
        setLoading(false);
        return;
      }

      try {
        const q = query(collection(db, "predlozeniTermini"), where("korisnica", "==", korisnickoIme));
        const snapshot = await getDocs(q);
        const lista = snapshot.docs
          .map((doc) => doc.data().termini || [])
          .flat()
          .map((termin) => ({
            id: termin.id,
            start: new Date(termin.start),
            end: new Date(termin.end),
            note: termin.note,
            usluga: termin.usluga || "N/A",
          }));
        setPonudjeni(lista);
      } catch (err) {
        console.error("Greška pri učitavanju termina:", err);
        toast.error("Greška pri učitavanju ponuđenih termina.");
      } finally {
        setLoading(false);
      }
    };

    fetchTermini();
  }, [korisnickoIme]);

  const potvrdiTermin = async (termin) => {
    try {
      const eventRef = doc(db, "admin_kalendar", termin.id);
      await updateDoc(eventRef, {
        start: termin.start,
        end: termin.end,
        note: termin.note || "",
        tip: "termin",
        title: `💅 ${korisnickoIme}`,
        status: "potvrđen",
        clientUsername: korisnickoIme,
        backgroundColor: "#ffe4ec",
      });

      const izboriSnap = await getDocs(
        query(collection(db, "izboriTermina"), where("korisnickoIme", "==", korisnickoIme))
      );
      const izboriDeletes = izboriSnap.docs.map((docSnap) => deleteDoc(docSnap.ref));

      const predloziSnap = await getDocs(
        query(collection(db, "predlozeniTermini"), where("korisnica", "==", korisnickoIme))
      );
      const predloziDeletes = predloziSnap.docs.map((docSnap) => deleteDoc(docSnap.ref));

      await Promise.all([...izboriDeletes, ...predloziDeletes]);

      await fetch("https://notifikacija-api.vercel.app/api/posalji-notifikaciju", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          korisnickoIme: "masa",
          title: "Potvrđen termin",
          body: `Korisnica ${korisnickoIme} je potvrdila termin: ${termin.start.toLocaleDateString(
            "sr-RS"
          )} u ${termin.start.toLocaleTimeString("sr-RS", { hour: "2-digit", minute: "2-digit" })} (${
            termin.usluga
          })`,
          click_action: "https://masaneils.vercel.app/admin",
        }),
      });

      toast.success("Uspešno si potvrdila termin!");
      setPonudjeni([]);
    } catch (err) {
      console.error("Greška pri potvrdi termina:", err);
      toast.error("Greška pri potvrdi termina.");
    }
  };

  if (loading) return <p className="text-center mt-4">Učitavanje...</p>;

  if (!korisnickoIme) return <p className="text-center mt-4">Molimo prijavite se.</p>;

  if (!ponudjeni.length) {
    return <p className="text-center mt-4">Nema ponuđenih termina.</p>;
  }

  return (
    <div className="p-6 max-w-xl mx-auto">
      <h2 className="text-2xl font-bold mb-4 text-center">Izaberi jedan od ponuđenih termina</h2>
      <ul className="space-y-4">
        {ponudjeni.map((termin) => (
          <li
            key={termin.id}
            className="bg-white rounded-xl shadow-md p-4 flex flex-col items-center"
          >
            <p className="font-semibold text-center">
              {termin.start.toLocaleDateString("sr-RS", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
              <br />
              {termin.start.toLocaleTimeString("sr-RS", {
                hour: "2-digit",
                minute: "2-digit",
              })} – {termin.end.toLocaleTimeString("sr-RS", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
            <p className="text-sm text-gray-600 mt-1 text-center">Usluga: {termin.usluga}</p>
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
        ))}
      </ul>
    </div>
  );
};

export default PonudjeniTermini;