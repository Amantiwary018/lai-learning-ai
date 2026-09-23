import { useState } from "react";
import { Link } from "wouter";
import { Copy, Check, ArrowRight, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/AppShell";
import { cn } from "@/lib/utils";

const TOOLS = [
  { name: "ChatGPT", maker: "OpenAI", good: ["Brainstorming and drafting", "Explaining concepts step by step", "Code help and data analysis (paid tiers)"], watch: "Can state wrong facts confidently. Check dates, numbers and citations." },
  { name: "Gemini", maker: "Google", good: ["Working with Google Docs, Gmail and Drive", "Long documents and multimodal input", "Quick research summaries"], watch: "Always open the linked sources before relying on a summary." },
  { name: "Claude", maker: "Anthropic", good: ["Long reading and careful writing", "Reviewing documents and code", "Structured reasoning"], watch: "It may not know very recent events unless connected to search." },
  { name: "Microsoft Copilot", maker: "Microsoft", good: ["Help inside Word, Excel, PowerPoint and Outlook", "Summarising meetings and email", "Web answers with citations"], watch: "Features depend on your Microsoft 365 plan and organisation settings." },
  { name: "DeepSeek", maker: "DeepSeek", good: ["Step-by-step maths and logic reasoning", "Explaining and writing code", "Low-cost API access for projects"], watch: "Double-check facts and dates; answers can be confidently wrong on recent events." },
  { name: "GitHub Copilot", maker: "GitHub / Microsoft", good: ["Code completion in your editor", "Writing tests and boilerplate", "Explaining unfamiliar code"], watch: "Review every suggestion; generated code can contain bugs or security issues." },
];

const PROMPTS = [
  { t: "Learn a concept", p: "Act as a patient teacher. Explain [topic] to a [class/level] student using one everyday example, then ask me 3 questions to check my understanding. Keep it under 200 words." },
  { t: "Exam answer", p: "Write a 5-mark exam answer on [question]. Use: definition, 3 key points with one-line explanations, a labelled diagram description, and a one-line conclusion." },
  { t: "Debug code", p: "Here is my [language] code and the error message. Explain the cause in simple words, point to the exact line, and show the corrected code. Code: [paste] Error: [paste]" },
  { t: "Verify a claim", p: "I read that [claim]. List what would need to be true for this to be correct, what reliable sources I should check, and any common misconceptions about it." },
  { t: "Summarise notes", p: "Summarise these notes into 8 bullet points for quick revision, then list 5 likely exam questions with short answers. Notes: [paste]" },
];

const MODULES = ["AI Fundamentals", "AI Assistants", "Prompt Engineering", "AI Research & Verification", "AI for Productivity", "AI for Data & Analysis", "AI Coding & Development", "AI Automation", "AI Agents", "AI for Creative Work", "AI APIs & Integration", "Profession-Specific AI Skills"];

export default function AITools() {
  const [copied, setCopied] = useState<number | null>(null);
  const copy = (i: number, s: string) => { navigator.clipboard?.writeText(s).then(() => { setCopied(i); setTimeout(() => setCopied(null), 1500); }).catch(() => {}); };
  return (
    <div>
      <PageHeader title="AI Tools Academy" subtitle="Learn how to use popular AI assistants well — what each is good at, how to prompt it, and how to verify its answers.">
        <Link href="/course/learn-ai"><Button data-testid="button-learn-ai-course">Open the Learn AI course<ArrowRight className="ml-2 h-4 w-4" /></Button></Link>
      </PageHeader>
      <div className="mb-6 flex items-start gap-3 rounded-xl border bg-card p-4 text-sm">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <p className="text-muted-foreground"><b className="text-foreground">Independent guide.</b> LAI is not affiliated with, endorsed by, or a partner of any company listed here. Product names belong to their owners, and features and pricing change often — check each provider's website for current details.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {TOOLS.map((t) => (
          <div key={t.name} className="rounded-xl border bg-card p-5" data-testid={`card-tool-${t.name.toLowerCase().replace(/\s+/g, "-")}`}>
            <div className="flex items-center justify-between"><h3 className="font-semibold">{t.name}</h3><span className="text-xs text-muted-foreground">by {t.maker}</span></div>
            <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Good for</p>
            <ul className="mt-1 space-y-1 text-sm">{t.good.map((g) => <li key={g}>• {g}</li>)}</ul>
            <p className="mt-3 rounded-lg bg-amber-500/10 p-2 text-xs text-amber-800 dark:text-amber-300"><b>Watch out:</b> {t.watch}</p>
          </div>
        ))}
      </div>

      <h2 className="mb-3 mt-10 font-display text-lg font-bold">Prompt templates that work with any assistant</h2>
      <div className="grid gap-3 md:grid-cols-2">
        {PROMPTS.map((p, i) => (
          <div key={p.t} className="rounded-xl border bg-card p-4">
            <div className="flex items-center justify-between"><p className="font-semibold">{p.t}</p><Button size="sm" variant="ghost" onClick={() => copy(i, p.p)} data-testid={`button-copy-prompt-${i}`}>{copied === i ? <Check className="mr-1 h-4 w-4 text-emerald-600" /> : <Copy className="mr-1 h-4 w-4" />}{copied === i ? "Copied" : "Copy"}</Button></div>
            <p className="mt-2 font-mono text-xs leading-relaxed text-muted-foreground">{p.p}</p>
          </div>
        ))}
      </div>

      <h2 className="mb-3 mt-10 font-display text-lg font-bold">The 5-step verification habit</h2>
      <ol className="grid gap-3 md:grid-cols-5">
        {["Ask for sources", "Open the sources", "Cross-check with a second source", "Check numbers and dates yourself", "Say what you're unsure about"].map((s, i) => (
          <li key={s} className="rounded-xl border bg-card p-4 text-sm"><span className="font-display text-2xl font-extrabold text-primary">{i + 1}</span><p className="mt-1">{s}</p></li>
        ))}
      </ol>

      <h2 className="mb-3 mt-10 font-display text-lg font-bold">Learn AI: 12 modules</h2>
      <div className="flex flex-wrap gap-2">{MODULES.map((m, i) => <Badge key={m} variant={i === 0 || i === 2 ? "default" : "secondary"} className={cn("px-3 py-1.5 text-xs")}>{i + 1}. {m}</Badge>)}</div>
      <p className="mt-2 text-xs text-muted-foreground">Recommended order: follow the numbers. Highlighted modules have full lessons now; the rest show their syllabus while lessons are produced.</p>
    </div>
  );
}
