const TOKEN_KEY = "skillRoutine_token";
const REMEMBER_KEY = "skillRoutine_remember";

function getToken() {
  return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
}

function setToken(token, remember) {
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_KEY);

  if (!token) return;

  if (remember) localStorage.setItem(TOKEN_KEY, token);
  else sessionStorage.setItem(TOKEN_KEY, token);
}

async function apiFetch(url, opts = {}) {
  const headers = { "Content-Type": "application/json", ...(opts.headers || {}) };
  const res = await fetch(url, { ...opts, headers });

  const text = await res.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch {}

  if (!res.ok) throw new Error(data.error || "Erro na API");
  return data;
}

// refs
const elRemember = document.getElementById("remember");
const elEmail = document.getElementById("email");
const elPass = document.getElementById("pass");
const elMsg = document.getElementById("msg");

// remember pref
const savedRemember = localStorage.getItem(REMEMBER_KEY);
if (savedRemember !== null) elRemember.checked = (savedRemember === "1");

elRemember.addEventListener("change", () => {
  localStorage.setItem(REMEMBER_KEY, elRemember.checked ? "1" : "0");
});

// auto redirect if token valid
(async () => {
  const token = getToken();
  if (!token) return;

  try {
    const res = await fetch("/api/state", {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.ok) window.location.href = "/app";
  } catch {}
})();

function tryLoginOnEnter(e) {
  if (e.key === "Enter") {
    document.getElementById("btnLogin").click();
  }
}
elEmail.addEventListener("keydown", tryLoginOnEnter);
elPass.addEventListener("keydown", tryLoginOnEnter);

function basicValidate(email, password) {
  if (!email || !email.includes("@")) throw new Error("Email inválido");
  if (!password || password.length < 4) throw new Error("Senha muito curta (mín 4)");
}

document.getElementById("btnRegister").addEventListener("click", async () => {
  try {
    elMsg.textContent = "Criando conta...";

    const email = elEmail.value.trim();
    const password = elPass.value;
    basicValidate(email, password);

    const { token, email: okEmail } = await apiFetch("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password })
    });

    setToken(token, elRemember.checked);
    elMsg.textContent = `Conta criada: ${okEmail}. Indo para o app...`;
    window.location.href = "/app";
  } catch (e) {
    elMsg.textContent = e.message;
  }
});

document.getElementById("btnLogin").addEventListener("click", async () => {
  try {
    elMsg.textContent = "Entrando...";

    const email = elEmail.value.trim();
    const password = elPass.value;
    basicValidate(email, password);

    const { token, email: okEmail } = await apiFetch("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password })
    });

    setToken(token, elRemember.checked);
    elMsg.textContent = `Logado como ${okEmail}. Indo para o app...`;
    window.location.href = "/app";
  } catch (e) {
    elMsg.textContent = e.message;
  }
});
