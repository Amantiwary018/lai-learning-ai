import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "wouter";
import { Clock, Loader2, CheckCircle2, XCircle, ArrowLeft, ArrowRight, Flag, RotateCcw, Target, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AnswerInput, TYPE_LABEL } from "@/components/Question";
import { Markdown } from "@/components/Markdown";
import { api, queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export default function TestPage() {
  const { scope, id } = useParams<{ scope: string; id: string }>();
  const [paper, setPaper] = useState<any>(null); const [err, setErr] = useState(""); const [loading, setLoading] = useState(false);
  const [answers, setAnswers] = useState<Record<string, any>>({}); const [cur, setCur] = useState(0); const [left, setLeft] = useState(0);
  const [result, setResult] = useState<any>(null); const [submitting, setSubmitting] = useState(false); const [flags, setFlags] = useState<Set<number>>(new Set());
  const submitted = useRef(false); const answersRef = useRef<Record<string, any>>({});
  useEffect(() => { answersRef.current = answers; }, [answers]);

  const start = async () => {
    setLoading(true); setErr(""); setResult(null); setAnswers({}); setCur(0); setFlags(new Set()); submitted.current = false;
    try { const p = await api<any>("GET", `/api/tests/${scope}/${id}`); setPaper(p); setLeft(p.minutes * 60); }
    catch (e: any) { setErr(e.message); } finally { setLoading(false); }
  };
  useEffect(() => { start(); }, [scope, id]);

  const submit = async () => {
    if (!paper || submitted.current) return; submitted.current = true; setSubmitting(true);
    try { const r = await api<any>("POST", "/api/tests/submit", { token: paper.token, answers: answersRef.current }); setResult(r); queryClient.invalidateQueries(); window.scrollTo(0, 0); }
    catch (e: any) { setErr(e.message); submitted.current = false; } finally { setSubmitting(false); }
  };
  useEffect(() => {
    if (!paper || result) return;
    const iv = setInterval(() => setLeft((l) => { if (l <= 1) { clearInterval(iv); submit(); return 0; } return l - 1; }), 1000);
    return () => clearInterval(iv);
  }, [paper, result]);

  if (loading) return <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Preparing your test…</div>;
  if (err && !paper) return <div className="rounded-xl border bg-card p-6"><p className="text-sm text-destructive" data-testid="text-test-error">{err}</p><Button className="mt-4" variant="outline" onClick={() => history.back()}>Go back</Button></div>;
  if (!paper) return null;

  if (result) {
    return (
      <div className="space-y-5" data-testid="panel-results">
        <div className="rounded-2xl border bg-card p-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Results · {paper.title}</p>
          <div className="mt-3 flex flex-wrap items-end gap-6">
            <div><p className={cn("text-5xl font-extrabold tabular-nums", result.passed ? "text-emerald-600" : "text-destructive")} data-testid="text-score-percent">{result.percent}%</p><p className="text-sm text-muted-foreground">{result.passed ? "Passed" : "Below 60% pass mark"}</p></div>
            <div className="flex gap-6 text-sm"><div><p className="text-2xl font-bold tabular-nums">{Math.round(result.score * 10) / 10}/{result.total}</p><p className="text-muted-foreground">Score</p></div><div><p className="text-2xl font-bold tabular-nums text-emerald-600">{result.correct}</p><p className="text-muted-foreground">Correct</p></div><div><p className="text-2xl font-bold tabular-nums text-destructive">{result.incorrect}</p><p className="text-muted-foreground">Incorrect</p></div></div>
          </div>
          <div className={cn("mt-5 flex items-start gap-2 rounded-lg p-3 text-sm", result.weak.length ? "bg-amber-500/10" : "bg-emerald-500/10")} data-testid="text-recommendation">{result.weak.length ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" /> : <Target className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />}{result.recommendation}</div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="outline" onClick={start} data-testid="button-retake"><RotateCcw className="mr-2 h-4 w-4" />Retake</Button>
            {result.weak.slice(0, 3).map((w: any) => <Link key={w.id} href={`/learn/${w.id}`}><Button variant="outline" data-testid={`button-revise-${w.id}`}>Revise: {w.title}</Button></Link>)}
            {scope === "topic" && <Link href={`/learn/${id}`}><Button data-testid="button-back-topic">Back to topic</Button></Link>}
          </div>
        </div>
        {result.topics.length > 1 && (
          <div className="rounded-xl border bg-card p-5"><h3 className="font-semibold">Performance by topic</h3><div className="mt-3 space-y-2">{result.topics.map((t: any) => <div key={t.id} className="grid grid-cols-[1fr_120px_48px] items-center gap-3 text-sm"><span className="truncate">{t.title}</span><Progress value={t.percent} className="h-2" /><span className={cn("text-right tabular-nums", t.percent < 60 && "text-destructive")}>{t.percent}%</span></div>)}</div></div>
        )}
        <div className="space-y-3">
          <h3 className="font-semibold">Answer review</h3>
          {result.details.map((d: any, i: number) => (
            <div key={d.id} className={cn("rounded-xl border bg-card p-4", d.correct ? "border-emerald-500/40" : "border-destructive/40")} data-testid={`review-${d.id}`}>
              <div className="mb-2 flex items-center gap-2 text-xs">{d.correct ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <XCircle className="h-4 w-4 text-destructive" />}<span className="font-semibold">Q{i + 1}</span><Badge variant="secondary">{TYPE_LABEL[d.type]}</Badge><span className="text-muted-foreground">{d.topic}</span></div>
              <Markdown>{d.prompt}</Markdown>
              <div className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
                <p>Your answer: <b className={d.correct ? "text-emerald-600" : "text-destructive"}>{d.yourAnswer == null || d.yourAnswer === "" ? "Not answered" : d.type === "mcq" ? d.options?.[d.yourAnswer] : String(d.yourAnswer)}</b></p>
                {!d.correct && <p>Correct answer: <b>{d.type === "mcq" ? d.options?.[d.correctAnswer] : String(d.correctAnswer)}</b></p>}
              </div>
              {d.explanation && <div className="mt-2 rounded-lg bg-secondary/60 p-3 text-sm"><Markdown>{d.explanation}</Markdown></div>}
            </div>
          ))}
        </div>
      </div>
    );
  }

  const Q = paper.questions[cur]; const answered = Object.keys(answers).filter((k) => answers[k] !== "" && answers[k] != null).length;
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_260px]">
      <div>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div><h1 className="font-display text-lg font-bold sm:text-xl" data-testid="text-test-title">{paper.title}</h1><p className="text-sm text-muted-foreground">Question {cur + 1} of {paper.questions.length}</p></div>
          <div className={cn("flex items-center gap-1.5 rounded-lg border px-3 py-1.5 font-mono text-sm tabular-nums", left < 60 && "border-destructive text-destructive")} data-testid="text-timer"><Clock className="h-4 w-4" />{fmt(left)}</div>
        </div>
        <Progress value={(answered / paper.questions.length) * 100} className="mb-4 h-1.5" />
        <div className="rounded-xl border bg-card p-5">
          <div className="mb-2 flex items-center gap-2 text-xs"><Badge variant="secondary">{TYPE_LABEL[Q.type]}</Badge>{Q.difficulty && <Badge variant="outline">{Q.difficulty}</Badge>}</div>
          <div className="mb-4 font-medium"><Markdown>{Q.prompt}</Markdown></div>
          <AnswerInput q={Q} value={answers[Q.id]} onChange={(v) => setAnswers((a) => ({ ...a, [Q.id]: v }))} />
        </div>
        {err && <p className="mt-2 text-sm text-destructive">{err}</p>}
        <div className="mt-4 flex items-center justify-between gap-2">
          <Button variant="ghost" disabled={cur === 0} onClick={() => setCur(cur - 1)} data-testid="button-prev-q"><ArrowLeft className="mr-1.5 h-4 w-4" />Previous</Button>
          <Button variant="ghost" size="sm" onClick={() => setFlags((f) => { const n = new Set(f); n.has(cur) ? n.delete(cur) : n.add(cur); return n; })} data-testid="button-flag"><Flag className={cn("mr-1.5 h-4 w-4", flags.has(cur) && "fill-amber-500 text-amber-500")} />{flags.has(cur) ? "Flagged" : "Flag"}</Button>
          {cur < paper.questions.length - 1 ? <Button onClick={() => setCur(cur + 1)} data-testid="button-next-q">Next<ArrowRight className="ml-1.5 h-4 w-4" /></Button>
            : <Button onClick={submit} disabled={submitting} data-testid="button-submit-test">{submitting && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}Submit test</Button>}
        </div>
      </div>
      <aside className="h-fit rounded-xl border bg-card p-4">
        <p className="text-sm font-semibold">Question palette</p>
        <p className="text-xs text-muted-foreground">{answered} of {paper.questions.length} answered</p>
        <div className="mt-3 grid grid-cols-6 gap-1.5">{paper.questions.map((q: any, i: number) => <button key={q.id} onClick={() => setCur(i)} className={cn("relative aspect-square rounded-md border text-xs font-semibold", i === cur && "ring-2 ring-primary", answers[q.id] != null && answers[q.id] !== "" ? "bg-primary text-primary-foreground" : "bg-background")} data-testid={`palette-${i}`}>{i + 1}{flags.has(i) && <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-amber-500" />}</button>)}</div>
        <Button className="mt-4 w-full" variant="outline" onClick={submit} disabled={submitting} data-testid="button-submit-early">Submit now</Button>
      </aside>
    </div>
  );
}
