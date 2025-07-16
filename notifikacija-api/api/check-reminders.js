import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";

if (!getApps().length) {
  initializeApp({
    credential: cert({
      type: process.env.FIREBASE_TYPE,
      project_id: process.env.FIREBASE_PROJECT_ID,
      private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
      private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      client_id: process.env.FIREBASE_CLIENT_ID,
      auth_uri: process.env.FIREBASE_AUTH_URI,
      token_uri: process.env.FIREBASE_TOKEN_URI,
      auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_X509,
      client_x509_cert_url: process.env.FIREBASE_CLIENT_X509,
      universe_domain: process.env.FIREBASE_UNIVERSE_DOMAIN,
    }),
  });
}

const db = getFirestore();
const messaging = getMessaging();

export default async function handler(req, res) {
  try {
    const today = new Date().toISOString().split("T")[0];
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

          if (err.errorInfo?.code === "messaging/registration-token-not-registered") {
            console.warn("⚠️ Token nije validan, brišem ga iz dokumenta.");
            batch.update(docRef, { korisnikToken: "" });
          }
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
        try {
          await messaging.send({
            token,
            notification: {
              title: "🎉 Rođendan danas!",
              body: `Danas je rođendan: ${imena}`,
            },
          });
          poslato.push(`Rođendani: ${imena}`);
        } catch (err) {
          console.error("❌ Greška pri slanju rođendanske notifikacije:", err);
        }
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
