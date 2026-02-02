import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "troque-essa-chave-depois";

export default function auth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) return res.status(401).json({ error: "Sem token" });

  try {
    req.user = jwt.verify(token, JWT_SECRET); // { email }
    return next();
  } catch (e) {
    return res.status(401).json({ error: "Token inválido" });
  }
}
