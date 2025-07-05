// api/posalji-notifikaciju.js
import admin from "firebase-admin";
import { cert } from "firebase-admin/app";
import serviceAccount from "../firebase-service-account.json"; // Pomeraj korak

if (!admin.apps.length) {
  admin.initializeApp({
    credential: cert(serviceAccount),
  });
}

export default async function handler(req, res) {
  if (req.method === "POST") {
    const { token, title, body } = req.body;

    try {
      await admin.messaging().send({
        token,
        notification: {
          title,
          body,
        },
      });

      return res.status(200).json({ success: true });
    } catch (err) {
      console.error("❌ Greška:", err);
      return res.status(500).json({ error: err.message });
    }
  }

  res.setHeader("Allow", ["POST"]);
  return res.status(405).end(`Method ${req.method} Not Allowed`);
}
