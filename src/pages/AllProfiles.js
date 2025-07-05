import React, { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import "./AllProfiles.css";

const AllProfiles = () => {
  const [profiles, setProfiles] = useState([]);

  useEffect(() => {
    const fetchProfiles = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "korisnici"));
        const data = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setProfiles(data);
      } catch (error) {
        console.error("Greška pri učitavanju profila:", error);
      }
    };

    fetchProfiles();
  }, []);

  return (
    <div className="all-profiles-page">
      <div className="all-profiles-box">
        <h1>Svi profili</h1>
        <div className="profiles-grid">
          {profiles.map((user) => (
            <div className="profile-card" key={user.id}>
              <h3>{user.username}</h3>
              {/* Ovde možeš dodati još podataka */}
              {/* <p>Smena: {user.smena}</p> */}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AllProfiles;
