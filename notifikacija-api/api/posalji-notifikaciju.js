import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";

/* ---------------- CORS ---------------- */
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

/* -------- helper: ponedeljak iz datuma (YYYY-MM-DD) -------- */
function mondayOf(d) {
  const x = new Date(d);
  const diff = (x.getDay() + 6) % 7; // 0=ned->6, 1=pon->0
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - diff);
  const yyyy = x.getFullYear();
  const mm = String(x.getMonth() + 1).padStart(2, "0");
  const dd = String(x.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/* ------------- Firebase Admin init ------------- */
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

/* ---- mapiranje linka po tipu (A i B su striktno razdvojeni) ---- */
function makeDeepLinkByType({ type, korisnickoIme, dateKeys }) {
  switch (type) {
    case "proposal_to_admin": {
      // A) korisnik poslao predloge → masa (admin) otvara nedelju
      const wk = Array.isArray(dateKeys) && dateKeys.length ? mondayOf(dateKeys[0]) : null;
      return wk ? `/admin/calendar?week=${wk}` : `/admin/calendar`;
    }
    case "proposal_to_user": {
      // B) masa poslala predloge korisniku → otvara /ponudjeni/:korisnickoIme
      return `/ponudjeni/${encodeURIComponent(korisnickoIme)}`;
    }
    case "no_slot": {
      // nema slobodnog termina → korisniku pokaži istu stranicu gde dobija info/predloge
      return `/ponudjeni/${encodeURIComponent(korisnickoIme)}`;
    }
    case "confirmed": {
      // potvrđen termin → gde želiš (primer: istorija)
      return `/istorija`;
    }
    default: {
      // bezbedan fallback
      return `/ponudjeni/${encodeURIComponent(korisnickoIme)}`;
    }
  }
}

/* ----------------- handler ----------------- */
export default async function handler(req, res) {
  if (!applyCors(req, res)) return;

  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  // ⬇⬇⬇ PROŠIRENO: dodat type i dateKeys (ne mešamo A i B slučajeve)
  const {
    korisnickoIme,
    title,
    body,
    click_action,  // ako ručno proslediš, ima prioritet
    type,          // "proposal_to_admin" | "proposal_to_user" | "no_slot" | "confirmed"
    dateKeys = [], // npr. ["2025-09-24", "2025-09-25"]
  } = req.body || {};

  if (!korisnickoIme) {
    return res.status(400).json({ error: "Nedostaje korisnickoIme u zahtevu." });
  }

  let token;

  try {
    const { getFirestore } = await import("firebase-admin/firestore");
    const db = getFirestore();

    // 🔑 fcmTokens/{korisnickoIme} → { token }
    const docSnap = await db.collection("fcmTokens").doc(korisnickoIme).get();
    if (!docSnap.exists) {
      return res.status(404).json({ error: `Token not found for korisnickoIme: ${korisnickoIme}` });
    }
    token = docSnap.data()?.token;
    if (!token) {
      return res.status(404).json({ error: `Empty token for korisnickoIme: ${korisnickoIme}` });
    }

    // 1) odredi ciljnu rutu
    let finalClickAction = (click_action && String(click_action).trim()) || null;
    if (!finalClickAction) {
      finalClickAction = makeDeepLinkByType({ type, korisnickoIme, dateKeys });
    }

    // 2) ekstra meta (weekKey samo za proposal_to_admin)
    const weekKey = type === "proposal_to_admin" && dateKeys.length ? mondayOf(dateKeys[0]) : "";

    // 3) pošalji data-only FCM
    await getMessaging().send({
      token,
      data: {
        title: title || "Obaveštenje",
        body: body || "",
        // više polja zbog različitih klijentskih handlera
        click_action: finalClickAction,
        url: finalClickAction,
        link: finalClickAction,
        // meta
        type: type || "",
        korisnickoIme: korisnickoIme || "",
        weekKey, // npr. "2025-09-22" samo za proposal_to_admin
      },
    });

    console.log("✅ Notifikacija poslata:", { korisnickoIme, type, finalClickAction, weekKey });
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("❌ Greška pri slanju notifikacije:", error);

    // 🧹 ukloni nevažeći token ako je to uzrok
    if (error?.code === "messaging/registration-token-not-registered" && token) {
      try {
        const { getFirestore } = await import("firebase-admin/firestore");
        const db = getFirestore();

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
