import { type ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import { LayoutDashboard, BookOpen, MessageCircleQuestion, Box, Code2, Sparkles, NotebookPen, Award, ShieldCheck, Moon, Sun, LogOut, Menu, X, BadgeCheck, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "./Logo";
import { useAuth, useTheme } from "@/lib/auth";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/courses", label: "Courses", icon: BookOpen },
  { href: "/doubts", label: "AI Doubt Solver", icon: MessageCircleQuestion },
  { href: "/visual", label: "Visual Lab", icon: Box },
  { href: "/code-lab", label: "Code Lab", icon: Code2 },
  { href: "/ai-tools", label: "AI Tools Academy", icon: Sparkles },
  { href: "/notes", label: "My Notes", icon: NotebookPen },
  { href: "/certificates", label: "Certificates", icon: Award },
  { href: "/verify", label: "Verify Certificate", icon: BadgeCheck },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function ThemeToggle() {
  const { dark, toggle } = useTheme();
  return <Button size="icon" variant="ghost" onClick={toggle} aria-label="Toggle dark mode" data-testid="button-theme">{dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</Button>;
}

export function AppShell({ children }: { children: ReactNode }) {
  const [loc] = useLocation();
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const nav = [...NAV, ...(user?.role === "admin" ? [{ href: "/admin", label: "Admin Panel", icon: ShieldCheck }] : [])];
  const side = (
    <nav className="flex flex-col gap-0.5 p-3">
      {nav.map((n) => {
        const active = loc === n.href || (n.href !== "/dashboard" && loc.startsWith(n.href));
        return (
          <Link key={n.href} href={n.href} onClick={() => setOpen(false)} className={cn("flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors", active ? "bg-primary text-primary-foreground" : "text-foreground/80 hover:bg-secondary")} data-testid={`link-nav-${n.label.toLowerCase().replace(/\s+/g, "-")}`}>
            <n.icon className="h-4 w-4 shrink-0" />{n.label}
          </Link>
        );
      })}
    </nav>
  );
  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r bg-sidebar lg:flex">
        <div className="flex h-16 items-center border-b px-5"><Link href="/"><Logo /></Link></div>
        <div className="flex-1 overflow-y-auto">{side}</div>
        {user && <div className="border-t p-3 text-xs text-muted-foreground"><p className="truncate font-medium text-foreground" data-testid="text-user-name">{user.name}</p><p className="truncate">{user.email}</p></div>}
        <p className="border-t px-3 py-2 text-[11px] leading-snug text-muted-foreground" data-testid="text-owner-credit">© 2026 LAI – Learning AI<br />Created by Aman Kumar Tiwary · AJU/261982</p>
      </aside>
      {open && <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setOpen(false)} />}
      <aside className={cn("fixed inset-y-0 left-0 z-50 w-64 border-r bg-sidebar transition-transform lg:hidden", open ? "translate-x-0" : "-translate-x-full")}>
        <div className="flex h-16 items-center justify-between border-b px-4"><Logo /><Button size="icon" variant="ghost" onClick={() => setOpen(false)} aria-label="Close menu"><X className="h-4 w-4" /></Button></div>
        {side}
      </aside>
      <div className="lg:pl-60">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b bg-background/85 px-3 backdrop-blur sm:px-6">
          <Button size="icon" variant="ghost" className="lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu" data-testid="button-menu"><Menu className="h-5 w-5" /></Button>
          <div className="lg:hidden"><Logo compact /></div>
          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            {user && <Button variant="ghost" size="sm" onClick={logout} data-testid="button-logout"><LogOut className="mr-1.5 h-4 w-4" />Log out</Button>}
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl px-3 py-5 sm:px-6 sm:py-7">{children}</main>
      </div>
    </div>
  );
}

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div><h1 className="font-display text-xl font-bold sm:text-2xl" data-testid="text-page-title">{title}</h1>{subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}</div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}
