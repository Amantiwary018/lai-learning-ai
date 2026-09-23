import { useState } from "react";
import { Link, useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ArrowLeft, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/AppShell";
import { api, queryClient } from "@/lib/queryClient";

export default function ProjectPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data, isLoading } = useQuery<any>({ queryKey: ["/api/courses", slug, "project"] });
  const [content, setContent] = useState(""); const [link, setLink] = useState(""); const [err, setErr] = useState("");
  const submit = useMutation({ mutationFn: () => api<any>("POST", `/api/courses/${slug}/project`, { content, link: link || undefined }), onSuccess: () => { setContent(""); queryClient.invalidateQueries({ queryKey: ["/api/courses"] }); }, onError: (e: any) => setErr(e.message) });
  if (isLoading) return <Skeleton className="h-96" />;
  return (
    <div>
      <Link href={`/course/${slug}`}><Button variant="ghost" size="sm" className="mb-3"><ArrowLeft className="mr-1.5 h-4 w-4" />Back to course</Button></Link>
      <PageHeader title="Final project" subtitle="Build it, submit it, and get an AI-assisted review against the project brief. A score of 60+ counts toward your certificate." />
      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <div className="rounded-xl border bg-card p-5"><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Project brief</p><p className="mt-2 whitespace-pre-line text-sm">{data?.brief}</p></div>
          <div className="rounded-xl border bg-card p-5">
            <p className="mb-2 text-sm font-semibold">Your submission</p>
            <Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={14} spellCheck={false} className="font-mono text-sm" placeholder="Paste your full source code and a short README: what it does, how to run it, and sample output." data-testid="input-project" />
            <Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="GitHub or demo link (optional)" className="mt-2" data-testid="input-project-link" />
            {err && <p className="mt-2 text-sm text-destructive">{err}</p>}
            <Button className="mt-3" disabled={content.trim().length < 40 || submit.isPending} onClick={() => { setErr(""); submit.mutate(); }} data-testid="button-submit-project">{submit.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}{submit.isPending ? "Reviewing your project…" : "Submit for review"}</Button>
            <p className="mt-2 text-xs text-muted-foreground">The reviewer reads your code but does not execute it. Admins can see every submission.</p>
          </div>
        </div>
        <div className="space-y-3">
          <p className="text-sm font-semibold">Submissions</p>
          {data?.submissions?.length ? data.submissions.map((s: any) => (
            <div key={s.id} className="rounded-xl border bg-card p-4" data-testid={`card-submission-${s.id}`}>
              <div className="flex items-center justify-between"><span className="flex items-center gap-1.5 text-sm font-semibold">{s.score >= 60 ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <AlertTriangle className="h-4 w-4 text-amber-600" />}{s.score}/100</span><span className="text-xs text-muted-foreground">{new Date(s.created_at + "Z").toLocaleString()}</span></div>
              <p className="mt-2 text-sm">{s.review?.summary}</p>
              {!!s.review?.strengths?.length && <><p className="mt-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400">Strengths</p><ul className="text-xs">{s.review.strengths.map((x: string) => <li key={x}>• {x}</li>)}</ul></>}
              {!!s.review?.improvements?.length && <><p className="mt-2 text-xs font-semibold text-amber-700 dark:text-amber-400">Improve</p><ul className="text-xs">{s.review.improvements.map((x: string) => <li key={x}>• {x}</li>)}</ul></>}
            </div>
          )) : <p className="text-sm text-muted-foreground">No submissions yet.</p>}
        </div>
      </div>
    </div>
  );
}
