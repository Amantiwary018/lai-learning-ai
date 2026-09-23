import { useEffect } from "react";
import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Count in-app navigations so "Back" never leaves the site: if the user opened this page
// directly (no earlier LAI page in history), Back goes to a sensible parent instead.
let depth = 0;
let listening = false;
function listen() {
  if (listening || typeof window === "undefined") return;
  listening = true;
  window.addEventListener("hashchange", () => { depth += 1; });
}

/** Parent page for a route, used when there is no in-app history to go back to. */
function parentOf(path: string, loggedIn: boolean) {
  const home = loggedIn ? "/dashboard" : "/";
  if (path.startsWith("/learn/") || path.startsWith("/test/") || path.startsWith("/course/")) return "/courses";
  if (path.startsWith("/certificate/")) return "/certificates";
  if (path.startsWith("/visual/")) return "/visual";
  if (path.startsWith("/verify/")) return "/verify";
  return home;
}

export function BackButton({ loggedIn, className }: { loggedIn: boolean; className?: string }) {
  const [loc, nav] = useLocation();
  useEffect(listen, []);
  const home = loggedIn ? "/dashboard" : "/";
  if (loc === home || loc === "/") return null;
  const goBack = () => {
    if (depth > 0) { depth -= 2; window.history.back(); } // the back navigation itself fires hashchange (+1)
    else nav(parentOf(loc, loggedIn));
  };
  return (
    <Button variant="ghost" size="sm" onClick={goBack} className={cn("gap-1.5", className)} aria-label="Go back" data-testid="button-back">
      <ArrowLeft className="h-4 w-4" /><span className="hidden sm:inline">Back</span>
    </Button>
  );
}
