import type { Express, Request, Response, NextFunction } from "express";
import type { Server } from "http";
import express from "express";
import path from "node:path";
import crypto from "node:crypto";
import { z } from "zod";
import { q, J, logError, topicCtx } from "./db";
import { seed } from "./seed";
import { attachUser, requireAuth, rateLimit, hashPassword, verifyPassword, createSession, destroySession, validateUpload, moderate, securityHeaders, setSessionCookie } from "./security";
import { route, tutorSystem, parseMeta, gatewayTTS } from "./ai";
import { recoverJobs } from "./videojobs";
import { registerAdmin } from "./admin";

const wrap = (fn: (req: Request, res: Response) => any) => (req: Request, res: Response, next: NextFunction) => Promise.resolve(fn(req, res)).catch(next);
const today = () => new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10); // IST calendar day
const touch = (uid: number) => q.run("INSERT OR IGNORE INTO activity (user_id, day) VALUES (?,?)", uid, today());
const fail = (status: number, message: string) => Object.assign(new Error(message), { status });

// ---------------- helpers ----------------
function orderedTopics(courseId: number) {
  return q.all<any>(`SELECT t.id, t.title, t.status, ch.id chapter_id, ch.title chapter, s.id subject_id, s.title subject FROM topics t JOIN chapters ch ON ch.id=t.chapter_id
    JOIN subjects s ON s.id=ch.subject_id WHERE s.course_id=? ORDER BY s.sort, s.id, ch.sort, ch.id, t.sort, t.id`, courseId);
}
function courseProgress(courseId: number, userId?: number) {
  const pub = q.get<any>(`SELECT COUNT(*) n FROM topics t JOIN chapters ch ON ch.id=t.chapter_id JOIN subjects s ON s.id=ch.subject_id WHERE s.course_id=? AND t.status='published'`, courseId)!.n;
  if (!userId) return { published: pub, completed: 0, percent: 0 };
  const done = q.get<any>(`SELECT COUNT(*) n FROM progress p JOIN topics t ON t.id=p.topic_id JOIN chapters ch ON ch.id=t.chapter_id JOIN subjects s ON s.id=ch.subject_id
    WHERE s.course_id=? AND p.user_id=? AND p.completed=1 AND t.status='published'`, courseId, userId)!.n;
  return { published: pub, completed: done, percent: pub ? Math.round((done / pub) * 100) : 0 };
}
function streak(uid: number) {
  const days = new Set(q.all<any>("SELECT day FROM activity WHERE user_id=?", uid).map((r) => r.day));
  let n = 0; let d = new Date(today() + "T00:00:00Z");
  if (!days.has(today())) d = new Date(d.getTime() - 864e5);
  while (days.has(d.toISOString().slice(0, 10))) { n++; d = new Date(d.getTime() - 864e5); }
  return n;
}
function weakTopics(uid: number, limit = 5) {
  return q.all<any>(`SELECT p.topic_id id, t.title, p.test_best best, c.slug course_slug, c.title course FROM progress p JOIN topics t ON t.id=p.topic_id JOIN chapters ch ON ch.id=t.chapter_id
    JOIN subjects s ON s.id=ch.subject_id JOIN courses c ON c.id=s.course_id WHERE p.user_id=? AND p.test_best >= 0 AND p.test_best < 60 ORDER BY p.test_best LIMIT ?`, uid, limit);
}
function publicQuestion(r: any) {
  const meta = J(r.meta, {});
  return { id: r.id, topicId: r.topic_id, type: r.type, prompt: r.prompt, options: J(r.options), difficulty: r.difficulty, starter: meta.starter || null };
}
function norm(s: string) { return String(s ?? "").trim().toLowerCase().replace(/\s+/g, " ").replace(/^["'`]|["'`]$/g, ""); }
function gradeOne(qrow: any, ans: any): { score: number; correct: boolean } {
  if (ans === undefined || ans === null || ans === "") return { score: 0, correct: false };
  if (qrow.type === "mcq") { const ok = Number(ans) === Number(qrow.answer); return { score: ok ? 1 : 0, correct: ok }; }
  if (qrow.type === "numerical") {
    const a = norm(ans), b = norm(qrow.answer);
    const na = parseFloat(a), nb = parseFloat(b);
    const ok = a === b || (!isNaN(na) && !isNaN(nb) && /^-?[\d.]+(e-?\d+)?$/.test(a) && Math.abs(na - nb) <= Math.max(1e-6, Math.abs(nb) * 0.01));
    return { score: ok ? 1 : 0, correct: ok };
  }
  if (qrow.type === "short") {
    const kws: string[] = J(qrow.meta, {}).keywords || [];
    const text = norm(ans);
    if (!kws.length) return { score: text.length > 10 ? 0.5 : 0, correct: false };
    const hit = kws.filter((k) => { const kk = norm(k); return text.includes(kk) || (kk.length > 5 && text.includes(kk.slice(0, 5))); }).length / kws.length;
    const score = hit >= 0.6 ? 1 : hit >= 0.3 ? 0.5 : 0;
    return { score, correct: score === 1 };
  }
  return { score: 0, correct: false };
}
function shuffle<T>(a: T[]) { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = crypto.randomInt(i + 1); [b[i], b[j]] = [b[j], b[i]]; } return b; }

// served test papers (prevents grading a cherry-picked subset)
const papers = new Map<string, { uid: number; scope: string; scopeId: number; courseId: number; qids: number[]; at: number }>();

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  seed();
  recoverJobs();
  app.use(express.json({ limit: "15mb" }));
  app.use(securityHeaders);
  app.use(attachUser);
  app.use("/media", express.static(path.resolve(process.cwd(), "media"), { maxAge: "1h", acceptRanges: true }));

  // ---------------- Auth ----------------
  const cred = z.object({ email: z.string().email().max(120), password: z.string().min(8).max(100) });
  app.post("/api/auth/signup", rateLimit("auth", 10, 60_000), wrap((req, res) => {
    const b = cred.extend({ name: z.string().min(2).max(80) }).safeParse(req.body);
    if (!b.success) throw fail(400, "Please enter your name, a valid email and a password of at least 8 characters.");
    if (!/[A-Za-z]/.test(b.data.password) || !/\d/.test(b.data.password)) throw fail(400, "Password must contain letters and numbers.");
    const email = b.data.email.toLowerCase();
    if (q.get("SELECT id FROM users WHERE email=?", email)) throw fail(409, "An account with this email already exists.");
    const id = Number(q.run("INSERT INTO users (name, email, password_hash) VALUES (?,?,?)", b.data.name.trim(), email, hashPassword(b.data.password)).lastInsertRowid);
    touch(id);
    const tok = createSession(id); setSessionCookie(res, tok);
    res.json({ token: tok, user: q.get("SELECT id, name, email, role, language, explain_mode, profession FROM users WHERE id=?", id) });
  }));
  app.post("/api/auth/login", rateLimit("auth", 10, 60_000), wrap((req, res) => {
    const b = cred.safeParse(req.body);
    if (!b.success) throw fail(400, "Enter a valid email and password.");
    const u = q.get<any>("SELECT * FROM users WHERE email=?", b.data.email.toLowerCase());
    if (!u || !verifyPassword(b.data.password, u.password_hash)) throw fail(401, "Incorrect email or password.");
    if (u.status !== "active") throw fail(403, "This account is suspended. Contact support.");
    touch(u.id);
    const { password_hash, ...user } = u;
    const tok = createSession(u.id); setSessionCookie(res, tok);
    res.json({ token: tok, user });
  }));
  app.post("/api/auth/logout", (req, res) => { if (req.token) destroySession(req.token); setSessionCookie(res, null); res.json({ ok: true }); });
  app.get("/api/auth/me", requireAuth, (req, res) => res.json(req.user));
  app.patch("/api/me", requireAuth, wrap((req, res) => {
    const b = z.object({ name: z.string().min(2).max(80).optional(), language: z.enum(["en", "hi", "hinglish"]).optional(),
      explain_mode: z.enum(["very-easy", "beginner", "detailed", "step-by-step", "visual", "exam", "revision"]).optional(), profession: z.string().max(60).optional() }).parse(req.body);
    for (const [k, v] of Object.entries(b)) if (v !== undefined) q.run(`UPDATE users SET ${k}=? WHERE id=?`, v, req.user!.id);
    res.json(q.get("SELECT id, name, email, role, language, explain_mode, profession FROM users WHERE id=?", req.user!.id));
  }));

  // ---------------- Catalog ----------------
  app.get("/api/categories", (_req, res) => res.json(q.all("SELECT * FROM categories ORDER BY sort")));
  app.get("/api/courses", (req, res) => {
    const uid = req.user?.id;
    const rows = q.all<any>("SELECT * FROM courses WHERE status='published' ORDER BY sort, id");
    res.json(rows.map((c) => {
      const counts = q.get<any>(`SELECT COUNT(*) topics, SUM(t.status='published') published, COUNT(DISTINCT ch.id) chapters FROM topics t JOIN chapters ch ON ch.id=t.chapter_id JOIN subjects s ON s.id=ch.subject_id WHERE s.course_id=?`, c.id)!;
      const videos = q.get<any>(`SELECT COUNT(*) n FROM videos v JOIN topics t ON t.id=v.topic_id JOIN chapters ch ON ch.id=t.chapter_id JOIN subjects s ON s.id=ch.subject_id WHERE s.course_id=? AND v.status='published'`, c.id)!.n;
      return { ...c, topics: counts.topics, publishedTopics: counts.published || 0, chapters: counts.chapters, videos,
        enrolled: uid ? !!q.get("SELECT 1 FROM enrollments WHERE user_id=? AND course_id=?", uid, c.id) : false, progress: courseProgress(c.id, uid).percent };
    }));
  });
  app.get("/api/courses/:slug", wrap((req, res) => {
    const c = q.get<any>("SELECT * FROM courses WHERE slug=?", req.params.slug);
    if (!c) throw fail(404, "Course not found");
    const uid = req.user?.id;
    const prog = uid ? new Map(q.all<any>("SELECT * FROM progress WHERE user_id=?", uid).map((p) => [p.topic_id, p])) : new Map();
    const vids = new Set(q.all<any>("SELECT topic_id FROM videos WHERE status='published'").map((v) => v.topic_id));
    const subjects = q.all<any>("SELECT * FROM subjects WHERE course_id=? ORDER BY sort, id", c.id).map((s) => ({
      ...s, chapters: q.all<any>("SELECT * FROM chapters WHERE subject_id=? ORDER BY sort, id", s.id).map((ch) => ({
        ...ch, topics: q.all<any>("SELECT id, title, status FROM topics WHERE chapter_id=? ORDER BY sort, id", ch.id).map((t) => {
          const p: any = prog.get(t.id);
          return { ...t, hasVideo: vids.has(t.id), completed: !!p?.completed, testBest: p?.test_best ?? -1, started: !!p };
        }),
      })),
    }));
    res.json({ ...c, subjects, progress: courseProgress(c.id, uid), enrolled: uid ? !!q.get("SELECT 1 FROM enrollments WHERE user_id=? AND course_id=?", uid, c.id) : false,
      certificate: uid ? certStatus(c, uid) : null });
  }));
  app.post("/api/courses/:slug/enroll", requireAuth, wrap((req, res) => {
    const c = q.get<any>("SELECT id FROM courses WHERE slug=?", req.params.slug);
    if (!c) throw fail(404, "Course not found");
    q.run("INSERT OR IGNORE INTO enrollments (user_id, course_id) VALUES (?,?)", req.user!.id, c.id);
    touch(req.user!.id);
    res.json({ ok: true });
  }));

  // ---------------- Topic / lesson ----------------
  app.get("/api/topics/:id", wrap((req, res) => {
    const id = Number(req.params.id);
    const t = topicCtx(id);
    if (!t) throw fail(404, "Topic not found");
    const isAdmin = req.user?.role === "admin";
    if (!isAdmin && t.status !== "published") throw fail(404, "This topic is not published yet.");
    const lesson = q.get<any>("SELECT * FROM lessons WHERE topic_id=?", id);
    const showLesson = lesson && (lesson.review_status === "approved" || req.user?.role === "admin");
    const list = orderedTopics(t.course_id);
    const idx = list.findIndex((x) => x.id === id);
    const nextPub = list.slice(idx + 1).find((x) => x.status === "published");
    const prevPub = [...list.slice(0, idx)].reverse().find((x) => x.status === "published");
    const videos = q.all<any>("SELECT id, lang, status, manifest, error FROM videos WHERE topic_id=?", id).map((v) => ({ id: v.id, lang: v.lang, status: v.status, error: isAdmin ? v.error : null, manifest: v.status === "published" ? J(v.manifest) : null }));
    const uid = req.user?.id;
    const p = uid ? q.get<any>("SELECT * FROM progress WHERE user_id=? AND topic_id=?", uid, id) : null;
    const saved = uid ? q.all<any>("SELECT id, kind FROM saved_notes WHERE user_id=? AND topic_id=?", uid, id) : [];
    res.json({
      ...t, lesson: showLesson ? { summary: lesson.summary, shortNotes: J(lesson.short_notes, []), detailed: J(lesson.detailed, {}), codeExample: J(lesson.code_example), commonMistakes: J(lesson.common_mistakes, []), visualId: lesson.visual_id, reviewStatus: lesson.review_status, source: lesson.source } : null,
      questions: showLesson ? q.all<any>("SELECT * FROM questions WHERE topic_id=? ORDER BY id", id).map(publicQuestion) : [],
      videos, progress: p || null, bookmarked: saved.some((s) => s.kind === "bookmark"), revision: saved.some((s) => s.kind === "revision"),
      next: nextPub ? { id: nextPub.id, title: nextPub.title } : null, prev: prevPub ? { id: prevPub.id, title: prevPub.title } : null,
      position: { index: list.filter((x) => x.status === "published").findIndex((x) => x.id === id) + 1, total: list.filter((x) => x.status === "published").length },
    });
  }));
  app.post("/api/topics/:id/progress", requireAuth, wrap((req, res) => {
    const id = Number(req.params.id); const uid = req.user!.id;
    if (!topicCtx(id)) throw fail(404, "Topic not found");
    const b = z.object({ videoDone: z.boolean().optional(), notesDone: z.boolean().optional(), visualDone: z.boolean().optional(), practiceDone: z.boolean().optional(), videoPos: z.number().min(0).max(36000).optional() }).parse(req.body);
    q.run("INSERT OR IGNORE INTO progress (user_id, topic_id) VALUES (?,?)", uid, id);
    if (b.videoDone) q.run("UPDATE progress SET video_done=1 WHERE user_id=? AND topic_id=?", uid, id);
    if (b.notesDone) q.run("UPDATE progress SET notes_done=1 WHERE user_id=? AND topic_id=?", uid, id);
    if (b.visualDone) q.run("UPDATE progress SET visual_done=1 WHERE user_id=? AND topic_id=?", uid, id);
    if (b.practiceDone) q.run("UPDATE progress SET practice_done=1 WHERE user_id=? AND topic_id=?", uid, id);
    if (b.videoPos !== undefined) q.run("UPDATE progress SET video_pos=? WHERE user_id=? AND topic_id=?", b.videoPos, uid, id);
    q.run("UPDATE progress SET updated_at=datetime('now') WHERE user_id=? AND topic_id=?", uid, id);
    const c = topicCtx(id)!; q.run("INSERT OR IGNORE INTO enrollments (user_id, course_id) VALUES (?,?)", uid, c.course_id);
    touch(uid);
    res.json(q.get("SELECT * FROM progress WHERE user_id=? AND topic_id=?", uid, id));
  }));

  // ---------------- Practice (instant feedback) ----------------
  app.post("/api/practice/check", requireAuth, rateLimit("practice", 60, 60_000), wrap(async (req, res) => {
    const b = z.object({ questionId: z.number(), answer: z.any() }).parse(req.body);
    const qr = q.get<any>(`SELECT qu.* FROM questions qu JOIN topics t ON t.id=qu.topic_id JOIN lessons l ON l.topic_id=t.id
      WHERE qu.id=? AND t.status='published' AND l.review_status='approved'`, b.questionId);
    if (!qr) throw fail(404, "Question not found");
    const meta = J(qr.meta, {});
    if (qr.type === "coding") {
      const code = String(b.answer || "").slice(0, 8000);
      if (code.trim().length < 10) throw fail(400, "Write your code before submitting.");
      const ctx = topicCtx(qr.topic_id)!;
      const r = await route({ task: "code", userId: req.user!.id, maxTokens: 900, skipLangCheck: true,
        system: `You are a strict but kind programming examiner. Evaluate the student's ${ctx.prog_language || ""} code for the task. You cannot run code; reason carefully about correctness. Reply ONLY with JSON: {"score": 0-100, "correct": true|false, "feedback": "markdown: what works, bugs found (with line references), how to fix"}`,
        messages: [{ role: "user", content: `Task:\n${qr.prompt}\n\nReference solution (for your eyes only):\n${meta.solution || "n/a"}\n\nStudent code:\n\`\`\`\n${code}\n\`\`\`` }] });
      let out: any = {}; try { out = JSON.parse(/\{[\s\S]*\}/.exec(r.text)![0]); } catch { out = { score: 0, correct: false, feedback: r.text }; }
      touch(req.user!.id);
      return res.json({ correct: !!out.correct, score: out.score, feedback: out.feedback, explanation: qr.explanation, solution: meta.solution, aiReviewed: true, model: r.modelLabel });
    }
    const g = gradeOne(qr, b.answer);
    touch(req.user!.id);
    res.json({ correct: g.correct, partial: g.score > 0 && !g.correct, answer: qr.type === "mcq" ? Number(qr.answer) : qr.answer, explanation: qr.explanation, keywords: meta.keywords });
  }));

  // ---------------- Tests ----------------
  app.get("/api/tests/:scope/:id", requireAuth, wrap((req, res) => {
    const scope = req.params.scope; const id = Number(req.params.id);
    let rows: any[] = []; let title = ""; let courseId = 0; let minutes = 10;
    const base = `SELECT qu.* FROM questions qu JOIN topics t ON t.id=qu.topic_id JOIN chapters ch ON ch.id=t.chapter_id JOIN subjects s ON s.id=ch.subject_id JOIN lessons l ON l.topic_id=t.id
      WHERE t.status='published' AND l.review_status='approved' AND qu.type != 'coding'`;
    if (scope === "topic") {
      const t = topicCtx(id); if (!t) throw fail(404, "Topic not found");
      rows = q.all(`${base} AND t.id=?`, id); title = `Topic test: ${t.title}`; courseId = t.course_id; minutes = 10;
    } else if (scope === "chapter") {
      const ch = q.get<any>("SELECT ch.*, s.course_id FROM chapters ch JOIN subjects s ON s.id=ch.subject_id WHERE ch.id=?", id); if (!ch) throw fail(404, "Chapter not found");
      const all = q.all<any>(`${base} AND ch.id=? AND qu.type IN ('mcq','numerical')`, id);
      const byTopic = new Map<number, any[]>(); all.forEach((r) => byTopic.set(r.topic_id, [...(byTopic.get(r.topic_id) || []), r]));
      rows = [...byTopic.values()].flatMap((l) => shuffle(l).slice(0, 4)); title = `Chapter test: ${ch.title}`; courseId = ch.course_id; minutes = 15;
    } else if (scope === "subject") {
      const s = q.get<any>("SELECT * FROM subjects WHERE id=?", id); if (!s) throw fail(404, "Subject not found");
      rows = shuffle(q.all(`${base} AND s.id=? AND qu.type IN ('mcq','numerical')`, id)).slice(0, 15); title = `Subject test: ${s.title}`; courseId = s.course_id; minutes = 20;
    } else if (scope === "mock" || scope === "final") {
      const c = q.get<any>("SELECT * FROM courses WHERE id=?", id); if (!c) throw fail(404, "Course not found");
      const all = q.all<any>(`${base} AND s.course_id=?`, id);
      const n = scope === "final" ? 25 : 20;
      rows = shuffle([...shuffle(all.filter((r) => r.type === "mcq")).slice(0, n - 5), ...shuffle(all.filter((r) => r.type !== "mcq")).slice(0, 5)]);
      title = scope === "final" ? `Final assessment: ${c.title}` : `Mock test: ${c.title}`; courseId = id; minutes = scope === "final" ? 35 : 30;
    } else throw fail(400, "Unknown test type");
    if (!rows.length) throw fail(404, "No questions are published for this test yet.");
    const token = crypto.randomBytes(12).toString("hex");
    papers.set(token, { uid: req.user!.id, scope, scopeId: id, courseId, qids: rows.map((r) => r.id), at: Date.now() });
    res.json({ token, title, scope, scopeId: id, minutes, questions: rows.map(publicQuestion) });
  }));
  app.post("/api/tests/submit", requireAuth, wrap((req, res) => {
    const b = z.object({ token: z.string(), answers: z.record(z.string(), z.any()) }).parse(req.body);
    const paper = papers.get(b.token);
    if (!paper || paper.uid !== req.user!.id) throw fail(400, "This test session has expired. Please start the test again.");
    papers.delete(b.token);
    const uid = req.user!.id;
    const rows = paper.qids.map((id) => q.get<any>("SELECT qu.*, t.title topic_title FROM questions qu JOIN topics t ON t.id=qu.topic_id WHERE qu.id=?", id)).filter(Boolean);
    let score = 0;
    const perTopic = new Map<number, { title: string; got: number; total: number }>();
    const details = rows.map((r) => {
      const ans = b.answers[String(r.id)];
      const g = gradeOne(r, ans);
      score += g.score;
      const pt = perTopic.get(r.topic_id) || { title: r.topic_title, got: 0, total: 0 }; pt.got += g.score; pt.total += 1; perTopic.set(r.topic_id, pt);
      return { id: r.id, topicId: r.topic_id, topic: r.topic_title, type: r.type, prompt: r.prompt, options: J(r.options), yourAnswer: ans ?? null,
        correctAnswer: r.type === "mcq" ? Number(r.answer) : r.answer, correct: g.correct, score: g.score, explanation: r.explanation };
    });
    const percent = Math.round((score / rows.length) * 100);
    const topics = [...perTopic.entries()].map(([id, v]) => ({ id, title: v.title, percent: Math.round((v.got / v.total) * 100) }));
    const weak = topics.filter((t) => t.percent < 60);
    q.run("INSERT INTO attempts (user_id, scope, scope_id, course_id, score, total, percent, details) VALUES (?,?,?,?,?,?,?,?)", uid, paper.scope, paper.scopeId, paper.courseId, score, rows.length, percent, JSON.stringify({ topics }));
    // per-topic best (topic tests set completion; other scopes feed weakness data)
    for (const t of topics) {
      q.run("INSERT OR IGNORE INTO progress (user_id, topic_id) VALUES (?,?)", uid, t.id);
      if (paper.scope === "topic") {
        q.run("UPDATE progress SET test_best = MAX(test_best, ?), practice_done=1, updated_at=datetime('now') WHERE user_id=? AND topic_id=?", t.percent, uid, t.id);
        q.run("UPDATE progress SET completed = 1 WHERE user_id=? AND topic_id=? AND test_best >= 60", uid, t.id);
      } else if (t.percent < 60) {
        q.run("UPDATE progress SET test_best = CASE WHEN test_best < 0 THEN ? ELSE test_best END WHERE user_id=? AND topic_id=?", t.percent, uid, t.id);
      }
    }
    q.run("INSERT OR IGNORE INTO enrollments (user_id, course_id) VALUES (?,?)", uid, paper.courseId);
    touch(uid);
    res.json({ scope: paper.scope, score, total: rows.length, percent, passed: percent >= 60, correct: details.filter((d) => d.correct).length,
      incorrect: details.filter((d) => !d.correct).length, details, topics, weak,
      recommendation: weak.length ? `Based on your performance, revise ${weak.map((w) => `"${w.title}"`).join(", ")} before moving ahead.` : percent >= 85 ? "Excellent work. You are ready for the next topic." : "Good job. A quick revision of the short notes will make this topic stronger." });
  }));
  app.get("/api/attempts", requireAuth, (req, res) => res.json(q.all("SELECT id, scope, scope_id, course_id, score, total, percent, created_at FROM attempts WHERE user_id=? ORDER BY id DESC LIMIT 50", req.user!.id)));

  // ---------------- Dashboard ----------------
  app.get("/api/dashboard", requireAuth, wrap((req, res) => {
    const uid = req.user!.id;
    const courses = q.all<any>("SELECT c.* FROM enrollments e JOIN courses c ON c.id=e.course_id WHERE e.user_id=? ORDER BY e.created_at DESC", uid)
      .map((c) => ({ id: c.id, slug: c.slug, title: c.title, category: c.category, certifiable: c.certifiable, ...courseProgress(c.id, uid) }));
    const last = q.get<any>("SELECT p.*, t.title FROM progress p JOIN topics t ON t.id=p.topic_id WHERE p.user_id=? ORDER BY p.updated_at DESC LIMIT 1", uid);
    let current: any = null; let recommended: any = null;
    if (last) {
      const ctx = topicCtx(last.topic_id)!;
      current = { id: last.topic_id, title: last.title, course: ctx.course, courseSlug: ctx.course_slug, chapter: ctx.chapter, videoPos: last.video_pos, completed: !!last.completed };
      const list = orderedTopics(ctx.course_id).filter((t) => t.status === "published");
      const done = new Set(q.all<any>("SELECT topic_id FROM progress WHERE user_id=? AND completed=1", uid).map((r) => r.topic_id));
      const nxt = list.find((t) => !done.has(t.id));
      if (nxt) recommended = { id: nxt.id, title: nxt.title, course: ctx.course, chapter: nxt.chapter };
    } else {
      const first = q.get<any>("SELECT id FROM courses WHERE slug='python-programming'");
      const t = first && orderedTopics(first.id).find((x) => x.status === "published");
      if (t) recommended = { id: t.id, title: t.title, course: "Python Programming", chapter: t.chapter };
    }
    const weak = weakTopics(uid);
    const attempts = q.all<any>(`SELECT a.id, a.scope, a.percent, a.created_at, CASE a.scope WHEN 'topic' THEN (SELECT title FROM topics WHERE id=a.scope_id) WHEN 'chapter' THEN (SELECT title FROM chapters WHERE id=a.scope_id)
      WHEN 'subject' THEN (SELECT title FROM subjects WHERE id=a.scope_id) ELSE (SELECT title FROM courses WHERE id=a.scope_id) END title FROM attempts a WHERE a.user_id=? ORDER BY a.id DESC LIMIT 12`, uid).reverse();
    const days: { day: string; minutes: number; active: boolean }[] = [];
    const act = new Set(q.all<any>("SELECT day FROM activity WHERE user_id=?", uid).map((r) => r.day));
    for (let i = 13; i >= 0; i--) { const d = new Date(new Date(today() + "T00:00:00Z").getTime() - i * 864e5).toISOString().slice(0, 10); days.push({ day: d.slice(5), minutes: 0, active: act.has(d) }); }
    const stats = q.get<any>("SELECT COUNT(*) topics, SUM(completed) completed, SUM(video_done) videos FROM progress WHERE user_id=?", uid)!;
    const avg = q.get<any>("SELECT ROUND(AVG(percent)) avg, COUNT(*) n FROM attempts WHERE user_id=?", uid)!;
    res.json({
      user: req.user, courses, current, recommended, weak, attempts, activity: days, streak: streak(uid),
      stats: { started: stats.topics || 0, completed: stats.completed || 0, videos: stats.videos || 0, avgScore: avg.avg ?? null, tests: avg.n },
      notes: q.get<any>("SELECT COUNT(*) n FROM saved_notes WHERE user_id=?", uid)!.n,
      projects: q.all("SELECT p.id, p.score, p.status, p.created_at, c.title course, c.slug FROM projects p JOIN courses c ON c.id=p.course_id WHERE p.user_id=? ORDER BY p.id DESC", uid),
      certificates: q.all("SELECT id, course_title, issued_at, score FROM certificates WHERE user_id=? AND status='valid'", uid),
      advice: weak.length ? `Based on your performance, revise "${weak[0].title}" before moving ahead.` : null,
    });
  }));

  // ---------------- Notes, bookmarks, revision ----------------
  app.get("/api/notes", requireAuth, (req, res) => res.json(q.all(`SELECT n.*, t.title topic, c.title course FROM saved_notes n LEFT JOIN topics t ON t.id=n.topic_id LEFT JOIN chapters ch ON ch.id=t.chapter_id
    LEFT JOIN subjects s ON s.id=ch.subject_id LEFT JOIN courses c ON c.id=s.course_id WHERE n.user_id=? ORDER BY n.id DESC`, req.user!.id)));
  app.post("/api/notes", requireAuth, wrap((req, res) => {
    const b = z.object({ topicId: z.number().nullable().optional(), kind: z.enum(["note", "bookmark", "revision"]), content: z.string().max(20000).optional() }).parse(req.body);
    if (b.kind !== "note" && b.topicId) {
      const ex = q.get<any>("SELECT id FROM saved_notes WHERE user_id=? AND topic_id=? AND kind=?", req.user!.id, b.topicId, b.kind);
      if (ex) { q.run("DELETE FROM saved_notes WHERE id=?", ex.id); return res.json({ removed: true }); }
    }
    const id = q.run("INSERT INTO saved_notes (user_id, topic_id, kind, content) VALUES (?,?,?,?)", req.user!.id, b.topicId ?? null, b.kind, b.content || "").lastInsertRowid;
    touch(req.user!.id);
    res.json({ id, added: true });
  }));
  app.delete("/api/notes/:id", requireAuth, (req, res) => { q.run("DELETE FROM saved_notes WHERE id=? AND user_id=?", Number(req.params.id), req.user!.id); res.json({ ok: true }); });
  app.get("/api/topics/:id/notes.md", wrap((req, res) => {
    const t = topicCtx(Number(req.params.id)); const l = q.get<any>("SELECT * FROM lessons WHERE topic_id=? AND review_status='approved'", Number(req.params.id));
    if (!t || !l) throw fail(404, "Notes not available");
    const d = J(l.detailed, {}); const code = J(l.code_example);
    const md = [`# ${t.title}`, `${t.course} › ${t.subject} › ${t.chapter}`, "", `> ${l.summary}`, "", "## Short notes", ...J(l.short_notes, []).map((s: string) => `- ${s}`), "",
      "## Explanation", d.explanation || "", "", "## Definitions", ...(d.definitions || []).map((x: any) => `- **${x.term}**: ${x.meaning}`), "",
      ...(d.formulas?.length ? ["## Formulas", ...d.formulas.map((f: any) => `- **${f.name}**: \`${f.expression}\` ${f.note ? `— ${f.note}` : ""}`), ""] : []),
      "## Important points", ...(d.points || []).map((p: string) => `- ${p}`), "", ...(code ? ["## Code example", "```" + (code.language || ""), code.code, "```", "", code.explanation || ""] : []),
      "", "## Common mistakes", ...J(l.common_mistakes, []).map((m: string) => `- ${m}`), "", "---", "Generated by LAI – Learning AI. AI-drafted content reviewed before publishing."].join("\n");
    res.setHeader("Content-Type", "text/markdown; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="LAI-${t.title.replace(/[^a-z0-9]+/gi, "-")}-notes.md"`);
    res.send(md);
  }));

  // ---------------- AI Doubt solver ----------------
  app.post("/api/doubts", requireAuth, rateLimit("ai", 20, 5 * 60_000), wrap(async (req, res) => {
    const b = z.object({ question: z.string().max(6000).default(""), mode: z.string().default("beginner"), lang: z.enum(["en", "hi", "hinglish"]).default("en"),
      topicId: z.number().nullable().optional(), image: z.string().optional(), pdf: z.string().optional(), pdfName: z.string().optional(), inputType: z.enum(["text", "photo", "voice", "pdf"]).default("text"),
      history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(8000) })).max(12).default([]) }).parse(req.body);
    const uid = req.user!.id;
    if (!b.question.trim() && !b.image && !b.pdf) throw fail(400, "Type a question, or attach a photo or PDF.");
    const mod = moderate(b.question);
    if (!mod.ok) return res.json({ answer: mod.reason, confidence: "high", needsClarification: false, moderated: true });
    let images: any[] = []; let extra = "";
    if (b.image) { const f = validateUpload(b.image, ["image/png", "image/jpeg", "image/webp", "image/gif"], 6_000_000); images = [{ media_type: f.mime, data: f.b64 }]; }
    if (b.pdf) {
      const f = validateUpload(b.pdf, ["application/pdf"], 10_000_000);
      const pdfParse = (await import("pdf-parse/lib/pdf-parse.js" as any)).default;
      let text = "";
      try { text = (await pdfParse(f.buf)).text || ""; } catch (e: any) { throw fail(400, "Could not read this PDF. Is it password-protected or scanned?"); }
      if (text.trim().length < 20) throw fail(400, "This PDF has no readable text (it may be a scanned image). Try uploading a photo of the page instead.");
      extra = `\nThe student uploaded study material "${b.pdfName || "document.pdf"}". Base your answer on it and quote/cite the relevant part. If the answer is not in the material, say so clearly before using general knowledge.\n<material>\n${text.slice(0, 40000)}\n</material>`;
    }
    const ctx: any = b.topicId ? topicCtx(b.topicId) : null;
    const weak = weakTopics(uid, 3).map((w) => w.title);
    const system = tutorSystem({ mode: b.mode, lang: b.lang, course: ctx?.course, subject: ctx?.subject, chapter: ctx?.chapter, topic: ctx?.title, weak, profession: req.user!.profession,
      extra: (images.length ? "\nThe student attached a photo. First state what question you can read in it (transcribe it). If handwriting or parts are unclear, list exactly what is unreadable and ask them to re-upload or type it." : "") + extra });
    const messages = [...b.history.map((h) => ({ role: h.role, content: h.content })), { role: "user" as const, content: b.question.trim() || (images.length ? "Please solve the question in this image." : "Please summarise this material and explain its key ideas."), images }];
    const r = await route({ task: images.length ? "vision" : b.pdf ? "document" : ctx?.prog_language ? "code" : "doubt", system, messages, userId: uid, lang: b.lang, maxTokens: 2200 });
    const meta = parseMeta(r.text);
    q.run("INSERT INTO doubts (user_id, topic_id, input_type, mode, lang, question, answer, model, confidence) VALUES (?,?,?,?,?,?,?,?,?)", uid, b.topicId ?? null, b.inputType, b.mode, b.lang, b.question.slice(0, 2000) || `[${b.inputType}]`, meta.text, r.model, meta.confidence);
    touch(uid);
    res.json({ answer: meta.text, confidence: meta.confidence, needsClarification: meta.needsClarification, model: r.modelLabel, fallback: r.fallback, qc: r.qc });
  }));
  app.get("/api/doubts", requireAuth, (req, res) => res.json(q.all("SELECT id, input_type, mode, lang, question, answer, confidence, created_at FROM doubts WHERE user_id=? ORDER BY id DESC LIMIT 30", req.user!.id)));
  app.post("/api/tts", requireAuth, rateLimit("tts", 15, 5 * 60_000), wrap(async (req, res) => {
    const b = z.object({ text: z.string().min(1).max(5000) }).parse(req.body);
    const plain = b.text.replace(/```[\s\S]*?```/g, " (see the code on screen) ").replace(/[#*_`>|]/g, "").replace(/\n+/g, " ").slice(0, 1400);
    try { const a = await gatewayTTS(plain); res.json({ audio: `data:${a.media_type};base64,${a.audio}` }); }
    catch (e: any) { logError("tts", e.message, {}, req.user!.id); throw fail(503, "Voice is temporarily unavailable. The text answer is still shown."); }
  }));

  // ---------------- Code lab ----------------
  app.post("/api/code/assist", requireAuth, rateLimit("ai", 20, 5 * 60_000), wrap(async (req, res) => {
    const b = z.object({ language: z.string().max(20), code: z.string().max(12000).default(""), error: z.string().max(4000).optional(), action: z.enum(["explain", "debug", "error", "review", "roadmap"]), lang: z.enum(["en", "hi", "hinglish"]).default("en") }).parse(req.body);
    if (b.action !== "roadmap" && b.code.trim().length < 3) throw fail(400, "Paste some code first.");
    const tasks: Record<string, string> = {
      explain: "Explain this code line by line for a beginner. Then summarise what the program does and its output for a sample input.",
      debug: "Find bugs in this code. For each bug: line, what is wrong, why, and the fix. Then give the corrected full code.",
      error: `Explain this error message in simple words, point to the exact cause in the code, and show the fix.\nError:\n${b.error || "(not provided)"}`,
      review: "Review this code like a senior developer: correctness, readability, edge cases, complexity. Give a score out of 10 and an improved version.",
      roadmap: `Create a step-by-step learning roadmap for ${b.language}: Introduction → Basic Concepts → Examples → Practice → Projects. Include 3 mini project ideas.`,
    };
    const r = await route({ task: "code", userId: req.user!.id, lang: b.lang, maxTokens: 2200,
      system: tutorSystem({ mode: "step-by-step", lang: b.lang, course: `${b.language} programming`, extra: "\nYou cannot execute code; reason carefully and say when behaviour depends on input or compiler." }),
      messages: [{ role: "user", content: `${tasks[b.action]}\n\nLanguage: ${b.language}\n\`\`\`${b.language}\n${b.code}\n\`\`\`` }] });
    const meta = parseMeta(r.text);
    touch(req.user!.id);
    res.json({ answer: meta.text, confidence: meta.confidence, model: r.modelLabel });
  }));

  // ---------------- Projects ----------------
  app.post("/api/courses/:slug/project", requireAuth, rateLimit("ai", 20, 5 * 60_000), wrap(async (req, res) => {
    const c = q.get<any>("SELECT * FROM courses WHERE slug=?", req.params.slug);
    if (!c?.project) throw fail(404, "This course has no project.");
    const b = z.object({ content: z.string().min(40, "Your submission is too short.").max(30000), link: z.string().max(300).optional() }).parse(req.body);
    const r = await route({ task: "grade", userId: req.user!.id, maxTokens: 1200, skipLangCheck: true,
      system: `You are a fair project examiner for the LAI course "${c.title}". Evaluate the student's submission against the brief. You cannot run code; judge from reading it. Reply ONLY with JSON: {"score": 0-100, "passed": true|false (passed if score >= 60), "summary": "...", "strengths": ["..."], "improvements": ["..."]}`,
      messages: [{ role: "user", content: `Project brief:\n${c.project}\n\nStudent submission:\n${b.content}\n${b.link ? `Link: ${b.link}` : ""}` }] });
    let review: any; try { review = JSON.parse(/\{[\s\S]*\}/.exec(r.text)![0]); } catch { review = { score: 0, passed: false, summary: "The automatic review could not be parsed. Please resubmit.", strengths: [], improvements: [] }; }
    review.score = Math.max(0, Math.min(100, Number(review.score) || 0)); review.passed = review.score >= 60; review.model = r.modelLabel;
    const id = q.run("INSERT INTO projects (user_id, course_id, content, link, review, score, status) VALUES (?,?,?,?,?,?,?)", req.user!.id, c.id, b.content, b.link || null, JSON.stringify(review), review.score, review.passed ? "passed" : "needs-work").lastInsertRowid;
    touch(req.user!.id);
    res.json({ id, review });
  }));
  app.get("/api/courses/:slug/project", requireAuth, wrap((req, res) => {
    const c = q.get<any>("SELECT * FROM courses WHERE slug=?", req.params.slug); if (!c) throw fail(404, "Course not found");
    res.json({ brief: c.project, submissions: q.all<any>("SELECT * FROM projects WHERE user_id=? AND course_id=? ORDER BY id DESC", req.user!.id, c.id).map((p) => ({ ...p, review: J(p.review) })) });
  }));

  // ---------------- Certificates ----------------
  function certStatus(c: any, uid: number) {
    const prog = courseProgress(c.id, uid);
    const final = q.get<any>("SELECT MAX(percent) best FROM attempts WHERE user_id=? AND scope='final' AND scope_id=?", uid, c.id)!.best;
    const proj = c.project ? q.get<any>("SELECT MAX(score) best FROM projects WHERE user_id=? AND course_id=?", uid, c.id)!.best : null;
    const reqs = [
      { key: "lessons", label: `Complete all ${prog.published} published topics (pass each topic test with 60%+)`, met: prog.published > 0 && prog.completed >= prog.published, detail: `${prog.completed}/${prog.published}` },
      { key: "final", label: "Score 60% or more in the final assessment", met: (final ?? -1) >= 60, detail: final == null ? "not attempted" : `best ${final}%` },
      ...(c.project ? [{ key: "project", label: "Final project reviewed with score 60+", met: (proj ?? -1) >= 60, detail: proj == null ? "not submitted" : `best ${proj}` }] : []),
    ];
    const issued = q.get<any>("SELECT id FROM certificates WHERE user_id=? AND course_id=? AND status='valid'", uid, c.id);
    return { certifiable: !!c.certifiable, requirements: reqs, eligible: !!c.certifiable && reqs.every((r) => r.met), certificateId: issued?.id || null, finalBest: final };
  }
  app.post("/api/courses/:slug/certificate", requireAuth, wrap((req, res) => {
    const c = q.get<any>("SELECT * FROM courses WHERE slug=?", req.params.slug); if (!c) throw fail(404, "Course not found");
    const st = certStatus(c, req.user!.id);
    if (st.certificateId) return res.json({ id: st.certificateId });
    if (!st.eligible) throw fail(400, "You have not met all certificate requirements yet.");
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const rnd = Array.from(crypto.randomBytes(8)).map((x) => alphabet[x % alphabet.length]).join("");
    const id = `LAI-${new Date().getFullYear()}-${rnd.slice(0, 4)}-${rnd.slice(4)}`;
    q.run("INSERT INTO certificates (id, user_id, course_id, student_name, course_title, score) VALUES (?,?,?,?,?,?)", id, req.user!.id, c.id, req.user!.name, c.title, st.finalBest ?? null);
    res.json({ id });
  }));
  app.get("/api/certificates", requireAuth, (req, res) => res.json(q.all("SELECT * FROM certificates WHERE user_id=? ORDER BY issued_at DESC", req.user!.id)));
  app.get("/api/certificates/:id/verify", rateLimit("verify", 30, 60_000), wrap((req, res) => {
    const cert = q.get<any>("SELECT id, student_name, course_title, score, issued_at, status FROM certificates WHERE id=?", String(req.params.id).toUpperCase().trim());
    if (!cert) return res.status(404).json({ valid: false, message: "No certificate found with this ID." });
    res.json({ valid: cert.status === "valid", ...cert });
  }));

  // ---------------- Video (student side) ----------------
  app.get("/api/videos/:id", wrap((req, res) => {
    const v = q.get<any>("SELECT * FROM videos WHERE id=?", req.params.id); if (!v) throw fail(404, "Video not found");
    res.json({ id: v.id, status: v.status, lang: v.lang, error: v.error, manifest: v.status === "published" ? J(v.manifest) : null });
  }));
  app.post("/api/videos/:id/event", rateLimit("vevent", 60, 60_000), wrap((req, res) => {
    const b = z.object({ type: z.string().max(40), position: z.number().optional(), detail: z.string().max(500).optional() }).parse(req.body);
    logError("video-player", `${b.type} in ${req.params.id} at ${b.position?.toFixed(2)}s`, { detail: b.detail }, req.user?.id ?? null, b.type === "error" ? "error" : "warn");
    res.json({ ok: true });
  }));
  app.post("/api/errors", rateLimit("clienterr", 30, 60_000), (req, res) => { logError("client", String(req.body?.message || "unknown").slice(0, 500), { stack: String(req.body?.stack || "").slice(0, 1500), url: req.body?.url }, req.user?.id ?? null); res.json({ ok: true }); });
  app.get("/api/health", async (_req, res) => { const { gatewayHealth } = await import("./ai"); res.json({ ok: true, gateway: await gatewayHealth() }); });

  registerAdmin(app);

  // uniform error responses + logging
  app.use("/api", (err: any, req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || (err.name === "ZodError" ? 400 : 500);
    const message = err.name === "ZodError" ? (err.issues?.[0]?.message || "Invalid input") : err.message || "Something went wrong";
    if (status >= 500) logError("api", `${req.method} ${req.path}: ${message}`, { stack: String(err.stack || "").slice(0, 1500) }, req.user?.id ?? null);
    res.status(status).json({ message });
  });
  return httpServer;
}
