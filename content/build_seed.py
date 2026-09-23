"""Combine curriculum + reviewed generated content into content/seed.json (consumed by the Node seeder)."""
import json, os, re, sys
sys.path.insert(0, os.path.dirname(__file__))
from curriculum import CATEGORIES, FULL, OUTLINE
from generate_content import slugify

G = os.path.join(os.path.dirname(__file__), "generated")

VISUALS = [
    (r"pointer|variables and data types|arrays|lists and tuples|structures", "memory"),
    (r"compil|jvm|structure of a", "hardware"),
    (r"ohm|series and parallel", "circuit"),
    (r"linear equation", "balance"),
    (r"quadratic|logarithm", "geometry"),
    (r"artificial intelligence|large language|capabilities", "neural"),
]

def visual_for(title):
    for pat, v in VISUALS:
        if re.search(pat, title, re.I): return v
    return None

def lesson_from(d):
    return {"summary": d["summary"], "shortNotes": d["shortNotes"], "detailed": d["detailed"],
            "codeExample": d.get("codeExample"), "commonMistakes": d.get("commonMistakes", []),
            "questions": d["questions"], "scenes": d["video"]["scenes"]}

courses = []
missing = []
for sort, c in enumerate(FULL):
    subs = []
    for s in c["subjects"]:
        chs = []
        for ch in s["chapters"]:
            tops = []
            for t in ch["topics"]:
                p = f"{G}/topics/{slugify(c['slug'] + '-' + t)}.json"
                if os.path.exists(p):
                    tops.append({"title": t, "lesson": lesson_from(json.load(open(p))), "visual": visual_for(t)})
                else:
                    missing.append(p); tops.append({"title": t})
            chs.append({"title": ch["title"], "topics": tops})
        subs.append({"title": s["title"], "chapters": chs})
    for title, topics in c.get("outline_subjects", []):
        subs.append({"title": title, "chapters": [{"title": title, "topics": [{"title": t} for t in topics]}]})
    courses.append({k: c.get(k) for k in ["slug", "title", "category", "certifiable", "language", "level", "description", "project"]}
                   | {"contentStatus": "full", "subjects": subs, "sort": sort})

for i, (slug, title, cat, desc) in enumerate(OUTLINE):
    p = f"{G}/outlines/{slug}.json"
    o = json.load(open(p)) if os.path.exists(p) else {"subjects": []}
    subs = [{"title": s["title"], "chapters": [{"title": ch["title"], "topics": [{"title": t} for t in ch["topics"]]} for ch in s["chapters"]]} for s in o["subjects"]]
    courses.append({"slug": slug, "title": title, "category": cat, "certifiable": False, "language": None, "level": "Beginner",
                    "description": desc, "project": None, "contentStatus": "outline", "subjects": subs, "sort": 100 + i})

json.dump({"categories": CATEGORIES, "courses": courses}, open(os.path.join(os.path.dirname(__file__), "seed.json"), "w"), ensure_ascii=False)
print("courses", len(courses), "missing", len(missing))
for m in missing: print(" missing", m)
