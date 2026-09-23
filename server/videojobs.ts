import { q, J, logError } from "./db";
import { gatewayBuildVideo } from "./ai";

// Simple durable-ish job queue: state lives in the videos table, a worker drains 'queued' rows.
const running = new Set<string>();
const CONCURRENCY = 2;
const pendingOnly = new Map<string, number[] | null>();

export function enqueueVideo(id: string, onlyScenes: number[] | null = null) {
  pendingOnly.set(id, onlyScenes);
  q.run("UPDATE videos SET status='queued', error=NULL, updated_at=datetime('now') WHERE id = ?", id);
  pump();
}

export function pump() {
  if (running.size >= CONCURRENCY) return;
  const next = q.all<any>("SELECT * FROM videos WHERE status='queued' ORDER BY updated_at LIMIT ?", CONCURRENCY - running.size)
    .filter((v) => !running.has(v.id));
  for (const v of next) run(v);
}

async function run(v: any) {
  running.add(v.id);
  q.run("UPDATE videos SET status='building', updated_at=datetime('now') WHERE id = ?", v.id);
  try {
    const manifest: any = await gatewayBuildVideo({ videoId: v.id, lang: v.lang, voice: v.voice || "kore", scenes: J(v.script, []), onlyScenes: pendingOnly.get(v.id) ?? null });
    pendingOnly.delete(v.id);
    const status = manifest.qc?.passed ? "published" : "failed";
    q.run("UPDATE videos SET status=?, manifest=?, error=?, updated_at=datetime('now') WHERE id = ?", status, JSON.stringify(manifest),
      status === "failed" ? `QC failed; faulty scenes: ${JSON.stringify(manifest.qc?.faultyScenes || [])}` : null, v.id);
    if (status === "failed") logError("video-pipeline", `QC failed for ${v.id}`, manifest.qc, null, "warn");
  } catch (e: any) {
    q.run("UPDATE videos SET status='failed', error=?, updated_at=datetime('now') WHERE id = ?", String(e.message || e).slice(0, 500), v.id);
    logError("video-pipeline", `build failed for ${v.id}: ${e.message}`, {});
  } finally {
    running.delete(v.id);
    setTimeout(pump, 50);
  }
}

// Recover jobs interrupted by a restart
export function recoverJobs() {
  q.run("UPDATE videos SET status='queued' WHERE status='building'");
  if (process.env.LAI_AUTOBUILD_VIDEOS !== "0") pump();
}
