import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { LogoMark } from "@/components/Logo";
export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-6 text-center">
      <LogoMark className="h-12 w-12" />
      <h1 className="font-display text-2xl font-bold">Page not found</h1>
      <p className="max-w-sm text-sm text-muted-foreground">This page doesn't exist or has moved.</p>
      <Link href="/"><Button data-testid="button-home">Back to home</Button></Link>
    </div>
  );
}
