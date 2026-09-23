import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Play, Pause, RotateCcw, Loader2, Captions, Code2, AlertTriangle, SkipBack, SkipForward, ListVideo, CheckCircle2, Languages, Maximize, Minimize, MoreVertical, X } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { mediaUrl, api } from "@/lib/queryClient";
import { cn } from "@/lib/utils";

export interface Step { say: string; write: { kind: string; content: string } | null; start: number; end: number }
export interface Scene { index: number; title: string; start: number; end: number; duration: number; steps: Step[] }
export interface Manifest { videoId: string; lang: string; duration: number; audio: string; captions: string; scenes: Scene[]; qc: { passed: boolean; checks: { name: string; passed: boolean; detail: string }[] } }
export interface VideoVariant { id: string; lang: string; status: string; error?: string | null; manifest: Manifest | null }

const fmt = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;
const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const LANG_LABEL: Record<string, string> = { en: "English", hi: "हिन्दी", hinglish: "Hinglish" };

/** Writing window for a step: the hand writes while the teacher starts speaking, finishing before the step ends. */
function writeWindow(st: Step) {
  const chars = st.write?.content.length || 1;
  const dur = st.end - st.start;
  const start = st.start + Math.min(0.25, dur * 0.1);
  const len = Math.min(dur * 0.8, Math.max(0.8, chars * (st.write?.kind === "code" ? 0.06 : 0.085)));
  return { start, end: start + len };
}

/** The hand: a stylised hand holding a marker, tip at (0,0). */
function Hand({ x, y, t, visible, size = 120 }: { x: number; y: number; t: number; visible: boolean; size?: number }) {
  const wobble = Math.sin(t * 22) * 1.6 * (size / 120);
  const k = size / 120;
  return (
    <svg aria-hidden className="pointer-events-none absolute z-20 transition-opacity duration-200" style={{ left: x - 4 * k, top: y - 6 * k + wobble, opacity: visible ? 0.95 : 0 }} width={size} height={size} viewBox="0 0 120 120">
      <g transform="rotate(-8 10 10)">
        <path d="M4 6 L22 24" stroke="#1d2b64" strokeWidth="7" strokeLinecap="round" />
        <path d="M2 3 L7 9" stroke="#0f172a" strokeWidth="4" strokeLinecap="round" />
        <path d="M20 22 L58 60" stroke="#2847d6" strokeWidth="11" strokeLinecap="round" />
        <path d="M34 30 C52 22 74 30 88 48 C100 64 104 86 96 104 L62 112 C52 96 40 84 30 72 C24 64 22 52 28 44 Z" fill="#f2c9a5" stroke="#c98f68" strokeWidth="2" />
        <path d="M36 44 C44 40 52 42 56 48" stroke="#c98f68" strokeWidth="2" fill="none" strokeLinecap="round" />
        <path d="M30 58 C38 54 46 56 50 62" stroke="#c98f68" strokeWidth="2" fill="none" strokeLinecap="round" />
        <path d="M60 36 C70 34 80 38 86 46" stroke="#c98f68" strokeWidth="2" fill="none" strokeLinecap="round" />
      </g>
    </svg>
  );
}

function BoardLine({ kind, text, p, lineRef }: { kind: string; text: string; p: number; lineRef?: (el: HTMLElement | null) => void }) {
  const clip = { clipPath: `inset(-12px ${(1 - p) * 100}% -12px -4px)` } as const;
  if (kind === "code") return null;
  const base = "relative inline-block whitespace-pre-wrap font-hand font-bold leading-snug [text-rendering:geometricPrecision]";
  if (kind === "heading")
    return (
      <div className="mb-2">
        <span ref={lineRef} className={cn(base, "text-[clamp(1.35rem,3.4vw,2.3rem)] text-board-ink")} style={clip}>{text}
          <svg className="absolute -bottom-2 left-0 h-3 w-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 10"><path d="M1 6 Q 30 2 55 6 T 99 5" stroke="hsl(var(--chart-2))" strokeWidth="3" fill="none" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - clamp((p - 0.7) / 0.3)} vectorEffect="non-scaling-stroke" /></svg>
        </span>
      </div>
    );
  if (kind === "highlight")
    return (
      <div className="my-1">
        <span ref={lineRef} className={cn(base, "px-2 text-[clamp(1.1rem,2.6vw,1.7rem)] text-board-accent")} style={clip}>
          <span className="absolute inset-0 -z-0 rounded-sm bg-[hsl(var(--chart-2)/0.28)]" style={{ transformOrigin: "left", transform: `scaleX(${clamp(p * 1.1)})` }} />
          <span className="relative">{text}</span>
        </span>
      </div>
    );
  return (
    <div className={cn("my-0.5", kind === "equation" && "my-1.5 pl-4")}>
      {kind === "bullet" && <span className="mr-2 font-hand text-board-accent" style={{ opacity: p > 0 ? 1 : 0 }}>•</span>}
      <span ref={lineRef} className={cn(base, kind === "equation" ? "text-[clamp(1.25rem,3.1vw,2.1rem)] tracking-wide text-board-ink" : "text-[clamp(1.05rem,2.5vw,1.65rem)] text-board-ink")} style={clip}>{text}</span>
    </div>
  );
}

export function VideoPlayer({ videos, initialPos = 0, onProgress, onComplete, codeLang }: { videos: VideoVariant[]; initialPos?: number; onProgress?: (pos: number) => void; onComplete?: () => void; codeLang?: string | null }) {
  const published = videos.filter((v) => v.status === "published" && v.manifest);
  const [variantId, setVariantId] = useState(published[0]?.id);
  const variant = published.find((v) => v.id === variantId) || published[0];
  const m = variant?.manifest || null;
  const audioRef = useRef<HTMLAudioElement>(null);
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [buffering, setBuffering] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rate, setRate] = useState(1);
  const [cc, setCc] = useState(true);
  const [fullCode, setFullCode] = useState(false);
  const [showScenes, setShowScenes] = useState(false);
  const [resumeAt, setResumeAt] = useState<number | null>(initialPos > 5 ? initialPos : null);
  const [ended, setEnded] = useState(false);
  const [bust, setBust] = useState(0);
  const lastSave = useRef(0);
  const lastTick = useRef<{ media: number; wall: number } | null>(null);
  const userSeek = useRef(false);
  const writingEl = useRef<HTMLElement | null>(null);
  const writingP = useRef(0);
  const writingCode = useRef(false);
  const boardRef = useRef<HTMLDivElement>(null);
  const [pen, setPen] = useState({ x: 0, y: 0, on: false });
  const playerRef = useRef<HTMLDivElement>(null);
  const textColRef = useRef<HTMLDivElement>(null);
  const codeColRef = useRef<HTMLDivElement>(null);
  const [fs, setFs] = useState(false); // full-screen view: the player covers the whole window
  const [boardW, setBoardW] = useState(800);

  useEffect(() => {
    const b = boardRef.current; if (!b) return;
    const ro = new ResizeObserver(() => setBoardW(b.clientWidth)); ro.observe(b);
    return () => ro.disconnect();
  });
  useEffect(() => { // lock page scroll while the full-screen view is open
    if (!fs) return; const o = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = o; };
  }, [fs]);
  const toggleFs = () => setFs((v) => !v);


  const report = useCallback((type: string, detail?: string) => {
    if (!m) return;
    api("POST", `/api/videos/${m.videoId}/event`, { type, position: audioRef.current?.currentTime || 0, detail }).catch(() => {});
  }, [m]);

  // animation clock: visuals are a pure function of the audio clock -> cannot drift from speech
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const a = audioRef.current;
      if (a) {
        const now = performance.now();
        const cur = a.currentTime;
        if (lastTick.current && !a.paused && !userSeek.current) {
          const dm = cur - lastTick.current.media, dw = (now - lastTick.current.wall) / 1000;
          if (Math.abs(dm - dw * a.playbackRate) > 1.5 && dw < 2) report("time-jump", `media advanced ${dm.toFixed(2)}s in ${dw.toFixed(2)}s wall`);
        }
        lastTick.current = { media: cur, wall: now };
        userSeek.current = false;
        setT(cur);
        if (!a.paused && onProgress && Math.abs(cur - lastSave.current) > 5) { lastSave.current = cur; onProgress(cur); }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [onProgress, report]);

  // stall watchdog
  useEffect(() => {
    if (!playing) return;
    let last = audioRef.current?.currentTime ?? 0; let still = 0;
    const iv = setInterval(() => {
      const a = audioRef.current; if (!a || a.paused) return;
      if (Math.abs(a.currentTime - last) < 0.01) { still++; if (still >= 8) { setError("Playback stalled. Check your connection and retry."); report("stall"); a.pause(); } }
      else still = 0;
      last = a.currentTime;
    }, 1000);
    return () => clearInterval(iv);
  }, [playing, report]);

  useEffect(() => { if (audioRef.current) audioRef.current.playbackRate = rate; }, [rate]);

  const seek = (to: number) => { const a = audioRef.current; if (!a || !m) return; userSeek.current = true; a.currentTime = clamp(to, 0, m.duration - 0.05); setT(a.currentTime); setEnded(false); };
  const toggle = async () => {
    const a = audioRef.current; if (!a) return;
    if (a.paused) { try { if (ended) seek(0); await a.play(); } catch (e: any) { setError("Your browser blocked playback. Press play again."); } }
    else a.pause();
  };
  const retry = () => {
    const pos = audioRef.current?.currentTime || t;
    setError(null); setBuffering(true); setBust((b) => b + 1);
    setTimeout(() => { const a = audioRef.current; if (a) { a.load(); a.addEventListener("loadedmetadata", () => { a.currentTime = pos; a.play().catch(() => {}); }, { once: true }); } }, 30);
  };

  // keyboard shortcuts
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest("input,textarea,[contenteditable]")) return;
      if (!boardRef.current?.closest("[data-player]")?.matches(":hover, :focus-within")) return;
      if (e.code === "Space") { e.preventDefault(); toggle(); }
      if (e.code === "ArrowRight") seek(t + 5);
      if (e.code === "ArrowLeft") seek(t - 5);
      if (e.code === "KeyF") toggleFs();
      if (e.code === "Escape" && fs) setFs(false);
    };
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
  });

  const sceneIdx = useMemo(() => { if (!m) return 0; let i = 0; m.scenes.forEach((s, k) => { if (t >= s.start - 0.001) i = k; }); return i; }, [m, t]);
  const scene = m?.scenes[sceneIdx];
  const step = scene?.steps.find((s) => t >= s.start && t < s.end) || (scene && t >= scene.end ? scene.steps[scene.steps.length - 1] : undefined);
  const allCode = useMemo(() => m?.scenes.flatMap((s) => s.steps.filter((st) => st.write?.kind === "code").map((st) => st.write!.content)).join("\n") || "", [m]);

  // board items for the current scene with write progress
  const items = useMemo(() => {
    if (!scene) return [];
    return scene.steps.filter((st) => st.write && st.write.content?.trim()).map((st) => {
      const w = writeWindow(st);
      const p = fullCode && st.write!.kind === "code" ? 1 : clamp((t - w.start) / (w.end - w.start));
      return { st, p, writing: p > 0 && p < 1 };
    }).filter((x) => x.p > 0);
  }, [scene, t, fullCode]);

  // pen follows the reveal edge of the line currently being written
  useEffect(() => {
    const el = writingEl.current, board = boardRef.current;
    const active = items.some((x) => x.writing);
    if (el && board && active && el.isConnected) {
      const br = board.getBoundingClientRect(), er = el.getBoundingClientRect();
      if (writingCode.current) setPen({ x: er.right - br.left, y: er.bottom - br.top - 2, on: true });
      else setPen({ x: er.left - br.left + er.width * writingP.current, y: er.top - br.top + er.height * 0.78, on: true });
    } else setPen((pp) => (pp.on ? { ...pp, on: false } : pp));
  }, [items]);

  useEffect(() => {
    for (const el of [textColRef.current, codeColRef.current]) if (el) el.scrollTop = el.scrollHeight;
  }, [items]);

  if (!published.length) {
    const v = videos[0];
    return (
      <div className="flex aspect-video w-full flex-col items-center justify-center gap-3 rounded-xl border bg-card p-6 text-center" data-testid="status-video-unavailable">
        {v?.status === "failed" ? <AlertTriangle className="h-8 w-8 text-destructive" /> : <Loader2 className="h-8 w-8 animate-spin text-primary" />}
        <p className="font-semibold">{!v ? "No video lesson for this topic yet" : v.status === "failed" ? "This lecture did not pass quality checks" : "This lecture is being generated and quality-checked"}</p>
        <p className="max-w-md text-sm text-muted-foreground">{!v ? "Notes, visuals, practice and the AI tutor are available below." : v.status === "failed" ? "We never publish lectures with audio or sync problems. The faulty scene is being regenerated; use the notes meanwhile." : "Every scene's voice, timing and captions are validated before publishing. This usually takes a minute or two."}</p>
      </div>
    );
  }

  const src = mediaUrl(`/media/videos/${m!.videoId}/${m!.audio}${bust ? `?r=${bust}` : ""}`);
  const codeItems = items.filter((x) => x.st.write!.kind === "code");
  const textItems = items.filter((x) => x.st.write!.kind !== "code");
  const firstWriting = items.find((x) => x.writing);

  return (
    <div ref={playerRef} data-player tabIndex={-1} className={cn("overflow-hidden bg-card outline-none", fs ? "fixed inset-0 z-[100] flex flex-col" : "rounded-xl border shadow-sm")} data-testid="video-player">
      <audio ref={audioRef} key={m!.videoId} src={src} preload="auto"
        onLoadedMetadata={(e) => { setBuffering(false); if (resumeAt && resumeAt < m!.duration - 5) { /* wait for user choice */ } }}
        onWaiting={() => setBuffering(true)} onCanPlay={() => setBuffering(false)} onPlaying={() => { setBuffering(false); setPlaying(true); setError(null); }}
        onPause={() => { setPlaying(false); onProgress?.(audioRef.current?.currentTime || 0); }}
        onEnded={() => { setPlaying(false); setEnded(true); onProgress?.(0); onComplete?.(); }}
        onError={() => { setBuffering(false); setError("The lecture audio could not be loaded."); report("error", audioRef.current?.error?.message || `code ${audioRef.current?.error?.code}`); }} />

      {/* Board */}
      <div ref={boardRef} className={cn("board relative w-full cursor-pointer select-none overflow-hidden", fs ? "min-h-0 flex-1" : "aspect-[4/3] sm:aspect-video")} onClick={toggle} onDoubleClick={(e) => { e.preventDefault(); toggleFs(); }} data-testid="video-board">
        <div className="absolute left-4 top-3 z-10 flex items-center gap-2 text-xs font-medium text-board-muted sm:left-6 sm:top-4 sm:text-sm">
          <span className="rounded-full bg-board-chip px-2 py-0.5">Scene {sceneIdx + 1}/{m!.scenes.length}</span>
          <span className="line-clamp-1" data-testid="text-scene-title">{scene?.title}</span>
        </div>
        <div className={cn("absolute inset-0 flex gap-3 px-4 pt-11 sm:gap-4 sm:px-10 sm:pt-14", cc && step ? (fs ? "pb-20" : "pb-3 sm:pb-16") : "pb-4", codeItems.length ? "flex-col md:flex-row" : "flex-col")}>
          <div ref={textColRef} className={cn("no-scrollbar flex min-w-0 flex-col overflow-y-auto", codeItems.length ? "max-h-[42%] shrink-0 md:max-h-none md:w-1/2" : "w-full")}>
            {textItems.slice(-6).map((x, i) => (
              <div key={x.st.start}>{x.st.write!.content.split("\n").map((ln, k, arr) => {
                const lp = clamp(x.p * arr.length - k);
                return lp > 0 ? <BoardLine key={k} kind={x.st.write!.kind} text={ln} p={lp} lineRef={x === firstWriting && lp < 1 && lp > 0 ? (el) => { if (el) { writingEl.current = el; writingP.current = lp; writingCode.current = false; } } : undefined} /> : null;
              })}</div>
            ))}
          </div>
          {codeItems.length > 0 && (
            <div ref={codeColRef} className="no-scrollbar min-h-0 min-w-0 flex-1 overflow-y-auto rounded-lg bg-[#0f1629] p-3 font-mono text-[clamp(0.78rem,1.7vw,1.1rem)] font-medium leading-relaxed text-[#e6ecff] shadow-inner sm:p-4">
              <div className="mb-2 flex gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" /><span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" /><span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" /><span className="ml-2 text-[10px] uppercase tracking-wider text-[#7d8bb5]">{codeLang || "code"}</span></div>
              {codeItems.map((x) => {
                const txt = x.st.write!.content; const n = Math.floor(txt.length * x.p);
                return <pre key={x.st.start} className="whitespace-pre-wrap break-words">{txt.slice(0, n)}{x.writing && <span ref={x === firstWriting ? (el) => { if (el) { writingEl.current = el; writingCode.current = true; } } : undefined} className="animate-pulse text-[#ffcc66]">▌</span>}</pre>;
              })}
            </div>
          )}
        </div>
        <Hand x={pen.x} y={pen.y} t={t} visible={pen.on && playing} size={Math.round(Math.max(52, Math.min(120, boardW * 0.1)))} />
        {cc && step && (
          <div className={cn("absolute inset-x-0 bottom-3 z-10 justify-center px-4", fs ? "flex" : "hidden sm:flex")}>
            <p className={cn("max-w-3xl rounded-md bg-black/80 px-3 py-1.5 text-center leading-snug text-white", fs ? "text-base sm:text-lg" : "text-sm")} data-testid="text-caption">{step.say}</p>
          </div>
        )}
        {(buffering && !error) && <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/10"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>}
        {!playing && !buffering && !error && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-black/25 backdrop-blur-[1px]">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg">{ended ? <RotateCcw className="h-7 w-7" /> : <Play className="ml-1 h-7 w-7" />}</div>
            {resumeAt && t < 1 && !ended && (
              <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                <Button size="sm" onClick={() => { seek(resumeAt); setResumeAt(null); audioRef.current?.play(); }} data-testid="button-resume">Resume from {fmt(resumeAt)}</Button>
                <Button size="sm" variant="secondary" onClick={() => { setResumeAt(null); seek(0); audioRef.current?.play(); }} data-testid="button-start-over">Start over</Button>
              </div>
            )}
            {ended && <p className="flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1 text-sm text-white"><CheckCircle2 className="h-4 w-4 text-emerald-400" /> Lesson complete — continue with the notes</p>}
          </div>
        )}
        {error && (
          <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-3 bg-black/70 p-6 text-center text-white" onClick={(e) => e.stopPropagation()} data-testid="status-video-error">
            <AlertTriangle className="h-8 w-8 text-amber-400" /><p className="font-medium">{error}</p>
            <Button onClick={retry} data-testid="button-retry-video"><RotateCcw className="mr-2 h-4 w-4" />Retry from {fmt(t)}</Button>
            <p className="text-xs text-white/70">The issue has been logged for the LAI team.</p>
          </div>
        )}
      </div>
      {cc && step && !fs && <p className="border-t bg-card px-3 py-2 text-center text-sm leading-snug text-foreground/80 sm:hidden" data-testid="text-caption-mobile">{step.say}</p>}

      {/* Controls */}
      <div className="space-y-2 border-t px-3 py-2.5 sm:px-4">
        <div className="relative h-2 w-full cursor-pointer rounded-full bg-muted" onClick={(e) => { const r = (e.currentTarget as HTMLDivElement).getBoundingClientRect(); seek(((e.clientX - r.left) / r.width) * m!.duration); }} data-testid="progress-video">
          <div className="absolute inset-y-0 left-0 rounded-full bg-primary" style={{ width: `${(t / m!.duration) * 100}%` }} />
          {m!.scenes.slice(1).map((s) => <div key={s.index} className="absolute top-0 h-2 w-0.5 bg-background" style={{ left: `${(s.start / m!.duration) * 100}%` }} title={s.title} />)}
        </div>
        <div className="flex flex-wrap items-center gap-1 sm:gap-2">
          <Button size="icon" variant="ghost" onClick={toggle} aria-label={playing ? "Pause" : "Play"} data-testid="button-play">{playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}</Button>
          <Button size="icon" variant="ghost" onClick={() => seek(m!.scenes[Math.max(0, sceneIdx - (t - (scene?.start || 0) < 2 ? 1 : 0))].start)} aria-label="Previous scene" data-testid="button-prev-scene"><SkipBack className="h-4 w-4" /></Button>
          <Button size="icon" variant="ghost" onClick={() => sceneIdx < m!.scenes.length - 1 && seek(m!.scenes[sceneIdx + 1].start)} aria-label="Next scene" data-testid="button-next-scene"><SkipForward className="h-4 w-4" /></Button>
          <span className="font-mono text-xs tabular-nums text-muted-foreground" data-testid="text-video-time">{fmt(t)} / {fmt(m!.duration)}</span>
          <div className="ml-auto flex flex-wrap items-center gap-1">
            {published.length > 1 && (
              <Button size="sm" variant="ghost" onClick={() => { const i = published.findIndex((v) => v.id === variant!.id); audioRef.current?.pause(); setVariantId(published[(i + 1) % published.length].id); setT(0); }} data-testid="button-video-language"><Languages className="mr-1 h-4 w-4" />{LANG_LABEL[variant!.lang]}</Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => setRate((r) => (r >= 1.5 ? 0.75 : r + 0.25))} data-testid="button-speed">{rate}x</Button>
            <Button size="icon" variant={cc ? "secondary" : "ghost"} onClick={() => setCc(!cc)} aria-label="Captions" data-testid="button-captions"><Captions className="h-4 w-4" /></Button>
            <Button size="icon" variant={showScenes ? "secondary" : "ghost"} onClick={() => setShowScenes(!showScenes)} aria-label="Scenes" data-testid="button-scenes"><ListVideo className="h-4 w-4" /></Button>
            {allCode && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild><Button size="icon" variant="ghost" aria-label="More options" data-testid="button-video-more"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="z-[110]">
                  <DropdownMenuItem onSelect={() => setFullCode(!fullCode)} data-testid="button-full-code"><Code2 className="mr-2 h-4 w-4" />{fullCode ? "Hide full code" : "Show full code"}</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <Button size="icon" variant="ghost" onClick={toggleFs} aria-label={fs ? "Exit full screen" : "Full screen"} title={fs ? "Exit full screen (F)" : "Full screen (F)"} data-testid="button-fullscreen">{fs ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}</Button>
          </div>
        </div>
        {fullCode && allCode && !fs && (
          <div className="relative">
            <Button size="icon" variant="ghost" className="absolute right-1 top-1 h-7 w-7 text-[#dbe4ff] hover:bg-white/10" onClick={() => setFullCode(false)} aria-label="Hide full code" data-testid="button-hide-full-code"><X className="h-4 w-4" /></Button>
            <pre className="max-h-72 overflow-auto rounded-lg bg-[#0f1629] p-3 pr-10 font-mono text-sm text-[#e6ecff]" data-testid="text-full-code">{allCode}</pre>
          </div>
        )}
        {showScenes && (
          <div className={cn("grid gap-1 sm:grid-cols-2", fs && "max-h-48 overflow-y-auto")}>
            {m!.scenes.map((s) => (
              <button key={s.index} onClick={() => seek(s.start)} className={cn("flex items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover-elevate", s.index === sceneIdx && "bg-secondary")} data-testid={`button-scene-${s.index}`}>
                <span className="line-clamp-1">{s.index + 1}. {s.title}</span><span className="font-mono text-xs text-muted-foreground">{fmt(s.start)}</span>
              </button>
            ))}
            <p className="col-span-full flex items-center gap-1.5 pt-1 text-xs text-muted-foreground"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />Quality checked: {m!.qc.checks.filter((c) => c.passed).length}/{m!.qc.checks.length} checks passed · single continuous audio track · captions from the same script</p>
          </div>
        )}
      </div>
    </div>
  );
}
