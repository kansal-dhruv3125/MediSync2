const form = document.getElementById("login-form");
const identifierInput = document.getElementById("login-username");
const passwordInput = document.getElementById("login-password");
const errorEl = document.getElementById("login-error");
const submitBtn = form.querySelector("button[type=submit]");

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const identifier = identifierInput.value.trim();
  const password = passwordInput.value;

  if (!identifier) {
    errorEl.textContent = "Please enter your username or email.";
    return;
  }
  if (!password) {
    errorEl.textContent = "Please enter your password.";
    return;
  }

  errorEl.textContent = "";
  submitBtn.disabled = true;
  submitBtn.textContent = "Logging in...";

  try {
    const result = await MedisyncAPI.apiRequest("/api/auth/login", {
      method: "POST",
      body: { identifier: identifier, password: password },
    });

    setAuthSession(result.data.token, result.data.user);
    window.location.href = "index.html";
  } catch (error) {
    errorEl.textContent =
      error.message === "Incorrect username/email or password."
        ? "Incorrect username or password."
        : error.message;
    submitBtn.disabled = false;
    submitBtn.textContent = "Log In";
  }
});
