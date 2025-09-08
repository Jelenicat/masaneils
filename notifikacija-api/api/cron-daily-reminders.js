// /api/cron-daily-reminders.js
import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";

// 🔑 Service account iz ENV varijabli (kao i u cron-send-reminders.js)
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

if (!getApps().length) {
  initializeApp({ credential: cert(serviceAccount) });
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const db = getFirestore();

    // 📅 Sutrašnji dan (00:00 → 23:59)
    const now = new Date();
    const tomorrowStart = new Date(now);
    tomorrowStart.setDate(now.getDate() + 1);
    tomorrowStart.setHours(0, 0, 0, 0);

    const tomorrowEnd = new Date(tomorrowStart);
    tomorrowEnd.setHours(23, 59, 59, 999);

    const snap = await db
      .collection("admin_kalendar")
      .where("tip", "==", "termin")
      .where("start", ">=", Timestamp.fromDate(tomorrowStart))
      .where("start", "<=", Timestamp.fromDate(tomorrowEnd))
      .get();

    let sent = 0;

    for (const docSnap of snap.docs) {
      const t = docSnap.data();
      if (!t?.clientUsername) continue;

      const tokDoc = await db.collection("fcmTokens").doc(t.clientUsername).get();
      const token = tokDoc.exists ? tokDoc.data().token : null;
      if (!token) continue;

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
          title: "Podsetnik za sutra 📅",
          body: `Imate termin sutra (${datum}) u ${vreme}`,
        },
        data: {
          click_action: "https://masaneils.vercel.app/istorija",
        },
      });

      sent++;
    }

    return res.status(200).json({
      ok: true,
      window: { from: tomorrowStart.toISOString(), to: tomorrowEnd.toISOString() },
      sent,
    });
  } catch (err) {
    console.error("Cron daily error:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
