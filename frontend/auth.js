/**
 * Session management for MediSync2.
 *
 * Sessions are backed by JWTs issued by the API. The token and user object are
 * stored in localStorage; note that anything stored in the browser (localStorage
 * or cookies readable by JS) is exposed to XSS — the UI follows the app's own
 * policies and the API rejects weak tokens, but never treat the stored token
 * as fully secure. See README.md for details.
 */
const TOKEN_KEY = "medisync_token";
const USER_KEY = "medisync_user";

function getSessionToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function getSessionUser() {
  const saved = localStorage.getItem(USER_KEY);
  if (!saved) {
    return null;
  }
  try {
    return JSON.parse(saved);
  } catch (parseError) {
    return null;
  }
}

function setAuthSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

function clearAuthSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

// Kept as the "current user" accessor used across pages
function getCurrentUser() {
  return getSessionUser();
}

function logout() {
  clearAuthSession();
  window.location.href = "login.html";
}

function requireLogin() {
  if (!getSessionToken()) {
    window.location.href = "login.html";
  }
}

function redirectIfLoggedIn() {
  if (getSessionToken()) {
    window.location.href = "index.html";
  }
}

/**
 * Called by the API helper when the server rejects a stored token.
 */
window.MedisyncOnUnauthorized = function () {
  clearAuthSession();
  window.location.href = "login.html";
};

/**
 * Re-validates the stored token against the API.
 * Resolves true when valid; ends the session and resolves false otherwise.
 */
async function verifySession() {
  if (!getSessionToken()) {
    window.location.href = "login.html";
    return false;
  }
  try {
    await MedisyncAPI.apiRequest("/api/auth/me", {
      token: getSessionToken(),
    });
    return true;
  } catch (error) {
    if (error.status === 0) {
      // Network/JS failure — do NOT log the user out just because the API is
      // unreachable; the page will show errors instead.
      return false;
    }
    clearAuthSession();
    window.location.href = "login.html";
    return false;
  }
}
