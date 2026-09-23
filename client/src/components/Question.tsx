import { useState } from "react";
import { CheckCircle2, XCircle, Loader2, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Markdown } from "./Markdown";
import { api } from "@/lib/queryClient";
import { cn } from "@/lib/utils";

export const TYPE_LABEL: Record<string, string> = { mcq: "MCQ", short: "Short answer", numerical: "Numerical", coding: "Coding" };

export function AnswerInput({ q, value, onChange, disabled, reveal }: { q: any; value: any; onChange: (v: any) => void; disabled?: boolean; reveal?: { correct: number | null; chosen: any } }) {
  if (q.type === "mcq") return (
    <div className="space-y-2" role="radiogroup">
      {(q.options || []).map((o: string, i: number) => {
        const isAns = reveal && reveal.correct === i; const isWrongPick = reveal && Number(reveal.chosen) === i && reveal.correct !== i;
        return (
          <button key={i} type="button" disabled={disabled} onClick={() => onChange(i)} role="radio" aria-checked={value === i}
            className={cn("flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors", value === i && !reveal && "border-primary bg-primary/5", isAns && "border-emerald-500 bg-emerald-500/10", isWrongPick && "border-destructive bg-destructive/10", !disabled && "hover:border-primary")} data-testid={`option-${q.id}-${i}`}>
            <span className={cn("mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold", value === i && "border-primary bg-primary text-primary-foreground")}>{String.fromCharCode(65 + i)}</span>
            <span className="flex-1">{o}</span>
          </button>
        );
      })}
    </div>
  );
  if (q.type === "numerical") return <Input type="text" inputMode="decimal" value={value ?? ""} onChange={(e) => onChange(e.target.value)} disabled={disabled} placeholder="Enter a number" className="max-w-xs" data-testid={`input-answer-${q.id}`} />;
  if (q.type === "coding") return <Textarea value={value ?? q.starter ?? ""} onChange={(e) => onChange(e.target.value)} disabled={disabled} rows={9} spellCheck={false} className="font-mono text-sm" data-testid={`input-code-${q.id}`} />;
  return <Textarea value={value ?? ""} onChange={(e) => onChange(e.target.value)} disabled={disabled} rows={3} placeholder="Write your answer in a sentence or two" data-testid={`input-answer-${q.id}`} />;
}

/** Practice question with instant feedback (server-graded; coding answers are AI-reviewed). */
export function PracticeQuestion({ q, n, onChecked }: { q: any; n: number; onChecked?: (correct: boolean) => void }) {
  const [v, setV] = useState<any>(q.type === "coding" ? q.starter || "" : undefined);
  const [res, setRes] = useState<any>(null); const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const check = async () => {
    if (v === undefined || v === "") return setErr("Choose or write an answer first.");
    setBusy(true); setErr("");
    try { const r = await api<any>("POST", "/api/practice/check", { questionId: q.id, answer: v }); setRes(r); onChecked?.(r.correct); }
    catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  return (
    <div className="rounded-xl border bg-card p-4 sm:p-5" data-testid={`card-practice-${q.id}`}>
      <div className="mb-2 flex items-center gap-2 text-xs"><span className="font-semibold text-muted-foreground">Q{n}</span><Badge variant="secondary">{TYPE_LABEL[q.type] || q.type}</Badge>{q.difficulty && <Badge variant="outline">{q.difficulty}</Badge>}</div>
      <div className="mb-3 font-medium"><Markdown>{q.prompt}</Markdown></div>
      <AnswerInput q={q} value={v} onChange={(x) => { setV(x); if (res) setRes(null); }} disabled={busy} reveal={res && q.type === "mcq" ? { correct: res.answer, chosen: v } : undefined} />
      {err && <p className="mt-2 text-xs text-destructive">{err}</p>}
      <div className="mt-3 flex items-center gap-2">
        <Button size="sm" onClick={check} disabled={busy} data-testid={`button-check-${q.id}`}>{busy && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}{q.type === "coding" ? (busy ? "AI is reviewing…" : "Submit for AI review") : "Check answer"}</Button>
        {res && <Button size="sm" variant="ghost" onClick={() => { setRes(null); setV(q.type === "coding" ? q.starter || "" : undefined); }} data-testid={`button-retry-${q.id}`}>Try again</Button>}
      </div>
      {res && (
        <div className={cn("mt-3 rounded-lg border p-3 text-sm", res.correct ? "border-emerald-500/40 bg-emerald-500/10" : res.partial ? "border-amber-500/40 bg-amber-500/10" : "border-destructive/40 bg-destructive/10")} data-testid={`result-${q.id}`}>
          <p className="flex items-center gap-1.5 font-semibold">{res.correct ? <><CheckCircle2 className="h-4 w-4 text-emerald-600" />Correct</> : res.partial ? <><Lightbulb className="h-4 w-4 text-amber-600" />Partly right</> : <><XCircle className="h-4 w-4 text-destructive" />Not quite</>}{res.score != null && q.type === "coding" && <span className="ml-auto text-xs font-normal">AI score {res.score}/100</span>}</p>
          {q.type !== "mcq" && q.type !== "coding" && !res.correct && <p className="mt-1">Expected: <b>{String(res.answer)}</b></p>}
          {res.feedback && <div className="mt-2"><Markdown>{res.feedback}</Markdown></div>}
          {res.explanation && <div className="mt-2 text-muted-foreground"><Markdown>{res.explanation}</Markdown></div>}
          {q.type === "coding" && res.solution && <details className="mt-2"><summary className="cursor-pointer text-xs font-medium">Show reference solution</summary><pre className="mt-2 overflow-x-auto rounded-lg bg-[#0f1629] p-3 text-xs text-[#dbe4ff]">{res.solution}</pre></details>}
        </div>
      )}
    </div>
  );
}
