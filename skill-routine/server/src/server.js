import express from "express";
import cors from "cors";
import path from "path";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { fileURLToPath } from "url";
import os from "os";
import fs from "fs";
import https from "https";
import { initDB, run, get, all } from "../db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Render / reverse proxy (ajuda com req.ip, https, etc.)
app.set("trust proxy", 1);

// ====== CONFIG ======
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "troque-essa-chave-depois";

// Se quiser travar CORS só no seu frontend, use ORIGINS no Render.
// Ex: ORIGINS="https://lipezin007.github.io,http://localhost:5500"
const ORIGINS = (process.env.ORIGINS || "")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: ORIGINS.length ? ORIGINS : true, // sem ORIGINS: libera geral (bom pra teste)
    credentials: true,
  })
);

app.use(express.json({ limit: "2mb" }));

// ====== DB ======
initDB();

// ====== Helpers ======
function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function normalizeUsername(username) {
  return String(username || "").trim();
}

function validUsername(username) {
  // letras/números/_ 2..20
  return /^[a-zA-Z0-9_]{2,20}$/.test(username);
}

// ====== Auth middleware ======
function auth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: "Sem token" });

    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload; // { email }
    return next();
  } catch {
    return res.status(401).json({ error: "Token inválido" });
  }
}

async function getAuthedUser(req) {
  const email = req.user.email;
  return await get(`SELECT id, email, username FROM users WHERE email = ?`, [email]);
}

// ====== Default state ======
function defaultState() {
  const SKILL_IDS = [
    "determinacao",
    "inteligencia",
    "disciplina",
    "organizacao",
    "saude",
    "energia",
    "criatividade",
    "social",
  ];

  const skills = {};
  for (const id of SKILL_IDS) skills[id] = { level: 1, xp: 0 };

  return {
    createdAt: Date.now(),
    skills,
    dailyEarned: {},
    questsByDay: {},
    log: [],
  };
}

// ====== ROUTES ======
app.get("/", (req, res) => {
  res.json({ status: "LevelUpLife API ONLINE" });
});

app.get("/health", (req, res) => res.json({ ok: true }));

// Register (com username)
app.post("/auth/register", async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || "");
    const username = normalizeUsername(req.body?.username);

    if (!username || !validUsername(username)) {
      return res.status(400).json({ error: "Nick inválido (2-20, letras/números/_)" });
    }
    if (!email || !email.includes("@")) {
      return res.status(400).json({ error: "Email inválido" });
    }
    if (password.length < 4) {
      return res.status(400).json({ error: "Senha muito curta (mín 4)" });
    }

    const passwordHash = bcrypt.hashSync(password, 10);
    const now = Date.now();

    await run(
      `INSERT INTO users (email, password_hash, username, created_at, updated_at)
       VALUES (?,?,?,?,?)`,
      [email, passwordHash, username, now, now]
    );

    const user = await get(`SELECT id, email, username FROM users WHERE email = ?`, [email]);

    await run(
      `INSERT INTO states (user_id, state_json, updated_at) VALUES (?,?,?)`,
      [user.id, JSON.stringify(defaultState()), now]
    );

    const token = jwt.sign({ email }, JWT_SECRET, { expiresIn: "30d" });
    res.json({ token, email: user.email, username: user.username });
  } catch (e) {
    const msg = String(e.message || "").toLowerCase();

    if (msg.includes("unique") && msg.includes("users.email")) {
      return res.status(409).json({ error: "Email já cadastrado" });
    }
    if (msg.includes("unique") && (msg.includes("username") || msg.includes("idx_users_username_nocase"))) {
      return res.status(409).json({ error: "Nick já está em uso" });
    }

    console.error(e);
    res.status(500).json({ error: "Erro no servidor" });
  }
});

// Login (retorna username)
app.post("/auth/login", async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || "");

    const user = await get(
      `SELECT id, email, username, password_hash FROM users WHERE email = ?`,
      [email]
    );
    if (!user) return res.status(401).json({ error: "Usuário ou senha inválidos" });

    const ok = bcrypt.compareSync(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: "Usuário ou senha inválidos" });

    const token = jwt.sign({ email }, JWT_SECRET, { expiresIn: "30d" });
    res.json({ token, email: user.email, username: user.username });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erro no servidor" });
  }
});

// Me
app.get("/api/me", auth, async (req, res) => {
  try {
    const me = await getAuthedUser(req);
    if (!me) return res.status(404).json({ error: "Conta não encontrada" });
    res.json({ email: me.email, username: me.username });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erro no servidor" });
  }
});

// State
app.get("/api/state", auth, async (req, res) => {
  try {
    const me = await getAuthedUser(req);
    if (!me) return res.status(404).json({ error: "Conta não encontrada" });

    const row = await get(`SELECT state_json FROM states WHERE user_id = ?`, [me.id]);
    const state = row?.state_json ? JSON.parse(row.state_json) : defaultState();
    res.json({ state });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erro no servidor" });
  }
});

app.put("/api/state", auth, async (req, res) => {
  try {
    const incoming = req.body?.state;
    if (!incoming || typeof incoming !== "object") {
      return res.status(400).json({ error: "state inválido" });
    }

    const me = await getAuthedUser(req);
    if (!me) return res.status(404).json({ error: "Conta não encontrada" });

    const now = Date.now();

    await run(
      `UPDATE states SET state_json = ?, updated_at = ? WHERE user_id = ?`,
      [JSON.stringify(incoming), now, me.id]
    );

    await run(`UPDATE users SET updated_at = ? WHERE id = ?`, [now, me.id]);

    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erro no servidor" });
  }
});

// ===== Friends: search list =====
// GET /api/users/search?q=fel
app.get("/api/users/search", auth, async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    if (q.length < 2) return res.json({ users: [] });

    const me = await getAuthedUser(req);
    if (!me) return res.status(404).json({ error: "Conta não encontrada" });

    const rows = await all(
      `SELECT id, username
       FROM users
       WHERE username LIKE ?
         AND id <> ?
       ORDER BY username
       LIMIT 10`,
      [`%${q}%`, me.id]
    );

    res.json({ users: rows.map(r => ({ id: r.id, username: r.username })) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erro no servidor" });
  }
});

// POST /api/friends/request { username }
app.post("/api/friends/request", auth, async (req, res) => {
  try {
    const toUsername = normalizeUsername(req.body?.username);
    if (!toUsername) return res.status(400).json({ error: "Nick inválido" });

    const me = await getAuthedUser(req);
    if (!me) return res.status(404).json({ error: "Conta não encontrada" });

    const target = await get(
      `SELECT id, username FROM users WHERE username = ? COLLATE NOCASE`,
      [toUsername]
    );
    if (!target) return res.status(404).json({ error: "Usuário não encontrado" });
    if (target.id === me.id) return res.status(400).json({ error: "Você não pode adicionar você mesmo" });

    const now = Date.now();

    // Se existe request contrário pendente, aceita automaticamente
    const opposite = await get(
      `SELECT id, status FROM friend_requests
       WHERE from_user_id = ? AND to_user_id = ?`,
      [target.id, me.id]
    );

    if (opposite && opposite.status === "pending") {
      await run(`UPDATE friend_requests SET status='accepted', updated_at=? WHERE id=?`, [now, opposite.id]);
      return res.json({ ok: true, status: "accepted", autoAccepted: true });
    }

    // Se já existe aceito em qualquer direção, evita duplicar
    const already = await get(
      `SELECT id FROM friend_requests
       WHERE status='accepted'
         AND ((from_user_id=? AND to_user_id=?) OR (from_user_id=? AND to_user_id=?))`,
      [me.id, target.id, target.id, me.id]
    );
    if (already) return res.json({ ok: true, status: "accepted" });

    // Cria pedido
    try {
      await run(
        `INSERT INTO friend_requests (from_user_id, to_user_id, status, created_at, updated_at)
         VALUES (?,?,?,?,?)`,
        [me.id, target.id, "pending", now, now]
      );
      res.json({ ok: true, status: "pending" });
    } catch (e) {
      // UNIQUE (já existe)
      const existing = await get(
        `SELECT status FROM friend_requests WHERE from_user_id=? AND to_user_id=?`,
        [me.id, target.id]
      );
      res.json({ ok: true, status: existing?.status || "pending" });
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erro no servidor" });
  }
});

// GET /api/friends/requests  (pendentes recebidos)
app.get("/api/friends/requests", auth, async (req, res) => {
  try {
    const me = await getAuthedUser(req);
    if (!me) return res.status(404).json({ error: "Conta não encontrada" });

    const rows = await all(
      `SELECT fr.id, u.username AS from_username, fr.created_at
       FROM friend_requests fr
       JOIN users u ON u.id = fr.from_user_id
       WHERE fr.to_user_id = ? AND fr.status = 'pending'
       ORDER BY fr.created_at DESC`,
      [me.id]
    );

    res.json({ requests: rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erro no servidor" });
  }
});

// POST /api/friends/respond { requestId, action: "accept"|"reject" }
app.post("/api/friends/respond", auth, async (req, res) => {
  try {
    const requestId = Number(req.body?.requestId);
    const action = String(req.body?.action || "");

    if (!Number.isFinite(requestId)) return res.status(400).json({ error: "requestId inválido" });
    if (!["accept", "reject"].includes(action)) return res.status(400).json({ error: "action inválida" });

    const me = await getAuthedUser(req);
    if (!me) return res.status(404).json({ error: "Conta não encontrada" });

    const row = await get(`SELECT id, to_user_id, status FROM friend_requests WHERE id = ?`, [requestId]);
    if (!row) return res.status(404).json({ error: "Pedido não encontrado" });
    if (row.to_user_id !== me.id) return res.status(403).json({ error: "Sem permissão" });

    const now = Date.now();
    const newStatus = action === "accept" ? "accepted" : "rejected";

    await run(`UPDATE friend_requests SET status=?, updated_at=? WHERE id=?`, [newStatus, now, requestId]);
    res.json({ ok: true, status: newStatus });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erro no servidor" });
  }
});

// GET /api/friends  (lista de amigos aceitos)
app.get("/api/friends", auth, async (req, res) => {
  try {
    const me = await getAuthedUser(req);
    if (!me) return res.status(404).json({ error: "Conta não encontrada" });

    const rows = await all(
      `SELECT
         CASE
           WHEN fr.from_user_id = ? THEN u2.username
           ELSE u1.username
         END AS friend_username
       FROM friend_requests fr
       JOIN users u1 ON u1.id = fr.from_user_id
       JOIN users u2 ON u2.id = fr.to_user_id
       WHERE fr.status = 'accepted'
         AND (fr.from_user_id = ? OR fr.to_user_id = ?)
       ORDER BY friend_username`,
      [me.id, me.id, me.id]
    );

    res.json({ friends: rows.map(r => r.friend_username) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erro no servidor" });
  }
});

// ===== Ranking (base futura): top por skill =====
// GET /api/rank/skills -> { skills: { determinacao: [{username,level},...], ... } }
app.get("/api/rank/skills", auth, async (req, res) => {
  try {
    // Pega states de todo mundo
    const rows = await all(
      `SELECT u.username, s.state_json
       FROM users u
       JOIN states s ON s.user_id = u.id`,
      []
    );

    const SKILLS = ["determinacao","inteligencia","disciplina","organizacao","saude","energia","criatividade","social"];
    const buckets = {};
    for (const sk of SKILLS) buckets[sk] = [];

    for (const r of rows) {
      let state;
      try { state = JSON.parse(r.state_json); } catch { state = null; }
      if (!state?.skills) continue;

      for (const sk of SKILLS) {
        const lvl = Number(state.skills?.[sk]?.level || 0);
        if (lvl > 0) buckets[sk].push({ username: r.username, level: lvl });
      }
    }

    // ordena e pega top 10
    for (const sk of SKILLS) {
      buckets[sk].sort((a, b) => b.level - a.level || a.username.localeCompare(b.username));
      buckets[sk] = buckets[sk].slice(0, 10);
    }

    res.json({ skills: buckets });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erro no servidor" });
  }
});

// GET /api/users/public?username=nick
app.get("/api/users/public", auth, async (req, res) => {
  try {
    const username = String(req.query.username || "").trim();
    if (!username) return res.status(400).json({ error: "username inválido" });

    const u = await get(
      `SELECT id, username FROM users WHERE username = ? COLLATE NOCASE`,
      [username]
    );
    if (!u) return res.status(404).json({ error: "Usuário não encontrado" });

    const row = await get(`SELECT state_json FROM states WHERE user_id = ?`, [u.id]);
    const state = row?.state_json ? JSON.parse(row.state_json) : null;

    const skills = state?.skills || {};
    const SKILLS = ["determinacao","inteligencia","disciplina","organizacao","saude","energia","criatividade","social"];

    // nível geral = soma dos níveis
    let overall = 0;
    for (const sk of SKILLS) overall += Number(skills?.[sk]?.level || 0);

    // top skill
    let topSkill = null;
    let topLevel = -1;
    for (const sk of SKILLS) {
      const lvl = Number(skills?.[sk]?.level || 0);
      if (lvl > topLevel) {
        topLevel = lvl;
        topSkill = sk;
      }
    }

    res.json({
      username: u.username,
      overallLevel: overall,
      topSkill,
      topSkillLevel: topLevel < 0 ? 0 : topLevel,
      skills: Object.fromEntries(SKILLS.map(sk => [sk, { level: Number(skills?.[sk]?.level || 0) }]))
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erro no servidor" });
  }
});

// ===== Static =====
const ROOT_DIR = path.join(__dirname, "..", "public");
const LEGACY_ASSETS_DIR = path.join(ROOT_DIR, "assets");

app.use(express.static(ROOT_DIR));
app.use("/assets", express.static(LEGACY_ASSETS_DIR));

app.get("/assets/logo.png", (req, res) =>
  res.sendFile(path.join(LEGACY_ASSETS_DIR, "img", "logo.png"))
);

app.get("/", (req, res) => res.sendFile(path.join(ROOT_DIR, "index.html")));
app.get("/login", (req, res) => res.sendFile(path.join(ROOT_DIR, "login.html")));
app.get("/app", (req, res) => res.sendFile(path.join(ROOT_DIR, "app.html")));

// ===== Start server =====
const HOST = process.env.HOST || "0.0.0.0";
const HTTPS_KEY_PATH =
  process.env.HTTPS_KEY || path.join(__dirname, "..", "certs", "key.pem");
const HTTPS_CERT_PATH =
  process.env.HTTPS_CERT || path.join(__dirname, "..", "certs", "cert.pem");

function getLanAddresses() {
  const nets = os.networkInterfaces();
  const results = [];

  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === "IPv4" && !net.internal) results.push(net.address);
    }
  }

  return Array.from(new Set(results));
}

function logLanUrls(port, protocol) {
  const lanIps = getLanAddresses();
  if (lanIps.length) {
    console.log("Acesse no celular usando:");
    for (const ip of lanIps) console.log(`- ${protocol}://${ip}:${port}`);
  } else {
    console.log("Não foi possível detectar IPs de rede local.");
  }
}

// Em PRODUÇÃO (Render), não tente HTTPS dentro do Node.
// O Render já fornece HTTPS externamente.
const isProd = process.env.NODE_ENV === "production";

// HTTPS local só quando explicitamente habilitado
const wantsHttps =
  process.env.HTTPS === "true" || process.env.HTTPS === "1";

const hasCerts =
  fs.existsSync(HTTPS_KEY_PATH) && fs.existsSync(HTTPS_CERT_PATH);

if (!isProd && wantsHttps && hasCerts) {
  // ===== DEV: HTTPS local =====
  const key = fs.readFileSync(HTTPS_KEY_PATH);
  const cert = fs.readFileSync(HTTPS_CERT_PATH);

  https.createServer({ key, cert }, app).listen(PORT, HOST, () => {
    const localUrl = `https://localhost:${PORT}`;
    console.log(`Servidor HTTPS (DEV) rodando em ${localUrl} (host: ${HOST})`);
    logLanUrls(PORT, "https");
  });
} else {
  // ===== PROD (Render) + DEV normal (HTTP) =====
  app.listen(PORT, "0.0.0.0", () => {
    const localUrl = `http://localhost:${PORT}`;
    console.log(`🚀 API LevelUpLife rodando na porta ${PORT}`);
    if (!isProd) logLanUrls(PORT, "http");
  });
}