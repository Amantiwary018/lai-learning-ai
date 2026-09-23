import { useState, useEffect, Fragment } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Trash2, Pencil, Loader2, RefreshCw, CheckCircle2, XCircle, Wand2, Languages, Video, ChevronRight, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/AppShell";
import { api, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { VISUALS } from "@/components/visuals";

const inv = (...k: string[]) => k.forEach((x) => queryClient.invalidateQueries({ queryKey: [x] }));
const StatusBadge = ({ s }: { s?: string | null }) => <Badge variant="outline" className={cn("text-[11px]", s === "published" || s === "approved" || s === "valid" ? "border-emerald-500 text-emerald-700 dark:text-emerald-400" : s === "failed" || s === "rejected" || s === "revoked" ? "border-destructive text-destructive" : s === "building" || s === "queued" || s === "pending" ? "border-amber-500 text-amber-700 dark:text-amber-400" : "")}>{s || "none"}</Badge>;

function useAct() {
  const { toast } = useToast();
  return async (fn: () => Promise<any>, ok?: string, keys: string[] = []) => { try { const r = await fn(); if (ok) toast({ title: ok }); inv(...keys); return r; } catch (e: any) { toast({ title: "Action failed", description: e.message, variant: "destructive" }); } };
}

function Overview() {
  const { data: d } = useQuery<any>({ queryKey: ["/api/admin/overview"], refetchInterval: 15000 });
  if (!d) return <Skeleton className="h-64" />;
  const c = d.counts;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">{[["Students", c.students], ["Courses", c.courses], ["Published topics", `${c.published}/${c.topics}`], ["Questions", c.questions], ["Certificates", c.certificates], ["Doubts answered", c.doubts], ["Test attempts", c.attempts], ["Pending review", c.pendingReview], ["Errors (24h)", c.errors24h], ["AI gateway", d.gateway?.ok ? "Online" : "Offline"]].map(([l, v]) => (
        <div key={l as string} className="rounded-xl border bg-card p-4"><p className="text-xs text-muted-foreground">{l}</p><p className="mt-1 text-xl font-bold tabular-nums" data-testid={`kpi-${String(l).toLowerCase().replace(/\W+/g, "-")}`}>{v}</p></div>))}</div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border bg-card p-4"><p className="font-semibold">Video generation status</p><div className="mt-2 flex flex-wrap gap-2">{d.videos.map((v: any) => <span key={v.status} className="flex items-center gap-1.5 text-sm"><StatusBadge s={v.status} /><b className="tabular-nums">{v.n}</b></span>)}</div></div>
        <div className="rounded-xl border bg-card p-4"><p className="font-semibold">LAI AI Router — models</p><div className="mt-2 space-y-1 text-sm">{d.models.map((m: any) => { const u = d.aiByModel.find((x: any) => x.model === m.id); return <div key={m.id} className="flex justify-between gap-2"><span>{m.label} <span className="text-xs text-muted-foreground">({m.provider})</span></span><span className="tabular-nums text-muted-foreground">{u ? `${u.calls} calls · ${u.latency}ms avg · ${u.errors} err` : "no calls yet"}</span></div>; })}</div></div>
      </div>
      <div className="rounded-xl border bg-card p-4"><p className="font-semibold">AI calls by task</p><div className="mt-2 flex flex-wrap gap-2">{d.aiByTask.map((t: any) => <Badge key={t.task} variant="secondary">{t.task}: {t.calls}</Badge>)}{!d.aiByTask.length && <span className="text-sm text-muted-foreground">No AI calls yet.</span>}</div></div>
    </div>
  );
}

function LessonEditor({ topicId, onClose }: { topicId: number; onClose: () => void }) {
  const act = useAct();
  const { data, refetch } = useQuery<any>({ queryKey: ["/api/admin/lessons", String(topicId)] });
  const [form, setForm] = useState<any>(null); const [nq, setNq] = useState({ type: "mcq", prompt: "", options: "", answer: "", explanation: "" });
  useEffect(() => { if (data && !form) setForm({ summary: data.lesson?.summary || "", short: (data.lesson?.short_notes || []).join("\n"), detailed: JSON.stringify(data.lesson?.detailed || { explanation: "", definitions: [], formulas: [], points: [] }, null, 2), visual: data.lesson?.visual_id || "none" }); }, [data, form]);
  const save = () => { let det; try { det = JSON.parse(form.detailed); } catch { return act(async () => { throw new Error("Detailed notes must be valid JSON."); }); }
    act(() => api("PUT", `/api/admin/lessons/${topicId}`, { summary: form.summary, short_notes: form.short.split("\n").map((s: string) => s.trim()).filter(Boolean), detailed: det, visual_id: form.visual === "none" ? null : form.visual }), "Lesson saved", ["/api/admin/tree"]).then(() => refetch()); };
  const addQ = () => act(() => api("POST", "/api/admin/questions", { topicId, type: nq.type, prompt: nq.prompt, options: nq.type === "mcq" ? nq.options.split("\n").filter(Boolean) : null, answer: nq.answer, explanation: nq.explanation }), "Question added").then(() => { setNq({ type: "mcq", prompt: "", options: "", answer: "", explanation: "" }); refetch(); });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader><DialogTitle>{data?.topic?.title || "Lesson"}</DialogTitle></DialogHeader>
        {!data || !form ? <Skeleton className="h-64" /> : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-sm">Review status: <StatusBadge s={data.lesson?.review_status} /> Source: <Badge variant="secondary">{data.lesson?.source || "—"}</Badge>
              {data.videos.map((v: any) => <span key={v.id} className="flex items-center gap-1">video {v.lang}: <StatusBadge s={v.status} /></span>)}</div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => act(() => api("POST", `/api/admin/topics/${topicId}/generate-draft`), "AI draft created — review it below", ["/api/admin/review-queue", "/api/admin/tree"]).then(() => { setForm(null); refetch(); })} data-testid="button-generate-draft"><Wand2 className="mr-1.5 h-4 w-4" />Generate AI draft</Button>
              {data.lesson && <><Button size="sm" onClick={() => act(() => api("POST", `/api/admin/lessons/${topicId}/review`, { action: "approve", publish: true }), "Approved & published", ["/api/admin/review-queue", "/api/admin/tree", "/api/admin/videos"]).then(() => refetch())} data-testid="button-approve"><CheckCircle2 className="mr-1.5 h-4 w-4" />Approve & publish</Button>
              <Button size="sm" variant="outline" onClick={() => act(() => api("POST", `/api/admin/lessons/${topicId}/review`, { action: "reject" }), "Rejected", ["/api/admin/review-queue", "/api/admin/tree"]).then(() => refetch())} data-testid="button-reject"><XCircle className="mr-1.5 h-4 w-4" />Reject</Button></>}
            </div>
            <div className="space-y-1"><p className="text-xs font-semibold">Summary</p><Input value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} data-testid="input-lesson-summary" /></div>
            <div className="space-y-1"><p className="text-xs font-semibold">Short notes (one per line)</p><Textarea rows={5} value={form.short} onChange={(e) => setForm({ ...form, short: e.target.value })} /></div>
            <div className="space-y-1"><p className="text-xs font-semibold">Detailed notes (JSON: explanation, definitions, formulas, points)</p><Textarea rows={8} className="font-mono text-xs" value={form.detailed} onChange={(e) => setForm({ ...form, detailed: e.target.value })} /></div>
            <div className="space-y-1"><p className="text-xs font-semibold">Visual</p><Select value={form.visual} onValueChange={(v) => setForm({ ...form, visual: v })}><SelectTrigger className="w-64"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">None</SelectItem>{Object.entries(VISUALS).map(([k, v]) => <SelectItem key={k} value={k}>{v.title}</SelectItem>)}</SelectContent></Select></div>
            <Button size="sm" onClick={save} data-testid="button-save-lesson">Save lesson</Button>
            <div className="border-t pt-4">
              <p className="mb-2 font-semibold">Questions ({data.questions.length})</p>
              <div className="space-y-2">{data.questions.map((q: any) => (
                <div key={q.id} className="flex items-start gap-2 rounded-lg border p-2 text-sm"><Badge variant="secondary" className="shrink-0">{q.type}</Badge><div className="min-w-0 flex-1"><p className="line-clamp-2">{q.prompt}</p><p className="text-xs text-muted-foreground">Answer: {q.type === "mcq" ? q.options?.[Number(q.answer)] : q.answer}</p></div>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => act(() => api("DELETE", `/api/admin/questions/${q.id}`), "Question deleted").then(() => refetch())} aria-label="Delete question"><Trash2 className="h-3.5 w-3.5" /></Button></div>))}</div>
              <div className="mt-3 space-y-2 rounded-lg border bg-secondary/40 p-3">
                <p className="text-xs font-semibold">Add question</p>
                <Select value={nq.type} onValueChange={(v) => setNq({ ...nq, type: v })}><SelectTrigger className="w-40"><SelectValue /></SelectTrigger><SelectContent>{["mcq", "short", "numerical"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select>
                <Textarea rows={2} placeholder="Question prompt" value={nq.prompt} onChange={(e) => setNq({ ...nq, prompt: e.target.value })} data-testid="input-new-question" />
                {nq.type === "mcq" && <Textarea rows={4} placeholder="Options, one per line" value={nq.options} onChange={(e) => setNq({ ...nq, options: e.target.value })} />}
                <Input placeholder={nq.type === "mcq" ? "Correct option index (0-based)" : "Correct answer"} value={nq.answer} onChange={(e) => setNq({ ...nq, answer: e.target.value })} />
                <Input placeholder="Explanation" value={nq.explanation} onChange={(e) => setNq({ ...nq, explanation: e.target.value })} />
                <Button size="sm" onClick={addQ} disabled={!nq.prompt || !nq.answer} data-testid="button-add-question"><Plus className="mr-1 h-4 w-4" />Add</Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Content() {
  const act = useAct();
  const { data: courses } = useQuery<any[]>({ queryKey: ["/api/admin/courses"] });
  const [cid, setCid] = useState<number | null>(null); const [edit, setEdit] = useState<number | null>(null);
  const { data: tree, refetch } = useQuery<any[]>({ queryKey: ["/api/admin/tree", String(cid)], enabled: !!cid });
  const [newCourse, setNewCourse] = useState({ title: "", slug: "", category: "programming" });
  const add = (kind: string, parentId: number) => { const title = prompt(`New ${kind.slice(0, -1)} title`); if (title) act(() => api("POST", `/api/admin/${kind}`, { title, parentId }), "Added").then(() => refetch()); };
  const rename = (kind: string, id: number, cur: string) => { const title = prompt("Rename", cur); if (title && title !== cur) act(() => api("PATCH", `/api/admin/${kind}/${id}`, { title }), "Renamed").then(() => refetch()); };
  const del = (kind: string, id: number) => { if (confirm("Delete this item and everything inside it?")) act(() => api("DELETE", `/api/admin/${kind}/${id}`), "Deleted").then(() => refetch()); };
  const Row = ({ kind, item, children }: any) => (
    <div className="group flex items-center gap-1.5 py-0.5">{children}<span className="flex-1 truncate text-sm">{item.title}</span>
      <span className="flex gap-0.5 opacity-60 group-hover:opacity-100"><Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => rename(kind, item.id, item.title)} aria-label="Rename"><Pencil className="h-3 w-3" /></Button><Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => del(kind, item.id)} aria-label="Delete"><Trash2 className="h-3 w-3" /></Button></span></div>
  );
  return (
    <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
      <div className="space-y-3">
        <div className="max-h-[520px] space-y-1 overflow-y-auto rounded-xl border bg-card p-2">{courses?.map((c) => (
          <button key={c.id} onClick={() => setCid(c.id)} className={cn("flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm", cid === c.id ? "bg-primary text-primary-foreground" : "hover:bg-secondary")} data-testid={`button-admin-course-${c.slug}`}><span className="truncate">{c.title}</span><span className="text-[10px] opacity-70">{c.content_status}</span></button>))}</div>
        <div className="space-y-2 rounded-xl border bg-card p-3">
          <p className="text-xs font-semibold">New course</p>
          <Input placeholder="Title" value={newCourse.title} onChange={(e) => setNewCourse({ ...newCourse, title: e.target.value, slug: e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") })} data-testid="input-new-course" />
          <Select value={newCourse.category} onValueChange={(v) => setNewCourse({ ...newCourse, category: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["certifications", "engineering", "programming", "learn-ai"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
          <Button size="sm" disabled={newCourse.title.length < 2} onClick={() => act(() => api("POST", "/api/admin/courses", { ...newCourse, description: "" }), "Course created", ["/api/admin/courses", "/api/courses"]).then(() => setNewCourse({ title: "", slug: "", category: "programming" }))} data-testid="button-create-course"><Plus className="mr-1 h-4 w-4" />Create</Button>
        </div>
      </div>
      <div className="rounded-xl border bg-card p-4">
        {!cid ? <p className="text-sm text-muted-foreground">Select a course to manage its subjects, chapters and topics.</p> : !tree ? <Skeleton className="h-64" /> : (
          <div>
            <div className="mb-3 flex items-center justify-between"><p className="font-semibold">Course tree</p><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => add("subjects", cid)} data-testid="button-add-subject"><Plus className="mr-1 h-4 w-4" />Subject</Button>{(() => { const c = courses?.find((x) => x.id === cid); return c && <Button size="sm" variant="outline" onClick={() => { if (confirm(`Delete course "${c.title}"?`)) act(() => api("DELETE", `/api/admin/courses/${cid}`), "Course deleted", ["/api/admin/courses", "/api/courses"]).then(() => setCid(null)); }}><Trash2 className="mr-1 h-4 w-4" />Delete course</Button>; })()}</div></div>
            {tree.map((s) => (
              <div key={s.id} className="mb-3 rounded-lg border p-2">
                <Row kind="subjects" item={s}><Badge variant="secondary" className="text-[10px]">Subject</Badge></Row>
                {s.chapters.map((ch: any) => (
                  <div key={ch.id} className="ml-4 border-l pl-3">
                    <Row kind="chapters" item={ch}><ChevronRight className="h-3 w-3 text-muted-foreground" /><span className="text-[10px] text-muted-foreground">Chapter</span></Row>
                    {ch.topics.map((t: any) => (
                      <div key={t.id} className="ml-4 flex items-center gap-1.5 py-0.5 text-sm">
                        <StatusBadge s={t.status} />{t.review_status && <StatusBadge s={t.review_status} />}
                        <span className="flex-1 truncate">{t.title}</span>
                        <span className="text-[10px] text-muted-foreground">{t.questions}Q · video {t.video || "—"}</span>
                        <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => setEdit(t.id)} data-testid={`button-edit-topic-${t.id}`}><Eye className="mr-1 h-3 w-3" />Edit</Button>
                        {t.status === "published" ? <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => act(() => api("PATCH", `/api/admin/topics/${t.id}`, { status: "draft" }), "Unpublished").then(() => refetch())}>Unpublish</Button>
                          : t.review_status === "approved" && <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => act(() => api("PATCH", `/api/admin/topics/${t.id}`, { status: "published" }), "Published").then(() => refetch())}>Publish</Button>}
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => del("topics", t.id)} aria-label="Delete topic"><Trash2 className="h-3 w-3" /></Button>
                      </div>))}
                    <Button size="sm" variant="ghost" className="ml-4 h-6 text-xs" onClick={() => add("topics", ch.id)}><Plus className="mr-1 h-3 w-3" />Topic</Button>
                  </div>))}
                <Button size="sm" variant="ghost" className="ml-4 h-6 text-xs" onClick={() => add("chapters", s.id)}><Plus className="mr-1 h-3 w-3" />Chapter</Button>
              </div>))}
          </div>
        )}
      </div>
      {edit && <LessonEditor topicId={edit} onClose={() => { setEdit(null); refetch(); }} />}
    </div>
  );
}

function Review() {
  const { data } = useQuery<any[]>({ queryKey: ["/api/admin/review-queue"] }); const [edit, setEdit] = useState<number | null>(null);
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">AI-drafted lessons never reach students until an admin approves them.</p>
      {data?.length ? data.map((r) => <div key={r.topic_id} className="flex items-center gap-3 rounded-xl border bg-card p-3"><div className="min-w-0 flex-1"><p className="font-medium">{r.title}</p><p className="truncate text-xs text-muted-foreground">{r.course} · {r.summary}</p></div><Badge variant="secondary">{r.source}</Badge><Button size="sm" onClick={() => setEdit(r.topic_id)} data-testid={`button-review-${r.topic_id}`}>Review</Button></div>) : <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">Review queue is empty. Use “Generate AI draft” on any topic in Content.</p>}
      {edit && <LessonEditor topicId={edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

function Videos() {
  const act = useAct();
  const { data } = useQuery<any[]>({ queryKey: ["/api/admin/videos"], refetchInterval: 8000 });
  const [open, setOpen] = useState<string | null>(null);
  if (!data) return <Skeleton className="h-64" />;
  const counts = data.reduce((m: any, v) => ((m[v.status] = (m[v.status] || 0) + 1), m), {});
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 text-sm">{Object.entries(counts).map(([s, n]) => <span key={s} className="flex items-center gap-1.5"><StatusBadge s={s} /><b>{n as number}</b></span>)}</div>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b text-left text-xs text-muted-foreground"><tr><th className="p-3">Video</th><th className="p-3">Status</th><th className="p-3">QC</th><th className="p-3">Length</th><th className="p-3 text-right">Actions</th></tr></thead>
          <tbody>{data.map((v) => (<Fragment key={v.id}>
            <tr className="border-b last:border-0">
              <td className="p-3"><p className="font-medium">{v.topic}</p><p className="text-xs text-muted-foreground">{v.course} · {v.id} · {v.lang}</p>{v.error && <p className="mt-1 text-xs text-destructive">{v.error}</p>}</td>
              <td className="p-3"><StatusBadge s={v.status} /></td>
              <td className="p-3">{v.checks ? <button onClick={() => setOpen(open === v.id ? null : v.id)} className={cn("text-xs font-medium underline", v.qcPassed ? "text-emerald-600" : "text-destructive")} data-testid={`button-qc-${v.id}`}>{v.checks.filter((c: any) => c.passed).length}/{v.checks.length} passed</button> : "—"}</td>
              <td className="p-3 tabular-nums">{v.duration ? `${Math.floor(v.duration / 60)}:${String(Math.round(v.duration % 60)).padStart(2, "0")} · ${v.scenes} scenes` : "—"}</td>
              <td className="p-3 text-right"><div className="flex justify-end gap-1">
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => act(() => api("POST", `/api/admin/videos/${v.id}/build`, {}), "Rebuild queued", ["/api/admin/videos"])} disabled={v.status === "building"} data-testid={`button-rebuild-${v.id}`}><RefreshCw className="mr-1 h-3 w-3" />Rebuild</Button>
                {v.lang === "en" && <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => act(() => api("POST", `/api/admin/videos/${v.id}/translate`, { lang: "hi" }), "Hindi version queued", ["/api/admin/videos"])} data-testid={`button-translate-${v.id}`}><Languages className="mr-1 h-3 w-3" />Hindi</Button>}
              </div></td>
            </tr>
            {open === v.id && <tr className="border-b bg-secondary/40"><td colSpan={5} className="p-3">
              <div className="grid gap-1 text-xs sm:grid-cols-2">{v.checks.map((c: any) => <p key={c.name} className="flex items-start gap-1.5">{c.passed ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" /> : <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />}<span><b>{c.name}</b> — {c.detail}</span></p>)}</div>
              {v.sceneList && <div className="mt-3 space-y-1">{v.sceneList.map((s: any) => <div key={s.index} className="flex items-center gap-2 text-xs"><Video className="h-3.5 w-3.5 text-muted-foreground" /><span className="w-6 tabular-nums">#{s.index + 1}</span><span className="flex-1 truncate">{s.title}</span><span className="tabular-nums text-muted-foreground">{s.start.toFixed(1)}s → {s.end.toFixed(1)}s</span><Button size="sm" variant="ghost" className="h-6 px-2 text-[11px]" onClick={() => act(() => api("POST", `/api/admin/videos/${v.id}/build`, { onlyScenes: [s.index] }), `Regenerating scene ${s.index + 1} only`, ["/api/admin/videos"])} data-testid={`button-rebuild-scene-${v.id}-${s.index}`}>Regenerate scene</Button></div>)}</div>}
            </td></tr>}
          </Fragment>))}</tbody>
        </table>
      </div>
    </div>
  );
}

function Students() {
  const act = useAct(); const { data } = useQuery<any[]>({ queryKey: ["/api/admin/students"] });
  return (
    <div className="overflow-x-auto rounded-xl border bg-card"><table className="w-full text-sm"><thead className="border-b text-left text-xs text-muted-foreground"><tr><th className="p-3">Name</th><th className="p-3">Role</th><th className="p-3">Courses</th><th className="p-3">Completed</th><th className="p-3">Avg score</th><th className="p-3">Last active</th><th className="p-3">Status</th><th className="p-3" /></tr></thead>
      <tbody>{data?.map((u) => <tr key={u.id} className="border-b last:border-0"><td className="p-3"><p className="font-medium">{u.name}</p><p className="text-xs text-muted-foreground">{u.email}</p></td><td className="p-3">{u.role}</td><td className="p-3 tabular-nums">{u.courses}</td><td className="p-3 tabular-nums">{u.completed}</td><td className="p-3 tabular-nums">{u.avg ?? "—"}{u.avg != null && "%"}</td><td className="p-3 text-xs">{u.last_active || "—"}</td><td className="p-3"><StatusBadge s={u.status === "active" ? "valid" : "revoked"} /></td>
        <td className="p-3">{u.role !== "admin" && <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => act(() => api("PATCH", `/api/admin/students/${u.id}`, { status: u.status === "active" ? "suspended" : "active" }), "Updated", ["/api/admin/students"])}>{u.status === "active" ? "Suspend" : "Reactivate"}</Button>}</td></tr>)}</tbody></table></div>
  );
}

function Certs() {
  const act = useAct(); const { data } = useQuery<any[]>({ queryKey: ["/api/admin/certificates"] });
  return data?.length ? (
    <div className="overflow-x-auto rounded-xl border bg-card"><table className="w-full text-sm"><thead className="border-b text-left text-xs text-muted-foreground"><tr><th className="p-3">ID</th><th className="p-3">Student</th><th className="p-3">Course</th><th className="p-3">Issued</th><th className="p-3">Status</th><th className="p-3" /></tr></thead>
      <tbody>{data.map((c) => <tr key={c.id} className="border-b last:border-0"><td className="p-3 font-mono text-xs">{c.id}</td><td className="p-3">{c.student_name}<p className="text-xs text-muted-foreground">{c.email}</p></td><td className="p-3">{c.course_title}</td><td className="p-3 text-xs">{c.issued_at}</td><td className="p-3"><StatusBadge s={c.status} /></td><td className="p-3"><Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => act(() => api("PATCH", `/api/admin/certificates/${c.id}`, { status: c.status === "valid" ? "revoked" : "valid" }), "Updated", ["/api/admin/certificates"])} data-testid={`button-toggle-cert-${c.id}`}>{c.status === "valid" ? "Revoke" : "Restore"}</Button></td></tr>)}</tbody></table></div>
  ) : <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">No certificates issued yet.</p>;
}

function Logs() {
  const { data: errs } = useQuery<any[]>({ queryKey: ["/api/admin/errors"], refetchInterval: 15000 });
  const { data: usage } = useQuery<any[]>({ queryKey: ["/api/admin/ai-usage"], refetchInterval: 15000 });
  const { data: doubts } = useQuery<any[]>({ queryKey: ["/api/admin/doubts"] });
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <div className="rounded-xl border bg-card p-4"><p className="mb-2 font-semibold">Error log</p><div className="max-h-[480px] space-y-1.5 overflow-y-auto">{errs?.length ? errs.map((e) => <div key={e.id} className="rounded-lg border p-2 text-xs"><div className="flex gap-2"><Badge variant="outline" className={cn("text-[10px]", e.level === "error" && "border-destructive text-destructive")}>{e.level}</Badge><span className="font-medium">{e.source}</span><span className="ml-auto text-muted-foreground">{e.created_at}</span></div><p className="mt-1 break-words">{e.message}</p></div>) : <p className="text-sm text-muted-foreground">No errors logged.</p>}</div></div>
      <div className="rounded-xl border bg-card p-4"><p className="mb-2 font-semibold">AI usage (latest 200 calls)</p><div className="max-h-[480px] overflow-y-auto"><table className="w-full text-xs"><thead className="text-left text-muted-foreground"><tr><th className="py-1">Task</th><th>Model</th><th>Tokens</th><th>Latency</th><th>QC</th><th>Status</th></tr></thead><tbody>{usage?.map((u) => <tr key={u.id} className="border-t"><td className="py-1">{u.task}</td><td>{u.model}</td><td className="tabular-nums">{u.input_tokens ?? 0}/{u.output_tokens ?? 0}</td><td className="tabular-nums">{u.latency_ms}ms</td><td>{u.qc}</td><td className={u.status === "ok" ? "text-emerald-600" : "text-destructive"}>{u.status}</td></tr>)}</tbody></table>{!usage?.length && <p className="text-sm text-muted-foreground">No AI calls yet.</p>}</div></div>
      <div className="rounded-xl border bg-card p-4 xl:col-span-2"><p className="mb-2 font-semibold">Recent doubts (AI answers)</p><div className="max-h-72 space-y-1 overflow-y-auto text-xs">{doubts?.map((d) => <div key={d.id} className="flex gap-2 border-b py-1"><Badge variant="secondary" className="text-[10px]">{d.input_type}</Badge><span className="flex-1 truncate">{d.question}</span><span className="text-muted-foreground">{d.lang} · {d.mode} · {d.confidence} · {d.email}</span></div>)}</div></div>
    </div>
  );
}

export default function Admin() {
  return (
    <div>
      <PageHeader title="Admin Panel" subtitle="Manage content, review AI output, monitor videos, students, certificates and AI usage." />
      <Tabs defaultValue="overview">
        <TabsList className="mb-4 flex h-auto flex-wrap justify-start">
          {[["overview", "Overview"], ["content", "Content"], ["review", "AI review queue"], ["videos", "Video QC"], ["students", "Students"], ["certificates", "Certificates"], ["logs", "Errors & AI usage"]].map(([k, l]) => <TabsTrigger key={k} value={k} data-testid={`tab-admin-${k}`}>{l}</TabsTrigger>)}
        </TabsList>
        <TabsContent value="overview"><Overview /></TabsContent>
        <TabsContent value="content"><Content /></TabsContent>
        <TabsContent value="review"><Review /></TabsContent>
        <TabsContent value="videos"><Videos /></TabsContent>
        <TabsContent value="students"><Students /></TabsContent>
        <TabsContent value="certificates"><Certs /></TabsContent>
        <TabsContent value="logs"><Logs /></TabsContent>
      </Tabs>
    </div>
  );
}
