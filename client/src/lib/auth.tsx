import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { api, setAuthToken, queryClient, API_BASE } from "./queryClient";

export interface User { id: number; name: string; email: string; role: string; language: string; explain_mode: string; profession: string }
interface AuthCtx { user: User | null; booting: boolean; login: (email: string, password: string) => Promise<void>; signup: (name: string, email: string, password: string) => Promise<void>; logout: () => Promise<void>; update: (u: Partial<User>) => Promise<void> }
const Ctx = createContext<AuthCtx>(null as any);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [booting, setBooting] = useState(true);
  // Restore a session from the httpOnly cookie (works on same-origin deployments; harmless elsewhere)
  useEffect(() => {
    let alive = true;
    fetch(`${API_BASE}/api/auth/me`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null)).then((u) => { if (alive && u) setUser((cur) => cur || u); })
      .catch(() => {}).finally(() => alive && setBooting(false));
    return () => { alive = false; };
  }, []);
  const done = (r: { token: string; user: User }) => { setAuthToken(r.token); setUser(r.user); queryClient.clear(); };
  const login = useCallback(async (email: string, password: string) => done(await api("POST", "/api/auth/login", { email, password })), []);
  const signup = useCallback(async (name: string, email: string, password: string) => done(await api("POST", "/api/auth/signup", { name, email, password })), []);
  const logout = useCallback(async () => { try { await api("POST", "/api/auth/logout"); } catch { /* ignore */ } setAuthToken(null); setUser(null); queryClient.clear(); }, []);
  const update = useCallback(async (u: Partial<User>) => setUser(await api("PATCH", "/api/me", u)), []);
  return <Ctx.Provider value={{ user, booting, login, signup, logout, update }}>{children}</Ctx.Provider>;
}
export const useAuth = () => useContext(Ctx);
/** Where to send the user after logging in (set when a protected route bounces them to /login). */
export const returnTo: { path: string | null } = { path: null };

// Theme: seeded from the OS preference, toggled in memory
const ThemeCtx = createContext<{ dark: boolean; toggle: () => void }>({ dark: false, toggle: () => {} });
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [dark, setDark] = useState(() => typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches);
  useEffect(() => { document.documentElement.classList.toggle("dark", dark); }, [dark]);
  return <ThemeCtx.Provider value={{ dark, toggle: () => setDark((d) => !d) }}>{children}</ThemeCtx.Provider>;
}
export const useTheme = () => useContext(ThemeCtx);
