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
  console.log("🚀 check-reminders pokrenut u", new Date().toISOString());

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

  // Uzimamo najnoviji token za masu
  const tokenDoc = await db.collection("fcmTokens").doc("masa").get();
  const currentToken = tokenDoc.exists ? tokenDoc.data().token : null;

  console.log(`📨 Šaljem podsetnik za: ${data.tekst}`);

  if (data.zadnjiPutPoslato !== today && currentToken) {
    try {
      await messaging.send({
        token: currentToken, // 📌 sada se koristi poslednji token
        notification: {
          title: "📌 Podsetnik",
          body: data.tekst || "Imate novi podsetnik.",
        },
        data: {
          click_action: "/podsetnici"
        }
      });

          batch.update(docRef, { zadnjiPutPoslato: today });
          poslato.push(`Podsetnik: ${data.tekst}`);

        } catch (err) {
          console.error("\u274c Gre\u0161ka pri slanju podsetnika:", err);

          if (err.errorInfo?.code === "messaging/registration-token-not-registered") {
            console.warn("\u26a0\ufe0f Token nije validan, bri\u0161em ga iz dokumenta.");
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
              title: "\ud83c\udf89 Ro\u0111endan danas!",
              body: `Danas je ro\u0111endan: ${imena}`,
            }
          });
          poslato.push(`Ro\u0111endani: ${imena}`);
        } catch (err) {
          console.error("\u274c Gre\u0161ka pri slanju ro\u0111endanske notifikacije:", err);
        }
      } else {
        console.warn("\u26a0\ufe0f Masa nema FCM token za ro\u0111endane.");
      }
    }

    await batch.commit();

    res.status(200).json({
      message: `Ukupno poslato ${poslato.length} notifikacija.`,
      poslato,
    });

  } catch (err) {
    console.error("\u274c Gre\u0161ka u check-reminders + birthdays:", err);
    res.status(500).json({ error: "Gre\u0161ka na serveru." });
  }
}