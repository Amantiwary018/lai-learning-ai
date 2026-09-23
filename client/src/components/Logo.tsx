export function LogoMark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-label="LAI logo" role="img" fill="none">
      <rect width="32" height="32" rx="8" className="fill-primary" />
      <path d="M10 7v15.5h11" stroke="white" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="22.5" cy="10" r="3.2" fill="#f5a524" />
    </svg>
  );
}
export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2">
      <LogoMark />
      {!compact && <span className="leading-none"><span className="block font-display text-lg font-extrabold tracking-tight">LAI</span><span className="block text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Learning AI</span></span>}
    </span>
  );
}
