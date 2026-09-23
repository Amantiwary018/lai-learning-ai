"""Draft lesson content with an LLM, validate structure, write JSON. Content is then reviewed and seeded.
Run: python content/generate_content.py
"""
import asyncio, json, os, re, sys
sys.path.insert(0, os.path.dirname(__file__))
from curriculum import FULL, OUTLINE

OUT = os.path.join(os.path.dirname(__file__), "generated")
os.makedirs(f"{OUT}/topics", exist_ok=True); os.makedirs(f"{OUT}/outlines", exist_ok=True)
SEM = asyncio.Semaphore(8)

def slugify(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")[:70]

TOPIC_PROMPT = """You are an expert teacher writing a lesson for the LAI – Learning AI platform.
Course: {course}. Chapter: {chapter}. Topic: {topic}. {langnote}
Audience: beginner college students (India). Be accurate; do not invent facts. Plain English.

Return ONLY a JSON object (no markdown fences) with exactly these keys:
{{
 "summary": "one sentence",
 "shortNotes": ["6 concise revision bullets"],
 "detailed": {{
   "explanation": "3-5 short paragraphs of markdown explanation (may include `inline code`)",
   "definitions": [{{"term": "...", "meaning": "..."}}],
   "formulas": [{{"name": "...", "expression": "...", "note": "..."}}],
   "points": ["5-8 important points / exam tips"]
 }},
 "codeExample": {codeex},
 "commonMistakes": ["3 common mistakes"],
 "questions": [
   6 items {{"type":"mcq","prompt":"...","options":["a","b","c","d"],"answer":<0-3 index>,"explanation":"...","difficulty":"easy|medium|hard"}},
   2 items {{"type":"short","prompt":"...","answer":"model answer 1-3 sentences","keywords":["3-5 key words a correct answer must mention"],"explanation":"...","difficulty":"medium"}},
   1 item  {{"type":"numerical","prompt":"a question with ONE exact short answer (a number, or for code: the exact printed output)","answer":"exact answer string","explanation":"...","difficulty":"medium"}}{codingq}
 ],
 "video": {{"scenes": [
   4 to 6 scenes, each {{"title":"...","steps":[
     2-5 steps, each {{"say":"1-2 natural spoken sentences the teacher says","write": null OR {{"kind":"heading|text|equation|code|bullet|highlight","content":"what the teacher writes on the board while saying it"}}}}
   ]}}
 ]}}
}}
Video rules: total narration 200-320 words, warm human teacher voice, no markdown or symbols in "say" (write code/equations in words when spoken).
The board must be built up step by step: e.g. for equations write "2x + 5 = 17", then next step "2x = 12", then "x = 6" — each step writes ONE new line.
For code, each step writes only 1-3 NEW lines of code (kind "code"), explained as they appear. Keep each board line under 48 characters.
First scene introduces the topic; last scene is a quick recap. Formulas array may be empty for non-math topics. Use the language: English."""

OUTLINE_PROMPT = """Create a course outline for "{title}" ({desc}) on an education platform. Return ONLY JSON:
{{"subjects":[{{"title":"...","chapters":[{{"title":"...","topics":["...","..."]}}]}}]}}
Use 1-2 subjects, each 3-4 chapters, each chapter 2-4 topics. Beginner to intermediate, logical order, concise titles."""

async def ask(prompt, max_tokens=8000):
    """Draft content with the configured LLM (local adapter if present, otherwise Anthropic)."""
    try:
        sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "ai"))
        import local_provider
        txt = await local_provider.complete(prompt, max_tokens=max_tokens)
    except ImportError:
        from anthropic import AsyncAnthropic
        r = await AsyncAnthropic().messages.create(model=os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-4-5"), max_tokens=max_tokens,
                                                   messages=[{"role": "user", "content": prompt}])
        txt = "".join(getattr(b, "text", "") for b in r.content)
    m = re.search(r"\{.*\}", txt, re.S)
    return json.loads(m.group(0))

def validate_topic(d, coding):
    assert isinstance(d["shortNotes"], list) and len(d["shortNotes"]) >= 4
    for k in ["explanation", "definitions", "formulas", "points"]: assert k in d["detailed"]
    qs = d["questions"]; types = [q["type"] for q in qs]
    assert types.count("mcq") >= 5 and "short" in types and "numerical" in types
    if coding: assert "coding" in types
    for q in qs:
        if q["type"] == "mcq": assert len(q["options"]) == 4 and 0 <= int(q["answer"]) <= 3
    sc = d["video"]["scenes"]; assert 3 <= len(sc) <= 7
    for s in sc:
        assert s["steps"] and all(st["say"].strip() for st in s["steps"])
    words = sum(len(st["say"].split()) for s in sc for st in s["steps"])
    assert 120 <= words <= 480, f"narration words {words}"

async def gen_topic(course, chapter, topic):
    slug = slugify(f"{course['slug']}-{topic}")
    path = f"{OUT}/topics/{slug}.json"
    if os.path.exists(path): return
    coding = bool(course.get("language"))
    codeex = '{"language":"%s","code":"complete runnable example program","explanation":"line-by-line explanation"}' % course["language"] if coding else "null"
    codingq = ',\n   1 item  {"type":"coding","prompt":"small programming task","starter":"starter code","solution":"complete solution","explanation":"...","difficulty":"medium"}' if coding else ""
    langnote = f"Programming language: {course['language']}." if coding else ""
    prompt = TOPIC_PROMPT.format(course=course["title"], chapter=chapter, topic=topic, codeex=codeex, codingq=codingq, langnote=langnote)
    async with SEM:
        for attempt in range(3):
            try:
                d = await ask(prompt); validate_topic(d, coding)
                json.dump(d, open(path, "w"), indent=1, ensure_ascii=False); print("ok", slug, flush=True); return
            except Exception as e:
                print("retry", slug, attempt, repr(e)[:160], flush=True)
    print("FAILED", slug, flush=True)

async def gen_outline(slug, title, desc):
    path = f"{OUT}/outlines/{slug}.json"
    if os.path.exists(path): return
    async with SEM:
        for attempt in range(3):
            try:
                d = await ask(OUTLINE_PROMPT.format(title=title, desc=desc), 2000)
                assert d["subjects"] and d["subjects"][0]["chapters"][0]["topics"]
                json.dump(d, open(path, "w"), indent=1); print("ok outline", slug, flush=True); return
            except Exception as e:
                print("retry outline", slug, repr(e)[:120], flush=True)

async def main():
    jobs = []
    for c in FULL:
        for s in c["subjects"]:
            for ch in s["chapters"]:
                for t in ch["topics"]:
                    jobs.append(gen_topic(c, ch["title"], t))
    for o in OUTLINE: jobs.append(gen_outline(*o[:2], o[3]))
    await asyncio.gather(*jobs)

if __name__ == "__main__":
    asyncio.run(main())
