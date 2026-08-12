module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  const publicKey = process.env.MP_PUBLIC_KEY;
  if (!publicKey) {
    return res.status(500).json({ error: "Falta configurar MP_PUBLIC_KEY en Vercel." });
  }
  res.setHeader("Cache-Control", "no-store");
  return res.status(200).json({ publicKey });
};
