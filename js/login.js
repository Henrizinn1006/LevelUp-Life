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
const API_URL = "https://levelup-life-j5p1.onrender.com";

function withApiUrl(path) {
  if (!path) return API_URL;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${API_URL}${path.startsWith("/") ? "" : "/"}${path}`;
}

function saveToken(token) {
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
  if (!token) return;

  const remember = !!rememberEl?.checked;
  if (remember) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    sessionStorage.setItem(TOKEN_KEY, token);
  }
}

function showMsg(el, text) {
  if (!el) return;
  el.textContent = text || "";
}

async function apiPost(url, body) {
  const res = await fetch(withApiUrl(url), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Erro na API");
  return data;
}

function openRegisterModal() {
  if (!registerModal) return;

  registerModal.classList.remove("hidden");
  showMsg(regMsg, "");

  // pré-preenche email do campo de login, se tiver
  if (regEmail) regEmail.value = (emailEl?.value || "").trim();

  // foco no nick
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
  if (e.key === "Escape" && registerModal && !registerModal.classList.contains("hidden")) {
    closeRegisterModal();
  }
});

// Login
btnLogin?.addEventListener("click", async () => {
  try {
    showMsg(msgEl, "");

    const email = (emailEl?.value || "").trim();
    const password = String(passEl?.value || "");

    if (!email.includes("@")) throw new Error("Email inválido");
    if (password.length < 4) throw new Error("Senha muito curta (mín 4)");

    const data = await apiPost("/auth/login", { email, password });

    if (data?.token) saveToken(data.token);
    window.location.href = "/app";
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

  const data = await apiPost("/auth/register", { username, email, password });

  if (data?.token) saveToken(data.token);
  window.location.href = "/app";
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
