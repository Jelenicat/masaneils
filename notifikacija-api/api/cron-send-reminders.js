// /api/cron-send-reminders.js
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
function asZoned(date, timeZone = TZ) { return new Date(date.toLocaleString("en-GB", { timeZone })); }
function makeUtcFromLocalParts(y, m, d, hh = 0, mm = 0, ss = 0, ms = 0) {
  return new Date(Date.UTC(y, m, d, hh, mm, ss, ms));
}
function nextWeekWindowInUTC(nowUtc = new Date()) {
  const nowLocal = asZoned(nowUtc, TZ);
  const dow = nowLocal.getDay(); // 0=ned,1=pon
  const daysUntilNextMonday = (8 - dow) % 7;
  const nextMonLocal = new Date(nowLocal);
  nextMonLocal.setDate(nowLocal.getDate() + daysUntilNextMonday);
  nextMonLocal.setHours(0, 0, 0, 0);
  const nextSunLocal = new Date(nextMonLocal);
  nextSunLocal.setDate(nextMonLocal.getDate() + 6);
  nextSunLocal.setHours(23, 59, 59, 999);
  return {
    fromUTC: makeUtcFromLocalParts(nextMonLocal.getFullYear(), nextMonLocal.getMonth(), nextMonLocal.getDate(), 0, 0, 0, 0),
    toUTC:   makeUtcFromLocalParts(nextSunLocal.getFullYear(), nextSunLocal.getMonth(), nextSunLocal.getDate(), 23, 59, 59, 999),
  };
}

const fmtDate = new Intl.DateTimeFormat("sr-RS", { timeZone: TZ, weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" });
const fmtTime = new Intl.DateTimeFormat("sr-RS", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
function formatInBelgrade(d) { const dd = d instanceof Date ? d : new Date(d); return `${fmtDate.format(dd)} u ${fmtTime.format(dd)}`; }

// Ultra-robustni parser
function parseStartToDate(start) {
  try {
    if (start instanceof Timestamp) return start.toDate();
    if (start && typeof start === "object") {
      const secRaw = "seconds" in start ? start.seconds : ("_seconds" in start ? start._seconds : undefined);
      const nsRaw  = "nanoseconds" in start ? start.nanoseconds : ("_nanoseconds" in start ? start._nanoseconds : 0);
      const secNum = Number(secRaw), nsNum = Number(nsRaw);
      if (Number.isFinite(secNum)) {
        return new Date(secNum * 1000 + (Number.isFinite(nsNum) ? Math.trunc(nsNum / 1e6) : 0));
      }
      if (typeof secRaw === "string") {
        const tryIso = new Date(secRaw);
        if (!Number.isNaN(tryIso.getTime())) return tryIso;
      }
    }
    const d = start instanceof Date ? start : new Date(start);
    if (!Number.isNaN(d.getTime())) return d;
    return new Date();
  } catch { return new Date(); }
}

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    const db = getFirestore();
    const qlower = (x) => (x ?? "").toString().toLowerCase();
    const previewMode = qlower(req.query?.preview) === "1" || qlower(req.query?.preview) === "true";
    const debugMode   = qlower(req.query?.debug)   === "1" || qlower(req.query?.debug)   === "true";

    const { fromUTC, toUTC } = nextWeekWindowInUTC(new Date());

    // KLJUČNO: učitavamo SAMO potrebna polja.
    const snap = await db
      .collection("admin_kalendar")
      .where("tip", "==", "termin")
      .where("start", ">=", fromUTC)   // koristimo Date direktno
      .where("start", "<=", toUTC)
      .select("start", "clientUsername", "serviceName", "usluga") // <——
      .get();

    let sent = 0;
    const tasks = [];
    const results = [];

    for (const docSnap of snap.docs) {
      const t = docSnap.data();
      if (!t?.clientUsername) continue;

      const tokDoc = await db.collection("fcmTokens").doc(t.clientUsername).get();
      const token = tokDoc.exists ? tokDoc.data().token : null;
      if (!token) continue;

      const startDate = parseStartToDate(t.start);
      const bodyText = `Vaš termin je ${formatInBelgrade(startDate)}.`;

      const item = {
        user: t.clientUsername,
        eventId: docSnap.id,
        service: t.serviceName || t.usluga || null,
        startUTC: startDate.toISOString(),
        preview: bodyText,
      };
      if (debugMode) {
        item._debugType  = typeof t.start;
        item._debugKeys  = t.start && typeof t.start === "object" ? Object.keys(t.start) : null;
        item._debugStart = t.start;
      }
      results.push(item);

      if (!previewMode) {
        tasks.push(
          getMessaging()
            .send({
              token,
              data: {
                title: "Podsetnik",
                body: bodyText,
                click_action: "https://masaneils.vercel.app/istorija",
              },
            })
            .then(() => { sent += 1; })
        );
      }
    }

    if (!previewMode && tasks.length) await Promise.allSettled(tasks);

    return res.status(200).json({
      ok: true,
      window: { from: fromUTC.toISOString(), to: toUTC.toISOString() },
      sent: previewMode ? 0 : sent,
      previewMode,
      debugMode,
      results,
    });
  } catch (err) {
    console.error("Cron error:", err);
    return res.status(500).json({ ok: false, error: err?.message || String(err) });
  }
}
