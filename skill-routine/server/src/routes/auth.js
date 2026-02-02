import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { run, get } from "../../db.js";

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "troque-essa-chave-depois";

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function defaultState() {
  const SKILL_IDS = [
    "determinacao","inteligencia","disciplina","organizacao","saude","energia","criatividade","social"
  ];
  const skills = {};
  for (const id of SKILL_IDS) skills[id] = { level: 1, xp: 0 };
  return { createdAt: Date.now(), skills, dailyEarned: {}, questsByDay: {}, log: [] };
}

router.post("/register", async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || "");

    if (!email || !email.includes("@")) return res.status(400).json({ error: "Email inválido" });
    if (password.length < 4) return res.status(400).json({ error: "Senha muito curta (mín 4)" });

    const passwordHash = bcrypt.hashSync(password, 10);
    const now = Date.now();

    await run(
      `INSERT INTO users (email, password_hash, created_at, updated_at) VALUES (?,?,?,?)`,
      [email, passwordHash, now, now]
    );

    const user = await get(`SELECT id, email FROM users WHERE email = ?`, [email]);

    await run(
      `INSERT INTO states (user_id, state_json, updated_at) VALUES (?,?,?)`,
      [user.id, JSON.stringify(defaultState()), now]
    );

    const token = jwt.sign({ email }, JWT_SECRET, { expiresIn: "30d" });
    return res.json({ token, email });
  } catch (e) {
    if (String(e?.message || "").includes("UNIQUE")) {
      return res.status(409).json({ error: "Email já cadastrado" });
    }
    console.error(e);
    return res.status(500).json({ error: "Erro no servidor" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || "");

    const user = await get(`SELECT id, email, password_hash FROM users WHERE email = ?`, [email]);
    if (!user) return res.status(401).json({ error: "Usuário ou senha inválidos" });

    const ok = bcrypt.compareSync(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: "Usuário ou senha inválidos" });

    const token = jwt.sign({ email }, JWT_SECRET, { expiresIn: "30d" });
    return res.json({ token, email });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Erro no servidor" });
  }
});

export default router;
