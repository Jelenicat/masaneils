// utils/cors.js
export default function applyCors(req, res) {
  res.setHeader("Access-Control-Allow-Credentials", "true"); // ✅ vrednost mora biti string "true"
  res.setHeader("Access-Control-Allow-Origin", "https://masaneils.vercel.app"); // ✅ specifična vrednost
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET,OPTIONS,PATCH,DELETE,POST,PUT"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Content-Type, Authorization"
  );

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return false;
  }

  return true;
}
