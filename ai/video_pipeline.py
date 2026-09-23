"""LAI video pipeline.

Topic -> Script -> Scene Plan -> Voice Generation -> Visual/Handwriting timeline -> Scene Synchronization
      -> Assembly (single continuous CBR audio master) -> Quality Validation -> Publish

The visual layer (handwriting board, code typing, diagrams) is rendered by the client player as a pure
function of the master audio clock, so visuals can never drift from speech. This module produces:
  media/videos/<id>/scene_<i>_<hash>.mp3   per-scene narration (cached by content hash)
  media/videos/<id>/lesson_<hash>.mp3       assembled master track (CBR 128k -> exact seeking)
  media/videos/<id>/captions.vtt            WebVTT captions generated from the same script
  media/videos/<id>/manifest.json           timeline + QC report
"""
import asyncio, hashlib, json, os, re, subprocess

from tts import synthesize

MEDIA = os.environ.get("LAI_MEDIA_DIR", os.path.join(os.path.dirname(__file__), "..", "media"))
PAD = 0.45           # intentional pause between scenes (seconds)
WPS = 2.55           # expected speaking rate (words / second) ~ 153 wpm
TTS_RETRIES = 3
SEM = asyncio.Semaphore(int(os.environ.get("LAI_TTS_CONCURRENCY", "6")))


def _run(cmd):
    return subprocess.run(cmd, capture_output=True, text=True)


def probe_duration(path):
    r = _run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path])
    try:
        return float(r.stdout.strip())
    except ValueError:
        return 0.0


def silences(path, min_len=1.6):
    r = _run(["ffmpeg", "-hide_banner", "-i", path, "-af", f"silencedetect=noise=-42dB:d={min_len}", "-f", "null", "-"])
    starts = [float(x) for x in re.findall(r"silence_start: ([\d.]+)", r.stderr)]
    ends = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", r.stderr)]
    return list(zip(starts, ends + [None] * (len(starts) - len(ends))))


def decode_errors(path):
    r = _run(["ffmpeg", "-v", "error", "-i", path, "-f", "null", "-"])
    return r.stderr.strip()


def narration(scene):
    return " ".join(s["say"].strip() for s in scene["steps"]).strip()


def lang_ok(text, lang):
    letters = [c for c in text if c.isalpha()]
    if not letters:
        return False
    dev = sum(1 for c in letters if "\u0900" <= c <= "\u097F") / len(letters)
    if lang == "hi":
        return dev > 0.6
    return dev < 0.03  # en / hinglish are Latin script


def spoken_ok(scene_dur, words):
    expected = words / WPS
    ratio = scene_dur / expected if expected else 0
    return 0.55 <= ratio <= 1.9, ratio, expected


async def tts_scene(text, voice, out_path):
    """Generate one scene's narration, normalise to mono 44.1k CBR mp3 and self-check it."""
    last_err = "unknown"
    words = len(text.split())
    for attempt in range(TTS_RETRIES):
        try:
            async with SEM:
                raw = await synthesize(text, voice)
            tmp = out_path + ".raw.mp3"
            open(tmp, "wb").write(raw)
            # normalise: trim leading/trailing silence, mono, CBR 128k, consistent loudness
            r = _run(["ffmpeg", "-y", "-v", "error", "-i", tmp, "-af",
                      "silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse,loudnorm=I=-16:TP=-1.5:LRA=11",
                      "-ac", "1", "-ar", "44100", "-b:a", "128k", out_path])
            os.remove(tmp)
            if r.returncode != 0:
                raise RuntimeError(r.stderr[-300:])
            d = probe_duration(out_path)
            ok, ratio, _ = spoken_ok(d, words)
            gaps = [s for s in silences(out_path) if s[0] > 0.3 and s[1] and s[1] < d - 0.3]
            if not ok:
                raise RuntimeError(f"duration ratio {ratio:.2f} outside expected range (possible cut-off or repeated audio)")
            if gaps:
                raise RuntimeError(f"mid-scene silence {gaps[0][0]:.1f}-{gaps[0][1]:.1f}s (possible audio dropout)")
            return {"ok": True, "attempts": attempt + 1}
        except Exception as e:  # retry only this scene
            last_err = str(e)
    return {"ok": False, "attempts": TTS_RETRIES, "error": last_err}


def step_timeline(scene, start, dur):
    """Distribute steps within the scene proportionally to spoken characters (speech is uniform-rate)."""
    says = [s["say"].strip() for s in scene["steps"]]
    total = sum(len(s) + 1 for s in says) or 1
    t = start
    out = []
    for st, s in zip(scene["steps"], says):
        d = dur * (len(s) + 1) / total
        out.append({"say": s, "write": st.get("write"), "start": round(t, 3), "end": round(t + d, 3)})
        t += d
    out[-1]["end"] = round(start + dur, 3)
    return out


def vtt_time(t):
    h, rem = divmod(t, 3600); m, s = divmod(rem, 60)
    return f"{int(h):02d}:{int(m):02d}:{s:06.3f}"


async def build_video(video_id, scenes, lang="en", voice="kore", only=None):
    vdir = os.path.join(MEDIA, "videos", video_id)
    os.makedirs(vdir, exist_ok=True)
    checks = []
    scene_meta = []
    faulty = []

    # 1) Script / scene plan checks
    texts = [narration(s) for s in scenes]
    checks.append({"name": "Script has ordered scenes", "passed": len(scenes) > 0, "detail": f"{len(scenes)} scenes"})
    hashes = [hashlib.sha1(f"{voice}|{t}".encode()).hexdigest()[:12] for t in texts]
    dup = len(set(hashes)) != len(hashes)
    checks.append({"name": "No duplicated scene", "passed": not dup, "detail": "all scene scripts unique" if not dup else "duplicate scene narration detected"})
    lang_bad = [i for i, t in enumerate(texts) if not lang_ok(t, lang)]
    checks.append({"name": "Language consistent", "passed": not lang_bad, "detail": f"language={lang}" + (f"; mismatched scenes {lang_bad}" if lang_bad else "")})

    # 2) Voice generation per scene (cached by content hash; `only` forces regeneration of those scenes)
    async def do_scene(i):
        path = os.path.join(vdir, f"scene_{i}_{hashes[i]}.mp3")
        force = only is not None and i in only
        if force and os.path.exists(path):
            os.remove(path)
        if os.path.exists(path) and probe_duration(path) > 0.5:
            return i, path, {"ok": True, "attempts": 0, "cached": True}
        res = await tts_scene(texts[i], voice, path)
        return i, path, res

    results = await asyncio.gather(*[do_scene(i) for i in range(len(scenes))])
    results.sort(key=lambda r: r[0])

    t = 0.0
    for i, path, res in results:
        d = probe_duration(path) if res["ok"] else 0.0
        words = len(texts[i].split())
        ok_ratio, ratio, expected = spoken_ok(d, words) if d else (False, 0, words / WPS)
        sc_checks = {"audioExists": bool(d > 0), "durationRatio": round(ratio, 2), "expectedSec": round(expected, 1),
                     "attempts": res.get("attempts"), "cached": res.get("cached", False), "error": res.get("error")}
        if not res["ok"] or not ok_ratio:
            faulty.append(i)
        scene_meta.append({"index": i, "title": scenes[i].get("title", f"Scene {i+1}"), "audioFile": os.path.basename(path),
                           "start": round(t, 3), "duration": round(d, 3), "end": round(t + d, 3),
                           "steps": step_timeline(scenes[i], t, d) if d else [], "checks": sc_checks,
                           "status": "ok" if i not in faulty else "faulty"})
        t += d + PAD

    checks.append({"name": "Audio exists for every scene", "passed": all(s["checks"]["audioExists"] for s in scene_meta),
                   "detail": f"{sum(s['checks']['audioExists'] for s in scene_meta)}/{len(scene_meta)} scenes have audio"})
    checks.append({"name": "Audio duration matches scene script", "passed": not faulty,
                   "detail": "all scenes within expected speaking range" if not faulty else f"faulty scenes: {faulty}"})

    # 3) Timeline validation
    order_ok = [s["index"] for s in scene_meta] == list(range(len(scenes)))
    overlap = any(scene_meta[k]["start"] < scene_meta[k - 1]["end"] for k in range(1, len(scene_meta)))
    gaps = [round(scene_meta[k]["start"] - scene_meta[k - 1]["end"], 3) for k in range(1, len(scene_meta))]
    bad_gap = [g for g in gaps if abs(g - PAD) > 0.01]
    checks.append({"name": "Scenes correctly ordered", "passed": order_ok, "detail": "sequential 0..n-1" if order_ok else "order mismatch"})
    checks.append({"name": "No timestamp overlap", "passed": not overlap, "detail": "each scene starts after the previous ends"})
    checks.append({"name": "No unintended timestamp gap", "passed": not bad_gap, "detail": f"all gaps = {PAD}s intentional pause" if not bad_gap else f"unexpected gaps {bad_gap}"})
    checks.append({"name": "No missing scene", "passed": len(scene_meta) == len(scenes) and not faulty, "detail": f"{len(scene_meta)}/{len(scenes)} scenes assembled"})

    master_name = None
    total = 0.0
    if not faulty:
        # 4) Assembly into one continuous master track
        sig = hashlib.sha1("|".join(hashes).encode()).hexdigest()[:10]
        master_name = f"lesson_{sig}.mp3"
        master = os.path.join(vdir, master_name)
        if not os.path.exists(master):
            inputs, filt = [], []
            n = 0
            for k, s in enumerate(scene_meta):
                inputs += ["-i", os.path.join(vdir, s["audioFile"])]
                filt.append(f"[{n}:a]"); n += 1
                if k < len(scene_meta) - 1:
                    inputs += ["-f", "lavfi", "-t", str(PAD), "-i", "anullsrc=r=44100:cl=mono"]
                    filt.append(f"[{n}:a]"); n += 1
            fc = "".join(filt) + f"concat=n={n}:v=0:a=1[out]"
            r = _run(["ffmpeg", "-y", "-v", "error", *inputs, "-filter_complex", fc, "-map", "[out]",
                      "-ac", "1", "-ar", "44100", "-b:a", "128k", master])
            if r.returncode != 0:
                raise RuntimeError("assembly failed: " + r.stderr[-400:])
        total = probe_duration(master)
        expected_total = scene_meta[-1]["end"]
        drift = abs(total - expected_total)
        checks.append({"name": "Audio stays synchronized (master vs timeline)", "passed": drift < 0.3,
                       "detail": f"master {total:.2f}s vs timeline {expected_total:.2f}s (drift {drift*1000:.0f} ms)"})
        err = decode_errors(master)
        checks.append({"name": "Continuous playback (no decode errors)", "passed": not err, "detail": "clean decode of full track" if not err else err[:200]})
        long_sil = [s for s in silences(master, 2.2) if s[1] and s[0] > 0.5 and s[1] < total - 0.5]
        checks.append({"name": "No dead air / dropped audio", "passed": not long_sil,
                       "detail": "no silence > 2.2s inside lesson" if not long_sil else f"silence at {long_sil[0][0]:.1f}s"})

        # 5) Captions from the same script
        lines = ["WEBVTT", ""]
        cap_text = []
        for s in scene_meta:
            for st in s["steps"]:
                lines += [f"{vtt_time(st['start'])} --> {vtt_time(st['end'])}", st["say"], ""]
                cap_text.append(st["say"])
        open(os.path.join(vdir, "captions.vtt"), "w").write("\n".join(lines))
        cap_match = " ".join(cap_text) == " ".join(texts)
        checks.append({"name": "Captions match lesson narration", "passed": cap_match, "detail": f"{len(cap_text)} caption cues"})

    passed = all(c["passed"] for c in checks)
    manifest = {"videoId": video_id, "lang": lang, "voice": voice, "duration": round(total, 3), "pad": PAD,
                "audio": master_name, "captions": "captions.vtt" if master_name else None,
                "scenes": scene_meta, "qc": {"passed": passed, "checks": checks, "faultyScenes": faulty},
                "status": "published" if passed else "failed"}
    json.dump(manifest, open(os.path.join(vdir, "manifest.json"), "w"), indent=1, ensure_ascii=False)
    return manifest
