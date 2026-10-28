/**
 * Centralized API configuration and request helper for MediSync2.
 *
 * API base URL resolution order:
 *   1. window.MEDISYNC_API_URL   (inline override, set before this script loads)
 *   2. localStorage "medisync_api_url" (override you can set from the browser console)
 *   3. Default: http://localhost:5000 (local backend during development)
 *
 * No secrets live here — the JWT is only obtained from the API at login/signup
 * time and stored per-session in the browser.
 */
(function () {
  const OVERRIDE_STORAGE_KEY = "medisync_api_url";
  const DEFAULT_API_BASE_URL = "http://localhost:5000";

  function normalizeBaseUrl(url) {
    return String(url || "").replace(/\/+$/, "");
  }

  function resolveApiBaseUrl() {
    if (window.MEDISYNC_API_URL) {
      return normalizeBaseUrl(window.MEDISYNC_API_URL);
    }
    try {
      const override = localStorage.getItem(OVERRIDE_STORAGE_KEY);
      if (override) {
        return normalizeBaseUrl(override);
      }
    } catch (storageError) {
      // localStorage unavailable (e.g. privacy mode) — fall through to default
    }
    return DEFAULT_API_BASE_URL;
  }

  const API_BASE_URL = resolveApiBaseUrl();

  class ApiError extends Error {
    constructor(message, status, payload) {
      super(message);
      this.name = "ApiError";
      this.status = status;
      this.payload = payload;
    }
  }

  /**
   * Sends a JSON request to the API and resolves with the parsed body
   * ({ success, message, data }). Throws ApiError on network failures,
   * non-2xx responses, or success:false responses.
   */
  async function apiRequest(path, options) {
    const settings = options || {};
    const { method = "GET", body = undefined, token = null } = settings;

    const headers = {};
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
    }
    if (token) {
      headers["Authorization"] = "Bearer " + token;
    }

    let response;
    try {
      response = await fetch(API_BASE_URL + path, {
        method: method,
        headers: headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch (networkError) {
      throw new ApiError(
        "Could not reach the server. Check your connection and that the API is running at " + API_BASE_URL + ".",
        0,
        null
      );
    }

    let payload = null;
    try {
      payload = await response.json();
    } catch (parseError) {
      payload = null;
    }

    // Expired/invalid session while using a stored token: end the session.
    if (response.status === 401 && token && typeof window.MedisyncOnUnauthorized === "function") {
      window.MedisyncOnUnauthorized();
    }

    if (!response.ok || (payload && payload.success === false)) {
      throw new ApiError(
        (payload && payload.message) ||
          ("Request failed with status " + response.status + "."),
        response.status,
        payload
      );
    }

    return payload;
  }

  window.MedisyncAPI = {
    API_BASE_URL: API_BASE_URL,
    DEFAULT_API_BASE_URL: DEFAULT_API_BASE_URL,
    OVERRIDE_STORAGE_KEY: OVERRIDE_STORAGE_KEY,
    apiRequest: apiRequest,
    ApiError: ApiError,
  };
})();
