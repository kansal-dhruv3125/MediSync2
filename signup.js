const form = document.getElementById("signup-form");
const usernameInput = document.getElementById("signup-username");
const passwordInput = document.getElementById("signup-password");
const confirmInput = document.getElementById("signup-confirm");
const errorEl = document.getElementById("signup-error");

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const username = usernameInput.value.trim();
  const password = passwordInput.value;
  const confirmPassword = confirmInput.value;

  if (!username) {
    errorEl.textContent = "Please choose a username.";
    return;
  }
  if (!password) {
    errorEl.textContent = "Please choose a password.";
    return;
  }
  if (password !== confirmPassword) {
    errorEl.textContent = "Passwords do not match.";
    return;
  }

  const users = getUsers();
  const usernameTaken = users.some(
    (u) => u.username.toLowerCase() === username.toLowerCase()
  );

  if (usernameTaken) {
    errorEl.textContent = "That username is already taken.";
    return;
  }

  users.push({ username, password });
  saveUsers(users);

  setCurrentUser(username);
  window.location.href = "index.html";
});
