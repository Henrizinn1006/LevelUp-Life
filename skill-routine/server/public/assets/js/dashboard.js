// server/public/assets/js/dashboard.js

const $ = (id) => document.getElementById(id);

const btnLogout = $("btnLogout");

const activityEl = $("activity");
const minutesEl = $("minutes");
const difficultyEl = $("difficulty");
const nodEl = $("nodistraction");
const btnComplete = $("btnComplete");

const dayInfoEl = $("dayInfo");
const btnNewQuests = $("btnNewQuests");
const btnReset = $("btnReset");

const questsEl = $("quests");
const logEl = $("log");
const skillsEl = $("skills");
const radar = $("radar");

const xpModal = $("xpModal");
const xpText = $("xpText");
const xpOk = $("xpOk");

const TOKEN_KEY = "skillRoutine_token";
const API_URL = window.location.origin;

function withApiUrl(path) {
  if (!path) return API_URL;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${API_URL}${path.startsWith("/") ? "" : "/"}${path}`;
}

// ===== Amigos (UI) =====
const friendNickEl = $("friendNick");
const btnAddFriend = $("btnAddFriend");
const friendSuggestionsEl = $("friendSuggestions");
const friendRequestsEl = $("friendRequests");
const friendsListEl = $("friendsList");
const friendsMsgEl = $("friendsMsg");

// ===== Ranking (UI) =====
const personalRankEl = $("personalRank");
const rankSkillEl = $("rankSkill");
const btnRefreshRank = $("btnRefreshRank");
const rankListEl = $("rankList");
const rankMsgEl = $("rankMsg");

// Atividades reais -> qual skill principal elas treinam
const ACTIVITIES = [
  { id: "estudar", label: "Estudar", skill: "inteligencia" },
  { id: "treinar", label: "Treinar (musculação)", skill: "saude" },
  { id: "cardio", label: "Cardio / corrida", skill: "energia" },
  { id: "leitura", label: "Leitura", skill: "determinacao" },
  { id: "meditacao", label: "Meditação", skill: "disciplina" },
  { id: "organizacao", label: "Organizar rotina / casa", skill: "organizacao" },
  { id: "criativo", label: "Projeto criativo", skill: "criatividade" },
  { id: "social", label: "Socializar / networking", skill: "social" },
  { id: "trabalho", label: "Trabalho profundo", skill: "determinacao" },
];

const activitySkillMap = {
  "Estudar": {
    inteligencia: 1.0,
    determinacao: 0.6,
    disciplina: 0.4,
  },
  "Treinar (musculação)": {
    saude: 1.0,
    disciplina: 0.5,
    energia: 0.4,
  },
  "Cardio / corrida": {
    saude: 1.0,
    energia: 0.6,
    disciplina: 0.3,
  },
  "Leitura": {
    inteligencia: 0.7,
    determinacao: 0.5,
  },
  "Meditação": {
    determinacao: 1.0,
    energia: 0.6,
    saude: 0.4,
  },
  "Projeto criativo": {
    criatividade: 1.0,
    determinacao: 0.5,
    disciplina: 0.3,
  },
  "Organizar rotina / casa": {
    organizacao: 1.0,
    disciplina: 0.6,
  },
  "Socializar / networking": {
    social: 1.0,
    energia: 0.4,
  },
  "Trabalho profundo": {
    determinacao: 1.0,
    disciplina: 0.8,
    inteligencia: 0.4,
  },
};

const SKILLS = ["determinacao","inteligencia","disciplina","organizacao","saude","energia","criatividade","social"];
const MAX_LEVEL = 20;

// ===== Conquistas (localStorage) =====
const ACHIEVEMENTS = [
  { id: "first_activity", text: "Primeira atividade concluída" },
  { id: "focus_10", text: "10 atividades de determinação" },
  { id: "study_5", text: "5 dias desenvolvendo inteligência" },
];

function getToken() {
  return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
}

function authHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function todayKey(ts = Date.now()) {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
}

function defaultState() {
  const skills = {};
  for (const id of SKILLS) skills[id] = { level: 1, xp: 0 };

  return {
    createdAt: Date.now(),
    skills,
    dailyEarned: {},
    questsByDay: {},
    log: [],
  };
}

function migrateStateSkills(state) {
  if (!state || typeof state !== "object") return state;

  state.skills ||= {};

  if (state.skills.foco && !state.skills.determinacao) {
    state.skills.determinacao = state.skills.foco;
  }
  if (state.skills.estudo && !state.skills.inteligencia) {
    state.skills.inteligencia = state.skills.estudo;
  }

  delete state.skills.foco;
  delete state.skills.estudo;

  for (const id of SKILLS) {
    if (!state.skills[id]) state.skills[id] = { level: 1, xp: 0 };
  }

  if (Array.isArray(state.log)) {
    for (const entry of state.log) {
      if (entry?.skill === "foco") entry.skill = "determinacao";
      if (entry?.skill === "estudo") entry.skill = "inteligencia";

      if (entry?.gainedBySkill && typeof entry.gainedBySkill === "object") {
        const mapped = {};
        for (const [k, v] of Object.entries(entry.gainedBySkill)) {
          const nk = k === "foco" ? "determinacao" : k === "estudo" ? "inteligencia" : k;
          mapped[nk] = (Number(mapped[nk]) || 0) + (Number(v) || 0);
        }
        entry.gainedBySkill = mapped;
      }
    }
  }

  return state;
}

async function apiGet(url) {
  const res = await fetch(withApiUrl(url), { headers: { ...authHeaders() } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Erro na API");
  return data;
}

async function apiPost(url, body) {
  const res = await fetch(withApiUrl(url), {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Erro na API");
  return data;
}

async function apiPut(url, body) {
  const res = await fetch(withApiUrl(url), {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Erro na API");
  return data;
}

function showXP(textOrAmount) {
  const text = typeof textOrAmount === "number" ? `+${textOrAmount} XP` : String(textOrAmount);

  const el = document.createElement("div");
  el.className = "xp-float";
  el.innerText = text;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1300);

  if (!xpModal) return;
  xpText.textContent = text;
  xpModal.classList.remove("hidden");
}

function showXPHTML(html) {
  const el = document.createElement("div");
  el.className = "xp-float";
  el.innerHTML = html;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1500);

  if (!xpModal) return;
  xpText.innerHTML = html;
  xpModal.classList.remove("hidden");
}

function hideXP() {
  if (!xpModal) return;
  xpModal.classList.add("hidden");
}

function unlockAchievement(id) {
  const unlocked = JSON.parse(localStorage.getItem("achievements") || "[]");
  if (unlocked.includes(id)) return;

  unlocked.push(id);
  localStorage.setItem("achievements", JSON.stringify(unlocked));
  showAchievementPopup(id);
}

function showAchievementPopup(id) {
  const map = {
    first_activity: "🏆 Primeira atividade!",
    focus_10: "🧠 Determinação nível mestre!",
    study_5: "🧠 Consistência na inteligência!",
  };

  const el = document.createElement("div");
  el.className = "xp-float";
  el.innerText = map[id] || "🏆 Conquista desbloqueada!";
  document.body.appendChild(el);

  setTimeout(() => el.remove(), 1500);
}

function countActivitiesBySkill(state, skillId) {
  return state?.log?.filter((l) => l.skill === skillId).length || 0;
}

function countStudyDays(state) {
  const days = new Set();
  for (const l of state?.log || []) {
    if (l.skill === "inteligencia") days.add(todayKey(l.at));
  }
  return days.size;
}

function getRadarValue(skill) {
  return Math.min(MAX_LEVEL, skill.level + (skill.xp / xpToNext(skill.level)));
}

function skillLabel(id) {
  const map = {
    determinacao: "Determinação",
    inteligencia: "Inteligência",
    disciplina: "Disciplina",
    organizacao: "Organização",
    saude: "Saúde",
    energia: "Energia",
    criatividade: "Criatividade",
    social: "Social",
  };
  return map[id] || id;
}

// ===== Rank pessoal: nível geral + título =====
// "nível geral" = soma dos níveis de todas as skills
function overallLevel(state) {
  let sum = 0;
  for (const sk of SKILLS) sum += Number(state?.skills?.[sk]?.level || 0);
  return sum;
}

function personalTitle(totalLevel) {
  // você pode editar essa tabela à vontade
  const tiers = [
    { min: 0,  title: "Beta" },
    { min: 10, title: "Iniciante" },
    { min: 20, title: "Em progresso" },
    { min: 35, title: "Intermediário" },
    { min: 50, title: "Avançado" },
    { min: 70, title: "Elite" },
    { min: 100, title: "Alfa" },
    { min: 130, title: "Lendário" },
    { min: 170, title: "mestre" },
    { min: 220, title: "aura ♾️" },
  ];

  let best = tiers[0];
  for (const t of tiers) if (totalLevel >= t.min) best = t;
  const next = tiers.find(t => t.min > best.min) || null;

  return { current: best.title, nextMin: next?.min ?? null, nextTitle: next?.title ?? null };
}

function renderPersonalRank(state, username) {
  if (!personalRankEl) return;

  const total = overallLevel(state);
  const t = personalTitle(total);

  const nextText = t.nextMin
    ? `Próximo: ${t.nextTitle} no nível ${t.nextMin}`
    : `Topo máximo alcançado`;

  personalRankEl.innerHTML = `
    <div class="rank-badge">
      <div class="title">${t.current}</div>
      <div class="meta">${username ? `@${username} • ` : ""}Nível geral: ${total}</div>
      <div class="meta">${nextText}</div>
    </div>
  `;
}

// ===== XP/Level =====
function xpToNext(level) {
  return 100 + (level - 1) * 40;
}

function addXP(skill, amount) {
  skill.xp += amount;
  while (skill.xp >= xpToNext(skill.level)) {
    skill.xp -= xpToNext(skill.level);
    skill.level += 1;
  }
}

function aplicarXPAtividade(atividadeLabel, xpBase) {
  const skills = activitySkillMap[atividadeLabel];
  if (!skills) {
    console.warn("Atividade sem skills mapeadas:", atividadeLabel);
    return { total: 0, gainedBySkill: {} };
  }

  let total = 0;
  const gainedBySkill = {};
  const ganhos = [];

  for (const [skillId, peso] of Object.entries(skills)) {
    const xpFinal = Math.round(xpBase * peso);
    if (xpFinal <= 0) continue;
    const skillState = state?.skills?.[skillId];
    if (!skillState) continue;
    addXP(skillState, xpFinal);
    gainedBySkill[skillId] = xpFinal;
    total += xpFinal;
    ganhos.push({ skill: skillId, xp: xpFinal });
  }

  mostrarResumoXP(ganhos);

  return { total, gainedBySkill };
}

function mostrarResumoXP(ganhos) {
  if (!ganhos?.length) return;
  const mensagem = ganhos
    .map(g => `+${g.xp} XP em ${skillLabel(g.skill)}`)
    .join("<br>");

  showXPHTML(`<strong>✨ Atividade concluída</strong><br><br>${mensagem}`);
}

function computeXP({ minutes, difficulty, noDistraction }) {
  const m = Math.max(1, Number(minutes) || 1);
  const diffMul = difficulty === "dificil" ? 1.35 : difficulty === "medio" ? 1.15 : 1.0;
  const ndMul = noDistraction ? 1.2 : 1.0;
  const base = Math.min(240, m * 2);
  return Math.round(base * diffMul * ndMul);
}

// ===== Quests =====
function generateQuests(state, dateKey) {
  const skillIds = Object.keys(state.skills);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  const templates = [
    { type: "minutes", text: (s, n) => `Faça ${n} min de ${skillLabel(s)}` },
    { type: "nodistraction", text: (s) => `1 atividade de ${skillLabel(s)} sem distrações` },
    { type: "count", text: (s, n) => `Conclua ${n} atividades de ${skillLabel(s)}` },
  ];

  const quests = [];
  for (let i = 0; i < 3; i++) {
    const skill = pick(skillIds);
    const t = pick(templates);

    if (t.type === "minutes") {
      const n = pick([15, 20, 30, 40, 60]);
      quests.push({ id: `${dateKey}-${i}`, skill, kind: "minutes", target: n, progress: 0, done: false, text: t.text(skill, n) });
    } else if (t.type === "nodistraction") {
      quests.push({ id: `${dateKey}-${i}`, skill, kind: "nodistraction", target: 1, progress: 0, done: false, text: t.text(skill) });
    } else {
      const n = pick([1, 2, 3]);
      quests.push({ id: `${dateKey}-${i}`, skill, kind: "count", target: n, progress: 0, done: false, text: t.text(skill, n) });
    }
  }

  state.questsByDay[dateKey] = quests;
  return quests;
}

function updateQuestsWithActivity(state, dateKey, activity) {
  const quests = state.questsByDay[dateKey] || [];
  for (const q of quests) {
    if (q.done) continue;
    if (q.skill !== activity.skill) continue;

    if (q.kind === "minutes") q.progress += activity.minutes;
    if (q.kind === "count") q.progress += 1;
    if (q.kind === "nodistraction") q.progress += activity.noDistraction ? 1 : 0;

    if (q.progress >= q.target) q.done = true;
  }
}

// ===== Render principal =====
function render(state, username) {
  const dateKey = todayKey();

  const earnedRaw = state?.dailyEarned?.[dateKey];
  const earned = Number.isFinite(Number(earnedRaw)) ? Number(earnedRaw) : 0;
  if (dayInfoEl) dayInfoEl.textContent = `XP ganho hoje: ${earned}`;

  renderPersonalRank(state, username);

  const quests = state.questsByDay[dateKey] || [];
  if (questsEl) {
    questsEl.innerHTML = quests.length
      ? quests.map((q) => {
          const pct = Math.min(100, Math.round((q.progress / q.target) * 100));
          return `
            <div>
              <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;">
                <div><strong>${q.text}</strong></div>
                <div class="muted">${q.done ? "✅" : `${q.progress}/${q.target}`}</div>
              </div>
              <div style="height:8px;border-radius:999px;background:rgba(255,255,255,0.10);margin-top:8px;overflow:hidden;">
                <div style="height:100%;width:${pct}%;background:rgba(0,204,102,0.75);"></div>
              </div>
            </div>
          `;
        }).join("")
      : `<div class="muted">Nenhuma quest gerada hoje.</div>`;
  }

  const log = state.log || [];
  if (logEl) {
    const last = log.slice(-12).reverse();
    logEl.innerHTML = last.length
      ? last.map((e) => {
          const d = new Date(e.at);
          const hh = String(d.getHours()).padStart(2, "0");
          const mm = String(d.getMinutes()).padStart(2, "0");
          return `<div><strong>${hh}:${mm}</strong> — ${e.text}</div>`;
        }).join("")
      : `<div class="muted">Sem histórico ainda.</div>`;
  }

  const skillIds = Object.keys(state.skills);
  if (skillsEl) {
    skillsEl.innerHTML = skillIds.map((id) => {
      const s = state.skills[id];
      const pct = Math.min(100, Math.round((s.xp / xpToNext(s.level)) * 100));
      return `
        <div>
          <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;">
            <div><strong>${skillLabel(id)}</strong></div>
            <div class="muted">Nv ${s.level}</div>
          </div>
          <div style="height:8px;border-radius:999px;background:rgba(255,255,255,0.10);margin-top:8px;overflow:hidden;">
            <div style="height:100%;width:${pct}%;background:rgba(0,204,102,0.75);"></div>
          </div>
          <div class="muted" style="margin-top:6px;">${s.xp}/${xpToNext(s.level)} XP</div>
        </div>
      `;
    }).join("");
  }

  if (activityEl) {
    activityEl.innerHTML = ACTIVITIES.map((a) => `<option value="${a.id}">${a.label}</option>`).join("");
  }

  drawRadar(state);
}

function drawRadar(state) {
  if (!radar) return;
  const ctx = radar.getContext("2d");
  if (!ctx) return;

  const w = radar.width;
  const h = radar.height;
  ctx.clearRect(0, 0, w, h);

  const cx = w / 2;
  const cy = h / 2;
  const r = Math.min(w, h) * 0.38;

  const ids = Object.keys(state.skills);
  const values = ids.map((id) => getRadarValue(state.skills[id]));

  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.lineWidth = 1;

  for (let ring = 1; ring <= 4; ring++) {
    ctx.beginPath();
    ctx.arc(cx, cy, (r * ring) / 4, 0, Math.PI * 2);
    ctx.stroke();
  }

  const n = ids.length;
  for (let i = 0; i < n; i++) {
    const ang = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    const x = cx + r * Math.cos(ang);
    const y = cy + r * Math.sin(ang);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  const labelRadius = r + 18;
  ctx.font = "13px Segoe UI, Arial, sans-serif";
  for (let i = 0; i < n; i++) {
    const id = ids[i];
    const ang = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    const lx = cx + labelRadius * Math.cos(ang);
    const ly = cy + labelRadius * Math.sin(ang);

    const cos = Math.cos(ang);
    ctx.textAlign = cos > 0.2 ? "left" : cos < -0.2 ? "right" : "center";
    ctx.textBaseline = "middle";

    const highlight = radarHighlightSkills?.includes(id);
    ctx.fillStyle = highlight ? "#2cff88" : "#bbb";
    ctx.fillText(skillLabel(id), lx, ly);
  }

  const pts = [];
  for (let i = 0; i < n; i++) {
    const id = ids[i];
    const value = values[i];
    const t = Math.max(0.05, value / MAX_LEVEL);
    const ang = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    pts.push([cx + r * t * Math.cos(ang), cy + r * t * Math.sin(ang)]);
  }

  ctx.fillStyle = "rgba(0,204,102,0.20)";
  ctx.strokeStyle = "rgba(0,204,102,0.85)";
  ctx.lineWidth = 2;

  ctx.beginPath();
  pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

// Persist
async function saveState(state) {
  await apiPut("/api/state", { state });
}

// ===== Amigos =====
function setFriendsMsg(text) {
  if (!friendsMsgEl) return;
  friendsMsgEl.textContent = text || "";
}

let suggestionTimer = null;

async function refreshFriends() {
  try {
    const fr = await apiGet("/api/friends");
    const list = fr.friends || [];

    // 👇 AQUI FOI A TROCA
    if (friendsListEl) {
      if (!list.length) {
        friendsListEl.innerHTML = `<div class="muted">Você ainda não tem amigos.</div>`;
      } else {
        friendsListEl.innerHTML = `<div class="muted">Carregando níveis...</div>`;

        const profiles = await Promise.all(
          list.map(async (nick) => {
            try {
              const p = await apiGet(`/api/users/public?username=${encodeURIComponent(nick)}`);
              return { ok: true, nick, ...p };
            } catch (e) {
              return { ok: false, nick };
            }
          })
        );

        friendsListEl.innerHTML = profiles.map((p) => {
          if (!p.ok) {
            return `<div>🤝 <strong>${p.nick}</strong> <span class="muted">— sem dados</span></div>`;
          }

          const titleObj = personalTitle(Number(p.overallLevel || 0));
          const title = titleObj.current;

          return `
            <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;">
              <div>🤝 <strong>${p.nick}</strong></div>
              <div class="muted">${title} • Nv ${p.overallLevel}</div>
            </div>
          `;
        }).join("");
      }
    }
  } catch (e) {
    console.error(e);
  }

  // 👇 ESSA PARTE NÃO MUDA
  try {
    const rr = await apiGet("/api/friends/requests");
    const reqs = rr.requests || [];
    if (friendRequestsEl) {
      friendRequestsEl.innerHTML = reqs.length
        ? reqs.map(r => `
            <div>
              <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;">
                <div>📩 <strong>${r.from_username}</strong></div>
                <div class="row" style="gap:8px;">
                  <button class="primary" data-accept="${r.id}">Aceitar</button>
                  <button class="danger" data-reject="${r.id}">Recusar</button>
                </div>
              </div>
            </div>
          `).join("")
        : `<div class="muted">Sem pedidos.</div>`;
    }
  } catch (e) {
    console.error(e);
  }
}


async function sendFriendRequest(username) {
  setFriendsMsg("");
  const nick = String(username || "").trim();
  if (nick.length < 2) {
    setFriendsMsg("Digite um nick válido.");
    return;
  }

  try {
    const out = await apiPost("/api/friends/request", { username: nick });
    if (out.status === "accepted") {
      setFriendsMsg(out.autoAccepted ? "Pedido aceito automaticamente ✅" : "Vocês já são amigos ✅");
    } else if (out.status === "pending") {
      setFriendsMsg("Pedido enviado ✅");
    } else {
      setFriendsMsg(`Status: ${out.status}`);
    }
    if (friendNickEl) friendNickEl.value = "";
    if (friendSuggestionsEl) friendSuggestionsEl.innerHTML = "";
    await refreshFriends();
  } catch (e) {
    setFriendsMsg(e.message);
  }
}

async function searchUsers(q) {
  const query = String(q || "").trim();
  if (query.length < 2) {
    if (friendSuggestionsEl) friendSuggestionsEl.innerHTML = "";
    return;
  }

  try {
    const res = await apiGet(`/api/users/search?q=${encodeURIComponent(query)}`);
    const users = res.users || [];

    if (!friendSuggestionsEl) return;
    friendSuggestionsEl.innerHTML = users.length
      ? users.map(u => `
          <div class="suggestion">
            <div class="nick">${u.username}</div>
            <div class="mini">
              <button class="primary" data-addnick="${u.username}">Adicionar</button>
            </div>
          </div>
        `).join("")
      : `<div class="muted">Nenhum usuário encontrado.</div>`;
  } catch (e) {
    console.error(e);
  }
}

// ===== Ranking global =====
let cachedRank = null;

function setRankMsg(text) {
  if (!rankMsgEl) return;
  rankMsgEl.textContent = text || "";
}

function buildRankSkillSelect() {
  if (!rankSkillEl) return;
  rankSkillEl.innerHTML = SKILLS.map(sk => `<option value="${sk}">${skillLabel(sk)}</option>`).join("");
}

function renderRank(skillId) {
  if (!rankListEl) return;

  const list = cachedRank?.skills?.[skillId] || [];
  if (!list.length) {
    rankListEl.innerHTML = `<div class="muted">Sem dados ainda.</div>`;
    return;
  }

  rankListEl.innerHTML = list.map((row, idx) => {
    const medal = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : "🏅";
    return `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;">
        <div>${medal} <strong>${idx + 1}.</strong> ${row.username}</div>
        <div class="muted">Nv ${row.level}</div>
      </div>
    `;
  }).join("");
}

async function loadRank() {
  setRankMsg("Carregando ranking...");
  try {
    cachedRank = await apiGet("/api/rank/skills");
    setRankMsg("Ranking global (top 10) por skill.");
    const skill = rankSkillEl?.value || "determinacao";
    renderRank(skill);
  } catch (e) {
    console.error(e);
    setRankMsg(e.message);
  }
}

// ===== Boot =====
let state = null;
let me = null;
let radarHighlightSkills = null;
let radarHighlightTimer = null;

function setRadarHighlight(skillIds) {
  radarHighlightSkills = Array.isArray(skillIds) ? skillIds : null;
  if (radarHighlightTimer) clearTimeout(radarHighlightTimer);
  radarHighlightTimer = setTimeout(() => {
    radarHighlightSkills = null;
    if (state) drawRadar(state);
  }, 2000);
}

async function boot() {
  const token = getToken();
  if (!token) {
    window.location.replace("/login");
    return;
  }

  try {
    // user
    me = await apiGet("/api/me");

    // state
    const data = await apiGet("/api/state");
    state = data?.state || defaultState();

    state.skills ||= defaultState().skills;
    state.dailyEarned ||= {};
    state.questsByDay ||= {};
    state.log ||= [];

    state = migrateStateSkills(state);

    // normaliza dailyEarned
    if (state.dailyEarned && typeof state.dailyEarned === "object") {
      const fixed = {};
      for (const [k, v] of Object.entries(state.dailyEarned)) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(k)) continue;
        const n = Number(v);
        fixed[k] = Number.isFinite(n) ? n : 0;
      }
      state.dailyEarned = fixed;
    } else {
      state.dailyEarned = {};
    }

    render(state, me?.username);

    try { await saveState(state); } catch (e) { console.error(e); }

    await refreshFriends();

    buildRankSkillSelect();
    await loadRank();

  } catch (e) {
    console.error(e);
    localStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    window.location.replace("/login");
  }
}

btnLogout?.addEventListener("click", () => {
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
  window.location.replace("/login");
});

xpOk?.addEventListener("click", hideXP);

btnNewQuests?.addEventListener("click", async () => {
  if (!state) return;
  const dk = todayKey();
  generateQuests(state, dk);
  render(state, me?.username);
  try { await saveState(state); } catch (e) { console.error(e); }
});

btnReset?.addEventListener("click", async () => {
  if (!confirm("Resetar tudo? Isso apaga suas skills/quests/histórico.")) return;
  state = defaultState();
  render(state, me?.username);
  try { await saveState(state); } catch (e) { console.error(e); }
});

btnComplete?.addEventListener("click", async () => {
  if (!state) return;

  const activityId = activityEl?.value || "estudar";
  const activity = ACTIVITIES.find(a => a.id === activityId) || ACTIVITIES[0];
  const skill = activity.skill;

  const minutes = Math.max(1, Number(minutesEl?.value || 1));
  const difficulty = difficultyEl?.value || "facil";
  const noDistraction = (nodEl?.value || "nao") === "sim";

  const xpBase = computeXP({ minutes, difficulty, noDistraction });
  const { total: gained, gainedBySkill } = aplicarXPAtividade(activity.label, xpBase);

  const dk = todayKey();
  const prev = Number(state.dailyEarned[dk]);
  state.dailyEarned[dk] = (Number.isFinite(prev) ? prev : 0) + gained;

  const entry = {
    at: Date.now(),
    text: `${activity.label} • ${minutes}min • ${difficulty} • ${noDistraction ? "sem distração" : "com distração"} • +${gained} XP`,
    skill,
    minutes,
    difficulty,
    noDistraction,
    gained,
    gainedBySkill,
  };
  state.log.push(entry);

  updateQuestsWithActivity(state, dk, entry);

  unlockAchievement("first_activity");

  const grownSkills = Object.keys(gainedBySkill || {});
  if (grownSkills.length) setRadarHighlight(grownSkills);

  const totalDeterminacao = countActivitiesBySkill(state, "determinacao");
  if (activity.skill === "determinacao" && totalDeterminacao >= 10) {
    unlockAchievement("focus_10");
  }

  const diasEstudo = countStudyDays(state);
  if (activity.skill === "inteligencia" && diasEstudo >= 5) {
    unlockAchievement("study_5");
  }

  render(state, me?.username);
  // popup já exibido em mostrarResumoXP()

  try { await saveState(state); } catch (e) { console.error(e); }
});

// ===== Amigos eventos =====
btnAddFriend?.addEventListener("click", async () => {
  await sendFriendRequest(friendNickEl?.value || "");
});

friendNickEl?.addEventListener("input", () => {
  setFriendsMsg("");
  if (suggestionTimer) clearTimeout(suggestionTimer);
  suggestionTimer = setTimeout(() => searchUsers(friendNickEl?.value || ""), 200);
});

// ===== Ranking eventos =====
rankSkillEl?.addEventListener("change", () => {
  const skill = rankSkillEl.value;
  renderRank(skill);
});

btnRefreshRank?.addEventListener("click", async () => {
  await loadRank();
});

// click delegation: sugestões + aceitar/recusar
document.addEventListener("click", async (e) => {
  const t = e.target;

  if (t?.dataset?.addnick) {
    await sendFriendRequest(t.dataset.addnick);
  }

  if (t?.dataset?.accept) {
    const id = Number(t.dataset.accept);
    try {
      await apiPost("/api/friends/respond", { requestId: id, action: "accept" });
      await refreshFriends();
    } catch (err) {
      setFriendsMsg(err.message);
    }
  }

  if (t?.dataset?.reject) {
    const id = Number(t.dataset.reject);
    try {
      await apiPost("/api/friends/respond", { requestId: id, action: "reject" });
      await refreshFriends();
    } catch (err) {
      setFriendsMsg(err.message);
    }
  }
});

boot();
