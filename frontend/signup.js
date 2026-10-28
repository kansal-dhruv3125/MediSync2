const form = document.getElementById("signup-form");
const usernameInput = document.getElementById("signup-username");
const emailInput = document.getElementById("signup-email");
const passwordInput = document.getElementById("signup-password");
const confirmInput = document.getElementById("signup-confirm");
const errorEl = document.getElementById("signup-error");
const submitBtn = form.querySelector("button[type=submit]");

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const username = usernameInput.value.trim();
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  const confirmPassword = confirmInput.value;

  if (!username) {
    errorEl.textContent = "Please choose a username.";
    return;
  }
  if (!email) {
    errorEl.textContent = "Please enter your email address.";
    return;
  }
  if (!password) {
    errorEl.textContent = "Please choose a password.";
    return;
  }
  if (password.length < 6) {
    errorEl.textContent = "Password must be at least 6 characters.";
    return;
  }
  if (password !== confirmPassword) {
    errorEl.textContent = "Passwords do not match.";
    return;
  }

  errorEl.textContent = "";
  submitBtn.disabled = true;
  submitBtn.textContent = "Signing up...";

  try {
    const result = await MedisyncAPI.apiRequest("/api/auth/signup", {
      method: "POST",
      body: { username: username, email: email, password: password },
    });

    setAuthSession(result.data.token, result.data.user);
    window.location.href = "index.html";
  } catch (error) {
    errorEl.textContent = error.message;
    submitBtn.disabled = false;
    submitBtn.textContent = "Sign Up";
  }
});
