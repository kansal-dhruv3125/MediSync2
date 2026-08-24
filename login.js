const form = document.getElementById("login-form");
const usernameInput = document.getElementById("login-username");
const passwordInput = document.getElementById("login-password");
const errorEl = document.getElementById("login-error");

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const username = usernameInput.value.trim();
  const password = passwordInput.value;

  const users = getUsers();
  const matchedUser = users.find(
    (u) => u.username.toLowerCase() === username.toLowerCase() && u.password === password
  );

  if (!matchedUser) {
    errorEl.textContent = "Incorrect username or password.";
    return;
  }

  errorEl.textContent = "";
  setCurrentUser(matchedUser.username);
  window.location.href = "index.html";
});
