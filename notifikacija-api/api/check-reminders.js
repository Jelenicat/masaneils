// notifikacija-api/api/check-reminders.js

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import serviceAccount from "../../serviceAccountKey.json"; // prilagodi putanju ako treba

// Inicijalizacija Firebase Admin
initializeApp({
  credential: cert(serviceAccount),
});

const db = getFirestore();
const messaging = getMessaging();

export default async function handler(req, res) {
  try {
    const today = new Date().toISOString().split("T")[0]; // 'YYYY-MM-DD'

    // Uzimamo sve aktivne podsetnike
    const snapshot = await db.collection("podsetnici")
      .where("aktivan", "==", true)
      .get();

    const batch = db.batch();
    const poslato = [];

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const docRef = doc.ref;

      // Proveravamo da li je već poslat danas
      if (data.zadnjiPutPoslato !== today && data.korisnikToken) {
        try {
          await messaging.send({
            token: data.korisnikToken,
            notification: {
              title: "Podsetnik",
              body: data.tekst || "Imate novi podsetnik.",
            },
          });

          // Ažuriramo da je poslat danas
          batch.update(docRef, { zadnjiPutPoslato: today });
          poslato.push(data.tekst);
        } catch (err) {
          console.error("❌ Greška pri slanju notifikacije:", err);
        }
      }
    }

    await batch.commit();

    res.status(200).json({
      message: `Provereno. Poslato ${poslato.length} podsetnika.`,
      poslato,
    });
  } catch (err) {
    console.error("❌ Greška u check-reminders:", err);
    res.status(500).json({ error: "Server error." });
  }
}
