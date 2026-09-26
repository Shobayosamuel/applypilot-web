"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, getToken, setToken, type User } from "./api";

type AuthState = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  google: (idToken: string) => Promise<void>;
  logout: () => void;
};

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // The extension's content script may load after our first broadcast; when it
  // announces itself, hand it the current session.
  useEffect(() => {
    function onMsg(e: MessageEvent) {
      if (e.source === window && e.data?.source === "applypilot-ext" && e.data.type === "ready") {
        const t = getToken();
        if (t) setToken(t);
      }
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    api<User>("/me")
      .then((u) => {
        setUser(u);
        setToken(token); // re-broadcast to the extension on every load
      })
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const r = await api<{ token: string; user: User }>("/auth/login", { method: "POST", json: { email, password } });
    setToken(r.token);
    setUser(r.user);
  }, []);

  const signup = useCallback(async (name: string, email: string, password: string) => {
    const r = await api<{ token: string; user: User }>("/auth/signup", { method: "POST", json: { name, email, password } });
    setToken(r.token);
    setUser(r.user);
  }, []);

  const google = useCallback(async (idToken: string) => {
    const r = await api<{ token: string; user: User }>("/auth/google", { method: "POST", json: { id_token: idToken } });
    setToken(r.token);
    setUser(r.user);
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    window.location.href = "/login";
  }, []);

  return <Ctx.Provider value={{ user, loading, login, signup, google, logout }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth outside AuthProvider");
  return c;
}
