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

// Prozor: sutra (UTC)
function tomorrowWindowInUTC(now = new Date()) {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const d = now.getUTCDate();
  const start = new Date(Date.UTC(y, m, d + 1, 0, 0, 0, 0));
  const end   = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate(), 23, 59, 59, 999));
  return { fromUTC: start, toUTC: end };
}

// Prozor: tačan dan iz ?date=YYYY-MM-DD (UTC)
function dayWindowUTCFromISO(iso) {
  const [y, m, d] = (iso || "").split("-").map(Number);
  if (!y || !m || !d) return null;
  const start = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
  const end   = new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999));
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

// ---------- Robustan parser za t.start ----------
function parseHumanFirestoreString(s) {
  // Primer: "September 22, 2025 at 10:30:00 AM UTC+2"
  const re = /^([A-Za-z]+ \d{1,2}, \d{4}) at (\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)\s+UTC([+-]\d{1,2})$/;
  const m = re.exec(String(s).trim());
  if (!m) return null;

  const [, datePart, hhStr, mmStr, ssStr = "0", ampm, utcOffStr] = m;
  let hh = Number(hhStr);
  const mm = Number(mmStr);
  const ss = Number(ssStr);

  // 12h → 24h
  const upper = ampm.toUpperCase();
  if (upper === "AM") {
    if (hh === 12) hh = 0;
  } else {
    if (hh !== 12) hh += 12;
  }

  // Uzmemo offset sati iz "UTC+2"
  const offsetHours = Number(utcOffStr); // npr. +2 ili -1

  // Napravimo Date kao da je u toj zoni, pa preračunamo u UTC
  const dateOnly = new Date(datePart); // parsira u lokalnom TZ – zato odmah konstruišemo UTC ručno ispod
  if (Number.isNaN(dateOnly.getTime())) return null;
  const y = dateOnly.getFullYear();
  const mth = dateOnly.getMonth();
  const day = dateOnly.getDate();

  // Vreme u "lokalnom" offsetu → prvo računamo "lokalno", pa oduzmemo offset
  const msLocal = Date.UTC(y, mth, day, hh, mm, ss, 0);
  const msUTC = msLocal - offsetHours * 3600 * 1000;
  return new Date(msUTC);
}

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

    // String sa "UTC+/-N" (kako ga često vidiš u Firestore konzoli)
    if (typeof start === "string" && /UTC[+-]\d{1,2}\s*$/.test(start)) {
      const d = parseHumanFirestoreString(start);
      if (d && !Number.isNaN(d.getTime())) return d;
    }

    // ISO / Date / ms
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

    const q = (x) => (x ?? "").toString().toLowerCase();
    const previewMode = q(req.query?.preview) === "1" || q(req.query?.preview) === "true";
    const debugMode   = q(req.query?.debug)   === "1" || q(req.query?.debug)   === "true";

    // Opcioni filter korisnika (?user=_belluci_)
    const userFilter = (req.query?.user || "").toString();

    // Prozor: ?date=YYYY-MM-DD ili sutra (UTC)
    const dateParam = (req.query?.date || "").toString();
    let windowRange = dateParam ? dayWindowUTCFromISO(dateParam) : null;
    if (!windowRange) windowRange = tomorrowWindowInUTC(new Date());
    const { fromUTC, toUTC } = windowRange;

    // Čitamo sve termine i filtriramo u kodu
    const snap = await db
      .collection("admin_kalendar")
      .where("tip", "==", "termin")
      .get();

    let sent = 0;
    const tasks = [];
    const results = [];  // kome bismo poslali
    const skipped = [];  // koga smo preskočili i zašto (debug)

    for (const docSnap of snap.docs) {
      const t = docSnap.data();
      const id = docSnap.id;

      if (!t?.clientUsername) {
        if (debugMode) skipped.push({ id, reason: "no_clientUsername" });
        continue;
      }
      if (userFilter && t.clientUsername !== userFilter) continue;

      const startDate = parseStartToDate(t.start);
      if (!startDate || Number.isNaN(startDate.getTime())) {
        if (debugMode) skipped.push({ id, user: t.clientUsername, reason: "bad_start", start: t.start ?? null });
        continue;
      }

      // dnevni prozor u UTC
      if (startDate < fromUTC || startDate > toUTC) {
        if (debugMode) skipped.push({
          id,
          user: t.clientUsername,
          reason: "out_of_window",
          startUTC: startDate.toISOString()
        });
        continue;
      }

      // FCM token
      const tokDoc = await db.collection("fcmTokens").doc(t.clientUsername).get();
      const token = tokDoc.exists ? tokDoc.data().token : null;
      if (!token) {
        if (debugMode) skipped.push({ id, user: t.clientUsername, reason: "no_token" });
        continue;
      }

      const serviceName = t.serviceName || t.usluga || null;
      const whenTxt = formatInBelgrade(startDate);
      const bodyText = serviceName
        ? `Imate termin (${serviceName}) sutra (${whenTxt}).`
        : `Imate termin sutra (${whenTxt}).`;

      results.push({
        user: t.clientUsername,
        eventId: id,
        service: serviceName,
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
      debugMode,
      results,
      skipped, // koristan pregled u debug modu
    });
  } catch (err) {
    console.error("Cron daily error:", err);
    return res.status(500).json({ ok: false, error: err?.message || String(err) });
  }
}
