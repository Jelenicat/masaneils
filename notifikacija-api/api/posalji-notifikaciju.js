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

// 🚀 Init Firebase Admin SDK (ako već nije)
if (!getApps().length) {
  initializeApp({
    credential: cert({
      type: process.env.FIREBASE_TYPE,
      project_id: process.env.FIREBASE_PROJECT_ID,
      private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
      private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
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

export default async function handler(req, res) {
  if (!applyCors(req, res)) return;

  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { korisnickoIme, title, body, click_action } = req.body || {};
  if (!korisnickoIme) {
    return res.status(400).json({ error: "Nedostaje korisnickoIme u zahtevu." });
  }

  let token; // biće popunjen ispod da bismo ga imali u catch-u

  try {
    const { getFirestore } = await import("firebase-admin/firestore");
    const db = getFirestore();

    // 🔑 Token za korisnika (doc id = korisnicko ime)
    const docSnap = await db.collection("fcmTokens").doc(korisnickoIme).get();
    if (!docSnap.exists) {
      return res.status(404).json({ error: `Token not found for korisnickoIme: ${korisnickoIme}` });
    }
    token = docSnap.data()?.token;
    if (!token) {
      return res.status(404).json({ error: `Empty token for korisnickoIme: ${korisnickoIme}` });
    }

    // 🧭 Jedinstveni default: /ponudjeni/:korisnickoIme
    let finalClickAction = (click_action && String(click_action).trim()) || null;

    if (!finalClickAction) {
      // Ako nije poslato iz fronta, uvek vodi na kanoničku rutu koja postoji u SPA
      finalClickAction = `/ponudjeni/${encodeURIComponent(korisnickoIme)}`;
    }

    // Ako si poslao apsolutni URL, ostavi ga; inače pošalji relativnu rutu.
    const isAbsolute = /^https?:\/\//i.test(finalClickAction);
    const outboundClick = isAbsolute ? finalClickAction : finalClickAction;

    // 📩 Data-only poruka (SW i foreground listener će prikazati/navigirati)
    await getMessaging().send({
      token,
      data: {
        title: title || "Obaveštenje",
        body: body || "",
        // tri polja zbog različitih klijenata i tumačenja
        click_action: outboundClick,
        url: outboundClick,
        link: outboundClick,
      },
    });

    console.log("✅ Notifikacija poslata korisniku:", korisnickoIme, outboundClick);
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("❌ Greška pri slanju notifikacije:", error);

    // 🧹 Očisti nevažeći token (ako ga imamo i ako je uzrok)
    if (error?.code === "messaging/registration-token-not-registered" && token) {
      try {
        const { getFirestore } = await import("firebase-admin/firestore");
        const db = getFirestore();

        // Moguće da imaš dokumente mapirane po korisničkom imenu, pa je dovoljno samo taj doc
        // ali za svaki slučaj prođi kroz kolekciju i izbriši sve iste tokene
        const fcmTokensRef = db.collection("fcmTokens");
        const snapshot = await fcmTokensRef.get();

        const batch = db.batch();
        snapshot.forEach((docSnap) => {
          if (docSnap.data()?.token === token) {
            batch.delete(docSnap.ref);
          }
        });
        await batch.commit();

        console.log("🗑️ Obrisani nevažeći tokeni:", token);
      } catch (firestoreErr) {
        console.error("❌ Greška pri brisanju tokena:", firestoreErr);
      }
    }

    return res.status(500).json({ error: error.message });
  }
}
