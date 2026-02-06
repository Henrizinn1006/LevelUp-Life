const API_BASE = "https://levelup-life-ncrx.onrender.com";

const emailEl = document.getElementById("email");
const passEl = document.getElementById("pass");
const msgEl = document.getElementById("msg");
const rememberEl = document.getElementById("rememberMe");

const btnLogin = document.getElementById("btnLogin");
const btnRegister = document.getElementById("btnRegister");

// Modal criar conta
const registerModal = document.getElementById("registerModal");
const btnCloseRegister = document.getElementById("btnCloseRegister");
const btnDoRegister = document.getElementById("btnDoRegister");

const regUsername = document.getElementById("regUsername");
const regEmail = document.getElementById("regEmail");
const regPass = document.getElementById("regPass");
const regConfirm = document.getElementById("regConfirm");
const regMsg = document.getElementById("regMsg");

const TOKEN_KEY = "skillRoutine_token";

/**
 * Em GitHub Pages / site estático, a API é no Render.
 * Se você abrir direto no domínio do Render (quando estiver servindo front lá),
 * usa o origin atual.
 */
const API_URL =
  window.location.hostname.endsWith("onrender.com")
    ? window.location.origin
    : API_BASE;

function withApiUrl(path) {
  if (!path) return API_URL;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${API_URL}${path.startsWith("/") ? "" : "/"}${path}`;
}

/** ✅ FIX PRINCIPAL: ler token de session OU local */
function getToken() {
  return sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY);
}

function saveToken(token) {
  // limpa qualquer estado anterior
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_KEY);

  if (!token) return;

  const remember = !!rememberEl?.checked;
  if (remember) localStorage.setItem(TOKEN_KEY, token);
  else sessionStorage.setItem(TOKEN_KEY, token);
}

function showMsg(el, text) {
  if (!el) return;
  el.textContent = text || "";
}

/** ✅ erro mais robusto */
function extractApiError(data, fallback = "Erro na API") {
  if (!data) return fallback;
  if (typeof data === "string") return data;
  return (
    data.detail ||
    data.message ||
    data.error ||
    (Array.isArray(data.errors) && data.errors[0]?.message) ||
    fallback
  );
}

async function apiPost(url, body) {
  const res = await fetch(withApiUrl(url), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(extractApiError(data, `Erro ${res.status}`));
  return data;
}

function openRegisterModal() {
  if (!registerModal) return;

  registerModal.classList.remove("hidden");
  showMsg(regMsg, "");

  if (regEmail) regEmail.value = (emailEl?.value || "").trim();
  regUsername?.focus();
}

function closeRegisterModal() {
  if (!registerModal) return;
  registerModal.classList.add("hidden");
}

// Botões
btnRegister?.addEventListener("click", openRegisterModal);
btnCloseRegister?.addEventListener("click", closeRegisterModal);

// fecha clicando fora
registerModal?.addEventListener("click", (e) => {
  if (e.target === registerModal) closeRegisterModal();
});

// ESC fecha
document.addEventListener("keydown", (e) => {
  if (
    e.key === "Escape" &&
    registerModal &&
    !registerModal.classList.contains("hidden")
  ) {
    closeRegisterModal();
  }
});

/** helper de navegação */
function goApp() {
  window.location.href = "app.html";
}

/** ✅ (Opcional) já evita “voltar pro login” por token antigo inválido */
function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
}

// Login
btnLogin?.addEventListener("click", async () => {
  try {
    showMsg(msgEl, "");

    const email = (emailEl?.value || "").trim();
    const password = String(passEl?.value || "");

    if (!email.includes("@")) throw new Error("Email inválido");
    if (password.length < 4) throw new Error("Senha muito curta (mín 4)");

    clearToken(); // evita “mistura” de token antigo com novo

    const data = await apiPost("/auth/login", { email, password });

    // aceita token em formatos diferentes
    const token = data?.token || data?.access_token || data?.jwt;
    if (!token) throw new Error("Login ok, mas API não retornou token.");

    saveToken(token);

    // DEBUG rápido: descomente se quiser confirmar
    // console.log("token salvo?", !!getToken(), "remember:", !!rememberEl?.checked);

    goApp();
  } catch (e) {
    showMsg(msgEl, e.message);
  }
});

// Criar conta (modal)
async function doRegister() {
  showMsg(regMsg, "");

  const username = (regUsername?.value || "").trim();
  const email = (regEmail?.value || "").trim();
  const password = String(regPass?.value || "");
  const confirm = String(regConfirm?.value || "");

  if (username.length < 2) throw new Error("Nick muito curto (mín 2)");
  if (!email.includes("@")) throw new Error("Email inválido");
  if (password.length < 4) throw new Error("Senha muito curta (mín 4)");
  if (password !== confirm) throw new Error("As senhas não coincidem");

  clearToken();

  const data = await apiPost("/auth/register", { username, email, password });

  const token = data?.token || data?.access_token || data?.jwt;
  if (!token) throw new Error("Cadastro ok, mas API não retornou token.");

  saveToken(token);

  goApp();
}

btnDoRegister?.addEventListener("click", async () => {
  try {
    await doRegister();
  } catch (e) {
    showMsg(regMsg, e.message);
  }
});

// Enter dentro do modal cria conta
registerModal?.addEventListener("keydown", async (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    try {
      await doRegister();
    } catch (err) {
      showMsg(regMsg, err.message);
    }
  }
});
