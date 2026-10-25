# Iteration 3: page terms follow CSV glossary, services test messages, glossary merge import (avoid kept), trial regression
import os
import subprocess
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    for line in open("/app/frontend/.env"):
        if line.startswith("REACT_APP_BACKEND_URL="):
            BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
API = f"{BASE_URL}/api"
MANAGER = "bhattastha.dibd@gmail.com"
PLAYER = "qa.tester2@gmail.com"
TEST_EN = "zzqa iter three term"


def login(email, code):
    subprocess.run(["/app/scripts/emergent/test-otp.sh", email, code], check=True, capture_output=True)
    s = requests.Session()
    r = s.post(f"{API}/auth/otp/verify", json={"email": email, "code": code})
    assert r.status_code == 200, r.text
    return s


@pytest.fixture(scope="module")
def mgr():
    yield login(MANAGER, "615243")
    # teardown: remove the merge-import test row so glossary totals stay at the official count
    subprocess.run(["su", "postgres", "-c", f'psql -q -d hindi_charades -c "DELETE FROM glossary_terms WHERE en=\'{TEST_EN}\'"'], capture_output=True)


@pytest.fixture(scope="module")
def player():
    return login(PLAYER, "731942")


def _terms_in_extras(extras, en):
    out = []
    for part in extras["sourceTerms"].values():
        for lst in part.values():
            out += [x for x in lst if x["en"].lower() == en]
    return out


def test_health():
    r = requests.get(f"{API}/health")
    assert r.status_code == 200


# fix 1: page terms take glossary values
@pytest.mark.parametrize("pid", ["r38-primary-bundle", "seed-trial-r38-2025-conclusion"])
def test_page_terms_use_glossary(mgr, pid):
    d = mgr.get(f"{API}/admin/pages/{pid}").json()
    terms = {t["en"]: t for t in d["terms"]}
    p = terms["production"]
    assert p["hi"] == "उत्पादन"
    assert set(p["variants"]) == {"निर्माण", "प्रोडक्शन"}
    assert p["avoid"] == []
    if "audit" in terms:
        a = terms["audit"]
        assert a["hi"] == "लेखापरीक्षा"
        assert set(a["variants"]) == {"संपरीक्षा", "लेखापरीक्षा करना", "ऑडिट"}
        assert a["avoid"] == []
    st = _terms_in_extras(d["extras"], "production")
    assert st, "production not underlined"
    assert all("प्रोडक्शन" in x["variants"] and "प्रोडक्शन" not in x["avoid"] for x in st)
    ww = [w["text"] for w in d["extras"]["watchWords"]]
    assert "प्रोडक्शन" not in ww and "ऑडिट" not in ww


# fix 3: friendly messages
@pytest.mark.parametrize("task", ["translation", "transliteration", "tts"])
def test_services_test_friendly(mgr, task):
    r = mgr.post(f"{API}/admin/config/services/test", json={"task": task}, timeout=60)
    print(task, r.status_code, r.text[:300])
    if r.status_code == 422:
        m = r.json()["message"]
        assert "no suggestions returned" not in m.lower()
        assert "BHASHINI" in m or "Paused" in m


# fix 4: merge import count + avoid kept
def test_merge_import_keeps_avoid(mgr):
    r = mgr.post(f"{API}/admin/glossary/import", json={"csv": f"english_term,hindi_term,accepted_variants\n{TEST_EN},परीक्षणपद,परख\n", "mode": "merge"})
    assert r.status_code == 200, r.text
    assert r.json()["rows"] == 1 and r.json()["removed"] == 0
    row = [g for g in mgr.get(f"{API}/admin/glossary", params={"q": TEST_EN}).json() if g["en"] == TEST_EN][0]
    r = mgr.put(f"{API}/admin/glossary/{row['id']}", json={"hi": row["hi"], "variants": row["accepted_variants"], "avoid": ["गलतपद", "जाँचपद"]})
    assert r.status_code == 200, r.text
    # re-import: one avoid becomes accepted
    r = mgr.post(f"{API}/admin/glossary/import", json={"csv": f"english_term,hindi_term,accepted_variants\n{TEST_EN},परीक्षणपद,परख|जाँचपद\n", "mode": "merge"})
    assert r.status_code == 200, r.text
    row = [g for g in mgr.get(f"{API}/admin/glossary", params={"q": TEST_EN}).json() if g["en"] == TEST_EN][0]
    print(row)
    assert "गलतपद" in row["avoid_forms"]
    assert "जाँचपद" not in row["avoid_forms"]
    assert "जाँचपद" in row["accepted_variants"]


def test_glossary_total(mgr):
    n = mgr.get(f"{API}/admin/glossary/stats").json()["terms"]
    print("terms", n)
    assert n in (11389, 11390)  # 11389 after dash-row fix (+1 while zzqa test row exists)


# regression
def test_manager_overview_settings(mgr):
    for path in ["/admin/dashboard", "/admin/config", "/admin/config/services", "/admin/analytics/overview"]:
        r = mgr.get(f"{API}{path}")
        assert r.status_code == 200, (path, r.text[:200])


def test_trial_attempt_score(player):
    cid = "qa-" + uuid.uuid4().hex[:12]
    r = player.post(f"{API}/rounds/trial/attempts", json={"clientId": cid})
    assert r.status_code == 200, r.text
    a = r.json()
    page = a["page"]
    st = page["sourceTerms"]
    prod = [x for p in st.values() for l in p.values() for x in l if x["en"] == "production"]
    if prod:
        assert "प्रोडक्शन" in prod[0]["variants"] and "प्रोडक्शन" not in prod[0]["avoid"]
    answers = {}
    for part in page["parts"]:
        if part.get("editable"):
            answers[part["id"]] = {"fields": {f["key"]: "उत्पादन की लेखापरीक्षा" for f in part["fields"]}, "done": True}
    aid = a.get("id") or a["attempt"]["id"]
    r = player.post(f"{API}/attempts/{aid}/submit", json={"clientId": cid, "version": 1, "answers": answers})
    print(r.text[:300])
    assert r.status_code == 200, r.text
    assert isinstance(r.json()["score"], (int, float))
