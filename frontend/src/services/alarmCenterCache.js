import { API_BASE_URL, apiFetch } from "../config/api";

const CACHE_TTL = 60_000;
const listCache = new Map();
const detailCache = new Map();
const summaries = new Map();
let operatorsCache = null;

function isFresh(entry) {
  return Boolean(entry?.data) && Date.now() - entry.updatedAt < CACHE_TTL;
}

async function fetchJson(url) {
  const response = await apiFetch(url);
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  return response.json();
}

function loadCachedEntry(cache, key, request, force = false) {
  const current = cache.get(key);
  if (!force && isFresh(current)) return Promise.resolve(current.data);
  if (!force && current?.promise) return current.promise;

  const promise = request()
    .then((data) => {
      if (cache.get(key)?.promise === promise) {
        cache.set(key, { data, updatedAt: Date.now(), promise: null });
      }
      return data;
    })
    .catch((error) => {
      if (cache.get(key)?.promise === promise) cache.delete(key);
      throw error;
    });

  cache.set(key, {
    data: current?.data ?? null,
    updatedAt: current?.updatedAt ?? 0,
    promise,
  });
  return promise;
}

function toAlarmSummary(item) {
  if (!item?.id) return null;
  return {
    id: item.id,
    time: item.time,
    type: item.type,
    level: item.level,
    status: item.status,
    subject:
      item.subject ??
      (item.person_name
        ? { name: item.person_name, kind: "person" }
        : item.device_name
          ? { name: item.device_name, kind: "device" }
          : null),
    area: item.area ?? null,
  };
}

export function primeAlarmSummaries(items) {
  (items ?? []).forEach((item) => {
    const summary = toAlarmSummary(item);
    if (summary) summaries.set(summary.id, summary);
  });
}

export function primeAlarmDetail(detail) {
  if (!detail?.id) return;
  detailCache.set(detail.id, {
    data: detail,
    updatedAt: Date.now(),
    promise: null,
  });
  primeAlarmSummaries([detail]);
}

export function getCachedAlarmList(query) {
  return listCache.get(query)?.data ?? null;
}

export function getCachedAlarmDetail(alarmId) {
  return detailCache.get(alarmId)?.data ?? null;
}

export function getCachedAlarmOperators() {
  return operatorsCache?.data?.items ?? null;
}

export function getWarmAlarmList(alarmId) {
  const summary = summaries.get(alarmId);
  if (!summary) return null;
  const cachedOptions = [...listCache.values()].find((entry) => entry.data?.options)
    ?.data?.options;
  return {
    items: [summary],
    total: 1,
    options: cachedOptions ?? { types: [], levels: [], statuses: [] },
  };
}

export async function loadAlarmList(query, { force = false } = {}) {
  const payload = await loadCachedEntry(
    listCache,
    query,
    () => fetchJson(`${API_BASE_URL}/alarms?${query}`),
    force
  );
  primeAlarmSummaries(payload.items);
  return payload;
}

export async function loadAlarmDetail(alarmId, { force = false } = {}) {
  const detail = await loadCachedEntry(
    detailCache,
    alarmId,
    () => fetchJson(`${API_BASE_URL}/alarms/${encodeURIComponent(alarmId)}`),
    force
  );
  primeAlarmDetail(detail);
  return detail;
}

export async function loadAlarmOperators({ force = false } = {}) {
  if (!force && isFresh(operatorsCache)) return operatorsCache.data;
  if (!force && operatorsCache?.promise) return operatorsCache.promise;

  const promise = fetchJson(`${API_BASE_URL}/alarms/operators`)
    .then((data) => {
      operatorsCache = { data, updatedAt: Date.now(), promise: null };
      return data;
    })
    .catch((error) => {
      operatorsCache = null;
      throw error;
    });
  operatorsCache = {
    data: operatorsCache?.data ?? null,
    updatedAt: operatorsCache?.updatedAt ?? 0,
    promise,
  };
  return promise;
}

function buildDefaultAlarmQuery() {
  const today = new Date();
  const weekAgo = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() - 6
  );
  const toDateInput = (date) => {
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
    return local.toISOString().slice(0, 10);
  };
  return new URLSearchParams({
    page: "1",
    page_size: "10",
    start_date: toDateInput(weekAgo),
    end_date: toDateInput(today),
  }).toString();
}

export async function warmAlarmCenter(items) {
  const alarmItems = (items ?? []).filter((item) => item?.id);
  primeAlarmSummaries(alarmItems);
  void loadAlarmOperators().catch(() => {});
  void loadAlarmList(buildDefaultAlarmQuery()).catch(() => {});

  const alarmIds = alarmItems.map((item) => item.id);
  const priorityIds = alarmIds.slice(0, 5);
  await Promise.all(priorityIds.map((alarmId) => loadAlarmDetail(alarmId).catch(() => null)));

  const remainingIds = alarmIds.slice(priorityIds.length);
  const workerCount = Math.min(4, remainingIds.length);
  for (let workerIndex = 0; workerIndex < workerCount; workerIndex += 1) {
    void (async () => {
      for (let index = workerIndex; index < remainingIds.length; index += workerCount) {
        await loadAlarmDetail(remainingIds[index]).catch(() => null);
      }
    })();
  }
}

export function invalidateAlarmCenterCache() {
  listCache.clear();
  detailCache.clear();
  operatorsCache = null;
}
