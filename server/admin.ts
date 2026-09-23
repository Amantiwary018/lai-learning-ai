import type { Express, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { q, J, logError, topicCtx } from "./db";
import { requireAdmin, rateLimit } from "./security";
import { route, MODELS, gatewayHealth } from "./ai";
import { enqueueVideo } from "./videojobs";
import { insertLesson } from "./seed";

const wrap = (fn: (req: Request, res: Response) => any) => (req: Request, res: Response, next: NextFunction) => Promise.resolve(fn(req, res)).catch(next);
const fail = (status: number, message: string) => Object.assign(new Error(message), { status });

const DRAFT_PROMPT = (ctx: any) => `Write a lesson for the LAI – Learning AI platform. Course: ${ctx.course}. Subject: ${ctx.subject}. Chapter: ${ctx.chapter}. Topic: ${ctx.title}. ${ctx.prog_language ? `Programming language: ${ctx.prog_language}.` : ""}
Audience: beginner college students. Be accurate; do not invent facts.
Return ONLY JSON with keys: summary (1 sentence), shortNotes (6 bullets), detailed {explanation (markdown, 3-5 paragraphs), definitions [{term, meaning}], formulas [{name, expression, note}], points [5-8]},
codeExample (${ctx.prog_language ? `{language, code, explanation}` : "null"}), commonMistakes [3],
questions: 6 {type:"mcq", prompt, options[4], answer (0-3), explanation, difficulty}, 2 {type:"short", prompt, answer, keywords[3-5], explanation}, 1 {type:"numerical", prompt, answer (exact short string), explanation}${ctx.prog_language ? `, 1 {type:"coding", prompt, starter, solution, explanation}` : ""},
scenes: 4-6 video scenes [{title, steps:[{say: 1-2 spoken sentences (no symbols), write: null | {kind: heading|text|equation|code|bullet|highlight, content: board line under 48 chars}}]}] with 200-320 words of narration total; the board is built step by step (one new line per step).`;

export function registerAdmin(app: Express) {
  app.use("/api/admin", requireAdmin);

  app.get("/api/admin/overview", wrap(async (_req, res) => {
    const c = (sql: string) => q.get<any>(sql)!.n;
    res.json({
      counts: { students: c("SELECT COUNT(*) n FROM users WHERE role='student'"), courses: c("SELECT COUNT(*) n FROM courses"), topics: c("SELECT COUNT(*) n FROM topics"),
        published: c("SELECT COUNT(*) n FROM topics WHERE status='published'"), questions: c("SELECT COUNT(*) n FROM questions"), certificates: c("SELECT COUNT(*) n FROM certificates WHERE status='valid'"),
        doubts: c("SELECT COUNT(*) n FROM doubts"), attempts: c("SELECT COUNT(*) n FROM attempts"), pendingReview: c("SELECT COUNT(*) n FROM lessons WHERE review_status='pending'"),
        errors24h: c("SELECT COUNT(*) n FROM error_logs WHERE created_at > datetime('now','-1 day')") },
      videos: q.all("SELECT status, COUNT(*) n FROM videos GROUP BY status"),
      aiByModel: q.all("SELECT model, COUNT(*) calls, SUM(input_tokens) input, SUM(output_tokens) output, ROUND(AVG(latency_ms)) latency, SUM(status='error') errors FROM ai_usage GROUP BY model"),
      aiByTask: q.all("SELECT task, COUNT(*) calls FROM ai_usage GROUP BY task"),
      aiDaily: q.all("SELECT substr(created_at,1,10) day, COUNT(*) calls, SUM(status='error') errors FROM ai_usage WHERE created_at > datetime('now','-14 day') GROUP BY day ORDER BY day"),
      models: MODELS, gateway: await gatewayHealth(),
    });
  }));

  // ---------- Content CRUD ----------
  app.get("/api/admin/courses", (_req, res) => res.json(q.all("SELECT c.*, (SELECT COUNT(*) FROM subjects WHERE course_id=c.id) subjects FROM courses c ORDER BY sort, id")));
  const courseBody = z.object({ slug: z.string().regex(/^[a-z0-9-]+$/).min(2).max(60), title: z.string().min(2).max(120), category: z.string(), description: z.string().max(600).default(""),
    level: z.string().max(40).default("Beginner"), prog_language: z.string().max(20).nullable().optional(), certifiable: z.boolean().default(false), project: z.string().max(3000).nullable().optional(), status: z.enum(["published", "draft"]).default("published") });
  app.post("/api/admin/courses", wrap((req, res) => {
    const b = courseBody.parse(req.body);
    if (q.get("SELECT id FROM courses WHERE slug=?", b.slug)) throw fail(409, "Slug already in use");
    const id = q.run("INSERT INTO courses (slug, title, category, description, level, prog_language, certifiable, project, status, sort) VALUES (?,?,?,?,?,?,?,?,?,?)",
      b.slug, b.title, b.category, b.description, b.level, b.prog_language || null, b.certifiable ? 1 : 0, b.project || null, b.status, 500).lastInsertRowid;
    res.json({ id });
  }));
  app.patch("/api/admin/courses/:id", wrap((req, res) => {
    const b = courseBody.partial().parse(req.body);
    for (const [k, v] of Object.entries(b)) if (v !== undefined) q.run(`UPDATE courses SET ${k}=? WHERE id=?`, typeof v === "boolean" ? (v ? 1 : 0) : v, Number(req.params.id));
    res.json({ ok: true });
  }));
  app.delete("/api/admin/courses/:id", (req, res) => { q.run("DELETE FROM courses WHERE id=?", Number(req.params.id)); res.json({ ok: true }); });

  app.get("/api/admin/tree/:courseId", (req, res) => {
    const cid = Number(req.params.courseId);
    res.json(q.all<any>("SELECT * FROM subjects WHERE course_id=? ORDER BY sort, id", cid).map((s) => ({ ...s,
      chapters: q.all<any>("SELECT * FROM chapters WHERE subject_id=? ORDER BY sort, id", s.id).map((ch) => ({ ...ch,
        topics: q.all<any>(`SELECT t.*, l.review_status, (SELECT COUNT(*) FROM questions WHERE topic_id=t.id) questions, (SELECT status FROM videos WHERE topic_id=t.id AND lang='en') video
          FROM topics t LEFT JOIN lessons l ON l.topic_id=t.id WHERE t.chapter_id=? ORDER BY t.sort, t.id`, ch.id) })) })));
  });
  const node = z.object({ title: z.string().min(1).max(160), parentId: z.number().optional(), sort: z.number().optional(), status: z.enum(["published", "pipeline", "draft"]).optional() });
  const tables: Record<string, { table: string; parent: string }> = { subjects: { table: "subjects", parent: "course_id" }, chapters: { table: "chapters", parent: "subject_id" }, topics: { table: "topics", parent: "chapter_id" } };
  for (const [name, { table, parent }] of Object.entries(tables)) {
    app.post(`/api/admin/${name}`, wrap((req, res) => {
      const b = node.parse(req.body); if (!b.parentId) throw fail(400, "parentId required");
      const sort = b.sort ?? (q.get<any>(`SELECT COALESCE(MAX(sort),-1)+1 n FROM ${table} WHERE ${parent}=?`, b.parentId)!.n);
      const id = name === "topics" ? q.run(`INSERT INTO topics (chapter_id, title, sort, status) VALUES (?,?,?,?)`, b.parentId, b.title, sort, "pipeline").lastInsertRowid
        : q.run(`INSERT INTO ${table} (${parent}, title, sort) VALUES (?,?,?)`, b.parentId, b.title, sort).lastInsertRowid;
      res.json({ id });
    }));
    app.patch(`/api/admin/${name}/:id`, wrap((req, res) => {
      const b = node.partial().parse(req.body);
      if (b.title) q.run(`UPDATE ${table} SET title=? WHERE id=?`, b.title, Number(req.params.id));
      if (b.sort !== undefined) q.run(`UPDATE ${table} SET sort=? WHERE id=?`, b.sort, Number(req.params.id));
      if (b.status && name === "topics") {
        if (b.status === "published" && !q.get("SELECT 1 FROM lessons WHERE topic_id=? AND review_status='approved'", Number(req.params.id))) throw fail(400, "Approve the lesson content before publishing this topic.");
        q.run("UPDATE topics SET status=? WHERE id=?", b.status, Number(req.params.id));
      }
      res.json({ ok: true });
    }));
    app.delete(`/api/admin/${name}/:id`, (req, res) => { q.run(`DELETE FROM ${table} WHERE id=?`, Number(req.params.id)); res.json({ ok: true }); });
  }

  // ---------- Lessons & questions ----------
  app.get("/api/admin/lessons/:topicId", wrap((req, res) => {
    const tid = Number(req.params.topicId); const l = q.get<any>("SELECT * FROM lessons WHERE topic_id=?", tid);
    res.json({ topic: topicCtx(tid), lesson: l ? { ...l, short_notes: J(l.short_notes), detailed: J(l.detailed), code_example: J(l.code_example), common_mistakes: J(l.common_mistakes) } : null,
      questions: q.all<any>("SELECT * FROM questions WHERE topic_id=? ORDER BY id", tid).map((x) => ({ ...x, options: J(x.options), meta: J(x.meta, {}) })),
      videos: q.all<any>("SELECT id, lang, status, error, updated_at FROM videos WHERE topic_id=?", tid) });
  }));
  app.put("/api/admin/lessons/:topicId", wrap((req, res) => {
    const tid = Number(req.params.topicId);
    const b = z.object({ summary: z.string(), short_notes: z.array(z.string()), detailed: z.any(), visual_id: z.string().nullable().optional() }).parse(req.body);
    const ex = q.get("SELECT id FROM lessons WHERE topic_id=?", tid);
    if (ex) q.run("UPDATE lessons SET summary=?, short_notes=?, detailed=?, visual_id=?, source='manual-edit', updated_at=datetime('now') WHERE topic_id=?", b.summary, JSON.stringify(b.short_notes), JSON.stringify(b.detailed), b.visual_id ?? null, tid);
    else q.run("INSERT INTO lessons (topic_id, summary, short_notes, detailed, visual_id, review_status, source) VALUES (?,?,?,?,?,?,?)", tid, b.summary, JSON.stringify(b.short_notes), JSON.stringify(b.detailed), b.visual_id ?? null, "pending", "manual");
    res.json({ ok: true });
  }));
  const qBody = z.object({ topicId: z.number(), type: z.enum(["mcq", "short", "numerical", "coding"]), prompt: z.string().min(3), options: z.array(z.string()).nullable().optional(), answer: z.string(), explanation: z.string().default(""), difficulty: z.string().default("medium"), meta: z.any().optional() });
  app.post("/api/admin/questions", wrap((req, res) => {
    const b = qBody.parse(req.body);
    if (b.type === "mcq" && (!b.options || b.options.length < 2 || isNaN(Number(b.answer)) || Number(b.answer) >= b.options.length)) throw fail(400, "MCQ needs options and a valid answer index.");
    const id = q.run("INSERT INTO questions (topic_id, type, prompt, options, answer, explanation, difficulty, meta) VALUES (?,?,?,?,?,?,?,?)", b.topicId, b.type, b.prompt, b.options ? JSON.stringify(b.options) : null, b.answer, b.explanation, b.difficulty, JSON.stringify(b.meta || {})).lastInsertRowid;
    res.json({ id });
  }));
  app.patch("/api/admin/questions/:id", wrap((req, res) => {
    const b = qBody.partial().parse(req.body);
    for (const [k, v] of Object.entries(b)) if (v !== undefined && k !== "topicId") q.run(`UPDATE questions SET ${k}=? WHERE id=?`, k === "options" || k === "meta" ? JSON.stringify(v) : v, Number(req.params.id));
    res.json({ ok: true });
  }));
  app.delete("/api/admin/questions/:id", (req, res) => { q.run("DELETE FROM questions WHERE id=?", Number(req.params.id)); res.json({ ok: true }); });

  // ---------- AI-generated content review ----------
  app.post("/api/admin/topics/:id/generate-draft", rateLimit("draft", 10, 10 * 60_000), wrap(async (req, res) => {
    const tid = Number(req.params.id); const ctx = topicCtx(tid); if (!ctx) throw fail(404, "Topic not found");
    const r = await route({ task: "draft", userId: req.user!.id, maxTokens: 8000, skipLangCheck: true, system: "You are an expert curriculum writer. Output strictly valid JSON.", messages: [{ role: "user", content: DRAFT_PROMPT(ctx) }] });
    let d: any; try { d = JSON.parse(/\{[\s\S]*\}/.exec(r.text)![0]); } catch { throw fail(502, "The AI draft was not valid JSON. Please try again."); }
    if (!d.summary || !Array.isArray(d.shortNotes) || !Array.isArray(d.questions)) throw fail(502, "The AI draft is missing required sections. Please try again.");
    insertLesson(tid, d, null, "pending", "ai-draft");
    q.run("UPDATE topics SET status='draft' WHERE id=?", tid);
    res.json({ ok: true, model: r.modelLabel });
  }));
  app.get("/api/admin/review-queue", (_req, res) => res.json(q.all(`SELECT l.topic_id, l.summary, l.source, l.updated_at, t.title, c.title course FROM lessons l JOIN topics t ON t.id=l.topic_id
    JOIN chapters ch ON ch.id=t.chapter_id JOIN subjects s ON s.id=ch.subject_id JOIN courses c ON c.id=s.course_id WHERE l.review_status='pending' ORDER BY l.updated_at DESC`)));
  app.post("/api/admin/lessons/:topicId/review", wrap((req, res) => {
    const tid = Number(req.params.topicId); const b = z.object({ action: z.enum(["approve", "reject"]), publish: z.boolean().default(true) }).parse(req.body);
    if (b.action === "approve") {
      q.run("UPDATE lessons SET review_status='approved', source=CASE WHEN source='ai-draft' THEN 'ai-draft-reviewed' ELSE source END WHERE topic_id=?", tid);
      if (b.publish) q.run("UPDATE topics SET status='published' WHERE id=?", tid);
      const v = q.get<any>("SELECT id, status FROM videos WHERE topic_id=? AND lang='en'", tid);
      if (v && v.status !== "published") enqueueVideo(v.id);
    } else {
      q.run("UPDATE lessons SET review_status='rejected' WHERE topic_id=?", tid);
      q.run("UPDATE topics SET status='pipeline' WHERE id=?", tid);
    }
    res.json({ ok: true });
  }));

  // ---------- Videos ----------
  app.get("/api/admin/videos", (_req, res) => res.json(q.all<any>(`SELECT v.id, v.lang, v.status, v.error, v.updated_at, v.manifest, t.title topic, c.title course FROM videos v JOIN topics t ON t.id=v.topic_id
    JOIN chapters ch ON ch.id=t.chapter_id JOIN subjects s ON s.id=ch.subject_id JOIN courses c ON c.id=s.course_id ORDER BY c.sort, v.id`).map((v) => {
    const m = J(v.manifest); return { ...v, manifest: undefined, duration: m?.duration, scenes: m?.scenes?.length, qcPassed: m?.qc?.passed, checks: m?.qc?.checks, faultyScenes: m?.qc?.faultyScenes,
      sceneList: m?.scenes?.map((s: any) => ({ index: s.index, title: s.title, start: s.start, end: s.end, duration: s.duration, status: s.status, checks: s.checks })) };
  })));
  app.post("/api/admin/videos/:id/build", wrap((req, res) => {
    const b = z.object({ onlyScenes: z.array(z.number()).nullable().optional() }).parse(req.body || {});
    if (!q.get("SELECT id FROM videos WHERE id=?", req.params.id)) throw fail(404, "Video not found");
    enqueueVideo(String(req.params.id), b.onlyScenes ?? null); res.json({ ok: true });
  }));
  app.post("/api/admin/videos/:id/translate", wrap(async (req, res) => {
    const b = z.object({ lang: z.enum(["hi", "hinglish"]) }).parse(req.body);
    const v = q.get<any>("SELECT * FROM videos WHERE id=?", req.params.id); if (!v) throw fail(404, "Video not found");
    const target = b.lang === "hi" ? "Hindi in Devanagari script (keep code, symbols and equations exactly as written)" : "Hinglish (Hindi in Latin script)";
    const r = await route({ task: "draft", userId: req.user!.id, maxTokens: 6000, skipLangCheck: true, system: "You translate lesson scripts faithfully. Output strictly valid JSON only.",
      messages: [{ role: "user", content: `Translate every "say" field of this lesson video script into natural spoken ${target}. Keep "write" board items unchanged. Keep the same scenes and steps, same order. Return JSON {"scenes":[...]}.\n${v.script}` }] });
    let d: any; try { d = JSON.parse(/\{[\s\S]*\}/.exec(r.text)![0]); } catch { throw fail(502, "Translation failed. Try again."); }
    const orig = J(v.script, []);
    if (d.scenes?.length !== orig.length || d.scenes.some((s: any, i: number) => s.steps?.length !== orig[i].steps.length)) throw fail(502, "Translated script structure did not match the original; not saved.");
    const nid = `v${v.topic_id}-${b.lang}`;
    q.run("INSERT OR REPLACE INTO videos (id, topic_id, lang, voice, script, status) VALUES (?,?,?,?,?, 'queued')", nid, v.topic_id, b.lang, v.voice, JSON.stringify(d.scenes));
    enqueueVideo(nid); res.json({ id: nid });
  }));

  // ---------- Students, certificates, logs ----------
  app.get("/api/admin/students", (_req, res) => res.json(q.all(`SELECT u.id, u.name, u.email, u.role, u.status, u.created_at, (SELECT COUNT(*) FROM enrollments WHERE user_id=u.id) courses,
    (SELECT COUNT(*) FROM progress WHERE user_id=u.id AND completed=1) completed, (SELECT ROUND(AVG(percent)) FROM attempts WHERE user_id=u.id) avg, (SELECT MAX(day) FROM activity WHERE user_id=u.id) last_active FROM users u ORDER BY u.id`)));
  app.patch("/api/admin/students/:id", wrap((req, res) => {
    const b = z.object({ status: z.enum(["active", "suspended"]).optional(), role: z.enum(["student", "admin"]).optional() }).parse(req.body);
    if (Number(req.params.id) === req.user!.id) throw fail(400, "You cannot change your own account here.");
    if (b.status) { q.run("UPDATE users SET status=? WHERE id=?", b.status, Number(req.params.id)); if (b.status === "suspended") q.run("DELETE FROM sessions WHERE user_id=?", Number(req.params.id)); }
    if (b.role) q.run("UPDATE users SET role=? WHERE id=?", b.role, Number(req.params.id));
    res.json({ ok: true });
  }));
  app.get("/api/admin/certificates", (_req, res) => res.json(q.all("SELECT c.*, u.email FROM certificates c JOIN users u ON u.id=c.user_id ORDER BY issued_at DESC")));
  app.patch("/api/admin/certificates/:id", wrap((req, res) => {
    const b = z.object({ status: z.enum(["valid", "revoked"]) }).parse(req.body);
    q.run("UPDATE certificates SET status=? WHERE id=?", b.status, req.params.id); res.json({ ok: true });
  }));
  app.get("/api/admin/errors", (_req, res) => res.json(q.all("SELECT * FROM error_logs ORDER BY id DESC LIMIT 200")));
  app.get("/api/admin/ai-usage", (_req, res) => res.json(q.all("SELECT a.*, u.email FROM ai_usage a LEFT JOIN users u ON u.id=a.user_id ORDER BY a.id DESC LIMIT 200")));
  app.get("/api/admin/doubts", (_req, res) => res.json(q.all("SELECT d.id, d.input_type, d.mode, d.lang, d.question, d.confidence, d.model, d.created_at, u.email FROM doubts d JOIN users u ON u.id=d.user_id ORDER BY d.id DESC LIMIT 100")));
  void logError;
}
