import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { BackButton } from "@/components/BackButton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/AppShell";
import { useAuth, returnTo } from "@/lib/auth";
import { Loader2 } from "lucide-react";

export default function AuthPage({ mode }: { mode: "login" | "signup" }) {
  const { login, signup } = useAuth();
  const [, nav] = useLocation();
  const [name, setName] = useState(""); const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const { user } = useAuth(); const target = useRef("/dashboard");
  // navigate only after the user state has committed, so protected routes see the session
  useEffect(() => { if (user) { const p = target.current === "/dashboard" && returnTo.path ? returnTo.path : target.current; returnTo.path = null; nav(p); } }, [user]);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr("");
    if (mode === "signup" && name.trim().length < 2) return setErr("Please enter your full name.");
    if (!/^\S+@\S+\.\S+$/.test(email)) return setErr("Please enter a valid email address.");
    if (password.length < 8) return setErr("Password must be at least 8 characters.");
    setBusy(true);
    try { target.current = "/dashboard"; mode === "login" ? await login(email, password) : await signup(name, email, password); }
    catch (e: any) { setErr(e.message || "Something went wrong"); } finally { setBusy(false); }
  };
  const demo = async (_who: "student") => {
    setBusy(true); setErr("");
    try { target.current = "/dashboard"; await login("student@lai.app", "Student@123"); }
    catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex flex-col p-6 sm:p-10">
        <div className="flex items-center justify-between"><Link href="/"><Logo /></Link><div className="flex items-center gap-1"><BackButton loggedIn={false} /><ThemeToggle /></div></div>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
          <h1 className="font-display text-2xl font-bold">{mode === "login" ? "Welcome back" : "Create your LAI account"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{mode === "login" ? "Log in to continue learning." : "Free forever for learners. No credit card."}</p>
          <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
            {mode === "signup" && <div className="space-y-1.5"><Label htmlFor="name">Full name</Label><Input id="name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" data-testid="input-name" /></div>}
            <div className="space-y-1.5"><Label htmlFor="email">Email</Label><Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" data-testid="input-email" /></div>
            <div className="space-y-1.5"><Label htmlFor="password">Password</Label><Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"} data-testid="input-password" />{mode === "signup" && <p className="text-xs text-muted-foreground">At least 8 characters, with letters and numbers.</p>}</div>
            {err && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert" data-testid="text-auth-error">{err}</p>}
            <Button type="submit" className="w-full" disabled={busy} data-testid="button-submit">{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{mode === "login" ? "Log in" : "Create account"}</Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">{mode === "login" ? <>New to LAI? <Link href="/signup" className="font-medium text-primary">Create an account</Link></> : <>Already have an account? <Link href="/login" className="font-medium text-primary">Log in</Link></>}</p>
          <div className="mt-8 rounded-xl border bg-card p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Try the demo</p>
            <div className="mt-3 flex gap-2"><Button variant="outline" size="sm" className="flex-1" onClick={() => demo("student")} disabled={busy} data-testid="button-demo-student">Demo student</Button></div>
          </div>
        </div>
      </div>
      <div className="board relative hidden items-center justify-center border-l p-12 lg:flex">
        <div className="max-w-md font-hand text-board-ink">
          <p className="text-3xl">Learn → Ask → See</p>
          <p className="mt-2 text-3xl">Practice → Build</p>
          <p className="mt-2 text-3xl text-board-accent">→ Get certified</p>
          <p className="mt-8 font-sans text-sm text-board-muted">“Don't just study. See it, interact with it, build it and prove your skills.”</p>
        </div>
      </div>
    </div>
  );
}
