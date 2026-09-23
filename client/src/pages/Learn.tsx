import { useEffect, useMemo, useState, useCallback } from "react";
import { Link, useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { PlayCircle, NotebookPen, Box, MessageCircleQuestion, Dumbbell, ClipboardCheck, ArrowRight, ArrowLeft, Bookmark, BookmarkCheck, Download, RotateCcw, CheckCircle2, ChevronRight, Code2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { VideoPlayer } from "@/components/VideoPlayer";
import { Markdown } from "@/components/Markdown";
import { DoubtChat } from "@/components/DoubtChat";
import { PracticeQuestion } from "@/components/Question";
import { VISUALS } from "@/components/visuals";
import { api, queryClient, downloadFile } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const STEPS = [
  { key: "video", label: "Video lesson", icon: PlayCircle },
  { key: "notes", label: "Notes", icon: NotebookPen },
  { key: "visual", label: "Visual", icon: Box },
  { key: "doubt", label: "Ask doubt", icon: MessageCircleQuestion },
  { key: "practice", label: "Practice", icon: Dumbbell },
  { key: "test", label: "Topic test", icon: ClipboardCheck },
];

export default function Learn() {
  const { id } = useParams<{ id: string }>(); const tid = Number(id);
  const [, nav] = useLocation(); const { toast } = useToast();
  const [step, setStep] = useState("video"); const [notesView, setNotesView] = useState<"short" | "detailed">("short");
  const { data: t, isLoading, error } = useQuery<any>({ queryKey: ["/api/topics", id] });
  useEffect(() => { setStep("video"); window.scrollTo(0, 0); }, [id]);

  const prog = useMutation({ mutationFn: (b: any) => api("POST", `/api/topics/${id}/progress`, b), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] }) });
  const mark = (k: string) => { if (!t?.progress?.[k.replace(/([A-Z])/g, "_$1").toLowerCase()]) prog.mutate({ [k]: true }); };
  const saveNote = useMutation({ mutationFn: (kind: string) => api<any>("POST", "/api/notes", { topicId: tid, kind }), onSuccess: (r, kind) => { queryClient.invalidateQueries({ queryKey: ["/api/topics", id] }); queryClient.invalidateQueries({ queryKey: ["/api/notes"] }); toast({ title: r.removed ? "Removed" : kind === "bookmark" ? "Bookmarked" : kind === "revision" ? "Marked for revision" : "Saved to My Notes" }); } });
  const onVideoProgress = useCallback((pos: number) => { api("POST", `/api/topics/${id}/progress`, { videoPos: pos }).catch(() => {}); }, [id]);
  const onVideoDone = useCallback(() => { api("POST", `/api/topics/${id}/progress`, { videoDone: true, videoPos: 0 }).then(() => queryClient.invalidateQueries({ queryKey: ["/api/topics", id] })).catch(() => {}); }, [id]);

  const Visual = t?.lesson?.visualId ? VISUALS[t.lesson.visualId] : null;
  const steps = useMemo(() => STEPS.filter((s) => s.key !== "visual" || Visual), [Visual]);
  if (isLoading) return <div className="space-y-4"><Skeleton className="h-8 w-80" /><Skeleton className="aspect-video w-full" /></div>;
  if (error || !t) return <p className="text-sm text-destructive">This topic could not be loaded.</p>;
  if (!t.lesson) return <div className="rounded-xl border bg-card p-6"><h1 className="text-lg font-semibold">{t.title}</h1><p className="mt-2 text-sm text-muted-foreground">This lesson is still being produced and reviewed. It will unlock once it passes quality checks.</p><Link href={`/course/${t.course_slug}`}><Button className="mt-4" variant="outline">Back to course</Button></Link></div>;
  const L = t.lesson; const p = t.progress || {};
  const done: Record<string, boolean> = { video: !!p.video_done, notes: !!p.notes_done, visual: !!p.visual_done, practice: !!p.practice_done, test: p.test_best >= 60, doubt: false };
  const idx = steps.findIndex((s) => s.key === step);
  const go = (k: string) => { setStep(k); window.scrollTo({ top: 0, behavior: "smooth" }); if (k === "notes") mark("notesDone"); if (k === "visual") mark("visualDone"); };
  const practiceQs = t.questions;

  return (
    <div>
      <nav className="mb-3 flex flex-wrap items-center gap-1 text-xs text-muted-foreground" aria-label="Breadcrumb">
        <Link href={`/course/${t.course_slug}`} className="hover:text-foreground">{t.course}</Link><ChevronRight className="h-3 w-3" />
        <span>{t.subject}</span><ChevronRight className="h-3 w-3" /><span>{t.chapter}</span>
      </nav>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-display text-xl font-bold sm:text-2xl" data-testid="text-topic-title">{t.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Topic {t.position.index} of {t.position.total}{p.completed ? " · Completed" : ""}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => saveNote.mutate("bookmark")} data-testid="button-bookmark">{t.bookmarked ? <BookmarkCheck className="mr-1.5 h-4 w-4 text-primary" /> : <Bookmark className="mr-1.5 h-4 w-4" />}{t.bookmarked ? "Bookmarked" : "Bookmark"}</Button>
          <Button size="sm" variant="outline" onClick={() => saveNote.mutate("revision")} data-testid="button-revision"><RotateCcw className={cn("mr-1.5 h-4 w-4", t.revision && "text-amber-600")} />{t.revision ? "In revision list" : "Mark for revision"}</Button>
        </div>
      </div>

      <div className="mb-5 flex gap-1 overflow-x-auto rounded-xl border bg-card p-1" role="tablist">
        {steps.map((s, i) => (
          <button key={s.key} role="tab" aria-selected={step === s.key} onClick={() => go(s.key)} className={cn("flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors", step === s.key ? "bg-primary text-primary-foreground" : "hover:bg-secondary")} data-testid={`tab-${s.key}`}>
            <span className={cn("flex h-5 w-5 items-center justify-center rounded-full text-[11px]", step === s.key ? "bg-white/20" : done[s.key] ? "bg-emerald-500 text-white" : "bg-secondary")}>{done[s.key] ? <CheckCircle2 className="h-3.5 w-3.5" /> : i + 1}</span>{s.label}
          </button>
        ))}
      </div>

      {step === "video" && (
        <div className="space-y-4">
          <VideoPlayer key={id} videos={t.videos} initialPos={p.video_pos || 0} onProgress={onVideoProgress} onComplete={onVideoDone} codeLang={t.prog_language} />
          <div className="rounded-xl border bg-card p-4"><p className="text-sm"><b>In this lesson:</b> {L.summary}</p></div>
        </div>
      )}

      {step === "notes" && (
        <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
          <div className="rounded-xl border bg-card p-5">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <div className="flex rounded-lg border p-0.5">{(["short", "detailed"] as const).map((v) => <button key={v} onClick={() => setNotesView(v)} className={cn("rounded-md px-3 py-1 text-sm font-medium", notesView === v ? "bg-primary text-primary-foreground" : "")} data-testid={`button-notes-${v}`}>{v === "short" ? "Short notes" : "Detailed notes"}</button>)}</div>
              <Button size="sm" variant="outline" className="ml-auto" onClick={() => downloadFile(`/api/topics/${id}/notes.md`, `${t.title}.md`).catch(() => toast({ title: "Download failed", variant: "destructive" }))} data-testid="button-download-notes"><Download className="mr-1.5 h-4 w-4" />Download</Button>
              <Button size="sm" variant="outline" onClick={() => api("POST", "/api/notes", { topicId: tid, kind: "note", content: `# ${t.title}\n\n${L.shortNotes.map((s: string) => `- ${s}`).join("\n")}` }).then(() => { toast({ title: "Saved to My Notes" }); queryClient.invalidateQueries({ queryKey: ["/api/notes"] }); })} data-testid="button-save-notes">Save to My Notes</Button>
            </div>
            {notesView === "short" ? (
              <ul className="space-y-2">{L.shortNotes.map((s: string, i: number) => <li key={i} className="flex gap-2.5 text-sm"><span className="mt-[0.55rem] h-1.5 w-1.5 shrink-0 rounded-full bg-primary" /><div className="min-w-0 [&_p]:my-0"><Markdown>{s}</Markdown></div></li>)}</ul>
            ) : (
              <div className="space-y-6">
                <section><h3 className="mb-1 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Explanation</h3><Markdown>{L.detailed.explanation || ""}</Markdown></section>
                {!!L.detailed.definitions?.length && <section><h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Definitions</h3><dl className="space-y-2">{L.detailed.definitions.map((d: any) => <div key={d.term} className="rounded-lg bg-secondary/60 p-3"><dt className="font-semibold">{d.term}</dt><dd className="text-sm text-muted-foreground">{d.meaning}</dd></div>)}</dl></section>}
                {!!L.detailed.formulas?.length && <section><h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Formulas</h3><div className="grid gap-2 sm:grid-cols-2">{L.detailed.formulas.map((f: any) => <div key={f.name} className="board rounded-lg border p-3"><p className="text-xs text-board-muted">{f.name}</p><p className="font-hand text-lg text-board-ink">{f.expression}</p>{f.note && <p className="text-xs text-board-muted">{f.note}</p>}</div>)}</div></section>}
                {!!L.detailed.points?.length && <section><h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Important points</h3><ul className="space-y-1.5">{L.detailed.points.map((x: string, i: number) => <li key={i} className="flex gap-2 text-sm"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" /><Markdown>{x}</Markdown></li>)}</ul></section>}
                {L.codeExample?.code && <section><h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wider text-muted-foreground"><Code2 className="h-4 w-4" />Code example</h3><Markdown>{"```" + (L.codeExample.language || "") + "\n" + L.codeExample.code + "\n```"}</Markdown>{L.codeExample.explanation && <Markdown>{L.codeExample.explanation}</Markdown>}</section>}
                {!!L.commonMistakes?.length && <section><h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wider text-muted-foreground"><AlertTriangle className="h-4 w-4" />Common mistakes</h3><ul className="space-y-1.5">{L.commonMistakes.map((x: string, i: number) => <li key={i} className="text-sm">• {x}</li>)}</ul></section>}
              </div>
            )}
          </div>
          <aside className="space-y-3 text-sm">
            <div className="rounded-xl border bg-card p-4"><p className="font-semibold">Summary</p><p className="mt-1 text-muted-foreground">{L.summary}</p></div>
            <p className="px-1 text-xs text-muted-foreground">Content drafted with AI and reviewed before publishing ({L.source}).</p>
          </aside>
        </div>
      )}

      {step === "visual" && Visual && (
        <div>
          <div className="mb-3"><Badge variant="secondary">{Visual.mode}</Badge><h2 className="mt-2 font-semibold">{Visual.title}</h2><p className="text-sm text-muted-foreground">{Visual.description}</p></div>
          <Visual.Component />
        </div>
      )}

      {step === "doubt" && <DoubtChat topicId={tid} topicTitle={t.title} compact />}

      {step === "practice" && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Instant feedback on every question. Practice doesn't affect your score — the topic test does.</p>
          {practiceQs.length ? practiceQs.map((q: any, i: number) => <PracticeQuestion key={q.id} q={q} n={i + 1} onChecked={() => mark("practiceDone")} />) : <p className="text-sm">No practice questions yet.</p>}
        </div>
      )}

      {step === "test" && (
        <div className="rounded-xl border bg-card p-6">
          <h2 className="text-lg font-semibold">Topic test: {t.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">Timed, auto-graded test. Score 60% or more to complete this topic and unlock progress toward your certificate.</p>
          {p.test_best >= 0 && <p className="mt-3 text-sm">Your best score: <b className={p.test_best >= 60 ? "text-emerald-600" : "text-destructive"}>{p.test_best}%</b></p>}
          <Button className="mt-4" onClick={() => nav(`/test/topic/${id}`)} data-testid="button-start-topic-test"><ClipboardCheck className="mr-2 h-4 w-4" />{p.test_best >= 0 ? "Retake test" : "Start test"}</Button>
        </div>
      )}

      <div className="mt-6 flex items-center justify-between gap-2 border-t pt-4">
        {idx > 0 ? <Button variant="ghost" onClick={() => go(steps[idx - 1].key)} data-testid="button-prev-step"><ArrowLeft className="mr-2 h-4 w-4" />{steps[idx - 1].label}</Button> : t.prev ? <Link href={`/learn/${t.prev.id}`}><Button variant="ghost" data-testid="button-prev-topic"><ArrowLeft className="mr-2 h-4 w-4" />Previous topic</Button></Link> : <span />}
        {idx < steps.length - 1 ? <Button onClick={() => go(steps[idx + 1].key)} data-testid="button-next-step">Next: {steps[idx + 1].label}<ArrowRight className="ml-2 h-4 w-4" /></Button>
          : t.next ? <Link href={`/learn/${t.next.id}`}><Button data-testid="button-next-topic">Next topic: {t.next.title}<ArrowRight className="ml-2 h-4 w-4" /></Button></Link>
          : <Link href={`/course/${t.course_slug}`}><Button data-testid="button-course-end">Course project & final assessment<ArrowRight className="ml-2 h-4 w-4" /></Button></Link>}
      </div>
    </div>
  );
}
