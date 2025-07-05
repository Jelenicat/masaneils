import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Verify from "./pages/Verify";
import AdminPanel from "./pages/AdminPanel";
import AllProfiles from "./pages/AllProfiles";
import Troskovi from "./pages/Troskovi";
import MojKalendarAdmin from "./pages/MojKalendarAdmin";
import UnesiPodatke from "./pages/UnesiPodatke";
import OdabirUsluge from "./pages/OdabirUsluge"; // NOVO
import Kalendar from "./pages/Kalendar"; // NOVO
import Podsetnik from "./pages/Podsetnik";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/verify" element={<Verify />} />
        <Route path="/admin" element={<AdminPanel />} />
        <Route path="/admin/lista" element={<AllProfiles />} />
        <Route path="/admin/troskovi" element={<Troskovi />} />
        <Route path="/admin/kalendar" element={<MojKalendarAdmin />} />
        <Route path="/unesi-podatke" element={<UnesiPodatke />} />
        <Route path="/odabir-usluge" element={<OdabirUsluge />} /> {/* NOVO */}
        <Route path="/kalendar" element={<Kalendar />} /> {/* NOVO */}
        <Route path="/admin/podsetnik" element={<Podsetnik />} />

      </Routes>
    </Router>
  );
}

export default App;
