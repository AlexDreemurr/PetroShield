import { useSyncExternalStore } from "react";
import { API_BASE_URL, apiFetch } from "../config/api";

const DEFAULT_GROUPS = {
  alarm_type: [
    { code: "AREA_INTRUSION", value: "越界", name: "越界", color: "#ef4444" },
    { code: "DEVICE_ABNORMAL", value: "设备异常", name: "设备异常", color: "#f97316" },
    { code: "AI_REVIEW", value: "识别异常", name: "识别异常", color: "#f59e0b" },
    { code: "DEVICE_OFFLINE", value: "离线", name: "设备离线", color: "#64748b" },
    { code: "PERSON_FALL", value: "跌倒", name: "人员跌倒", color: "#dc2626" },
  ],
  risk_level: [
    { code: "CRITICAL", value: "重大", name: "重大", color: "#991b1b" },
    { code: "SEVERE", value: "严重", name: "严重", color: "#dc2626" },
    { code: "MEDIUM", value: "中等", name: "中等", color: "#f59e0b" },
    { code: "GENERAL", value: "一般", name: "一般", color: "#3b82f6" },
  ],
  area_risk_level: [
    { code: "LOW", value: "low", name: "低风险", color: "#22c55e" },
    { code: "MEDIUM", value: "medium", name: "中风险", color: "#f59e0b" },
    { code: "HIGH", value: "high", name: "高风险", color: "#dc2626" },
  ],
  person_type: [
    { code: "EMPLOYEE", value: "员工", name: "员工", color: "#2563eb" },
    { code: "CONTRACTOR", value: "承包商", name: "承包商", color: "#8b5cf6" },
    { code: "VISITOR", value: "访客", name: "访客", color: "#14b8a6" },
  ],
  device_type: [],
  device_status: [
    { code: "ONLINE", value: "online", name: "在线", color: "#10b981" },
    { code: "OFFLINE", value: "offline", name: "离线", color: "#64748b" },
    { code: "ALARM", value: "alarm", name: "告警", color: "#f97316" },
    { code: "FAULT", value: "fault", name: "故障", color: "#dc2626" },
    { code: "MAINTENANCE", value: "maintenance", name: "维护中", color: "#8b5cf6" },
  ],
  area_type: [
    { code: "DANGER", value: "danger", name: "危险区域", color: "#dc2626" },
    { code: "RESTRICTED", value: "restricted", name: "限制区域", color: "#d97706" },
    { code: "PROHIBITED", value: "prohibited", name: "禁入区域", color: "#7f1d1d" },
    { code: "NORMAL", value: "normal", name: "普通区域", color: "#15803d" },
  ],
};

let snapshot = { groups: DEFAULT_GROUPS, revision: "defaults", status: "idle" };
let loadingPromise = null;
const listeners = new Set();

function emit(nextSnapshot) {
  snapshot = nextSnapshot;
  listeners.forEach((listener) => listener());
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useRuntimeDictionaries() {
  return useSyncExternalStore(subscribe, () => snapshot, () => snapshot);
}

export function findDictionaryItem(dictionarySnapshot, groupCode, value) {
  const normalizedValue = String(value ?? "").trim().toLowerCase();
  if (!normalizedValue) return null;
  return (dictionarySnapshot?.groups?.[groupCode] ?? []).find((item) =>
    String(item.value).trim().toLowerCase() === normalizedValue ||
    String(item.code).trim().toLowerCase() === normalizedValue
  ) ?? null;
}

export function dictionaryLabel(dictionarySnapshot, groupCode, value, fallback = value) {
  return findDictionaryItem(dictionarySnapshot, groupCode, value)?.name ?? fallback ?? "--";
}

export function dictionaryColor(dictionarySnapshot, groupCode, value, fallback = "#64748b") {
  return findDictionaryItem(dictionarySnapshot, groupCode, value)?.color ?? fallback;
}

export function activeDictionaryItems(dictionarySnapshot, groupCode) {
  return dictionarySnapshot?.groups?.[groupCode] ?? [];
}

export function loadRuntimeDictionaries({ force = false } = {}) {
  if (loadingPromise && !force) return loadingPromise;
  if (!force && snapshot.status === "ready") return Promise.resolve(snapshot);

  loadingPromise = apiFetch(`${API_BASE_URL}/system/dictionaries/runtime`)
    .then((response) => {
      if (!response.ok) throw new Error(`Dictionary request failed: ${response.status}`);
      return response.json();
    })
    .then((payload) => {
      emit({
        groups: { ...DEFAULT_GROUPS, ...(payload.groups ?? {}) },
        revision: payload.revision ?? String(Date.now()),
        status: "ready",
      });
      return snapshot;
    })
    .catch((error) => {
      if (snapshot.status !== "ready") emit({ ...snapshot, status: "fallback" });
      throw error;
    })
    .finally(() => {
      loadingPromise = null;
    });
  return loadingPromise;
}

export function resetRuntimeDictionaries() {
  loadingPromise = null;
  emit({ groups: DEFAULT_GROUPS, revision: "defaults", status: "idle" });
}
