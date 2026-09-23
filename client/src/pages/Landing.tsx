import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, PenLine, Camera, Box, ClipboardCheck, Code2, Award, ShieldCheck, Mic, FileText, Languages, CheckCircle2, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/AppShell";
import { useAuth } from "@/lib/auth";

const FLOW = ["Learn", "Ask", "See", "Practice", "Build", "Get certified"];
const FEATURES = [
  { icon: PenLine, title: "AI video teacher that writes live", text: "A natural human voice explains while an animated hand writes each equation, line of code and note — in sync with the speech, never all at once." },
  { icon: Camera, title: "Doubt solver: text, photo, voice, PDF", text: "Snap a handwritten question or an error screenshot. Get step-by-step solutions, the concept behind them, and similar practice questions." },
  { icon: Box, title: "Visual and 3D learning", text: "Rotate molecules and computer hardware, run circuit simulations, step through memory and pointers. 3D only where it helps." },
  { icon: ClipboardCheck, title: "Practice, tests and analysis", text: "MCQ, short-answer, numerical and coding questions. Topic, chapter, subject and mock tests with weak-topic analysis." },
  { icon: Code2, title: "Programming lab", text: "C, Python and Java courses from introduction to projects, plus an AI code explainer and debugger." },
  { icon: Award, title: "Verifiable LAI certificates", text: "Complete lessons, assessments and a final project to earn a LAI Certificate of Completion with a public verification page." },
];

export default function Landing() {
  const { user } = useAuth();
  const { data: courses } = useQuery<any[]>({ queryKey: ["/api/courses"] });
  const { data: cats } = useQuery<any[]>({ queryKey: ["/api/categories"] });
  const full = courses?.filter((c) => c.content_status === "full") || [];
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
          <Link href="/"><Logo /></Link>
          <nav className="ml-6 hidden items-center gap-5 text-sm font-medium text-muted-foreground md:flex">
            <Link href="/courses" className="hover:text-foreground">Courses</Link>
            <Link href="/visual" className="hover:text-foreground">Visual Lab</Link>
            <Link href="/ai-tools" className="hover:text-foreground">AI Tools Academy</Link>
            <Link href="/verify" className="hover:text-foreground">Verify certificate</Link>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            {user ? <Link href="/dashboard"><Button data-testid="button-go-dashboard">Dashboard</Button></Link> : <>
              <Link href="/login"><Button variant="ghost" data-testid="button-login">Log in</Button></Link>
              <Link href="/signup"><Button data-testid="button-signup">Start learning</Button></Link>
            </>}
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:py-20">
          <div>
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground"><GraduationCap className="h-3.5 w-3.5 text-primary" />AI-powered learning platform · English, हिन्दी, Hinglish</p>
            <h1 className="font-display text-[clamp(2.1rem,4.4vw,3.5rem)] font-extrabold leading-[1.02] tracking-tight">
              Don't just study.<br /><span className="text-primary">See it, interact with it,</span><br />build it and prove your skills.
            </h1>
            <p className="mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">LAI – Learning AI is a complete learning ecosystem: AI video lessons written live by hand, a doubt solver that reads your photos, interactive 3D visuals, practice, tests, projects and verifiable certificates.</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href={user ? "/dashboard" : "/signup"}><Button size="lg" data-testid="button-hero-start">Start learning free <ArrowRight className="ml-2 h-4 w-4" /></Button></Link>
              <Link href="/courses"><Button size="lg" variant="outline" data-testid="button-hero-courses">Browse courses</Button></Link>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
              <span><b className="text-foreground">{courses?.length ?? "—"}</b> courses</span>
              <span><b className="text-foreground">{full.reduce((s, c) => s + c.publishedTopics, 0) || "—"}</b> published lessons</span>
              <span><b className="text-foreground">{full.reduce((s, c) => s + c.videos, 0) || "—"}</b> quality-checked video lectures</span>
            </div>
          </div>
          <div className="relative">
            <div className="overflow-hidden rounded-2xl border bg-card shadow-xl">
              <img src="./hero.jpg" alt="A hand writing an equation step by step on a whiteboard, surrounded by 3D learning models" className="aspect-video w-full object-cover" />
              <div className="board flex items-center gap-4 border-t p-4">
                <div className="shrink-0 whitespace-nowrap font-hand text-lg leading-tight text-board-ink sm:text-xl"><p>2x + 5 = 17</p><p>2x = 12</p><p className="text-board-accent">x = 6</p></div>
                <p className="text-sm text-muted-foreground">Each line is written by the animated hand exactly when the teacher says it.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y bg-card">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-2 px-4 py-5 sm:gap-3">
          {FLOW.map((f, i) => (
            <span key={f} className="flex items-center gap-2 sm:gap-3"><span className="rounded-full bg-secondary px-3 py-1.5 text-sm font-semibold">{f}</span>{i < FLOW.length - 1 && <ArrowRight className="h-4 w-4 text-muted-foreground" />}</span>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <h2 className="font-display text-2xl font-bold sm:text-3xl">Everything a student needs, in one flow</h2>
        <p className="mt-2 max-w-2xl text-muted-foreground">Select course → subject → chapter → topic, then move through video, notes, visuals, doubts, practice and tests. Finish with a project, final assessment and certificate.</p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-xl border bg-card p-5">
              <f.icon className="h-6 w-6 text-primary" />
              <h3 className="mt-3 font-semibold">{f.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6">
        <div className="grid gap-4 md:grid-cols-4">
          {cats?.map((c) => {
            const list = courses?.filter((x) => (c.slug === "certifications" ? x.certifiable : x.category === c.slug)) || [];
            return (
              <Link key={c.slug} href={`/courses?cat=${c.slug}`} className="group rounded-xl border bg-card p-5 transition-colors hover:border-primary" data-testid={`card-category-${c.slug}`}>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{list.length} courses</p>
                <h3 className="mt-1 font-semibold">{c.name}</h3>
                <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">{c.description}</p>
                <p className="mt-3 line-clamp-2 text-xs text-muted-foreground">{list.slice(0, 5).map((x) => x.title).join(" · ")}</p>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="border-t bg-card">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-14 sm:px-6 lg:grid-cols-2">
          <div>
            <h2 className="font-display text-2xl font-bold">Reliable lectures, by design</h2>
            <p className="mt-2 text-muted-foreground">Every lecture passes an automated quality gate before any student sees it. If a scene fails, only that scene is regenerated.</p>
            <ul className="mt-5 grid gap-2 text-sm sm:grid-cols-2">
              {["Audio exists for every scene", "Audio length matches the script", "Scenes in order, no overlaps", "No missing or duplicated scenes", "No dead air or dropouts", "One language throughout", "Captions match narration", "Zero drift: visuals follow the audio clock"].map((x) => (
                <li key={x} className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />{x}</li>
              ))}
            </ul>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {[{ i: ShieldCheck, t: "Secure by default", d: "Hashed passwords, server-side sessions, rate limits, validated uploads. AI keys never leave the server." },
              { i: Languages, t: "Your language", d: "Learn in English, Hindi or Hinglish with 7 explanation modes from Very Easy to Exam Style." },
              { i: Mic, t: "Speak your doubt", d: "Ask by voice and listen to the answer in a natural voice." },
              { i: FileText, t: "Ask your own notes", d: "Upload a PDF and ask questions grounded in your material." }].map((x) => (
              <div key={x.t} className="rounded-xl border bg-background p-4"><x.i className="h-5 w-5 text-primary" /><p className="mt-2 font-semibold">{x.t}</p><p className="mt-1 text-sm text-muted-foreground">{x.d}</p></div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-center gap-3"><Logo compact /><span>© 2026 LAI – Learning AI · Created and owned by Aman Kumar Tiwary (Reg. No. AJU/261982)</span></div>
          <p className="max-w-md text-xs">LAI certificates are issued by LAI only. LAI is not affiliated with or endorsed by OpenAI, Google, Anthropic, Microsoft or any other AI provider.</p>
        </div>
      </footer>
    </div>
  );
}
