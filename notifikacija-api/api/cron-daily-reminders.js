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

// ---------- Timezone / window helpers ----------
const TZ = "Europe/Belgrade";

// SUTRA: 00:00:00.000 UTC do 23:59:59.999 UTC (računato čisto u UTC)
function tomorrowWindowInUTC(now = new Date()) {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const d = now.getUTCDate();

  const start = new Date(Date.UTC(y, m, d + 1, 0, 0, 0, 0));
  const end   = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate(), 23, 59, 59, 999));
  return { fromUTC: start, toUTC: end };
}

// formatiranje poruke striktno u Europe/Belgrade
const fmtDate = new Intl.DateTimeFormat("sr-RS", {
  timeZone: TZ, weekday: "long", day: "2-digit", month: "2-digit", year: "numeric",
});
const fmtTime = new Intl.DateTimeFormat("sr-RS", {
  timeZone: TZ, hour: "2-digit", minute: "2-digit",
});
function formatInBelgrade(d) {
  const dd = d instanceof Date ? d : new Date(d);
  return `${fmtDate.format(dd)} u ${fmtTime.format(dd)}`;
}

// ---------- Ultra-robustan parser za t.start ----------
function parseStartToDate(start) {
  try {
    // Firestore Timestamp
    if (start instanceof Timestamp) return start.toDate();

    // Map sa seconds/_seconds, nanoseconds/_nanoseconds (brojevi ili stringovi)
    if (start && typeof start === "object") {
      const secRaw = "seconds" in start ? start.seconds : ("_seconds" in start ? start._seconds : undefined);
      const nsRaw  = "nanoseconds" in start ? start.nanoseconds : ("_nanoseconds" in start ? start._nanoseconds : 0);

      const secNum = Number(secRaw);
      const nsNum  = Number(nsRaw);

      if (Number.isFinite(secNum)) {
        const ms = secNum * 1000 + (Number.isFinite(nsNum) ? Math.trunc(nsNum / 1e6) : 0);
        return new Date(ms);
      }
      if (typeof secRaw === "string") {
        const tryIso = new Date(secRaw);
        if (!Number.isNaN(tryIso.getTime())) return tryIso;
      }
    }

    // ISO string / Date / ms
    const d = start instanceof Date ? start : new Date(start);
    if (!Number.isNaN(d.getTime())) return d;

    return null;
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const db = getFirestore();
    const fcm = getMessaging();

    // PREVIEW mod (dry-run): /api/cron-daily-reminders?preview=1
    const q = (x) => (x ?? "").toString().toLowerCase();
    const previewMode = q(req.query?.preview) === "1" || q(req.query?.preview) === "true";

    // Prozor: sutra (UTC)
    const { fromUTC, toUTC } = tomorrowWindowInUTC(new Date());

    // HOTFIX: čitamo bez range where-a; filtriramo u kodu
    const snap = await db
      .collection("admin_kalendar")
      .where("tip", "==", "termin")
      .get();

    let sent = 0;
    const tasks = [];
    const results = []; // pregled kome bi se poslalo

    for (const docSnap of snap.docs) {
      const t = docSnap.data();
      if (!t?.clientUsername) continue;

      // vreme termina
      const startDate = parseStartToDate(t.start);
      if (!startDate || Number.isNaN(startDate.getTime())) continue;

      // filtriraj na: sutrašnji dan (UTC prozor)
      if (startDate < fromUTC || startDate > toUTC) continue;

      // FCM token korisnika
      const tokDoc = await db.collection("fcmTokens").doc(t.clientUsername).get();
      const token = tokDoc.exists ? tokDoc.data().token : null;
      if (!token) continue;

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
          fcm.send({
            token,
            data: {
              title: "Podsetnik za sutra 📅",
              body: bodyText,
              click_action: "https://masaneils.vercel.app/istorija",
            },
          }).then(() => { sent += 1; })
        );
      }
    }

    if (!previewMode && tasks.length) {
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
    return res.status(500).json({ ok: false, error: err?.message || String(err) });
  }
}
