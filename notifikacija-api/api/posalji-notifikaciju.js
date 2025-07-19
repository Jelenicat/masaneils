import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";

// 🔒 CORS dozvole
function applyCors(req, res) {
  res.setHeader("Access-Control-Allow-Credentials", true);
  res.setHeader("Access-Control-Allow-Origin", "https://masaneils.vercel.app");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return false;
  }
  return true;
}

// 🚀 Inicijalizuj Firebase admin SDK (ako već nije)
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

// 📬 Glavni handler
export default async function handler(req, res) {
  if (!applyCors(req, res)) return;

  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { korisnickoIme, title, body, click_action } = req.body;

  if (!korisnickoIme) {
    return res.status(400).json({ error: "Nedostaje korisnickoIme u zahtevu." });
  }

  try {
    const { getFirestore } = await import("firebase-admin/firestore");
    const db = getFirestore();

    // 📥 Uzimamo FCM token korisnika
    const docRef = db.collection("fcmTokens").doc(korisnickoIme);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return res.status(404).json({ error: `Token not found for korisnickoIme: ${korisnickoIme}` });
    }

    const token = docSnap.data().token;

    // 🔁 Ako nije eksplicitno poslat `click_action`, proveri ima li korisnik aktivne predloge termina
    let finalClickAction = click_action;
    if (!finalClickAction) {
      try {
        const predloziSnapshot = await db
          .collection("ponudjeniTermini")
          .where("korisnickoIme", "==", korisnickoIme)
          .get();

        finalClickAction = !predloziSnapshot.empty ? "/predlozeni-termini" : "/";
      } catch (err) {
        finalClickAction = "/";
      }
    }

    // 🚀 Šaljemo notifikaciju
    console.log("📨 Šaljem na token:", token);

   await getMessaging().send({
  token,
  data: {
    title,
    body,
    click_action: `https://masaneils.vercel.app${finalClickAction}`,
  },
});


    console.log("✅ Notifikacija poslata");

    return res.status(200).json({ success: true });

  } catch (error) {
    console.error("❌ Greška pri slanju notifikacije:", error);

    // 🗑️ Ako je token nevažeći – brišemo ga iz Firestore-a
    if (error.code === "messaging/registration-token-not-registered") {
      try {
        const { getFirestore } = await import("firebase-admin/firestore");
        const db = getFirestore();
        const fcmTokensRef = db.collection("fcmTokens");

        const snapshot = await fcmTokensRef.get();
        snapshot.forEach(async (docSnap) => {
          if (docSnap.data().token === token) {
            await docSnap.ref.delete();
            console.log("🗑️ Obrišan token:", token);
          }
        });
      } catch (firestoreErr) {
        console.error("❌ Greška pri brisanju tokena:", firestoreErr);
      }
    }

    return res.status(500).json({ error: error.message });
  }
}
