const USERS_KEY = "users";
const CURRENT_USER_KEY = "currentUser";

function getUsers() {
  const saved = localStorage.getItem(USERS_KEY);
  return saved ? JSON.parse(saved) : [];
}

function saveUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function getCurrentUser() {
  return localStorage.getItem(CURRENT_USER_KEY);
}

function setCurrentUser(username) {
  localStorage.setItem(CURRENT_USER_KEY, username);
}

function logout() {
  localStorage.removeItem(CURRENT_USER_KEY);
  window.location.href = "login.html";
}

function requireLogin() {
  if (!getCurrentUser()) {
    window.location.href = "login.html";
  }
}

function redirectIfLoggedIn() {
  if (getCurrentUser()) {
    window.location.href = "index.html";
  }
}
