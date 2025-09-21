// src/App.js
import { BrowserRouter as Router, Routes, Route, useParams, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { onMessageListener } from "./firebase";

import Home from "./pages/Home";
import Verify from "./pages/Verify";
import AdminPanel from "./pages/AdminPanel";
import AllProfiles from "./pages/AllProfiles";
import Troskovi from "./pages/Troskovi";
import MojKalendarAdmin from "./pages/MojKalendarAdmin";
import UnesiPodatke from "./pages/UnesiPodatke";
import OdabirUsluge from "./pages/OdabirUsluge";
import Kalendar from "./pages/Kalendar";
import Podsetnik from "./pages/Podsetnik";
import ListaPodsetnika from "./pages/ListaPodsetnika";
import PonudjeniTermini from "./pages/PonudjeniTermini";
import Korisnik from "./pages/Korisnik";
import Istorija from "./pages/Istorija";
import MojTermin from "./pages/MojTermin";
import KorisniciMenadzer from "./pages/KorisniciMenadzer";

/** Helper za /ponudjeni/:korisnickoIme */
const PonudjeniTerminiWrapper = () => {
  const { korisnickoIme } = useParams();
  return <PonudjeniTermini korisnickoIme={korisnickoIme} />;
};

/** Minimalan toast (umesto alert-a) */
function showToast(msg) {
  if (!msg) return;
  const d = document.createElement("div");
  d.textContent = msg;
  Object.assign(d.style, {
    position: "fixed",
    bottom: "20px",
    right: "20px",
    background: "rgba(0,0,0,.85)",
    color: "#fff",
    padding: "10px 14px",
    borderRadius: "10px",
    zIndex: 9999,
    maxWidth: "80vw",
    fontSize: "14px",
    boxShadow: "0 6px 24px rgba(0,0,0,.25)",
  });
  document.body.appendChild(d);
  setTimeout(() => d.remove(), 4000);
}

/** 🔔 Foreground FCM listener + bridge za SW */
function NotifListener() {
  const nav = useNavigate();

  useEffect(() => {
    // Foreground poruke
    const unsub = onMessageListener((payload) => {
      console.log("📩 Foreground FCM:", payload);

      const title = payload?.notification?.title || payload?.data?.title || "Obaveštenje";
      const body = payload?.notification?.body || payload?.data?.body || "";
      showToast([title, body].filter(Boolean).join(" — "));

      const url = payload?.data?.link || payload?.data?.click_action || payload?.data?.url;
      if (!url) return;

      try {
        const u = new URL(url, window.location.origin);
        if (u.origin === window.location.origin) {
          nav(u.pathname + u.search + u.hash, { replace: false });
        } else {
          window.location.href = u.toString();
        }
      } catch {
        nav(url);
      }
    });

    // Poruke iz service workera (klik iz background-a)
    const onMsg = (e) => {
      const route = e?.data?.__OPEN_ROUTE__;
      if (route) {
        try {
          const u = new URL(route, window.location.origin);
          if (u.origin === window.location.origin) {
            nav(u.pathname + u.search + u.hash);
          } else {
            window.location.href = u.toString();
          }
        } catch {
          nav(route);
        }
      }
    };
    navigator.serviceWorker?.addEventListener?.("message", onMsg);

    return () => {
      if (typeof unsub === "function") unsub();
      navigator.serviceWorker?.removeEventListener?.("message", onMsg);
    };
  }, [nav]);

  return null;
}

export default function App() {
  return (
    <Router>
      <NotifListener />

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/verify" element={<Verify />} />
        <Route path="/admin" element={<AdminPanel />} />
        <Route path="/admin/lista" element={<AllProfiles />} />
        <Route path="/admin/troskovi" element={<Troskovi />} />
        <Route path="/admin/kalendar" element={<MojKalendarAdmin />} />
        <Route path="/unesi-podatke" element={<UnesiPodatke />} />
        <Route path="/odabir-usluge" element={<OdabirUsluge />} />
        <Route path="/kalendar" element={<Kalendar />} />
        <Route path="/admin/podsetnik" element={<Podsetnik />} />
        <Route path="/podsetnici" element={<ListaPodsetnika />} />

        <Route path="/korisnik" element={<Korisnik />} />
        <Route path="/ponudjeni/:korisnickoIme" element={<PonudjeniTerminiWrapper />} />
        <Route path="/istorija" element={<Istorija />} />
        <Route path="/moj-termin" element={<MojTermin />} />
        <Route path="/admin/korisnici" element={<KorisniciMenadzer />} />
      </Routes>
    </Router>
  );
}
