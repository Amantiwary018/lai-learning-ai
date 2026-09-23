import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { Flame, BookCheck, PlayCircle, Target, NotebookPen, Award, ArrowRight, AlertTriangle, FolderGit2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/AppShell";

function Kpi({ icon: I, label, value, hint }: any) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground"><I className="h-4 w-4" />{label}</div>
      <p className="mt-2 text-2xl font-bold tabular-nums">{value}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export default function Dashboard() {
  const { data: d, isLoading } = useQuery<any>({ queryKey: ["/api/dashboard"] });
  if (isLoading || !d) return <div className="space-y-4"><Skeleton className="h-10 w-64" /><div className="grid gap-4 sm:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}</div><Skeleton className="h-64" /></div>;
  const chart = d.attempts.map((a: any, i: number) => ({ n: i + 1, percent: a.percent, title: a.title }));
  return (
    <div>
      <PageHeader title={`Hi, ${d.user.name.split(" ")[0]}`} subtitle="Here's where you left off and what to do next.">
        <Link href="/courses"><Button variant="outline" data-testid="button-browse">Browse courses</Button></Link>
      </PageHeader>

      {d.advice && (
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4" data-testid="text-advice">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div className="flex-1"><p className="text-sm font-medium">{d.advice}</p></div>
          {d.weak[0] && <Link href={`/learn/${d.weak[0].id}`}><Button size="sm" variant="outline" data-testid="button-revise">Revise now</Button></Link>}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border bg-card p-5 lg:col-span-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{d.current ? "Continue learning" : "Start here"}</p>
          {d.current ? (<>
            <h2 className="mt-1 text-lg font-semibold" data-testid="text-current-topic">{d.current.title}</h2>
            <p className="text-sm text-muted-foreground">{d.current.course} · {d.current.chapter}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href={`/learn/${d.current.id}`}><Button data-testid="button-continue"><PlayCircle className="mr-2 h-4 w-4" />{d.current.completed ? "Review lesson" : "Resume lesson"}</Button></Link>
              {d.recommended && d.recommended.id !== d.current.id && <Link href={`/learn/${d.recommended.id}`}><Button variant="outline" data-testid="button-next-recommended">Next: {d.recommended.title}<ArrowRight className="ml-2 h-4 w-4" /></Button></Link>}
            </div>
          </>) : d.recommended ? (<>
            <h2 className="mt-1 text-lg font-semibold">{d.recommended.title}</h2>
            <p className="text-sm text-muted-foreground">{d.recommended.course} · {d.recommended.chapter}</p>
            <Link href={`/learn/${d.recommended.id}`}><Button className="mt-4" data-testid="button-start-first">Start your first lesson<ArrowRight className="ml-2 h-4 w-4" /></Button></Link>
          </>) : <p className="mt-2 text-sm">Pick a course to begin.</p>}
        </div>
        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center gap-3"><Flame className="h-8 w-8 text-orange-500" /><div><p className="text-2xl font-bold tabular-nums" data-testid="text-streak">{d.streak} day{d.streak === 1 ? "" : "s"}</p><p className="text-xs text-muted-foreground">Learning streak</p></div></div>
          <div className="mt-4 grid grid-cols-7 gap-1.5">{d.activity.map((a: any) => <div key={a.day} title={a.day} className={`aspect-square rounded ${a.active ? "bg-primary" : "bg-secondary"}`} />)}</div>
          <p className="mt-2 text-xs text-muted-foreground">Last 14 days</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi icon={BookCheck} label="Topics completed" value={d.stats.completed} hint={`${d.stats.started} started`} />
        <Kpi icon={PlayCircle} label="Video lessons watched" value={d.stats.videos} />
        <Kpi icon={Target} label="Average test score" value={d.stats.avgScore == null ? "—" : `${d.stats.avgScore}%`} hint={`${d.stats.tests} tests taken`} />
        <Kpi icon={NotebookPen} label="Saved notes & bookmarks" value={d.notes} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border bg-card p-5 lg:col-span-2">
          <h3 className="font-semibold">Quiz performance</h3>
          {chart.length ? (
            <div className="mt-3 h-56"><ResponsiveContainer><LineChart data={chart}><CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" /><XAxis dataKey="n" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" /><YAxis domain={[0, 100]} tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" /><Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} formatter={(v: any) => [`${v}%`, "Score"]} labelFormatter={(_l: any, p: any) => p?.[0]?.payload?.title || ""} /><Line type="monotone" dataKey="percent" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 3 }} /></LineChart></ResponsiveContainer></div>
          ) : <p className="mt-3 text-sm text-muted-foreground">Take a topic test to see your performance trend here.</p>}
        </div>
        <div className="rounded-xl border bg-card p-5">
          <h3 className="font-semibold">Weak topics</h3>
          {d.weak.length ? <ul className="mt-3 space-y-2">{d.weak.map((w: any) => <li key={w.id}><Link href={`/learn/${w.id}`} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm hover:border-primary" data-testid={`link-weak-${w.id}`}><span className="truncate">{w.title}</span><span className="ml-2 font-semibold text-destructive">{w.best}%</span></Link></li>)}</ul> : <p className="mt-3 text-sm text-muted-foreground">No weak topics yet. Topics scoring below 60% in tests appear here.</p>}
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border bg-card p-5 lg:col-span-2">
          <h3 className="font-semibold">Enrolled courses</h3>
          {d.courses.length ? <div className="mt-3 space-y-3">{d.courses.map((c: any) => (
            <Link key={c.id} href={`/course/${c.slug}`} className="block rounded-lg border p-3 hover:border-primary" data-testid={`link-enrolled-${c.slug}`}>
              <div className="flex items-center justify-between text-sm"><span className="font-medium">{c.title}</span><span className="tabular-nums text-muted-foreground">{c.completed}/{c.published} topics</span></div>
              <Progress value={c.percent} className="mt-2 h-2" />
            </Link>))}</div> : <p className="mt-3 text-sm text-muted-foreground">You haven't enrolled in a course yet.</p>}
        </div>
        <div className="space-y-4">
          <div className="rounded-xl border bg-card p-5">
            <h3 className="flex items-center gap-2 font-semibold"><Award className="h-4 w-4" />Certificates</h3>
            {d.certificates.length ? d.certificates.map((c: any) => <Link key={c.id} href={`/certificate/${c.id}`} className="mt-2 block text-sm text-primary underline">{c.course_title}</Link>) : <p className="mt-2 text-sm text-muted-foreground">Complete a certification course to earn your first LAI certificate.</p>}
          </div>
          <div className="rounded-xl border bg-card p-5">
            <h3 className="flex items-center gap-2 font-semibold"><FolderGit2 className="h-4 w-4" />Projects</h3>
            {d.projects.length ? d.projects.slice(0, 4).map((p: any) => <Link key={p.id} href={`/course/${p.slug}/project`} className="mt-2 flex justify-between text-sm"><span className="truncate">{p.course}</span><span className={p.score >= 60 ? "text-emerald-600" : "text-amber-600"}>{p.score}/100</span></Link>) : <p className="mt-2 text-sm text-muted-foreground">No project submissions yet.</p>}
          </div>
          <Link href="/doubts" className="flex items-center gap-3 rounded-xl border bg-primary p-5 text-primary-foreground"><Sparkles className="h-5 w-5" /><span className="text-sm font-medium">Stuck? Ask the AI doubt solver</span></Link>
        </div>
      </div>
    </div>
  );
}
