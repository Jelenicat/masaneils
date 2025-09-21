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
  const decoded = korisnickoIme ? decodeURIComponent(korisnickoIme) : "";
  return <PonudjeniTermini korisnickoIme={decoded} />;
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

/** 🧭 Bootstrap za hash deeplink (#/ruta -> /ruta) */
function HashBootstrapper() {
  const nav = useNavigate();

  useEffect(() => {
    const normalize = (hash) => {
      if (!hash) return null;
      if (!hash.startsWith("#/")) return null;
      return hash.slice(1); // "#/x" -> "/x"
    };

    // pokreni na mount
    const t = normalize(window.location.hash);
    if (t) nav(t, { replace: true });

    // reaguj i na promenu hasha
    const onHashChange = () => {
      const n = normalize(window.location.hash);
      if (n) nav(n, { replace: true });
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [nav]);

  return null;
}

/** 🔔 Foreground FCM listener + bridge iz SW */
/** 🔔 Foreground FCM listener (bez SW bridge-a) */
function NotifListener() {
  const nav = useNavigate();

  useEffect(() => {
    // Foreground FCM poruke (dok je tab aktivan)
    const unsub = onMessageListener((payload) => {
      const title = payload?.notification?.title || payload?.data?.title || "Obaveštenje";
      const body  = payload?.notification?.body  || payload?.data?.body  || "";
      showToast([title, body].filter(Boolean).join(" — "));

      // Ako poruka u foregroundu nosi deep-link, navigiraj unutar SPA
      const raw = payload?.data?.click_action || payload?.data?.url || payload?.data?.link;
      if (!raw) return;

      try {
        const u = new URL(raw, window.location.origin);
        const target = u.pathname + u.search + u.hash;
        if (u.origin === window.location.origin) {
          nav(target, { replace: false });
        } else {
          window.location.href = u.toString();
        }
      } catch {
        const t = raw.startsWith("/") ? raw : `/${raw}`;
        nav(t, { replace: false });
      }
    });

    // ❌ NEMA više slušanja poruka iz service workera / window.postMessage
    // klik na notifikaciju sada uvek otvara NOVI tab iz SW → ovde ne diramo ništa

    return () => {
      if (typeof unsub === "function") unsub();
    };
  }, [nav]);

  return null;
}

export default function App() {
  return (
    <Router>
      <HashBootstrapper />
      <NotifListener />

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/verify" element={<Verify />} />
        <Route path="/admin" element={<AdminPanel />} />
        <Route path="/admin/lista" element={<AllProfiles />} />
        <Route path="/admin/troskovi" element={<Troskovi />} />
        {/* ⬇⬇⬇ Ovo prima ?week=YYYY-MM-DD i učitava baš tu nedelju (već radi u tvom fajlu) */}
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
