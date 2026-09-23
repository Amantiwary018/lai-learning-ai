import { Switch, Route, Router, Redirect, useLocation } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, ThemeProvider, useAuth, returnTo } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/Landing";
import AuthPage from "@/pages/Auth";
import Dashboard from "@/pages/Dashboard";
import Catalog from "@/pages/Catalog";
import CoursePage from "@/pages/Course";
import Learn from "@/pages/Learn";
import TestPage from "@/pages/Test";
import Doubts from "@/pages/Doubts";
import VisualLab from "@/pages/VisualLab";
import CodeLab from "@/pages/CodeLab";
import AITools from "@/pages/AITools";
import Notes from "@/pages/Notes";
import { Certificates, CertificateView, Verify } from "@/pages/Certificates";
import ProjectPage from "@/pages/Project";
import Admin from "@/pages/Admin";
import Settings from "@/pages/Settings";
import type { ComponentType } from "react";

function Private({ component: C, admin = false }: { component: ComponentType<any>; admin?: boolean }) {
  const { user, booting } = useAuth();
  const [loc] = useLocation();
  if (!user && booting) return <div className="grid min-h-screen place-items-center text-sm text-muted-foreground" data-testid="status-session">Loading your session…</div>;
  if (!user) { returnTo.path = loc; return <Redirect to="/login" />; }
  if (admin && user.role !== "admin") return <Redirect to="/dashboard" />;
  return <AppShell><C /></AppShell>;
}
const Shell = (C: ComponentType<any>) => () => <AppShell><C /></AppShell>;

function AppRouter() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/login">{() => <AuthPage mode="login" />}</Route>
      <Route path="/signup">{() => <AuthPage mode="signup" />}</Route>
      <Route path="/dashboard">{() => <Private component={Dashboard} />}</Route>
      <Route path="/courses" component={Shell(Catalog)} />
      <Route path="/course/:slug" component={Shell(CoursePage)} />
      <Route path="/course/:slug/project">{() => <Private component={ProjectPage} />}</Route>
      <Route path="/learn/:id">{() => <Private component={Learn} />}</Route>
      <Route path="/test/:scope/:id">{() => <Private component={TestPage} />}</Route>
      <Route path="/doubts">{() => <Private component={Doubts} />}</Route>
      <Route path="/visual" component={Shell(VisualLab)} />
      <Route path="/visual/:id" component={Shell(VisualLab)} />
      <Route path="/code-lab">{() => <Private component={CodeLab} />}</Route>
      <Route path="/ai-tools" component={Shell(AITools)} />
      <Route path="/notes">{() => <Private component={Notes} />}</Route>
      <Route path="/certificates">{() => <Private component={Certificates} />}</Route>
      <Route path="/certificate/:id" component={Shell(CertificateView)} />
      <Route path="/verify" component={Shell(Verify)} />
      <Route path="/verify/:id" component={Shell(Verify)} />
      <Route path="/settings">{() => <Private component={Settings} />}</Route>
      <Route path="/admin">{() => <Private component={Admin} admin />}</Route>
      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Router hook={useHashLocation}>
              <AppRouter />
            </Router>
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
