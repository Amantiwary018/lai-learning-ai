import { useEffect, useRef, useState } from "react";
import { Send, Camera, Mic, MicOff, FileText, X, Loader2, Volume2, Square, ThumbsUp, HelpCircle, AlertTriangle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Markdown } from "./Markdown";
import { api } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

export const MODES = [
  { v: "very-easy", l: "Very Easy" }, { v: "beginner", l: "Beginner" }, { v: "detailed", l: "Detailed" }, { v: "step-by-step", l: "Step-by-Step" },
  { v: "visual", l: "Visual Explanation" }, { v: "exam", l: "Exam Answer Style" }, { v: "revision", l: "Quick Revision" },
];
export const LANGS = [{ v: "en", l: "English" }, { v: "hi", l: "हिन्दी (Hindi)" }, { v: "hinglish", l: "Hinglish" }];

interface Msg { role: "user" | "assistant"; content: string; image?: string; pdfName?: string; confidence?: string; needsClarification?: boolean; model?: string; fallback?: boolean; inputType?: string }

const readFile = (f: File) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(f); });
async function shrinkImage(dataUrl: string, max = 1600): Promise<string> {
  return new Promise((res) => {
    const img = new Image();
    img.onload = () => { const s = Math.min(1, max / Math.max(img.width, img.height)); if (s === 1 && dataUrl.length < 3_000_000) return res(dataUrl); const c = document.createElement("canvas"); c.width = img.width * s; c.height = img.height * s; c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height); res(c.toDataURL("image/jpeg", 0.88)); };
    img.onerror = () => res(dataUrl); img.src = dataUrl;
  });
}

export function DoubtChat({ topicId = null, topicTitle, compact = false }: { topicId?: number | null; topicTitle?: string; compact?: boolean }) {
  const { user } = useAuth();
  const [mode, setMode] = useState(user?.explain_mode || "beginner");
  const [lang, setLang] = useState(user?.language || "en");
  const [text, setText] = useState(""); const [image, setImage] = useState<string | null>(null); const [pdf, setPdf] = useState<{ data: string; name: string } | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]); const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const [listening, setListening] = useState(false); const [voiceUsed, setVoiceUsed] = useState(false);
  const [speaking, setSpeaking] = useState<number | null>(null); const [ttsBusy, setTtsBusy] = useState<number | null>(null);
  const rec = useRef<any>(null); const audio = useRef<HTMLAudioElement | null>(null); const endRef = useRef<HTMLDivElement>(null);
  const photoInput = useRef<HTMLInputElement>(null); const pdfInput = useRef<HTMLInputElement>(null);
  const SR: any = typeof window !== "undefined" ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition : null;

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [msgs, busy]);
  useEffect(() => () => { audio.current?.pause(); rec.current?.stop?.(); }, []);

  const toggleMic = () => {
    setErr("");
    if (!SR) { setErr("Voice input isn't supported in this browser. Try Chrome or Edge, or type your question."); return; }
    if (listening) { rec.current?.stop(); return; }
    const r = new SR(); r.lang = lang === "hi" ? "hi-IN" : "en-IN"; r.interimResults = true; r.continuous = false;
    const base = text ? text + " " : "";
    r.onresult = (e: any) => { let s = ""; for (let i = 0; i < e.results.length; i++) s += e.results[i][0].transcript; setText(base + s); };
    r.onerror = (e: any) => { setErr(e.error === "not-allowed" ? "Microphone permission was denied. Allow microphone access or type your question." : `Voice input error: ${e.error}. Please try again or type.`); setListening(false); };
    r.onend = () => setListening(false);
    rec.current = r; r.start(); setListening(true); setVoiceUsed(true);
  };

  const onPhoto = async (f?: File) => {
    if (!f) return; setErr("");
    if (!/^image\/(png|jpe?g|webp|gif)$/.test(f.type)) return setErr("Please upload a PNG, JPG or WEBP image.");
    if (f.size > 12_000_000) return setErr("Image is too large (max 12 MB).");
    setImage(await shrinkImage(await readFile(f))); setPdf(null);
  };
  const onPdf = async (f?: File) => {
    if (!f) return; setErr("");
    if (f.type !== "application/pdf") return setErr("Please upload a PDF file.");
    if (f.size > 7_000_000) return setErr("PDF is too large (max 7 MB).");
    setPdf({ data: await readFile(f), name: f.name }); setImage(null);
  };

  const send = async (override?: string) => {
    const q = (override ?? text).trim();
    if (!q && !image && !pdf) return setErr("Type a question, or attach a photo or PDF.");
    setErr(""); const inputType = image ? "photo" : pdf ? "pdf" : voiceUsed ? "voice" : "text";
    const history = msgs.slice(-8).map((m) => ({ role: m.role, content: m.content.slice(0, 6000) }));
    const um: Msg = { role: "user", content: q || (image ? "Please solve the question in this photo." : `Explain the key ideas of ${pdf?.name}`), image: image || undefined, pdfName: pdf?.name, inputType };
    setMsgs((m) => [...m, um]); setText(""); setBusy(true);
    const sentImage = image, sentPdf = pdf; setImage(null); setVoiceUsed(false);
    try {
      const r = await api<any>("POST", "/api/doubts", { question: q, mode, lang, topicId, inputType, image: sentImage || undefined, pdf: sentPdf?.data, pdfName: sentPdf?.name, history });
      setMsgs((m) => [...m, { role: "assistant", content: r.answer, confidence: r.confidence, needsClarification: r.needsClarification, model: r.model, fallback: r.fallback }]);
    } catch (e: any) { setErr(e.message || "The AI tutor could not answer right now. Please try again."); setMsgs((m) => m.slice(0, -1)); setText(q); setImage(sentImage); }
    finally { setBusy(false); }
  };

  const listen = async (i: number, content: string) => {
    if (speaking === i) { audio.current?.pause(); setSpeaking(null); return; }
    audio.current?.pause(); setTtsBusy(i); setErr("");
    try { const r = await api<{ audio: string }>("POST", "/api/tts", { text: content }); const a = new Audio(r.audio); audio.current = a; a.onended = () => setSpeaking(null); await a.play(); setSpeaking(i); }
    catch (e: any) { setErr(e.message); } finally { setTtsBusy(null); }
  };

  const suggestions = topicTitle ? [`Explain ${topicTitle} with a simple real-life example`, `What are common mistakes in ${topicTitle}?`, `Give me 3 practice questions on ${topicTitle}`] : ["Solve: 2x + 5 = 17 step by step", "What is the difference between RAM and ROM?", "Explain pointers in C like I'm a beginner", "Hinglish mein samjhao: recursion kya hai?"];

  return (
    <div className={cn("flex flex-col rounded-xl border bg-card", compact ? "h-[560px]" : "h-[calc(100vh-190px)] min-h-[560px]")}>
      <div className="flex flex-wrap items-center gap-2 border-b p-3">
        <Select value={mode} onValueChange={setMode}><SelectTrigger className="h-8 w-[170px] text-xs" data-testid="select-mode"><SelectValue /></SelectTrigger><SelectContent>{MODES.map((m) => <SelectItem key={m.v} value={m.v}>{m.l}</SelectItem>)}</SelectContent></Select>
        <Select value={lang} onValueChange={setLang}><SelectTrigger className="h-8 w-[150px] text-xs" data-testid="select-language"><SelectValue /></SelectTrigger><SelectContent>{LANGS.map((m) => <SelectItem key={m.v} value={m.v}>{m.l}</SelectItem>)}</SelectContent></Select>
        {topicTitle && <span className="truncate rounded-md bg-secondary px-2 py-1 text-xs text-muted-foreground">Context: {topicTitle}</span>}
        {msgs.length > 0 && <Button size="sm" variant="ghost" className="ml-auto h-8 text-xs" onClick={() => setMsgs([])} data-testid="button-new-chat">New chat</Button>}
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4" data-testid="list-messages">
        {!msgs.length && (
          <div className="mx-auto max-w-lg py-6 text-center">
            <Sparkles className="mx-auto h-8 w-8 text-primary" />
            <p className="mt-2 font-semibold">Ask any doubt</p>
            <p className="mt-1 text-sm text-muted-foreground">Type it, speak it, snap a photo of a handwritten question or error screenshot, or upload your notes as a PDF.</p>
            <div className="mt-4 flex flex-col gap-2">{suggestions.map((s) => <button key={s} onClick={() => send(s)} className="rounded-lg border px-3 py-2 text-left text-sm hover:border-primary" data-testid="button-suggestion">{s}</button>)}</div>
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
            <div className={cn("max-w-[92%] rounded-2xl px-4 py-3", m.role === "user" ? "bg-primary text-primary-foreground" : "border bg-background")} data-testid={`message-${m.role}-${i}`}>
              {m.image && <img src={m.image} alt="Uploaded question" className="mb-2 max-h-56 rounded-lg" />}
              {m.pdfName && <p className="mb-1 flex items-center gap-1 text-xs opacity-80"><FileText className="h-3.5 w-3.5" />{m.pdfName}</p>}
              {m.role === "user" ? <p className="whitespace-pre-wrap text-sm">{m.content}</p> : <Markdown>{m.content}</Markdown>}
              {m.role === "assistant" && (
                <div className="mt-3 space-y-2 border-t pt-2">
                  {m.confidence && m.confidence !== "high" && <p className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{m.confidence === "low" ? "The AI is not fully certain about this answer. Please verify it with your textbook or teacher." : "Mostly confident. Double-check key facts for exams."}</p>}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => listen(i, m.content)} disabled={ttsBusy === i} data-testid={`button-listen-${i}`}>{ttsBusy === i ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : speaking === i ? <Square className="mr-1 h-3.5 w-3.5" /> : <Volume2 className="mr-1 h-3.5 w-3.5" />}{speaking === i ? "Stop" : "Listen"}</Button>
                    {i === msgs.length - 1 && !busy && <>
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => send("Yes, I understood. Give me one similar practice question to try.")} data-testid="button-understood"><ThumbsUp className="mr-1 h-3.5 w-3.5" />Understood</Button>
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => send("I didn't understand. Please explain again more simply, with an everyday example.")} data-testid="button-not-understood"><HelpCircle className="mr-1 h-3.5 w-3.5" />Explain simpler</Button>
                    </>}
                    {m.model && <span className="ml-auto text-[10px] text-muted-foreground">via LAI AI Router · {m.model}{m.fallback ? " (fallback)" : ""}</span>}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
        {busy && <div className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="status-thinking"><Loader2 className="h-4 w-4 animate-spin" />{image || msgs[msgs.length - 1]?.image ? "Reading your photo and solving…" : "Thinking step by step…"}</div>}
        <div ref={endRef} />
      </div>

      <div className="border-t p-3">
        {err && <p className="mb-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive" role="alert" data-testid="text-doubt-error">{err}</p>}
        {(image || pdf) && (
          <div className="mb-2 flex items-center gap-2 rounded-lg border bg-background p-2 text-xs">
            {image ? <img src={image} alt="Attachment preview" className="h-12 w-12 rounded object-cover" /> : <FileText className="h-5 w-5 text-primary" />}
            <span className="flex-1 truncate">{image ? "Photo attached — add a note or just send" : pdf!.name}</span>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setImage(null); setPdf(null); }} aria-label="Remove attachment"><X className="h-4 w-4" /></Button>
          </div>
        )}
        <div className="flex items-end gap-2">
          <div className="flex gap-1">
            <input ref={photoInput} type="file" accept="image/png,image/jpeg,image/webp" capture="environment" className="hidden" onChange={(e) => { onPhoto(e.target.files?.[0]); e.target.value = ""; }} data-testid="input-photo" />
            <input ref={pdfInput} type="file" accept="application/pdf" className="hidden" onChange={(e) => { onPdf(e.target.files?.[0]); e.target.value = ""; }} data-testid="input-pdf" />
            <Button size="icon" variant="outline" onClick={() => photoInput.current?.click()} aria-label="Upload photo" data-testid="button-photo"><Camera className="h-4 w-4" /></Button>
            <Button size="icon" variant={listening ? "destructive" : "outline"} onClick={toggleMic} aria-label="Voice input" data-testid="button-mic">{listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}</Button>
            {!compact && <Button size="icon" variant="outline" onClick={() => pdfInput.current?.click()} aria-label="Upload PDF notes" data-testid="button-pdf"><FileText className="h-4 w-4" /></Button>}
          </div>
          <Textarea value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} placeholder={listening ? "Listening… speak now" : "Type your doubt… (Shift+Enter for a new line)"} rows={1} className="max-h-40 min-h-[40px] flex-1 resize-none" data-testid="input-doubt" />
          <Button size="icon" onClick={() => send()} disabled={busy} aria-label="Send" data-testid="button-send">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}</Button>
        </div>
      </div>
    </div>
  );
}
