# Fix 2: POST /api/sahayika/tts — 30 uncached calls per signed-in user per 10 min, 31st distinct text -> 429 tts_rate_limited; cached repeat still 200
import json, os, sys, time
import requests
BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
email = sys.argv[1] if len(sys.argv) > 1 else "qa.load05@gmail.com"
ck = json.load(open("/app/tests/load/cookies.json"))[email]
s = requests.Session()
s.cookies.set("hc_session", ck, domain=BASE.split("//")[1])
print("profile", s.get(f"{BASE}/api/me/profile").status_code)
tag = int(time.time()) % 100000
first = None
for i in range(1, 32):
    txt = f"Check {tag} {i}."
    t = time.time()
    r = s.post(f"{BASE}/api/sahayika/tts", json={"text": txt}, timeout=60)
    print(i, r.status_code, r.headers.get("content-type"), len(r.content), f"{time.time()-t:.2f}s", r.text[:80] if r.status_code != 200 else "")
    if r.status_code == 200 and first is None:
        first = txt
    if r.status_code == 429:
        break
if first:
    r = s.post(f"{BASE}/api/sahayika/tts", json={"text": first}, timeout=60)
    print("cached repeat:", r.status_code, r.headers.get("content-type"), len(r.content))
r = requests.post(f"{BASE}/api/sahayika/tts", json={"text": "anon"}, timeout=30)
print("anonymous:", r.status_code, r.text[:80])
