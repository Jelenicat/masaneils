// api/check-reminders.js

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";



if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    }),
  });
}


const db = getFirestore();
const messaging = getMessaging();

export default async function handler(req, res) {
  try {
    const today = new Date().toISOString().split("T")[0]; // 'YYYY-MM-DD'
    const todayMonthDay = `${String(new Date().getMonth() + 1).padStart(2, "0")}-${String(new Date().getDate()).padStart(2, "0")}`;

    const poslato = [];

    // 1️⃣ PODSETNICI
    const remindersSnapshot = await db.collection("podsetnici")
      .where("aktivan", "==", true)
      .get();

    const batch = db.batch();

    for (const doc of remindersSnapshot.docs) {
      const data = doc.data();
      const docRef = doc.ref;

      if (data.zadnjiPutPoslato !== today && data.korisnikToken) {
        try {
          await messaging.send({
            token: data.korisnikToken,
            notification: {
              title: "📌 Podsetnik",
              body: data.tekst || "Imate novi podsetnik.",
            },
          });

          batch.update(docRef, { zadnjiPutPoslato: today });
          poslato.push(`Podsetnik: ${data.tekst}`);
        } catch (err) {
          console.error("❌ Greška pri slanju podsetnika:", err);
        }
      }
    }

    // 2️⃣ ROĐENDANI
    const korisniciSnapshot = await db.collection("korisnici").get();
    const slavljenici = korisniciSnapshot.docs.filter((doc) => {
      const datum = doc.data().datumRodjenja;
      return datum && datum.slice(5) === todayMonthDay;
    });

    if (slavljenici.length > 0) {
      const imena = slavljenici.map((doc) => doc.id).join(", ");
      const tokenDoc = await db.collection("fcmTokens").doc("masa").get();
      const token = tokenDoc.exists ? tokenDoc.data().token : null;

      if (token) {
        await messaging.send({
          token,
          notification: {
            title: "🎉 Rođendan danas!",
            body: `Danas je rođendan: ${imena}`,
          },
        });

        poslato.push(`Rođendani: ${imena}`);
      } else {
        console.warn("⚠️ Masa nema FCM token za rođendane.");
      }
    }

    await batch.commit();

    res.status(200).json({
      message: `Ukupno poslato ${poslato.length} notifikacija.`,
      poslato,
    });
  } catch (err) {
    console.error("❌ Greška u check-reminders + birthdays:", err);
    res.status(500).json({ error: "Greška na serveru." });
  }
}
