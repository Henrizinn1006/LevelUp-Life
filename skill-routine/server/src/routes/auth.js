import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { run, get } from "../../db.js"; // ajuste caminho se o seu for diferente

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || "troque-essa-chave-depois";

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function normalizeUsername(username) {
  return String(username || "").trim();
}

function validUsername(username) {
  return /^[a-zA-Z0-9_]{2,20}$/.test(username);
}

router.post("/register", async (req, res) => {
  try {
    const username = normalizeUsername(req.body.username);
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || "");

    if (!validUsername(username)) return res.status(400).json({ error: "Nick inválido (2-20, letras/números/_)" });
    if (!email.includes("@")) return res.status(400).json({ error: "Email inválido" });
    if (password.length < 4) return res.status(400).json({ error: "Senha muito curta (mín 4)" });

    const existsEmail = await get("SELECT id FROM users WHERE email = $1", [email]);
    if (existsEmail) return res.status(409).json({ error: "Email já cadastrado" });

    const existsUser = await get("SELECT id FROM users WHERE username = $1", [username]);
    if (existsUser) return res.status(409).json({ error: "Nick já em uso" });

    const hash = await bcrypt.hash(password, 10);

    const r = await run(
      "INSERT INTO users (email, username, password) VALUES ($1, $2, $3) RETURNING id, email, username",
      [email, username, hash]
    );

    const user = r.rows?.[0];
    const token = jwt.sign({ email: user.email }, JWT_SECRET, { expiresIn: "30d" });

    return res.json({ ok: true, token, user: { id: user.id, email: user.email, username: user.username } });
  } catch (e) {
    console.error("REGISTER ERROR:", e);
    return res.status(500).json({ error: "Erro no servidor" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || "");

    if (!email.includes("@")) return res.status(400).json({ error: "Email inválido" });
    if (password.length < 4) return res.status(400).json({ error: "Senha muito curta (mín 4)" });

    const user = await get("SELECT id, email, username, password FROM users WHERE email = $1", [email]);
    if (!user) return res.status(401).json({ error: "Usuário não encontrado" });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ error: "Senha incorreta" });

    const token = jwt.sign({ email: user.email }, JWT_SECRET, { expiresIn: "30d" });
    return res.json({ ok: true, token, user: { id: user.id, email: user.email, username: user.username } });
  } catch (e) {
    console.error("LOGIN ERROR:", e);
    return res.status(500).json({ error: "Erro no servidor" });
  }
});

export default router;
