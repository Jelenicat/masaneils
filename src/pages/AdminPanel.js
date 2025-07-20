import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./AdminPanel.css";
import {
  removeFcmToken,
  removeTokenFromFirestore,
  sendNotification,
} from "../firebase";
import { db } from "../firebase";
import {
  collection,
  getDocs,
  query,
  where,
  Timestamp,
  doc,
  getDoc,
} from "firebase/firestore";
import { addDays, startOfWeek } from "date-fns";

const AdminPanel = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [poruka, setPoruka] = useState("");

  const handleLogout = async () => {
    setLoading(true);
    try {
      const username = localStorage.getItem("korisnickoIme");
      if (username) {
        await removeTokenFromFirestore(username);
      }
      removeFcmToken();
      localStorage.removeItem("korisnickoIme");
      navigate("/");
    } catch (error) {
      setPoruka("❌ Greška pri odjavi.");
      setTimeout(() => setPoruka(""), 3000);
    } finally {
      setLoading(false);
    }
  };

  const posaljiPodsetnike = async () => {
    setLoading(true);
    setPoruka("");
    try {
      const danas = new Date();
      const sledeciPonedeljak = startOfWeek(addDays(danas, 1), { weekStartsOn: 1 });
      const sledecaSubota = addDays(sledeciPonedeljak, 6);
      sledecaSubota.setHours(23, 59, 59, 999);


      console.log("📆 Podsetnici za termine od", sledeciPonedeljak, "do", sledecaSubota);

      const q = query(
        collection(db, "admin_kalendar"),
        where("start", ">=", Timestamp.fromDate(sledeciPonedeljak)),
        where("start", "<=", Timestamp.fromDate(sledecaSubota)),
        where("tip", "==", "termin")
      );

      const snapshot = await getDocs(q);
      const korisniciMap = new Map();

      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.clientUsername && data.start) {
          const username = data.clientUsername;
          const vreme = data.start.toDate().toISOString();
          if (!korisniciMap.has(username)) {
            korisniciMap.set(username, vreme);
          }
        }
      });

      const sentTokens = new Set();

      for (const [korisnickoIme, vreme] of korisniciMap.entries()) {
        console.log(`📤 Šaljem podsetnik za ${korisnickoIme} u ${vreme}`);
        const docRef = doc(db, "fcmTokens", korisnickoIme);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const token = docSnap.data().token;
          if (token && !sentTokens.has(token)) {
            console.log("✅ Šaljem notifikaciju na token:", token);
            await sendNotification(korisnickoIme, {
              title: "📅 Podsetnik",
              body: "Imaš zakazan termin naredne nedelje. Klikni da vidiš kada!",
              path: "/istorija",
            });
            sentTokens.add(token);
          } else {
            console.warn("⚠️ Token već iskorišćen ili ne postoji:", token);
          }
        } else {
          console.warn(`❌ Nema tokena za korisnika ${korisnickoIme}`);
        }
      }

      setPoruka("✅ Podsetnici su poslati!");
    } catch (error) {
      setPoruka("❌ Greška pri slanju podsetnika.");
    } finally {
      setLoading(false);
      setTimeout(() => setPoruka(""), 3000);
    }
  };

  return (
    <div className="admin-page" role="main" aria-label="Admin Panel">
      <div className="admin-panel">
        
        <ul className="admin-menu" role="navigation" aria-label="Admin Navigation">
          <li onClick={() => navigate("/admin/lista")} aria-label="Lista svih profila">
            📋 Lista svih profila
          </li>
          <li onClick={() => navigate("/podsetnici")} aria-label="Lista podsetnika">
            📝 Lista podsetnika
          </li>
          <li onClick={() => navigate("/admin/troskovi")} aria-label="Troškovi i zarada">
            💸 Troškovi i zarada
          </li>
          <li onClick={() => navigate("/admin/kalendar")} aria-label="Moj kalendar">
            📅 Moj kalendar
          </li>
          <li onClick={() => navigate("/admin/podsetnik")} aria-label="Dodaj podsetnik">
            ⏰ Dodaj podsetnik
          </li>
          <li onClick={() => navigate("/admin/korisnici")} aria-label="Dodaj/Obriši korisnika">
            ➕ Dodaj / Obriši korisnika
          </li>
        </ul>

        {poruka && <p className="uspesna-poruka">{poruka}</p>}

        <div className="admin-actions">
          <button
            className="menu-button posalji-button"
            onClick={posaljiPodsetnike}
            disabled={loading}
            aria-label="Pošalji podsetnike korisnicima"
          >
            {loading ? "⏳" : "📩 Pošalji podsetnik"}
          </button>
          <button
            className="menu-button logout-button"
            onClick={handleLogout}
            disabled={loading}
            aria-label="Odjavi se iz admin panela"
          >
            {loading ? "⏳" : "🚪 Odjavi se"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;