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
