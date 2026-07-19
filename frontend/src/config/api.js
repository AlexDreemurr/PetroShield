const DEFAULT_API_ORIGIN = "http://localhost:8000";
const API_VERSION_PREFIX = "/api/v1";

function normalizeApiBaseUrl(value) {
  const rawBaseUrl = (value || DEFAULT_API_ORIGIN).trim().replace(/\/+$/, "");

  if (/\/api\/v\d+$/i.test(rawBaseUrl)) {
    return rawBaseUrl;
  }

  return `${rawBaseUrl}${API_VERSION_PREFIX}`;
}

export const API_BASE_URL = normalizeApiBaseUrl(
  import.meta.env.VITE_API_BASE_URL
);

export const AUTH_TOKEN_KEY = "petroshield_access_token";

export function getAuthToken() {
  return window.localStorage.getItem(AUTH_TOKEN_KEY);
}

export function setAuthToken(token) {
  if (token) window.localStorage.setItem(AUTH_TOKEN_KEY, token);
  else window.localStorage.removeItem(AUTH_TOKEN_KEY);
}

export async function apiFetch(input, init = {}) {
  const token = getAuthToken();
  const headers = new Headers(init.headers || {});
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  const response = await fetch(input, { ...init, headers });
  if (response.status === 401 && !String(input).includes("/auth/login")) {
    setAuthToken(null);
    window.dispatchEvent(new Event("petroshield:unauthorized"));
  }
  return response;
}

export async function readApiError(response, fallback = "请求失败") {
  try {
    const payload = await response.json();
    return payload.detail || fallback;
  } catch {
    return fallback;
  }
}
