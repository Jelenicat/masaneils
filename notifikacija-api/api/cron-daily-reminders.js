// /api/cron-daily-reminders.js
import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";

// --- Admin init (ENV iz Vercel-a)
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
if (!getApps().length) initializeApp({ credential: cert(serviceAccount) });

// ---------- TZ helpers (Europe/Belgrade) ----------
const TZ = "Europe/Belgrade";

function asZoned(date, timeZone = TZ) {
  return new Date(date.toLocaleString("en-GB", { timeZone }));
}
function makeUtcFromLocalParts(y, m, d, hh = 0, mm = 0, ss = 0, ms = 0) {
  return new Date(Date.UTC(y, m, d, hh, mm, ss, ms));
}
function tomorrowWindowInUTC(nowUtc = new Date()) {
  const nowLocal = asZoned(nowUtc, TZ);

  const startLocal = new Date(nowLocal);
  startLocal.setDate(nowLocal.getDate() + 1);
  startLocal.setHours(0, 0, 0, 0);

  const endLocal = new Date(startLocal);
  endLocal.setHours(23, 59, 59, 999);

  const fromUTC = makeUtcFromLocalParts(
    startLocal.getFullYear(),
    startLocal.getMonth(),
    startLocal.getDate(),
    0, 0, 0, 0
  );
  const toUTC = makeUtcFromLocalParts(
    endLocal.getFullYear(),
    endLocal.getMonth(),
    endLocal.getDate(),
    23, 59, 59, 999
  );

  return { fromUTC, toUTC };
}

const fmtDate = new Intl.DateTimeFormat("sr-RS", {
  timeZone: TZ,
  weekday: "long",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});
const fmtTime = new Intl.DateTimeFormat("sr-RS", {
  timeZone: TZ,
  hour: "2-digit",
  minute: "2-digit",
});
function formatInBelgrade(d) {
  const dd = d instanceof Date ? d : new Date(d);
  return `${fmtDate.format(dd)} u ${fmtTime.format(dd)}`;
}

// Robustni parser za t.start (Timestamp | {seconds,nanoseconds} | string | Date)
function parseStartToDate(start) {
  if (start instanceof Timestamp) return start.toDate();
  if (start?.seconds !== undefined && start?.nanoseconds !== undefined) {
    const sec = Number(start.seconds);
    const ns = Number(start.nanoseconds);
    return new Timestamp(sec, ns).toDate();
  }
  return new Date(start);
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const db = getFirestore();

    // 👇 PREVIEW mod (dry-run): /api/cron-daily-reminders?preview=1
    const previewMode =
      (req.query?.preview ?? "").toString().toLowerCase() === "1" ||
      (req.query?.preview ?? "").toString().toLowerCase() === "true";

    // ---- PROZOR: sutra po Beogradu (upit u UTC)
    const { fromUTC, toUTC } = tomorrowWindowInUTC(new Date());

    const snap = await db
      .collection("admin_kalendar")
      .where("tip", "==", "termin")
      .where("start", ">=", Timestamp.fromDate(fromUTC))
      .where("start", "<=", Timestamp.fromDate(toUTC))
      .get();

    let sent = 0;
    const tasks = [];
    const results = []; // 👈 za pregled kome bi se poslalo

    for (const docSnap of snap.docs) {
      const t = docSnap.data();
      if (!t?.clientUsername) continue;

      const tokDoc = await db.collection("fcmTokens").doc(t.clientUsername).get();
      const token = tokDoc.exists ? tokDoc.data().token : null;
      if (!token) continue;

      const startDate = parseStartToDate(t.start);
      const bodyText = `Imate termin sutra (${formatInBelgrade(startDate)}).`;

      results.push({
        user: t.clientUsername,
        eventId: docSnap.id,
        service: t.serviceName || t.usluga || null,
        startUTC: startDate.toISOString(),
        preview: bodyText,
      });

      if (!previewMode) {
        tasks.push(
          getMessaging()
            .send({
              token,
              data: {
                title: "Podsetnik za sutra 📅",
                body: bodyText,
                click_action: "https://masaneils.vercel.app/istorija",
              },
            })
            .then(() => { sent += 1; })
        );
      }
    }

    if (!previewMode) {
      await Promise.allSettled(tasks);
    }

    return res.status(200).json({
      ok: true,
      window: { from: fromUTC.toISOString(), to: toUTC.toISOString() },
      sent: previewMode ? 0 : sent,
      previewMode,
      results,
    });
  } catch (err) {
    console.error("Cron daily error:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
