import { API_BASE_URL, apiFetch } from "../config/api";
import { warmAlarmCenter } from "./alarmCenterCache";

const CACHE_TTL = 60_000;
const resourceCache = new Map();

function isFresh(entry) {
  return Boolean(entry?.data) && Date.now() - entry.updatedAt < CACHE_TTL;
}

export function getCachedJson(url) {
  return resourceCache.get(url)?.data ?? null;
}

export function setCachedJson(url, data) {
  resourceCache.set(url, {
    data,
    updatedAt: Date.now(),
    promise: null,
  });
}

export function invalidateCachedJson(url) {
  resourceCache.delete(url);
}

export function loadCachedJson(url, { force = false } = {}) {
  const current = resourceCache.get(url);
  if (current?.promise) return current.promise;
  if (!force && isFresh(current)) return Promise.resolve(current.data);

  const promise = apiFetch(url)
    .then((response) => {
      if (!response.ok) throw new Error(`Request failed: ${response.status}`);
      return response.json();
    })
    .then((data) => {
      setCachedJson(url, data);
      return data;
    })
    .catch((error) => {
      if (current?.data) {
        resourceCache.set(url, { ...current, promise: null });
      } else {
        resourceCache.delete(url);
      }
      throw error;
    });

  resourceCache.set(url, {
    data: current?.data ?? null,
    updatedAt: current?.updatedAt ?? 0,
    promise,
  });
  return promise;
}

export const PAGE_DATA_URLS = {
  people: `${API_BASE_URL}/people/locations`,
  devices: `${API_BASE_URL}/devices/overview`,
  areas: `${API_BASE_URL}/risk-control/overview`,
  statistics7Days: `${API_BASE_URL}/statistics/overview?days=7`,
  riskEvents: `${API_BASE_URL}/statistics/risk-events`,
  videoAI: `${API_BASE_URL}/video-ai/overview`,
};

let warmPromise = null;

export function warmApplicationPages() {
  if (warmPromise) return warmPromise;

  warmPromise = Promise.allSettled([
    loadCachedJson(PAGE_DATA_URLS.people),
    loadCachedJson(PAGE_DATA_URLS.devices),
    loadCachedJson(PAGE_DATA_URLS.areas),
    loadCachedJson(PAGE_DATA_URLS.statistics7Days),
    loadCachedJson(PAGE_DATA_URLS.riskEvents),
    loadCachedJson(PAGE_DATA_URLS.videoAI),
    warmAlarmCenter([]),
  ]).finally(() => {
    warmPromise = null;
  });

  return warmPromise;
}
