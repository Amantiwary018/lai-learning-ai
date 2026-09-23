# LAI – Learning AI

> Don't just study. See it, interact with it, build it and prove your skills.

**Created and owned by:** Aman Kumar Tiwary · Registration No. AJU/261982 · © 2026, all rights reserved (see [LICENSE](LICENSE))

LAI is a full-stack AI-powered education platform. Every course follows
**Course → Subject → Chapter → Topic → Lesson**, and every topic walks the student through

```
AI VIDEO LESSON → NOTES → VISUAL/3D LEARNING → DOUBT SOLVER → PRACTICE → TEST → PERFORMANCE ANALYSIS → NEXT TOPIC
```

and every certification course ends with **PROJECT → FINAL ASSESSMENT → LAI CERTIFICATE**.

## What works today (MVP)

| Area | Status |
| --- | --- |
| Accounts | Sign up / log in / log out, hashed passwords (scrypt), server-side sessions (Bearer token + httpOnly cookie), roles (student / admin), rate limits |
| Catalog | 26 courses in 4 categories — Certification Courses, Engineering, Programming & Technology, Learn AI. **6 full courses** (C, Python, Java, Learn AI, Engineering Mathematics Foundations, Basic Electrical Engineering) with 50 published topics; the other 20 are syllabus-only outlines marked "Outline · in production" |
| AI video teacher | Whiteboard lectures that write step by step in sync with a human-sounding voice. One continuous audio track per lecture, timestamps measured from the real audio, per-scene QC (duration, silence gaps, decode errors, cue order, drift). Faulty lectures are never shown; the admin can regenerate only the faulty scene. Captions, speed, scene list, resume, "Show full code" |
| Notes | Short + detailed notes, formulas, common mistakes, download as Markdown, save to My Notes |
| Visual / 3D lab | 9 interactive visuals (3D computer hardware, 3D molecules, 3D solids, packet flow, circuit simulator, memory/pointers, equation balance, heart, neural network) — 3D only where it helps |
| AI doubt solver | Text, photo (vision), voice (browser speech recognition), PDF; 7 explanation modes; English / Hindi / Hinglish with language-lock checks; "Listen" (TTS); confidence warnings when an answer is uncertain |
| Practice & tests | MCQ, fill-in, short answer, numerical, coding; hints + explanations; topic / chapter / subject / mock / final tests with timers, server-side grading, weak-topic analysis |
| Code lab | Runs Python (Pyodide) and JavaScript in the browser sandbox; AI explain / find bugs / explain error / review / roadmap |
| AI Tools Academy | Independent guides to ChatGPT, Gemini, Claude, Microsoft Copilot, GitHub Copilot, DeepSeek etc. **No partnership or official certification is claimed** |
| Projects | Course projects reviewed by AI against the brief with a rubric-style score |
| Certificates | Issued only when every requirement is met; unique ID, QR code, public verification page, admin revocation. Clearly states it is issued by LAI, not by any AI company |
| Dashboard | Streak, progress, test history chart, weak topics, continue-learning |
| Admin panel | Content CRUD for the whole tree, AI-draft review queue, video QC + per-scene regenerate + Hindi translation, students, certificates, error log, AI usage per model |

## Architecture

```
Browser (React + Vite + Tailwind + shadcn/ui)
   │  REST (JSON)                        no API keys in the frontend
   ▼
Node/Express API  (server/)  ── SQLite (better-sqlite3)
   │  LAI AI Router: Student Request → pick model by task (doubt / vision / code / grade / draft / quick / document)
   │                 → call → quality check (language lock, empty/refusal, JSON shape) → fallback model → final response
   ▼
Python AI gateway (ai/gateway.py, internal port 8001)
   ├── chat adapters: Anthropic | OpenAI | optional local adapter   (LAI_PROVIDER)
   ├── TTS: tts.py                                               (LAI_TTS_PROVIDER)
   └── video pipeline: script → scenes → voice → measure → sync timeline → assemble single track → QC
```

## Run locally

Requirements: Node 20+, Python 3.10+, ffmpeg.

```bash
npm install
pip install -r ai/requirements.txt
cp .env.example .env          # add ANTHROPIC_API_KEY and/or OPENAI_API_KEY
python3 content/build_seed.py # builds content/seed.json from content/generated (already committed)

# development (two terminals)
python3 ai/gateway.py
npm run dev                   # http://localhost:5000

# production
npm run build && ./start.sh
```

The database is created and seeded automatically on first boot. Lecture videos are generated in the
background on boot (set `LAI_AUTOBUILD_VIDEOS=0` to disable) and appear once they pass QC.

**Accounts**

- Demo student: `student@lai.app` / `Student@123` (one-click "Demo student" button on the login page)
- Admin: `admin@lai.app` (or `LAI_ADMIN_EMAIL`) with the password from `LAI_ADMIN_PASSWORD`. If that variable is not set on first boot, a random password is generated and printed once in the server log. There is no default admin password.

## Deploying

LAI needs a long-running Node process plus the Python gateway and a writable disk (SQLite + generated
audio), so use a VM or container host such as Render, Railway, Fly.io or a VPS:

1. Set the environment variables from `.env.example` (at minimum an LLM key and `LAI_ADMIN_PASSWORD`).
2. Build: `npm ci && npm run build && pip install -r ai/requirements.txt`
3. Start: `./start.sh`
4. Mount a persistent volume for `data.db` and `media/`.

Static-only hosts (GitHub Pages, plain Vercel static) cannot run the backend.

## Tests

- `python3 script/e2e_certificate.py` — signs up a fresh user, passes every topic test, the final
  assessment, submits a sample project for AI review, claims the certificate and verifies it.
- `npx tsc --noEmit` — type-checks client and server.

## Content honesty

- AI-drafted lessons are marked "AI draft · reviewed" and go through the admin review queue.
- Uncertain AI answers are flagged, never presented as guaranteed fact.
- Outline courses show their syllabus only; lessons, tests and videos unlock as they pass review.
- Tool guides are independent and may go out of date; check each provider's site for current features and pricing.

## Roadmap (future modules)

School (Class 5–12), MBA/BBA, more engineering branches, live classes, mobile apps, payments,
peer discussion, recorded-video export (MP4).
