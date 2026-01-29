let isRegister = false;

const form = document.getElementById("authForm");
const toggleBtn = document.getElementById("btnToggle");
const formTitle = document.getElementById("formTitle");

const usernameField = document.getElementById("usernameField");
const confirmField = document.getElementById("confirmField");

const username = document.getElementById("username");
const confirm = document.getElementById("confirmPassword");
const email = document.getElementById("email");
const password = document.getElementById("password");
const error = document.getElementById("error");

toggleBtn.addEventListener("click", () => {
  isRegister = !isRegister;

  if (isRegister) {
    formTitle.textContent = "Criar conta";
    toggleBtn.textContent = "Já tenho conta";
    usernameField.classList.remove("hidden");
    confirmField.classList.remove("hidden");
  } else {
    formTitle.textContent = "Login";
    toggleBtn.textContent = "Criar conta";
    usernameField.classList.add("hidden");
    confirmField.classList.add("hidden");
  }

  if (error) error.style.display = "none";
});

async function apiFetch(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Erro na API");
  return data;
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (error) error.style.display = "none";

  const payload = {
    email: email.value.trim(),
    password: password.value
  };

  try {
    let data;
    if (isRegister) {
      if (!username.value || !confirm.value) {
        throw new Error("Preencha todos os campos");
      }
      if (password.value !== confirm.value) {
        throw new Error("As senhas não coincidem");
      }
      data = await apiFetch("/auth/register", {
        ...payload,
        username: username.value.trim()
      });
    } else {
      data = await apiFetch("/auth/login", payload);
    }

    if (data?.token) {
      localStorage.setItem("skillRoutine_token", data.token);
    }

    window.location.href = "/app";
  } catch (e) {
    if (error) {
      error.textContent = e.message;
      error.style.display = "block";
    }
  }
});
