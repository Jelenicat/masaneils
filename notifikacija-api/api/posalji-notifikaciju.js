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

/* ----------------- handler ----------------- */
export default async function handler(req, res) {
  if (!applyCors(req, res)) return;

  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  // ⬇⬇⬇ PROŠIRENO: dodati type i dateKeys
  const {
    korisnickoIme,
    title,
    body,
    click_action,
    type,           // npr. "proposal_to_admin" | "proposal_to_user" | "no_slot" | "confirmed"
    dateKeys = [],  // npr. ["2025-09-24", "2025-09-25"] (datumi predloga)
  } = req.body || {};

  if (!korisnickoIme) {
    return res.status(400).json({ error: "Nedostaje korisnickoIme u zahtevu." });
  }

  let token; // da imamo vrednost dostupnu u catch-u

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

    /* ---------- odredi odredišnu rutu ---------- */
    let finalClickAction = (click_action && String(click_action).trim()) || null;

    if (!finalClickAction) {
      if (type === "proposal_to_admin") {
        // korisnik poslao predloge → otvori admin kalendar za odgovarajuću nedelju
        const wk = dateKeys.length ? mondayOf(dateKeys[0]) : null;
        finalClickAction = wk ? `/admin/calendar?week=${wk}` : `/admin/calendar`;
      } else if (type === "proposal_to_user" || type === "no_slot") {
        // predlozi koje masa šalje korisniku / poruka da nema termina
        finalClickAction = `/ponudjeni/${encodeURIComponent(korisnickoIme)}`;
      } else if (type === "confirmed") {
        // potvrđen termin → istorija (po tvojoj logici)
        finalClickAction = `/istorija`;
      } else {
        // generalni fallback
        finalClickAction = `/ponudjeni/${encodeURIComponent(korisnickoIme)}`;
      }
    }

    // Ako je apsolutni URL, ostavi ga; u suprotnom šaljemo relativnu rutu.
    const isAbsolute = /^https?:\/\//i.test(finalClickAction);
    const outboundClick = isAbsolute ? finalClickAction : finalClickAction;

    // Dodatno: pošalji i weekKey da SW/app može lako da pročita
    const weekKey =
      type === "proposal_to_admin" && dateKeys.length ? mondayOf(dateKeys[0]) : "";

    /* ---------- slanje poruke ---------- */
    await getMessaging().send({
      token,
      // data-only poruka; SW i/ili foreground listener prikazuje i navigira
      data: {
        title: title || "Obaveštenje",
        body: body || "",

        // više polja zbog različitih tumačenja na klijentu/SW
        click_action: outboundClick,
        url: outboundClick,
        link: outboundClick,

        // metapodaci
        type: type || "",
        korisnickoIme: korisnickoIme || "",
        weekKey, // npr. "2025-09-22" za admin calendar
      },
    });

    console.log("✅ Notifikacija poslata:", { korisnickoIme, type, outboundClick, weekKey });
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("❌ Greška pri slanju notifikacije:", error);

    // 🧹 ukloni nevažeći token
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
