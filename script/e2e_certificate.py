"""End-to-end check of the certificate path: signup -> pass every topic test -> final -> project -> certificate -> verify.
Reads correct answers from the local DB, so run it only against a local dev database."""
import json, sqlite3, sys, time, urllib.request, random
BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:5000"
COURSE = sys.argv[2] if len(sys.argv) > 2 else "python-programming"
db = sqlite3.connect("data.db")
def call(method, path, body=None, tok=None):
    req = urllib.request.Request(BASE + path, method=method, data=json.dumps(body).encode() if body is not None else None,
                                 headers={"Content-Type": "application/json", **({"Authorization": "Bearer " + tok} if tok else {})})
    try:
        with urllib.request.urlopen(req, timeout=180) as r: return json.loads(r.read())
    except urllib.error.HTTPError as e: raise SystemExit(f"{method} {path} -> {e.code} {e.read()[:300]}")
def correct(qid, qtype):
    ans = db.execute("select answer from questions where id=?", (qid,)).fetchone()[0]
    return int(ans) if qtype == "mcq" else ans
def take(scope, sid, tok):
    p = call("GET", f"/api/tests/{scope}/{sid}", tok=tok)
    r = call("POST", "/api/tests/submit", {"token": p["token"], "answers": {str(q["id"]): correct(q["id"], q["type"]) for q in p["questions"]}}, tok)
    return r["percent"]
email = f"e2e{random.randint(1000,99999)}@lai.app"
tok = call("POST", "/api/auth/signup", {"name": "E2E Tester", "email": email, "password": "Tester@1234"})["token"]
course = call("GET", f"/api/courses/{COURSE}", tok=tok)
call("POST", f"/api/courses/{COURSE}/enroll", {}, tok)
tids = [t["id"] for s in course["subjects"] for ch in s["chapters"] for t in ch["topics"] if t["status"] == "published"]
print("topics", len(tids), "scores", [take("topic", t, tok) for t in tids])
print("final", take("final", course["id"], tok))
proj = open(__file__.replace("e2e_certificate.py", "sample_expense_tracker.py")).read()
rev = call("POST", f"/api/courses/{COURSE}/project", {"content": proj}, tok)["review"]
print("project", rev["score"], rev["passed"], rev.get("summary", "")[:160])
cert = call("POST", f"/api/courses/{COURSE}/certificate", {}, tok)
print("certificate", cert)
print("verify", call("GET", f"/api/certificates/{cert['id']}/verify"))
