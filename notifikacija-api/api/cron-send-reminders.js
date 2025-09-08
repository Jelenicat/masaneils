// /api/cron-send-reminders.js
import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";

// Sastavi service account iz ENV varijabli koje već imaš u Vercelu
const serviceAccount = {
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
};

// Inicijalizuj Admin SDK samo jednom
if (!getApps().length) {
  initializeApp({ credential: cert(serviceAccount) });
}

export default async function handler(req, res) {
  // Endpoint je za cron (server-to-server), nema potrebe za CORS-om/OPTIONS
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const db = getFirestore();

    // ---- Izračunaj prozor: SLEDEĆA NEDELJA (ponedeljak 00:00 -> nedelja 23:59:59.999)
    const now = new Date();
    // JS getDay(): ned=0, pon=1, uto=2, ... sub=6
    const day = now.getDay();
    const daysUntilNextMonday = (8 - day) % 7; // ako je nedelja (0) -> 1; ako je ponedeljak (1) -> 0
    const nextMonday = new Date(now);
    nextMonday.setDate(now.getDate() + daysUntilNextMonday);
    nextMonday.setHours(0, 0, 0, 0);

    const nextSunday = new Date(nextMonday);
    nextSunday.setDate(nextMonday.getDate() + 6);
    nextSunday.setHours(23, 59, 59, 999);

    // ---- Povuci sve potvrđene termine u sledećoj nedelji
    const snap = await db
      .collection("admin_kalendar")
      .where("tip", "==", "termin")
      .where("start", ">=", Timestamp.fromDate(nextMonday))
      .where("start", "<=", Timestamp.fromDate(nextSunday))
      .get();

    let sent = 0;

    for (const docSnap of snap.docs) {
      const t = docSnap.data();
      if (!t?.clientUsername) continue;

      // Nađi FCM token korisnika
      const tokDoc = await db.collection("fcmTokens").doc(t.clientUsername).get();
      const token = tokDoc.exists ? tokDoc.data().token : null;
      if (!token) continue;

      // Format: "ponedeljak 09.09 u 14:30"
      const d = t.start?.toDate ? t.start.toDate() : new Date(t.start);
      const datum = d.toLocaleDateString("sr-RS", {
        weekday: "long",
        day: "2-digit",
        month: "2-digit",
      });
      const vreme = d.toLocaleTimeString("sr-RS", {
        hour: "2-digit",
        minute: "2-digit",
      });

      await getMessaging().send({
        token,
        notification: {
          title: "Podsetnik",
          body: `Vaš termin je ${datum} u ${vreme}`,
        },
        data: {
          click_action: "https://masaneils.vercel.app/istorija",
        },
      });

      sent++;
    }

    return res.status(200).json({
      ok: true,
      window: {
        from: nextMonday.toISOString(),
        to: nextSunday.toISOString(),
      },
      sent,
    });
  } catch (err) {
    console.error("Cron error:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
