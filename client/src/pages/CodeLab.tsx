import { useRef, useState } from "react";
import { Link } from "wouter";
import { Play, Loader2, BookOpen, Bug, AlertOctagon, Star, Map, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/AppShell";
import { Markdown } from "@/components/Markdown";
import { LANGS } from "@/components/DoubtChat";
import { api } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";

const SAMPLES: Record<string, string> = {
  python: `def average(marks):\n    total = 0\n    for m in marks:\n        total += m\n    return total / len(marks)\n\nprint(average([78, 92, 85]))\nprint(average([]))`,
  javascript: `function fizzbuzz(n) {\n  for (let i = 1; i <= n; i++) {\n    if (i % 15 === 0) console.log("FizzBuzz");\n    else if (i % 3 === 0) console.log("Fizz");\n    else if (i % 5 === 0) console.log("Buzz");\n    else console.log(i);\n  }\n}\nfizzbuzz(15);`,
  c: `#include <stdio.h>\n\nint main() {\n    int arr[5] = {3, 8, 1, 9, 4};\n    int max = arr[0];\n    for (int i = 0; i <= 5; i++) {\n        if (arr[i] > max) max = arr[i];\n    }\n    printf("Max = %d\\n", max);\n    return 0;\n}`,
  java: `public class Main {\n    public static void main(String[] args) {\n        String name = null;\n        System.out.println("Length: " + name.length());\n    }\n}`,
  cpp: `#include <iostream>\nusing namespace std;\n\nint factorial(int n) {\n    if (n == 0) return 1;\n    return n * factorial(n - 1);\n}\n\nint main() {\n    cout << factorial(5) << endl;\n    return 0;\n}`,
  sql: `SELECT name, AVG(marks) AS avg_marks\nFROM students\nWHERE avg_marks > 75\nGROUP BY name;`,
};
const NAMES: Record<string, string> = { python: "Python", javascript: "JavaScript", c: "C", java: "Java", cpp: "C++", sql: "SQL" };
const ACTIONS = [
  { k: "explain", l: "Explain code", i: BookOpen }, { k: "debug", l: "Find bugs", i: Bug }, { k: "error", l: "Explain my error", i: AlertOctagon },
  { k: "review", l: "Review & score", i: Star }, { k: "roadmap", l: "Learning roadmap", i: Map },
];

let pyodidePromise: Promise<any> | null = null;
function loadPyodide(): Promise<any> {
  if (!pyodidePromise) pyodidePromise = new Promise((res, rej) => {
    const s = document.createElement("script"); s.src = "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js";
    s.onload = () => (window as any).loadPyodide().then(res, rej); s.onerror = () => { pyodidePromise = null; rej(new Error("Could not load the Python runtime. Check your connection.")); };
    document.head.appendChild(s);
  });
  return pyodidePromise;
}
function runJs(code: string): Promise<string> {
  return new Promise((resolve) => {
    const f = document.createElement("iframe"); f.sandbox.add("allow-scripts"); f.style.display = "none";
    const done = (out: string) => { window.removeEventListener("message", onMsg); f.remove(); resolve(out); };
    const onMsg = (e: MessageEvent) => { if (e.source === f.contentWindow && e.data?.laiOut !== undefined) done(e.data.laiOut); };
    window.addEventListener("message", onMsg);
    f.srcdoc = `<script>const o=[];const fmt=a=>a.map(x=>typeof x==='object'?JSON.stringify(x):String(x)).join(' ');console.log=(...a)=>o.push(fmt(a));console.error=(...a)=>o.push('Error: '+fmt(a));try{${code.replace(/<\/script>/gi, "<\\/script>")}\n}catch(e){o.push(e.name+': '+e.message)}parent.postMessage({laiOut:o.join('\\n')},'*');<\/script>`;
    document.body.appendChild(f); setTimeout(() => done("Stopped: the program took longer than 5 seconds (infinite loop?)."), 5000);
  });
}

export default function CodeLab() {
  const { user } = useAuth();
  const [lang, setLang] = useState("python"); const [code, setCode] = useState(SAMPLES.python); const [error, setError] = useState("");
  const [out, setOut] = useState<string | null>(null); const [running, setRunning] = useState(false);
  const [answer, setAnswer] = useState(""); const [busy, setBusy] = useState<string | null>(null); const [err, setErr] = useState("");
  const [uiLang, setUiLang] = useState(user?.language || "en");
  const runnable = lang === "python" || lang === "javascript";
  const run = async () => {
    setRunning(true); setOut(null);
    try {
      if (lang === "javascript") setOut((await runJs(code)) || "(no output)");
      else {
        const py = await loadPyodide(); let buf = "";
        py.setStdout({ batched: (s: string) => { buf += s + "\n"; } }); py.setStderr({ batched: (s: string) => { buf += s + "\n"; } });
        try { await py.runPythonAsync(code); } catch (e: any) { buf += String(e.message).split("\n").slice(-4).join("\n"); }
        setOut(buf || "(no output)");
      }
    } catch (e: any) { setOut(e.message); } finally { setRunning(false); }
  };
  const ask = async (action: string) => {
    setBusy(action); setErr(""); setAnswer("");
    try { const r = await api<any>("POST", "/api/code/assist", { language: NAMES[lang], code, error: action === "error" ? (error || out || "") : undefined, action, lang: uiLang }); setAnswer(r.answer); }
    catch (e: any) { setErr(e.message); } finally { setBusy(null); }
  };
  return (
    <div>
      <PageHeader title="Code Lab" subtitle="Write code, run Python and JavaScript right in your browser, and let the AI explain, debug and review it.">
        <Link href="/course/c-programming"><Button variant="outline" size="sm">C course</Button></Link>
        <Link href="/course/python-programming"><Button variant="outline" size="sm">Python course</Button></Link>
        <Link href="/course/java-programming"><Button variant="outline" size="sm">Java course</Button></Link>
      </PageHeader>
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Select value={lang} onValueChange={(v) => { setLang(v); setCode(SAMPLES[v]); setOut(null); setAnswer(""); }}><SelectTrigger className="h-9 w-40" data-testid="select-code-language"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(NAMES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select>
            <Select value={uiLang} onValueChange={setUiLang}><SelectTrigger className="h-9 w-36"><SelectValue /></SelectTrigger><SelectContent>{LANGS.map((l) => <SelectItem key={l.v} value={l.v}>{l.l}</SelectItem>)}</SelectContent></Select>
            {runnable ? <Button className="ml-auto" onClick={run} disabled={running} data-testid="button-run">{running ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Play className="mr-1.5 h-4 w-4" />}{running && lang === "python" && !out ? "Loading Python…" : "Run"}</Button>
              : <span className="ml-auto text-xs text-muted-foreground">{NAMES[lang]} runs on your computer's compiler. The AI can reason about its output.</span>}
          </div>
          <Textarea value={code} onChange={(e) => setCode(e.target.value)} rows={16} spellCheck={false} className="bg-[#0f1629] font-mono text-sm text-[#dbe4ff]" data-testid="input-code" />
          {out !== null && <div className="rounded-lg border bg-card p-3" data-testid="text-output"><p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"><Terminal className="h-3.5 w-3.5" />Output</p><pre className="whitespace-pre-wrap font-mono text-sm">{out}</pre></div>}
          <Textarea value={error} onChange={(e) => setError(e.target.value)} rows={2} placeholder="Paste a compiler/runtime error here (optional)" className="font-mono text-xs" data-testid="input-error" />
          <div className="flex flex-wrap gap-2">{ACTIONS.map((a) => <Button key={a.k} variant="outline" size="sm" onClick={() => ask(a.k)} disabled={!!busy} data-testid={`button-ai-${a.k}`}>{busy === a.k ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <a.i className="mr-1.5 h-4 w-4" />}{a.l}</Button>)}</div>
        </div>
        <div className="min-h-[300px] rounded-xl border bg-card p-5" data-testid="panel-ai-answer">
          {err && <p className="text-sm text-destructive">{err}</p>}
          {busy && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />The AI is reading your code…</p>}
          {answer ? <Markdown>{answer}</Markdown> : !busy && !err && <div className="text-sm text-muted-foreground"><p className="font-medium text-foreground">AI code assistant</p><p className="mt-1">Each sample has a deliberate issue (for example, the C sample reads past the end of the array and the Java sample throws a NullPointerException). Try “Find bugs” or run the Python sample to see the division-by-zero error, then press “Explain my error”.</p></div>}
        </div>
      </div>
    </div>
  );
}
