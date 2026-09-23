import crypto from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import { q } from "./db";

// ---------- Password hashing (scrypt, per-user salt, constant-time compare) ----------
export function hashPassword(pw: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(pw, salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}
export function verifyPassword(pw: string, stored: string) {
  const [, salt, hash] = stored.split("$");
  if (!salt || !hash) return false;
  const test = crypto.scryptSync(pw, salt, 64);
  const ref = Buffer.from(hash, "hex");
  return ref.length === test.length && crypto.timingSafeEqual(ref, test);
}

// ---------- Bearer-token sessions (stored server-side, 7-day expiry) ----------
const TTL = 7 * 24 * 3600 * 1000;
export function createSession(userId: number) {
  const token = crypto.randomBytes(32).toString("base64url");
  q.run("INSERT INTO sessions (token, user_id, expires_at) VALUES (?,?,?)", token, userId, Date.now() + TTL);
  return token;
}
export function destroySession(token: string) { q.run("DELETE FROM sessions WHERE token = ?", token); }

export interface AuthedUser { id: number; name: string; email: string; role: string; language: string; explain_mode: string; profession: string; }
declare global { namespace Express { interface Request { user?: AuthedUser; token?: string } } }

function tokenFrom(req: Request) {
  const h = req.headers.authorization;
  if (h?.startsWith("Bearer ")) return h.slice(7);
  const m = /(?:^|;\s*)(?:__Host-)?lai_session=([A-Za-z0-9_-]+)/.exec(req.headers.cookie || "");
  return m ? m[1] : null; // httpOnly cookie keeps the session across reloads on same-origin deployments
}
export function setSessionCookie(res: Response, token: string | null) {
  // production uses the __Host- prefix (Secure, host-only, Path=/), which hosting proxies require
  const prod = process.env.NODE_ENV === "production";
  const name = prod ? "__Host-lai_session" : "lai_session";
  const secure = prod ? "; Secure" : "";
  res.setHeader("Set-Cookie", token
    ? `${name}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 3600}${secure}`
    : `${name}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`);
}
export function attachUser(req: Request, _res: Response, next: NextFunction) {
  const token = tokenFrom(req);
  if (token) {
    const row = q.get<any>(`SELECT u.id, u.name, u.email, u.role, u.language, u.explain_mode, u.profession, u.status, s.expires_at
      FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?`, token);
    if (row && row.expires_at > Date.now() && row.status === "active") { req.user = row; req.token = token; }
  }
  next();
}
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ message: "Please log in to continue." });
  next();
}
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ message: "Please log in." });
  if (req.user.role !== "admin") return res.status(403).json({ message: "Admin access required." });
  next();
}

// ---------- Rate limiting (sliding window, in-memory) ----------
const buckets = new Map<string, number[]>();
export function rateLimit(name: string, limit: number, windowMs: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = `${name}:${req.user?.id ?? req.ip}`;
    const now = Date.now();
    const hits = (buckets.get(key) || []).filter((t) => now - t < windowMs);
    if (hits.length >= limit) {
      const retry = Math.ceil((windowMs - (now - hits[0])) / 1000);
      res.setHeader("Retry-After", String(retry));
      return res.status(429).json({ message: `Too many requests. Please wait ${retry}s and try again.` });
    }
    hits.push(now); buckets.set(key, hits); next();
  };
}

// ---------- Upload validation (in-memory only, magic-byte checks, size caps) ----------
const MAGIC: Record<string, (b: Buffer) => boolean> = {
  "image/png": (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  "image/jpeg": (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  "image/webp": (b) => b.subarray(0, 4).toString() === "RIFF" && b.subarray(8, 12).toString() === "WEBP",
  "image/gif": (b) => b.subarray(0, 3).toString() === "GIF",
  "application/pdf": (b) => b.subarray(0, 4).toString() === "%PDF",
};
export function validateUpload(dataUrl: string, allowed: string[], maxBytes: number) {
  const m = /^data:([\w/+.-]+);base64,(.+)$/s.exec(dataUrl || "");
  if (!m) throw Object.assign(new Error("Invalid file encoding."), { status: 400 });
  const mime = m[1];
  if (!allowed.includes(mime)) throw Object.assign(new Error(`Unsupported file type ${mime}. Allowed: ${allowed.join(", ")}`), { status: 400 });
  const buf = Buffer.from(m[2], "base64");
  if (buf.length > maxBytes) throw Object.assign(new Error(`File too large. Max ${(maxBytes / 1e6).toFixed(0)} MB.`), { status: 413 });
  if (!MAGIC[mime]?.(buf)) throw Object.assign(new Error("File content does not match its type."), { status: 400 });
  return { mime, buf, b64: m[2] };
}

// ---------- Content moderation (first-pass filter; the model also applies its own safety policy) ----------
const BLOCK = [/\b(how to (make|build) (a )?(bomb|explosive|weapon))\b/i, /\b(kill|hurt) (myself|someone)\b/i, /\bchild (porn|sexual)\b/i, /\b(hack|steal) (someone'?s|a) (account|password)\b/i];
export function moderate(text: string): { ok: boolean; reason?: string } {
  for (const r of BLOCK) if (r.test(text)) return { ok: false, reason: "This request is outside what LAI can help with. If you are in distress, please reach out to someone you trust or a local helpline." };
  return { ok: true };
}

// ---------- Security headers ----------
export function securityHeaders(_req: Request, res: Response, next: NextFunction) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
}
