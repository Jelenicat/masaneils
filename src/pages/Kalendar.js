// Izmenjeni Kalendar.js
import React, { useEffect, useMemo, useState } from "react";
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

// ⬇⬇⬇ formatiranje nedelje i vremena
import { format, addDays, startOfWeek } from "date-fns";
import { sr } from "date-fns/locale";

// 1) Dodata "Nedelja"
const daniUNedelji = ["Ponedeljak", "Utorak", "Sreda", "Četvrtak", "Petak", "Subota", "Nedelja"];

// helpers za nedelju
const mondayOf = (d) => {
  const x = new Date(d);
  const diff = (x.getDay() + 6) % 7; // 0=ned → 6; 1=pon → 0
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - diff);
  return x;
};
const weekRangeText = (monday) => {
  const startTxt = format(monday, "dd.MM", { locale: sr });
  const endTxt = format(addDays(monday, 6), "dd.MM.yyyy", { locale: sr });
  return `Nedelja ${startTxt}–${endTxt}`;
};

const Kalendar = () => {
  const korisnickoIme = localStorage.getItem("korisnickoIme");
  const smena = localStorage.getItem("smena");
  const usluga = localStorage.getItem("usluga") || "";
  const materijal = localStorage.getItem("materijal") || "nije_bitno";
  const velicina = localStorage.getItem("velicina") || "nije_bitno";
  const navigate = useNavigate();

  const [dostupniTermini, setDostupniTermini] = useState([]);
  const [izabrani, setIzabrani] = useState([]);
  const [offsetNedelja, setOffsetNedelja] = useState(1);
  const [vecIzabraniTerminiIDs, setVecIzabraniTerminiIDs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [poruka, setPoruka] = useState("");

  // ✅ Jedan izvor istine za ponedeljak prikazane nedelje
  const baseMonday = useMemo(() => {
    const now = new Date();
    const day = now.getDay(); // 0=ned ... 1=pon ... 6=sub
    const daysToNextMonday = ((8 - day) % 7) || 7;
    const firstMonday = new Date(now);
    firstMonday.setDate(now.getDate() + daysToNextMonday);
    firstMonday.setHours(0, 0, 0, 0);
    const m = new Date(firstMonday);
    m.setDate(m.getDate() + (offsetNedelja - 1) * 7);
    return m; // lokalna ponoć ponedeljka izabrane nedelje
  }, [offsetNedelja]);

  useEffect(() => {
    const fetchSve = async () => {
      if (!korisnickoIme || !smena || !usluga) {
        toast.error("Nedostaju korisnički podaci.");
        return;
      }
      await fetchVecIzabraniTermini();
      await fetchTermini();
    };
    fetchSve();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const fetchTermini = async () => {
    try {
      const snapshot = await getDocs(collection(db, "admin_kalendar"));
      const svi = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      const sviRelevantni = svi.filter((t) =>
        ["slobodan", "edukacija", "odmor"].includes(t.tip)
      );

      // ✅ Opseg na osnovu baseMonday
      const startOfWeek = new Date(baseMonday);
      const endOfWeek = new Date(baseMonday);
      endOfWeek.setDate(endOfWeek.getDate() + 6);
      endOfWeek.setHours(23, 59, 59, 999);

      const filtrirani = sviRelevantni.filter((t) => {
        const start = new Date(t.start?.toDate ? t.start.toDate() : t.start);
        const startTime = start.getTime();
        const localHour = start.getHours();

        if (startTime < startOfWeek.getTime() || startTime > endOfWeek.getTime())
          return false;

        // Uvek prikazuj edukaciju i odmor
        if (t.tip === "edukacija" || t.tip === "odmor") return true;

        if (t.tip === "slobodan") {
          if (vecIzabraniTerminiIDs.includes(t.id)) return false;

          if (smena === "jutro") {
            // jutro vidi samo termine pre 15h
            return localHour < 16;
          }

          if (smena === "popodne") {
            return true; // popodnevna vidi sve
          }
        }

        return false;
      });

      setDostupniTermini(filtrirani);
    } catch (err) {
      toast.error("Greška pri učitavanju termina.");
    }
  };

  // Grupisanje po danima (stabilno u odnosu na baseMonday)
  const grupisaniPoDanu = {};
  daniUNedelji.forEach((dan) => {
    grupisaniPoDanu[dan] = [];
  });

  dostupniTermini.forEach((termin) => {
    const start = termin.start?.toDate ? termin.start.toDate() : new Date(termin.start);

    // 🧭 Dan kao razlika dana u odnosu na baseMonday (0..6) → bez getDay/ DST zavisnosti
    const midnightStart = new Date(start);
    midnightStart.setHours(0, 0, 0, 0);
    const idx = Math.max(
      0,
      Math.min(6, Math.floor((midnightStart.getTime() - baseMonday.getTime()) / 86400000))
    );
    const dan = daniUNedelji[idx];

    if (grupisaniPoDanu[dan]) {
      grupisaniPoDanu[dan].push({
        ...termin,
        vreme: format(start, "HH:mm"),
      });
    }
  });

  // Sortiraj termine unutar svakog dana po vremenu
  Object.keys(grupisaniPoDanu).forEach((dan) => {
    grupisaniPoDanu[dan].sort((a, b) => {
      const ta = a.start?.toDate ? a.start.toDate().getTime() : new Date(a.start).getTime();
      const tb = b.start?.toDate ? b.start.toDate().getTime() : new Date(b.start).getTime();
      return ta - tb;
    });
  });

  const toggleOdabir = (termin) => {
    if (termin.tip !== "slobodan" || vecIzabraniTerminiIDs.includes(termin.id)) return;

    const sada = new Date();
    const start = new Date(termin.start?.toDate ? termin.start.toDate() : termin.start);

    const danUNedelji = sada.getDay(); // 0 - nedelja, 6 - subota
    const sat = sada.getHours();
    const minut = sada.getMinutes();

    // granice za narednu nedelju prema baseMonday naredne nedelje
    const nextWeekMonday = addDays(mondayOf(sada), 7);
    nextWeekMonday.setHours(0, 0, 0, 0);
    const startOfNextWeek = new Date(nextWeekMonday);
    const endOfNextWeek = addDays(nextWeekMonday, 6);
    endOfNextWeek.setHours(23, 59, 59, 999);

    if (smena === "jutro") {
      const isUNarednojNedelji = start >= startOfNextWeek && start <= endOfNextWeek;
      const isDozvoljenoVreme =
        (danUNedelji === 6 && (sat > 12 || (sat === 12 && minut >= 0))) || // subota od 12h
        (danUNedelji === 0 && sat <= 23); // nedelja do 23h

      if (!isUNarednojNedelji) {
        toast.warn("Možeš birati samo termine iz naredne nedelje.");
        return;
      }

      if (!isDozvoljenoVreme) {
        toast.warn("Možeš birati samo subotom od 12h do nedelje u 23h.");
        return;
      }

      if (start.getHours() >= 17) {
        toast.warn("Jutarnja smena može birati samo termine pre 15h.");
        return;
      }
    }

    if (smena === "popodne") {
      const osamNedeljaKasnije = new Date();
      osamNedeljaKasnije.setDate(sada.getDate() + 56);
      if (start < sada || start > osamNedeljaKasnije) {
        toast.warn("Možeš birati samo termine u narednih 8 nedelja.");
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
    if (izabrani.length === 0) {
      toast.warn("Niste izabrali nijedan termin.");
      return;
    }

    setLoading(true);
    setPoruka("");

    try {
      // upis u "izboriTermina" + prikupljanje datuma za notifikaciju
      const pickedDates = [];
      for (const termin of izabrani) {
        const startDate = termin.start?.toDate ? termin.start.toDate() : new Date(termin.start);
        pickedDates.push(startDate);
        await addDoc(collection(db, "izboriTermina"), {
          korisnickoIme,
          eventId: termin.id,
          datum: startDate.toISOString().split("T")[0], // YYYY-MM-DD
          timestamp: serverTimestamp(),
          status: "izabrala",
          // 👇 novo:
          usluga,
          materijal,
          velicina,
        });
      }

      // nedelja (ponedeljak) iz PRVOG izabranog termina
      pickedDates.sort((a, b) => a - b);
      const monday = mondayOf(pickedDates[0]);
      const mondayISO = monday.toISOString().slice(0, 10);

      // 👇 novi format "nedelja 16–22.09.2025"
      const startDay = new Date(monday).getDate();
      const endDate = addDays(monday, 6);
      const endPart = format(endDate, "dd.MM.yyyy", { locale: sr });
      const weekTextPretty = `nedelja ${startDay}–${endPart}`;

      // 👇 lepo prikazano ime (npr. "mila" -> "Mila")
      const displayName = (korisnickoIme || "")
        .toString()
        .trim()
        .toLowerCase()
        .replace(/^./, (c) => c.toUpperCase());

      // ➕ IZRAČUNAJ WEEK OFFSET ZA ADMIN KALENDAR
      const baseMondayToday = startOfWeek(new Date(), { weekStartsOn: 1 });
      baseMondayToday.setHours(0, 0, 0, 0);

      const mondayLocal = new Date(monday);
      mondayLocal.setHours(0, 0, 0, 0);

      const diffDays = Math.round(
        (mondayLocal.getTime() - baseMondayToday.getTime()) / 86400000
      );
      const weekOffset = Math.trunc(diffDays / 7);

      // notifikacija Maši sa nedeljom + deep-link na tu nedelju (preko weekOffset)
      await fetch("https://notifikacija-api.vercel.app/api/posalji-notifikaciju", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          korisnickoIme: "masa",
          title: "📅 Novi izbor termina",
          body: `${displayName} je poslala predloge — ${weekTextPretty}.`,
          click_action: `/admin/kalendar?weekOffset=${weekOffset}`,
          url: `/admin/kalendar?weekOffset=${weekOffset}`,
          link: `/admin/kalendar?weekOffset=${weekOffset}`,
        }),
      });

      setPoruka("✅ Uspešno ste poslali predloge!");
      setIzabrani([]);
      await fetchVecIzabraniTermini();
      fetchTermini();
    } catch (err) {
      console.error("❌ Greška pri slanju termina:", err);
      setPoruka("❌ Greška pri slanju termina.");
    } finally {
      setLoading(false);
      setTimeout(() => setPoruka(""), 3000);
    }
  };

  return (
    <div className="kalendar">
      <div className="kalendar-inner">
        <h2>
          Izabrana usluga: <span>{usluga}</span>
          {usluga === "Izlivanje" && (
            <span>
              {" "}
              – {materijal === "Da" ? "Ima materijal" : "Nema materijal"} – Veličina: {velicina}
            </span>
          )}
        </h2>

        <div className="navigation-buttons">
          <button className="nedelja-dugme" onClick={() => setOffsetNedelja((prev) => prev - 1)}>
            ⬅ Prethodna
          </button>
          <button className="nedelja-dugme" onClick={() => setOffsetNedelja((prev) => prev + 1)}>
            Sledeća ➡
          </button>
        </div>

        <div className="nedelja-grid">
          {daniUNedelji.map((dan, i) => (
            <div key={dan} className="dan-kocka">
              <div className="naslov-dana">
                {dan}
                <br />
                <span className="datum-dana">
                  {format(addDays(baseMonday, i), "dd.MM", { locale: sr })}
                </span>
              </div>

              {grupisaniPoDanu[dan].length === 0 ? (
                <div className="prazno">—</div>
              ) : (
                grupisaniPoDanu[dan].map((t) => (
                  <div
                    key={t.id}
                    className={`termin-kocka ${t.tip} ${
                      izabrani.find((z) => z.id === t.id) ? "selected" : ""
                    } ${vecIzabraniTerminiIDs.includes(t.id) ? "disabled" : ""}`}
                    onClick={() => {
                      if (!vecIzabraniTerminiIDs.includes(t.id)) {
                        toggleOdabir(t);
                      }
                    }}
                  >
                    {t.tip === "slobodan" ? t.vreme : t.tip.toUpperCase()}
                  </div>
                ))
              )}
            </div>
          ))}
        </div>

        <button
          className="submit"
          disabled={izabrani.length === 0 || loading}
          onClick={handleSubmit}
        >
          {loading ? "⏳ Slanje..." : "Pošalji izbore"}
        </button>

        <button className="nazad-dugme" onClick={() => navigate("/odabir-usluge")}>
          Nazad
        </button>

        {poruka && <p className="uspesna-poruka">{poruka}</p>}
      </div>
    </div>
  );
};

export default Kalendar;
