import React, { useEffect, useState } from "react";
import { db } from "../firebase";
import {
  collection,
  getDocs,
  doc,
  deleteDoc,
  setDoc,
} from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import "./KorisniciMenadzer.css";

const KorisniciMenadzer = () => {
  const [korisnici, setKorisnici] = useState([]);
  const [novoIme, setNovoIme] = useState("");
  const [smena, setSmena] = useState("jutro");
  const [poruka, setPoruka] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const fetchKorisnici = async () => {
    setLoading(true);
    try {
      const snapshot = await getDocs(collection(db, "korisnici"));
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setKorisnici(data);
    } catch (error) {
      setPoruka("❌ Greška pri učitavanju korisnica.");
    } finally {
      setLoading(false);
    }
  };

  const dodajKorisnika = async () => {
    if (!novoIme) return alert("Unesite korisničko ime");
    setLoading(true);
    try {
      await setDoc(doc(db, "korisnici", novoIme), {
        username: novoIme,
        smena,
        rola: "radnica",
        brojTelefona: "",
        datumRodjenja: "",
      });
      setNovoIme("");
      setPoruka("✅ Uspešno ste dodali korisnicu.");
      await fetchKorisnici();
    } catch (error) {
      setPoruka("❌ Greška pri dodavanju korisnice.");
    } finally {
      setLoading(false);
      setTimeout(() => setPoruka(""), 3000);
    }
  };

  const obrisiKorisnika = async (id) => {
    if (window.confirm(`Obrisati korisnicu "${id}"?`)) {
      setLoading(true);
      try {
        await deleteDoc(doc(db, "korisnici", id));
        await fetchKorisnici();
        setPoruka("✅ Uspešno ste obrisali korisnicu.");
      } catch (error) {
        setPoruka("❌ Greška pri brisanju korisnice.");
      } finally {
        setLoading(false);
        setTimeout(() => setPoruka(""), 3000);
      }
    }
  };

  useEffect(() => {
    fetchKorisnici();
  }, []);

  return (
    <div className="korisnici-menadzer">
      <h2>👩‍💼 Upravljanje korisnicama</h2>

      <div className="dodaj-forma">
        <input
          type="text"
          placeholder="Korisničko ime"
          value={novoIme}
          onChange={(e) => setNovoIme(e.target.value)}
          disabled={loading}
          aria-label="Unesite korisničko ime"
        />
        <select
          value={smena}
          onChange={(e) => setSmena(e.target.value)}
          disabled={loading}
          aria-label="Izaberite smenu"
        >
          <option value="jutro">Jutro</option>
          <option value="popodne">Popodne</option>
        </select>
        <button onClick={dodajKorisnika} disabled={loading}>
          {loading ? "⏳" : "➕ Dodaj"}
        </button>
      </div>

      {poruka && <p className="uspesna-poruka">{poruka}</p>}

      {loading ? (
        <p>Učitavanje...</p>
      ) : korisnici.length === 0 ? (
        <p>Nema korisnica za prikaz.</p>
      ) : (
        <ul className="lista-korisnica">
          {korisnici.map((kor) => (
            <li key={kor.id}>
              {kor.username} ({kor.smena})
              <button
                className="obrisi-dugme"
                onClick={() => obrisiKorisnika(kor.id)}
                disabled={loading}
                aria-label={`Obriši korisnicu ${kor.username}`}
              >
                🗑️ Obriši
              </button>
            </li>
          ))}
        </ul>
      )}

      <button
        className="nazad-dugme"
        onClick={() => navigate("/admin")}
        disabled={loading}
      >
        ← Nazad
      </button>
    </div>
  );
};

export default KorisniciMenadzer;