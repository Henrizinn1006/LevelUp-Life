import express from "express";
import { run, get } from "../../db.js";
import auth from "../middlewares/auth.js";

const router = express.Router();

function defaultState() {
  const SKILL_IDS = [
    "determinacao","inteligencia","disciplina","organizacao","saude","energia","criatividade","social"
  ];
  const skills = {};
  for (const id of SKILL_IDS) skills[id] = { level: 1, xp: 0 };
  return { createdAt: Date.now(), skills, dailyEarned: {}, questsByDay: {}, log: [] };
}

router.get("/state", auth, async (req, res) => {
  try {
    const email = req.user.email;

    const user = await get("SELECT id FROM users WHERE email = $1", [email]);
    if (!user) return res.status(404).json({ error: "Conta não encontrada" });

    const row = await get("SELECT state_json FROM states WHERE user_id = $1", [user.id]);
    const state = row?.state_json ? JSON.parse(row.state_json) : defaultState();

    return res.json({ state });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Erro no servidor" });
  }
});

router.put("/state", auth, async (req, res) => {
  try {
    const email = req.user.email;
    const incoming = req.body?.state;

    if (!incoming || typeof incoming !== "object") {
      return res.status(400).json({ error: "state inválido" });
    }

    const user = await get("SELECT id FROM users WHERE email = $1", [email]);
    if (!user) return res.status(404).json({ error: "Conta não encontrada" });

    const now = Date.now();

    await run(
      `UPDATE states SET state_json = ?, updated_at = ? WHERE user_id = ?`,
      [JSON.stringify(incoming), now, user.id]
    );

    await run(`UPDATE users SET updated_at = ? WHERE id = ?`, [now, user.id]);

    return res.json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Erro no servidor" });
  }
});

export default router;
