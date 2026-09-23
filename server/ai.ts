import http from "node:http";
/**
 * LAI AI Router
 *   Student Request -> LAI AI Router -> Appropriate model/tool -> Quality Check -> Final Response
 *
 * Models are registered with capability scores; the router picks the best model for a task
 * (weighing cost, speed, coding, vision, language support), and falls back to the next
 * candidate on failure. All provider calls go through the internal AI gateway (server-side only);
 * API keys never reach the browser.
 */
import { q, logError } from "./db";

const GATEWAY = process.env.AI_GATEWAY_URL || "http://127.0.0.1:8001";

export type Task = "doubt" | "vision" | "code" | "grade" | "draft" | "quick" | "document";

interface ModelSpec { id: string; label: string; vision: boolean; coding: number; reasoning: number; hindi: number; speed: number; cost: number; docs: number; enabled: boolean; }

export const MODELS: ModelSpec[] = [
  { id: "claude_sonnet_4_6", label: "Claude Sonnet 4.6", vision: true, coding: 5, reasoning: 5, hindi: 4, speed: 3, cost: 3, docs: 5, enabled: true },
  { id: "gemini_3_flash", label: "Gemini 3 Flash", vision: true, coding: 4, reasoning: 4, hindi: 5, speed: 5, cost: 1, docs: 4, enabled: true },
  { id: "gpt5_mini", label: "GPT-5 mini", vision: true, coding: 4, reasoning: 4, hindi: 4, speed: 4, cost: 1, docs: 4, enabled: true },
  { id: "claude_haiku_4_5", label: "Claude Haiku 4.5", vision: true, coding: 4, reasoning: 3, hindi: 3, speed: 5, cost: 1, docs: 3, enabled: true },
];

const WEIGHTS: Record<Task, Partial<Record<keyof ModelSpec, number>>> = {
  doubt: { reasoning: 3, speed: 1, cost: -0.5 },
  vision: { reasoning: 3, speed: 1 },
  code: { coding: 3, reasoning: 1.5, speed: 0.5 },
  grade: { reasoning: 2, speed: 2, cost: -1 },
  draft: { reasoning: 3, docs: 1 },
  quick: { speed: 3, cost: -2, reasoning: 1 },
  document: { docs: 3, reasoning: 2 },
};

export function rankModels(task: Task, opts: { lang?: string; needsVision?: boolean } = {}) {
  return MODELS.filter((m) => m.enabled && (!opts.needsVision || m.vision))
    .map((m) => {
      let s = 0;
      for (const [k, w] of Object.entries(WEIGHTS[task])) s += (m as any)[k] * (w as number);
      if (opts.lang === "hi" || opts.lang === "hinglish") s += m.hindi * 1.5;
      return { m, s };
    })
    .sort((a, b) => b.s - a.s)
    .map((x) => x.m);
}

export interface ChatMsg { role: "user" | "assistant"; content: string; images?: { media_type: string; data: string }[] }

// ---------- Quality check ----------
function scriptRatio(text: string) {
  const letters = [...text].filter((c) => /\p{L}/u.test(c));
  if (!letters.length) return 0;
  return letters.filter((c) => c >= "\u0900" && c <= "\u097F").length / letters.length;
}
export function qualityCheck(text: string, lang?: string) {
  const issues: string[] = [];
  if (!text || text.trim().length < 2) issues.push("empty response");
  if (lang === "hi" && scriptRatio(text.replace(/```[\s\S]*?```/g, "")) < 0.35) issues.push("language mismatch: expected Hindi (Devanagari)");
  if ((lang === "en" || lang === "hinglish") && scriptRatio(text) > 0.1) issues.push(`language mismatch: expected ${lang === "en" ? "English" : "Hinglish (Latin script)"}`);
  const sentences = text.split(/(?<=[.!?।])\s+/).map((s) => s.trim()).filter((s) => s.length > 25);
  const dup = sentences.length - new Set(sentences).size;
  if (dup > 1) issues.push("repeated sentences");
  return { passed: issues.length === 0, issues };
}

// Parse trailer lines the tutor is instructed to append
export function parseMeta(text: string) {
  const conf = /CONFIDENCE:\s*(high|medium|low)/i.exec(text)?.[1]?.toLowerCase() || "medium";
  const clar = /NEEDS_CLARIFICATION:\s*(yes|no)/i.exec(text)?.[1]?.toLowerCase() === "yes";
  const clean = text.replace(/\n?\s*CONFIDENCE:\s*\w+\s*/gi, "").replace(/\n?\s*NEEDS_CLARIFICATION:\s*\w+\s*/gi, "").trim();
  return { confidence: conf, needsClarification: clar, text: clean };
}

async function callGateway(model: string, system: string, messages: ChatMsg[], maxTokens: number) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 90_000);
  try {
    const r = await fetch(`${GATEWAY}/chat`, {
      method: "POST", headers: { "Content-Type": "application/json" }, signal: ctrl.signal,
      body: JSON.stringify({ model, system, messages: messages.map((m) => ({ role: m.role, content: m.content, images: m.images || [] })), max_tokens: maxTokens }),
    });
    if (!r.ok) throw new Error(`gateway ${r.status}: ${(await r.text()).slice(0, 200)}`);
    return (await r.json()) as { text: string; usage: { input: number; output: number }; latency_ms: number; provider: string; model: string };
  } finally { clearTimeout(t); }
}

export async function route(opts: { task: Task; system: string; messages: ChatMsg[]; userId?: number | null; lang?: string; maxTokens?: number; skipLangCheck?: boolean }) {
  const needsVision = opts.messages.some((m) => m.images?.length);
  const candidates = rankModels(opts.task, { lang: opts.lang, needsVision });
  let lastErr: any = null;
  for (const [i, m] of candidates.slice(0, 3).entries()) {
    try {
      let res = await callGateway(m.id, opts.system, opts.messages, opts.maxTokens || 1800);
      let qc = qualityCheck(res.text, opts.skipLangCheck ? undefined : opts.lang);
      if (!qc.passed && qc.issues.some((x) => x.startsWith("language"))) {
        // one corrective retry to keep the language consistent
        const fix = `${opts.system}\n\nIMPORTANT: Your previous answer used the wrong language. Respond ONLY in ${opts.lang === "hi" ? "Hindi (Devanagari script)" : opts.lang === "hinglish" ? "Hinglish (Hindi words written in Latin/English script)" : "English"}. Do not switch languages.`;
        res = await callGateway(m.id, fix, opts.messages, opts.maxTokens || 1800);
        qc = qualityCheck(res.text, opts.lang);
      }
      q.run("INSERT INTO ai_usage (user_id, task, provider, model, input_tokens, output_tokens, latency_ms, status, qc) VALUES (?,?,?,?,?,?,?,?,?)",
        opts.userId ?? null, opts.task, res.provider, m.id, res.usage?.input || 0, res.usage?.output || 0, res.latency_ms, i === 0 ? "ok" : "fallback-ok", JSON.stringify(qc));
      return { text: res.text, model: m.id, modelLabel: m.label, qc, fallback: i > 0 };
    } catch (e: any) {
      lastErr = e;
      q.run("INSERT INTO ai_usage (user_id, task, provider, model, latency_ms, status, qc) VALUES (?,?,?,?,?,?,?)", opts.userId ?? null, opts.task, "gateway", m.id, 0, "error", JSON.stringify({ error: String(e.message || e).slice(0, 300) }));
      logError("ai-router", `model ${m.id} failed: ${e.message || e}`, { task: opts.task }, opts.userId ?? null, "warn");
    }
  }
  throw Object.assign(new Error("The AI tutor is temporarily unavailable. Please try again in a moment."), { status: 503, cause: lastErr });
}

export async function gatewayHealth() {
  try { const r = await fetch(`${GATEWAY}/health`); return r.ok ? await r.json() : { ok: false }; } catch { return { ok: false }; }
}
export async function gatewayTTS(text: string, voice = "kore") {
  const r = await fetch(`${GATEWAY}/tts`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, voice }) });
  if (!r.ok) throw new Error(`tts ${r.status}`);
  return (await r.json()) as { audio: string; media_type: string };
}
// Video builds can take several minutes; global fetch (undici) aborts after 300s without headers,
// so use a plain http request with a generous explicit timeout.
export function gatewayBuildVideo(body: any): Promise<any> {
  const url = new URL(`${GATEWAY}/video/build`);
  const payload = JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: url.hostname, port: url.port, path: url.pathname, method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) } }, (res) => {
      let data = ""; res.setEncoding("utf8");
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        if ((res.statusCode || 500) >= 400) return reject(new Error(`video pipeline ${res.statusCode}: ${data.slice(0, 300)}`));
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    });
    req.setTimeout(30 * 60 * 1000, () => req.destroy(new Error("video pipeline timed out")));
    req.on("error", reject);
    req.end(payload);
  });
}

// ---------- Tutor prompt ----------
export const MODES: Record<string, string> = {
  "very-easy": "Explain like to a 12-year-old: very simple words, one everyday analogy, short sentences.",
  beginner: "Explain for a beginner: simple language, define every term, one example.",
  detailed: "Give a thorough, detailed explanation with background, examples and edge cases.",
  "step-by-step": "Solve/explain strictly step by step with numbered steps, one idea per step, showing all working.",
  visual: "Explain visually: use ASCII diagrams, tables or described mental pictures; structure the idea spatially.",
  exam: "Answer in exam style: definition, key points as bullets, formula/diagram if relevant, and a crisp conclusion suited for university exams.",
  revision: "Quick revision: 5-7 bullet points only, key formulas and one-line tips.",
};
export const LANGS: Record<string, string> = {
  en: "English",
  hi: "Hindi written in Devanagari script (keep technical terms and code in English where natural)",
  hinglish: "Hinglish — conversational Hindi written in Latin/English letters, mixed with English technical terms",
};

export function tutorSystem(ctx: { mode?: string; lang?: string; course?: string; subject?: string; chapter?: string; topic?: string; weak?: string[]; profession?: string; extra?: string }) {
  return `You are the LAI AI Teacher on "LAI – Learning AI", a patient, accurate tutor for students.
Language: respond ONLY in ${LANGS[ctx.lang || "en"] || "English"} for the entire answer. Never switch language mid-answer.
Explanation mode: ${MODES[ctx.mode || "beginner"] || MODES.beginner}
Learning context — Course: ${ctx.course || "general"}; Subject: ${ctx.subject || "-"}; Chapter: ${ctx.chapter || "-"}; Topic: ${ctx.topic || "-"}.${ctx.weak?.length ? ` The student is weak in: ${ctx.weak.join(", ")} — reinforce these gently.` : ""}${ctx.profession ? ` The student's profession/role: ${ctx.profession}.` : ""}
Rules:
- Be accurate. If you are not sure, say so clearly and suggest how to verify. Never present uncertain information as guaranteed fact.
- For problems: identify the question, solve step by step, explain the underlying concept, then give the final answer in bold.
- Use Markdown. Use fenced code blocks with a language tag for code. Use plain-text math like 2x + 5 = 17 (no LaTeX).
- After solving, add a section "Try these" with 2 similar practice questions (no answers), then ask one short question checking whether the student understood.
- If an image or question is unreadable, incomplete or ambiguous, do NOT guess: say what is unclear and ask for clarification.
- Refuse harmful requests politely. Do not write the student's graded assignment for them when explicitly asked to cheat; teach instead.
${ctx.extra || ""}
At the very end, on separate lines, output exactly:
CONFIDENCE: high|medium|low
NEEDS_CLARIFICATION: yes|no`;
}
