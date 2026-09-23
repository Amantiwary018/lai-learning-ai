import Database from "better-sqlite3";
import path from "node:path";

const DB_PATH = process.env.LAI_DB_PATH || path.resolve(process.cwd(), "data.db");
export const sqlite = new Database(DB_PATH);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

sqlite.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'student', language TEXT NOT NULL DEFAULT 'en', explain_mode TEXT NOT NULL DEFAULT 'beginner',
  profession TEXT DEFAULT 'Student', status TEXT NOT NULL DEFAULT 'active', created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS categories (slug TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT, sort INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS courses (
  id INTEGER PRIMARY KEY AUTOINCREMENT, slug TEXT NOT NULL UNIQUE, title TEXT NOT NULL, category TEXT NOT NULL, description TEXT,
  level TEXT, prog_language TEXT, certifiable INTEGER DEFAULT 0, project TEXT, status TEXT NOT NULL DEFAULT 'published',
  content_status TEXT NOT NULL DEFAULT 'outline', sort INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS subjects (id INTEGER PRIMARY KEY AUTOINCREMENT, course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE, title TEXT NOT NULL, sort INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS chapters (id INTEGER PRIMARY KEY AUTOINCREMENT, subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE, title TEXT NOT NULL, sort INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS topics (id INTEGER PRIMARY KEY AUTOINCREMENT, chapter_id INTEGER NOT NULL REFERENCES chapters(id) ON DELETE CASCADE, title TEXT NOT NULL, sort INTEGER DEFAULT 0, status TEXT NOT NULL DEFAULT 'pipeline');
CREATE TABLE IF NOT EXISTS lessons (
  id INTEGER PRIMARY KEY AUTOINCREMENT, topic_id INTEGER NOT NULL UNIQUE REFERENCES topics(id) ON DELETE CASCADE, summary TEXT,
  short_notes TEXT, detailed TEXT, code_example TEXT, common_mistakes TEXT, visual_id TEXT,
  review_status TEXT NOT NULL DEFAULT 'approved', source TEXT DEFAULT 'ai-draft-reviewed', updated_at TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT, topic_id INTEGER NOT NULL REFERENCES topics(id) ON DELETE CASCADE, type TEXT NOT NULL, prompt TEXT NOT NULL,
  options TEXT, answer TEXT, explanation TEXT, difficulty TEXT DEFAULT 'medium', meta TEXT);
CREATE TABLE IF NOT EXISTS videos (
  id TEXT PRIMARY KEY, topic_id INTEGER NOT NULL REFERENCES topics(id) ON DELETE CASCADE, lang TEXT NOT NULL DEFAULT 'en', voice TEXT DEFAULT 'kore',
  status TEXT NOT NULL DEFAULT 'queued', script TEXT NOT NULL, manifest TEXT, error TEXT, updated_at TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS enrollments (user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE, created_at TEXT DEFAULT (datetime('now')), PRIMARY KEY (user_id, course_id));
CREATE TABLE IF NOT EXISTS progress (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, topic_id INTEGER NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  video_done INTEGER DEFAULT 0, notes_done INTEGER DEFAULT 0, visual_done INTEGER DEFAULT 0, practice_done INTEGER DEFAULT 0, test_best INTEGER DEFAULT -1,
  completed INTEGER DEFAULT 0, video_pos REAL DEFAULT 0, updated_at TEXT DEFAULT (datetime('now')), PRIMARY KEY (user_id, topic_id));
CREATE TABLE IF NOT EXISTS attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, scope TEXT NOT NULL, scope_id INTEGER NOT NULL,
  course_id INTEGER, score REAL, total INTEGER, percent INTEGER, details TEXT, created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS saved_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, topic_id INTEGER REFERENCES topics(id) ON DELETE CASCADE,
  kind TEXT NOT NULL, content TEXT, created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS activity (user_id INTEGER NOT NULL, day TEXT NOT NULL, PRIMARY KEY (user_id, day));
CREATE TABLE IF NOT EXISTS doubts (
  id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, topic_id INTEGER, input_type TEXT, mode TEXT, lang TEXT,
  question TEXT, answer TEXT, model TEXT, confidence TEXT, created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  content TEXT, link TEXT, review TEXT, score INTEGER, status TEXT DEFAULT 'submitted', created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS certificates (
  id TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  student_name TEXT NOT NULL, course_title TEXT NOT NULL, score INTEGER, issued_at TEXT DEFAULT (datetime('now')), status TEXT DEFAULT 'valid');
CREATE TABLE IF NOT EXISTS ai_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, task TEXT, provider TEXT, model TEXT, input_tokens INTEGER, output_tokens INTEGER,
  latency_ms INTEGER, status TEXT, qc TEXT, created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS error_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT, source TEXT, level TEXT DEFAULT 'error', message TEXT, context TEXT, user_id INTEGER, created_at TEXT DEFAULT (datetime('now')));
CREATE INDEX IF NOT EXISTS idx_topics_chapter ON topics(chapter_id);
CREATE INDEX IF NOT EXISTS idx_questions_topic ON questions(topic_id);
CREATE INDEX IF NOT EXISTS idx_attempts_user ON attempts(user_id);
`);

export const q = {
  get<T = any>(sql: string, ...p: any[]): T | undefined { return sqlite.prepare(sql).get(...p) as T | undefined; },
  all<T = any>(sql: string, ...p: any[]): T[] { return sqlite.prepare(sql).all(...p) as T[]; },
  run(sql: string, ...p: any[]) { return sqlite.prepare(sql).run(...p); },
};

export const J = (s: any, fallback: any = null) => { if (s == null) return fallback; try { return JSON.parse(s); } catch { return fallback; } };

export function logError(source: string, message: string, context: any = {}, userId: number | null = null, level = "error") {
  try { q.run("INSERT INTO error_logs (source, level, message, context, user_id) VALUES (?,?,?,?,?)", source, level, String(message).slice(0, 2000), JSON.stringify(context).slice(0, 4000), userId); }
  catch (e) { console.error("failed to log error", e); }
  console.error(`[${level}] ${source}: ${message}`);
}

export function topicCtx(topicId: number) {
  return q.get<any>(`SELECT t.id, t.title, t.status, t.sort, ch.id chapter_id, ch.title chapter, s.id subject_id, s.title subject, c.id course_id, c.slug course_slug, c.title course, c.prog_language
    FROM topics t JOIN chapters ch ON ch.id=t.chapter_id JOIN subjects s ON s.id=ch.subject_id JOIN courses c ON c.id=s.course_id WHERE t.id=?`, topicId);
}
