import { Link, useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { CheckCircle2, Circle, PlayCircle, Lock, ClipboardList, FolderGit2, Award, ArrowRight, Loader2, Clock, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { api, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

const AI_PATH = ["AI Fundamentals", "AI Assistants", "Prompt Engineering", "AI Research", "Productivity", "Data Analysis", "AI Coding", "Automation", "AI Agents", "APIs", "Profession-Specific AI"];

export default function CoursePage() {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth(); const [, nav] = useLocation(); const { toast } = useToast();
  const { data: c, isLoading, error } = useQuery<any>({ queryKey: ["/api/courses", slug] });
  const enroll = useMutation({ mutationFn: () => api("POST", `/api/courses/${slug}/enroll`), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/courses"] }); toast({ title: "Enrolled", description: "The course has been added to your dashboard." }); } });
  const cert = useMutation({ mutationFn: () => api<{ id: string }>("POST", `/api/courses/${slug}/certificate`), onSuccess: (r) => nav(`/certificate/${r.id}`), onError: (e: any) => toast({ title: "Not yet", description: e.message, variant: "destructive" }) });
  if (isLoading) return <div className="space-y-4"><Skeleton className="h-28" /><Skeleton className="h-96" /></div>;
  if (error || !c) return <p className="text-sm text-destructive">Course not found.</p>;
  const allTopics = c.subjects.flatMap((s: any) => s.chapters.flatMap((ch: any) => ch.topics));
  const firstOpen = allTopics.find((t: any) => t.status === "published" && !t.completed) || allTopics.find((t: any) => t.status === "published");
  const isFull = c.content_status === "full";
  const needLogin = () => { toast({ title: "Log in to continue", description: "Create a free account to track progress." }); nav("/login"); };
  return (
    <div>
      <div className="rounded-2xl border bg-card p-5 sm:p-7">
        <div className="flex flex-wrap gap-1.5">
          {isFull ? <Badge className="bg-emerald-600 hover:bg-emerald-600">Full course</Badge> : <Badge variant="secondary"><Clock className="mr-1 h-3 w-3" />Outline · lessons in production</Badge>}
          {!!c.certifiable && <Badge variant="outline"><Award className="mr-1 h-3 w-3" />LAI certificate</Badge>}
          {c.level && <Badge variant="outline">{c.level}</Badge>}
        </div>
        <h1 className="mt-3 font-display text-2xl font-bold sm:text-3xl" data-testid="text-course-title">{c.title}</h1>
        <p className="mt-2 max-w-3xl text-muted-foreground">{c.description}</p>
        {user && isFull && <div className="mt-4 max-w-md"><div className="flex justify-between text-sm"><span>Progress</span><span className="tabular-nums">{c.progress.completed}/{c.progress.published} topics</span></div><Progress value={c.progress.percent} className="mt-1.5 h-2" /></div>}
        <div className="mt-5 flex flex-wrap gap-2">
          {firstOpen && <Button onClick={() => user ? nav(`/learn/${firstOpen.id}`) : needLogin()} data-testid="button-start-course"><PlayCircle className="mr-2 h-4 w-4" />{c.progress?.completed ? "Continue" : "Start learning"}</Button>}
          {user && !c.enrolled && <Button variant="outline" onClick={() => enroll.mutate()} disabled={enroll.isPending} data-testid="button-enroll">Enroll</Button>}
          {c.enrolled && <Badge variant="secondary" className="px-3 py-2">Enrolled</Badge>}
        </div>
      </div>

      {slug === "learn-ai" && (
        <div className="mt-4 rounded-xl border bg-card p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Recommended learning path</p>
          <div className="mt-3 flex flex-wrap items-center gap-1.5 text-sm">{AI_PATH.map((p, i) => <span key={p} className="flex items-center gap-1.5"><span className="rounded-md bg-secondary px-2 py-1">{i + 1}. {p}</span>{i < AI_PATH.length - 1 && <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />}</span>)}</div>
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
        <div>
          <h2 className="mb-3 font-semibold">Syllabus</h2>
          <Accordion type="multiple" defaultValue={c.subjects.slice(0, 1).map((s: any) => `s${s.id}`)} className="space-y-3">
            {c.subjects.map((s: any, si: number) => (
              <AccordionItem key={s.id} value={`s${s.id}`} className="rounded-xl border bg-card px-4">
                <AccordionTrigger className="hover:no-underline" data-testid={`accordion-subject-${s.id}`}><span className="text-left"><span className="block text-xs text-muted-foreground">Subject {si + 1}</span>{s.title}</span></AccordionTrigger>
                <AccordionContent>
                  {s.chapters.map((ch: any, ci: number) => (
                    <div key={ch.id} className="mb-4">
                      <div className="mb-1.5 flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold">Chapter {ci + 1}: {ch.title}</p>
                        {user && ch.topics.some((t: any) => t.status === "published") && <Link href={`/test/chapter/${ch.id}`}><Button size="sm" variant="ghost" className="h-7 text-xs" data-testid={`button-chapter-test-${ch.id}`}><ClipboardList className="mr-1 h-3.5 w-3.5" />Chapter test</Button></Link>}
                      </div>
                      <ul className="space-y-1">
                        {ch.topics.map((t: any) => {
                          const pub = t.status === "published";
                          const inner = (<>
                            {t.completed ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" /> : pub ? <Circle className="h-4 w-4 shrink-0 text-muted-foreground" /> : <Lock className="h-4 w-4 shrink-0 text-muted-foreground/60" />}
                            <span className={`flex-1 ${pub ? "" : "text-muted-foreground"}`}>{t.title}</span>
                            {t.testBest >= 0 && <span className={`text-xs tabular-nums ${t.testBest >= 60 ? "text-emerald-600" : "text-destructive"}`}>{t.testBest}%</span>}
                            {pub && t.hasVideo && <PlayCircle className="h-3.5 w-3.5 text-primary" />}
                            {!pub && <span className="text-[11px] text-muted-foreground">coming soon</span>}
                          </>);
                          return <li key={t.id}>{pub ? <button onClick={() => user ? nav(`/learn/${t.id}`) : needLogin()} className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-secondary" data-testid={`link-topic-${t.id}`}>{inner}</button> : <div className="flex items-center gap-2.5 px-2 py-1.5 text-sm">{inner}</div>}</li>;
                        })}
                      </ul>
                    </div>
                  ))}
                  {user && s.chapters.some((ch: any) => ch.topics.some((t: any) => t.status === "published")) && <Link href={`/test/subject/${s.id}`}><Button size="sm" variant="outline" data-testid={`button-subject-test-${s.id}`}><ClipboardList className="mr-1.5 h-4 w-4" />Subject test</Button></Link>}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>

        <aside className="space-y-4">
          {isFull && user && (
            <div className="rounded-xl border bg-card p-5">
              <h3 className="font-semibold">Assessments</h3>
              <div className="mt-3 space-y-2">
                <Link href={`/test/mock/${c.id}`}><Button variant="outline" className="w-full justify-start" data-testid="button-mock-test"><ClipboardList className="mr-2 h-4 w-4" />Mock test (20 questions)</Button></Link>
                <Link href={`/test/final/${c.id}`}><Button variant="outline" className="mt-2 w-full justify-start" data-testid="button-final-test"><Award className="mr-2 h-4 w-4" />Final assessment</Button></Link>
                {c.project && <Link href={`/course/${slug}/project`}><Button variant="outline" className="mt-2 w-full justify-start" data-testid="button-project"><FolderGit2 className="mr-2 h-4 w-4" />Final project</Button></Link>}
              </div>
            </div>
          )}
          {c.certificate?.certifiable && (
            <div className="rounded-xl border bg-card p-5" data-testid="panel-certificate">
              <h3 className="flex items-center gap-2 font-semibold"><Award className="h-4 w-4 text-primary" />LAI Certificate of Completion</h3>
              <ul className="mt-3 space-y-2 text-sm">{c.certificate.requirements.map((r: any) => <li key={r.key} className="flex items-start gap-2">{r.met ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />}<span>{r.label}<span className="block text-xs text-muted-foreground">{r.detail}</span></span></li>)}</ul>
              {c.certificate.certificateId ? <Link href={`/certificate/${c.certificate.certificateId}`}><Button className="mt-4 w-full" data-testid="button-view-certificate">View certificate</Button></Link>
                : <Button className="mt-4 w-full" disabled={!c.certificate.eligible || cert.isPending} onClick={() => cert.mutate()} data-testid="button-claim-certificate">{cert.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{c.certificate.eligible ? "Claim certificate" : "Complete requirements to unlock"}</Button>}
              <p className="mt-3 text-xs text-muted-foreground">Issued by LAI – Learning AI. Not an official certificate from any AI company.</p>
            </div>
          )}
          {!isFull && <div className="rounded-xl border bg-card p-5 text-sm text-muted-foreground"><p className="font-semibold text-foreground">Syllabus preview</p>This course's full structure is ready. Lessons, videos and tests are being produced and reviewed; topics unlock as soon as they pass quality checks.</div>}
          {c.project && <div className="rounded-xl border bg-card p-5"><h3 className="font-semibold">Course project</h3><p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{c.project}</p></div>}
        </aside>
      </div>
    </div>
  );
}
