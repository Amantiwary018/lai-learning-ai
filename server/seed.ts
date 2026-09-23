import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { q, sqlite } from "./db";
import { hashPassword } from "./security";

export function seed() {
  const admin = q.get("SELECT id FROM users WHERE role='admin'");
  if (!admin) {
    // No default admin password: use LAI_ADMIN_PASSWORD, otherwise generate one and print it once.
    const adminPass = process.env.LAI_ADMIN_PASSWORD || crypto.randomBytes(9).toString("base64url");
    if (!process.env.LAI_ADMIN_PASSWORD) console.log(`[LAI] Admin account created: ${process.env.LAI_ADMIN_EMAIL || "admin@lai.app"} / ${adminPass} (set LAI_ADMIN_PASSWORD to choose your own)`);
    q.run("INSERT INTO users (name, email, password_hash, role) VALUES (?,?,?,?)", "Aman Kumar Tiwary", process.env.LAI_ADMIN_EMAIL || "admin@lai.app",
      hashPassword(adminPass), "admin");
    q.run("INSERT INTO users (name, email, password_hash, role) VALUES (?,?,?,?)", "Demo Student", "student@lai.app", hashPassword("Student@123"), "student");
  }
  const has = q.get<any>("SELECT COUNT(*) n FROM courses")!;
  if (has.n > 0) return;
  const file = path.resolve(process.cwd(), "content/seed.json");
  if (!fs.existsSync(file)) { console.warn("seed.json missing; skipping course seed"); return; }
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  const tx = sqlite.transaction(() => {
    data.categories.forEach((c: any, i: number) => q.run("INSERT OR REPLACE INTO categories (slug, name, description, sort) VALUES (?,?,?,?)", c.slug, c.name, c.description, i));
    for (const c of data.courses) {
      const cid = q.run(`INSERT INTO courses (slug, title, category, description, level, prog_language, certifiable, project, content_status, sort) VALUES (?,?,?,?,?,?,?,?,?,?)`,
        c.slug, c.title, c.category, c.description, c.level, c.language, c.certifiable ? 1 : 0, c.project, c.contentStatus, c.sort).lastInsertRowid;
      c.subjects.forEach((s: any, si: number) => {
        const sid = q.run("INSERT INTO subjects (course_id, title, sort) VALUES (?,?,?)", cid, s.title, si).lastInsertRowid;
        s.chapters.forEach((ch: any, ci: number) => {
          const chid = q.run("INSERT INTO chapters (subject_id, title, sort) VALUES (?,?,?)", sid, ch.title, ci).lastInsertRowid;
          ch.topics.forEach((t: any, ti: number) => {
            const tid = Number(q.run("INSERT INTO topics (chapter_id, title, sort, status) VALUES (?,?,?,?)", chid, t.title, ti, t.lesson ? "published" : "pipeline").lastInsertRowid);
            if (!t.lesson) return;
            insertLesson(tid, t.lesson, t.visual, "approved", "ai-draft-reviewed");
          });
        });
      });
    }
  });
  tx();
  console.log("seeded courses:", data.courses.length);
}

export function insertLesson(tid: number, L: any, visual: string | null, review: string, source: string) {
  q.run(`INSERT OR REPLACE INTO lessons (topic_id, summary, short_notes, detailed, code_example, common_mistakes, visual_id, review_status, source) VALUES (?,?,?,?,?,?,?,?,?)`,
    tid, L.summary, JSON.stringify(L.shortNotes), JSON.stringify(L.detailed), JSON.stringify(L.codeExample || null), JSON.stringify(L.commonMistakes || []), visual, review, source);
  q.run("DELETE FROM questions WHERE topic_id = ?", tid);
  for (const qu of L.questions || []) {
    const meta: any = {};
    if (qu.keywords) meta.keywords = qu.keywords;
    if (qu.starter) meta.starter = qu.starter;
    if (qu.solution) meta.solution = qu.solution;
    q.run("INSERT INTO questions (topic_id, type, prompt, options, answer, explanation, difficulty, meta) VALUES (?,?,?,?,?,?,?,?)",
      tid, qu.type, qu.prompt, qu.options ? JSON.stringify(qu.options) : null, String(qu.answer ?? ""), qu.explanation || "", qu.difficulty || "medium", JSON.stringify(meta));
  }
  if (L.scenes?.length) {
    const vid = `v${tid}-en`;
    const existing = q.get("SELECT id FROM videos WHERE id = ?", vid);
    if (existing) q.run("UPDATE videos SET script = ?, status = 'queued', manifest = NULL, updated_at = datetime('now') WHERE id = ?", JSON.stringify(L.scenes), vid);
    else q.run("INSERT INTO videos (id, topic_id, lang, script, status) VALUES (?,?,?,?,?)", vid, tid, "en", JSON.stringify(L.scenes), "queued");
  }
}
