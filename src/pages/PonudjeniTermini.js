import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import { doc, getDoc, runTransaction, query, collection, getDocs, where } from "firebase/firestore";
import { toast } from "react-toastify";
import { utcToZonedTime, format } from "date-fns-tz";
import { requestPermission } from "../firebase"; // Added for FCM integration

const PonudjeniTermini = ({ korisnickoIme }) => {
  const [ponudjeni, setPonudjeni] = useState([]);

  useEffect(() => {
    if (!korisnickoIme) {
      toast.error("Korisničko ime nije definisano.");
      return;
    }
    requestPermission().catch((err) => {
      toast.error("Greška prilikom postavljanja notifikacija: " + err.message);
    });
    const fetchPonudjeniTermini = async () => {
      try {
        const docSnap = await getDoc(doc(db, "predlozeniTermini", korisnickoIme));
        if (docSnap.exists()) {
          const data = docSnap.data();
          const now = utcToZonedTime(new Date(), "Europe/Belgrade");
          setPonudjeni(
            data.termini.filter((t) => utcToZonedTime(t.start, "Europe/Belgrade") >= now)
          );
        }
      } catch (error) {
        console.error("Greška pri učitavanju predloženih termina:", error);
        toast.error("Greška pri učitavanju predloženih termina.");
      }
    };
    fetchPonudjeniTermini();
  }, [korisnickoIme]);

  const potvrdiTermin = async (termin) => {
    try {
      await runTransaction(db, async (transaction) => {
        const eventRef = doc(db, "admin_kalendar", termin.id);
        const eventSnapshot = await transaction.get(eventRef);
        if (!eventSnapshot.exists()) {
          throw new Error("Termin ne postoji.");
        }

        transaction.update(eventRef, {
          start: utcToZonedTime(termin.start, "Europe/Belgrade"),
          end: utcToZonedTime(termin.end, "Europe/Belgrade"),
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
        izboriSnap.docs.forEach((docSnap) => {
          transaction.delete(docSnap.ref);
        });

        const predloziSnap = await getDocs(
          query(collection(db, "predlozeniTermini"), where("korisnica", "==", korisnickoIme))
        );
        predloziSnap.docs.forEach((docSnap) => {
          transaction.delete(docSnap.ref);
        });
      });

      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          await fetch("https://notifikacija-api.vercel.app/api/posalji-notifikaciju", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              korisnickoIme: "masa",
              title: "Potvrđen termin",
              body: `Korisnica ${korisnickoIme} je potvrdila termin: ${format(
                utcToZonedTime(termin.start, "Europe/Belgrade"),
                "dd.MM.yyyy HH:mm",
                { timeZone: "Europe/Belgrade" }
              )} (${termin.usluga})`,
              click_action: "https://masaneils.vercel.app/admin",
            }),
          });
          break;
        } catch (err) {
          if (attempt === 2) {
            console.error("Neuspešno slanje notifikacije:", err);
            toast.warn("Termin potvrđen, ali notifikacija nije poslata.");
          }
          await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
        }
      }

      toast.success("Uspešno si potvrdila termin!");
      setPonudjeni([]);
    } catch (err) {
      console.error("Greška pri potvrdi termina:", err);
      toast.error("Greška pri potvrdi termina.");
    }
  };

  return (
    <div className="ponudjeni-termini">
      <h2>Predloženi termini</h2>
      <ul>
        {ponudjeni.map((termin) => (
          <li
            key={termin.id}
            className="bg-white rounded-xl shadow-md p-4 flex flex-col items-center"
          >
            <p className="font-semibold text-center">
              {format(utcToZonedTime(termin.start, "Europe/Belgrade"), "EEEE, dd. MMMM yyyy", {
                locale: "sr-RS",
              })}
              <br />
              {format(utcToZonedTime(termin.start, "Europe/Belgrade"), "HH:mm", {
                timeZone: "Europe/Belgrade",
              })} – {format(utcToZonedTime(termin.end, "Europe/Belgrade"), "HH:mm", {
                timeZone: "Europe/Belgrade",
              })}
            </p>
            <p className="text-sm text-gray-600 mt-1 text-center">Usluga: {termin.usluga}</p>
            {termin.note && (
              <p className="text-sm text-gray-600 mt-1 text-center">📝 {termin.note}</p>
            )}
            <p className="text-xs text-gray-500 mt-2">
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