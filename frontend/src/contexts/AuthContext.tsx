"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { authApi, AuthUser } from "@/lib/api";

interface AuthState {
  user: AuthUser | null;
  loggedIn: boolean;
  loading: boolean;
}

interface AuthContextValue extends AuthState {
  checkSession: () => Promise<void>;
  login: (identifier: string, password: string) => Promise<void>;
  register: (
    identifier: string,
    identifierType: "email" | "phone",
    password: string,
    confirmPassword: string
  ) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    loggedIn: false,
    loading: true,
  });
  const checkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const checkSession = useCallback(async () => {
    try {
      const res = await authApi.me();
      setState({
        user: res.user,
        loggedIn: res.loggedIn,
        loading: false,
      });
    } catch {
      setState({ user: null, loggedIn: false, loading: false });
    }
  }, []);

  const scheduleRecheck = useCallback(() => {
    if (typeof window === "undefined") return;
    if (checkTimerRef.current) clearTimeout(checkTimerRef.current);
    // 每 5 分钟续一次 session（session TTL 是 7 天）
    checkTimerRef.current = setTimeout(checkSession, 5 * 60 * 1000);
  }, [checkSession]);

  const login = useCallback(
    async (identifier: string, password: string) => {
      const res = await authApi.login({ identifier, password });
      if (!res.success) throw new Error(res.detail || "登录失败");
      setState({ user: res.user!, loggedIn: true, loading: false });
      scheduleRecheck();
    },
    [scheduleRecheck]
  );

  const register = useCallback(
    async (
      identifier: string,
      identifierType: "email" | "phone",
      password: string,
      confirmPassword: string
    ) => {
      const res = await authApi.register({
        identifier,
        identifierType,
        password,
        confirmPassword,
      });
      if (!res.success) throw new Error(res.detail || "注册失败");
      setState({ user: res.user!, loggedIn: true, loading: false });
      scheduleRecheck();
    },
    [scheduleRecheck]
  );

  const logout = useCallback(async () => {
    await authApi.logout();
    setState({ user: null, loggedIn: false, loading: false });
    if (checkTimerRef.current) clearTimeout(checkTimerRef.current);
  }, []);

  const refreshUser = useCallback(async () => {
    await checkSession();
  }, [checkSession]);

  // 初始化：检查 session
  useEffect(() => {
    checkSession();
    return () => {
      if (checkTimerRef.current) clearTimeout(checkTimerRef.current);
    };
  }, [checkSession]);

  return (
    <AuthContext.Provider
      value={{ ...state, checkSession, login, register, logout, refreshUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
