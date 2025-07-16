import React from "react";
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

  const handleLogout = async () => {
    const username = localStorage.getItem("korisnickoIme");

    if (username) {
      await removeTokenFromFirestore(username); // 🧹 Remove from Firestore
    }

    removeFcmToken(); // 🧹 Remove from localStorage
    localStorage.removeItem("korisnickoIme"); // Remove username
    navigate("/"); // Return to Home
  };

  const posaljiPodsetnike = async () => {
    const danas = new Date();
    const sledeciPonedeljak = startOfWeek(addDays(danas, 7), { weekStartsOn: 1 });
    const sledecaSubota = addDays(sledeciPonedeljak, 5);

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

    for (const [korisnickoIme, vreme] of korisniciMap.entries()) {
      console.log(`📤 Šaljem podsetnik za ${korisnickoIme} u ${vreme}`);

      const docRef = doc(db, "fcmTokens", korisnickoIme);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const token = docSnap.data().token;
        console.log("✅ Token za slanje:", token);
        await sendNotification(token, {
          title: "📅 Podsetnik",
          body: "Imaš zakazan termin naredne nedelje. Klikni da vidiš kada!",
          click_action: `https://masaneils.vercel.app/moj-termin?vreme=${encodeURIComponent(
            vreme
          )}`,
        });
      } else {
        console.warn(`❌ Nema tokena za korisnika ${korisnickoIme}`);
      }
    }

    alert("✅ Podsetnici su poslati!");
  };

  return (
    <div className="admin-page" role="main" aria-label="Admin Panel">
      <div className="admin-panel">
        <ul className="admin-menu">
          <li onClick={() => navigate("/admin/lista")} aria-label="Lista svih profila">
            📋 Lista svih profila
          </li>
          <li onClick={() => navigate("/podsetnici")} aria-label="Lista podsetnika">
            📝 Lista podsetnik
          </li>
          <li onClick={() => navigate("/admin/troskovi")} aria-label="Troškovi">
            💸 Troškovi i zarada
          </li>
          <li onClick={() => navigate("/admin/kalendar")} aria-label="Moj kalendar">
            📅 Moj kalendar
          </li>
          <li onClick={() => navigate("/admin/podsetnik")} aria-label="Dodaj podsetnik">
            ⏰ Dodaj podsetnik
          </li>
        </ul>

        <button onClick={posaljiPodsetnike} className="posalji-btn">
          📨 Pošalji podsetnik
        </button>
        <button onClick={handleLogout} className="logout-button" aria-label="Odjavi se">
          🚪 Odjavi se
        </button>
      </div>
    </div>
  );
};

export default AdminPanel;
