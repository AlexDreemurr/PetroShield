import React, { useCallback, useEffect, useMemo, useState } from "react";
import { API_BASE_URL, apiFetch, getAuthToken, readApiError, setAuthToken } from "../config/api";
import { AuthContext } from "./authStore";
import { loadRuntimeDictionaries, resetRuntimeDictionaries } from "../services/runtimeDictionaries";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(Boolean(getAuthToken()));

  const refreshUser = useCallback(async () => {
    if (!getAuthToken()) { setUser(null); setIsLoading(false); return null; }
    setIsLoading(true);
    try {
      const response = await apiFetch(`${API_BASE_URL}/auth/me`);
      if (!response.ok) throw new Error(await readApiError(response, "登录状态校验失败"));
      const nextUser = await response.json();
      setUser(nextUser);
      return nextUser;
    } catch {
      setAuthToken(null);
      setUser(null);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { refreshUser(); }, [refreshUser]);
  useEffect(() => {
    if (user) loadRuntimeDictionaries().catch(() => {});
    else resetRuntimeDictionaries();
  }, [user]);
  useEffect(() => {
    const handleUnauthorized = () => { resetRuntimeDictionaries(); setUser(null); setIsLoading(false); };
    window.addEventListener("petroshield:unauthorized", handleUnauthorized);
    return () => window.removeEventListener("petroshield:unauthorized", handleUnauthorized);
  }, []);

  async function login(username, password) {
    const response = await apiFetch(`${API_BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!response.ok) throw new Error(await readApiError(response, "登录失败"));
    const payload = await response.json();
    setAuthToken(payload.access_token);
    setUser(payload.user);
    return payload.user;
  }

  async function logout() {
    try { await apiFetch(`${API_BASE_URL}/auth/logout`, { method: "POST" }); } catch { /* 本地令牌仍会清除 */ }
    setAuthToken(null);
    resetRuntimeDictionaries();
    setUser(null);
  }

  const value = useMemo(() => ({ user, isLoading, login, logout, refreshUser, hasPermission: (code) => Boolean(user?.permissions?.includes(code)) }), [user, isLoading, refreshUser]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
