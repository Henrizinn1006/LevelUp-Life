import express from "express";
import cors from "cors";
import path from "path";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { fileURLToPath } from "url";
import { initDB, run, get, all } from "../db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.set("trust proxy", 1);

// ================= CONFIG =================
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "troque-essa-chave-depois";

const ORIGINS = (process.env.ORIGINS || "")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: ORIGINS.length ? ORIGINS : true,
    credentials: true,
  })
);

app.use(express.json({ limit: "2mb" }));

// ================= HELPERS =================
function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function normalizeUsername(username) {
  return String(username || "").trim();
}

function validUsername(username) {
  return /^[a-zA-Z0-9_]{2,20}$/.test(username);
}

function defaultState() {
  const SKILLS = [
    "determinacao","inteligencia","disciplina","organizacao",
    "saude","energia","criatividade","social"
  ];

  const skills = {};
  for (const s of SKILLS) skills[s] = { level: 1, xp: 0 };

  return {
    createdAt: Date.now(),
    skills,
    dailyEarned: {},
    questsByDay: {},
    log: [],
  };
}

// ================= AUTH =================
function auth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: "Sem token" });

    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ error: "Token inválido" });
  }
}

async function getAuthedUser(req) {
  return await get(
    "SELECT id, email, username FROM users WHERE email = $1",
    [req.user.email]
  );
}

// ================= BASIC =================
app.get("/", (req, res) =>
  res.json({ status: "LevelUpLife API ONLINE" })
);

app.get("/health", (req, res) =>
  res.json({ ok: true })
);

// ================= AUTH ROUTES =================
app.post("/auth/register", async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const username = normalizeUsername(req.body?.username);
    const password = String(req.body?.password || "");

    if (!validUsername(username))
      return res.status(400).json({ error: "Nick inválido" });
    if (!email.includes("@"))
      return res.status(400).json({ error: "Email inválido" });
    if (password.length < 4)
      return res.status(400).json({ error: "Senha muito curta" });

    const exists = await get(
      "SELECT id FROM users WHERE email = $1 OR username = $2",
      [email, username]
    );
    if (exists)
      return res.status(409).json({ error: "Usuário já existe" });

    const hash = bcrypt.hashSync(password, 10);

    const r = await run(
      `INSERT INTO users (email, username, password)
       VALUES ($1,$2,$3)
       RETURNING id,email,username`,
      [email, username, hash]
    );

    const user = r.rows[0];

    await run(
      `INSERT INTO states (user_id, state)
       VALUES ($1,$2)
       ON CONFLICT (user_id)
       DO UPDATE SET state = EXCLUDED.state`,
      [user.id, defaultState()]
    );

    const token = jwt.sign({ email }, JWT_SECRET, { expiresIn: "30d" });
    res.json({ token, email, username });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erro no servidor" });
  }
});

app.post("/auth/login", async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || "");

    const user = await get(
      "SELECT email, username, password FROM users WHERE email = $1",
      [email]
    );
    if (!user) return res.status(401).json({ error: "Credenciais inválidas" });

    if (!bcrypt.compareSync(password, user.password))
      return res.status(401).json({ error: "Credenciais inválidas" });

    const token = jwt.sign({ email }, JWT_SECRET, { expiresIn: "30d" });
    res.json({ token, email: user.email, username: user.username });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erro no servidor" });
  }
});

// ================= STATE =================
app.get("/api/state", auth, async (req, res) => {
  const me = await getAuthedUser(req);
  const row = await get("SELECT state FROM states WHERE user_id = $1", [me.id]);
  res.json({ state: row?.state || defaultState() });
});

app.put("/api/state", auth, async (req, res) => {
  const me = await getAuthedUser(req);
  await run(
    `INSERT INTO states (user_id, state)
     VALUES ($1,$2)
     ON CONFLICT (user_id)
     DO UPDATE SET state = EXCLUDED.state`,
    [me.id, req.body.state]
  );
  res.json({ ok: true });
});

// ✅ Quem sou eu (para o dashboard)
app.get("/auth/me", auth, async (req, res) => {
  try {
    const me = await getAuthedUser(req); // {id,email,username}
    if (!me) return res.status(404).json({ error: "Usuário não encontrado" });
    res.json(me);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erro no servidor" });
  }
});

// ================= FRIENDS =================
app.get("/api/users/search", auth, async (req, res) => {
  const q = String(req.query.q || "").trim();
  if (q.length < 2) return res.json({ users: [] });

  const me = await getAuthedUser(req);
  const rows = await all(
    `SELECT id, username FROM users
     WHERE username ILIKE $1 AND id <> $2
     ORDER BY username LIMIT 10`,
    [`%${q}%`, me.id]
  );

  res.json({ users: rows });
});

app.post("/api/friends/request", auth, async (req, res) => {
  const me = await getAuthedUser(req);
  const target = await get(
    "SELECT id FROM users WHERE username ILIKE $1",
    [req.body.username]
  );
  if (!target) return res.status(404).json({ error: "Usuário não encontrado" });

  const opposite = await get(
    "SELECT id FROM friend_requests WHERE from_user=$1 AND to_user=$2",
    [target.id, me.id]
  );

  if (opposite) {
    await run(
      "INSERT INTO friends (user_id,friend_id) VALUES ($1,$2),($2,$1) ON CONFLICT DO NOTHING",
      [me.id, target.id]
    );
    await run("DELETE FROM friend_requests WHERE id=$1", [opposite.id]);
    return res.json({ status: "accepted" });
  }

  await run(
    "INSERT INTO friend_requests (from_user,to_user) VALUES ($1,$2) ON CONFLICT DO NOTHING",
    [me.id, target.id]
  );
  res.json({ status: "pending" });
});

app.get("/api/friends", auth, async (req, res) => {
  const me = await getAuthedUser(req);
  const rows = await all(
    `SELECT u.username
     FROM friends f JOIN users u ON u.id=f.friend_id
     WHERE f.user_id=$1 ORDER BY u.username`,
    [me.id]
  );
  res.json({ friends: rows.map(r => r.username) });
});

// ================= STATIC =================
const ROOT = path.join(__dirname, "..", "public");
app.use(express.static(ROOT));

app.get("/login", (_, res) => res.sendFile(path.join(ROOT, "login.html")));
app.get("/app", (_, res) => res.sendFile(path.join(ROOT, "app.html")));

// ================= START =================
async function start() {
  await initDB();

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 LevelUpLife API rodando na porta ${PORT}`);
  });
}

start().catch(err => {
  console.error("Falha ao iniciar:", err);
  process.exit(1);
});
