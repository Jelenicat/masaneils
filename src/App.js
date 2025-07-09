import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
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
        <Route path="/odabir-usluge" element={<OdabirUsluge />} />
        <Route path="/kalendar" element={<Kalendar />} />
        <Route path="/admin/podsetnik" element={<Podsetnik />} />
        <Route path="/podsetnici" element={<ListaPodsetnika />} />
        <Route path="/ponudjeni-termini" element={<PonudjeniTermini />} />
        <Route path="/korisnik" element={<Korisnik />} />
      </Routes>
    </Router>
  );
}

export default App;
