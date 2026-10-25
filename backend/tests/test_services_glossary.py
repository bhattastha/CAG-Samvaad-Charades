# Iteration 2: BHASHINI services config (GET/PUT/test), glossary stats/import/search, RBAC for new endpoints
import os
import subprocess
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    for line in open("/app/frontend/.env"):
        if line.startswith("REACT_APP_BACKEND_URL="):
            BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
API = f"{BASE_URL}/api"
MANAGER = "bhattastha.dibd@gmail.com"
PLAYER = "qa.tester1@cag.gov.in"


def login(email, code="615243"):
    subprocess.run(["/app/scripts/emergent/test-otp.sh", email, code], check=True, capture_output=True)
    s = requests.Session()
    r = s.post(f"{API}/auth/otp/verify", json={"email": email, "code": code})
    assert r.status_code == 200, r.text
    return s


@pytest.fixture(scope="module")
def mgr():
    return login(MANAGER)


@pytest.fixture(scope="module")
def player():
    return login(PLAYER, "731942")


def test_health():
    r = requests.get(f"{API}/health")
    assert r.status_code == 200, r.text


# services config
def test_services_get(mgr):
    r = mgr.get(f"{API}/admin/config/services")
    assert r.status_code == 200, r.text
    d = r.json()
    for k in ["translationProvider", "translation", "transliterationProvider", "transliteration", "transliterationSuggestions", "tts", "ttsGender", "ttsLanguage", "ttsSamplingRate", "asrHindi", "llm"]:
        assert k in d["current"], k
    assert d["current"]["translationProvider"] == "dhruva"
    assert d["current"]["transliterationProvider"] == "dhruva"


def test_services_put_roundtrip_and_audit(mgr):
    cur = mgr.get(f"{API}/admin/config/services").json()["current"]
    orig = cur["transliterationSuggestions"]
    body = {**cur, "transliterationSuggestions": 5}
    r = mgr.put(f"{API}/admin/config/services", json=body)
    assert r.status_code == 200, r.text
    assert r.json()["current"]["transliterationSuggestions"] == 5
    assert r.json()["voiceChanged"] is False
    assert mgr.get(f"{API}/admin/config/services").json()["current"]["transliterationSuggestions"] == 5
    au = mgr.get(f"{API}/admin/audit", params={"action": "config.services"}).json()
    assert au and au[0]["action"] == "config.services"
    r = mgr.put(f"{API}/admin/config/services", json={**cur, "transliterationSuggestions": orig})
    assert r.status_code == 200
    assert mgr.get(f"{API}/admin/config/services").json()["current"]["transliterationSuggestions"] == orig


def test_services_put_invalid_id(mgr):
    cur = mgr.get(f"{API}/admin/config/services").json()["current"]
    r = mgr.put(f"{API}/admin/config/services", json={**cur, "translation": "bad id"})
    assert r.status_code == 400, r.text
    print(r.text)
    assert mgr.get(f"{API}/admin/config/services").json()["current"]["translation"] == cur["translation"]


def test_services_put_out_of_range(mgr):
    cur = mgr.get(f"{API}/admin/config/services").json()["current"]
    r = mgr.put(f"{API}/admin/config/services", json={**cur, "transliterationSuggestions": 99})
    assert r.status_code == 400, r.text


@pytest.mark.parametrize("task", ["translation", "transliteration", "tts", "llm"])
def test_services_test_endpoint(mgr, task):
    r = mgr.post(f"{API}/admin/config/services/test", json={"task": task}, timeout=60)
    print(task, r.status_code, r.text[:300])
    assert r.status_code in (200, 422)
    d = r.json()  # must be JSON, not Cloudflare HTML
    if r.status_code == 422:
        assert d["ok"] is False and d["message"]


# RBAC
def test_player_forbidden(player):
    assert player.get(f"{API}/admin/config/services").status_code == 403
    assert player.put(f"{API}/admin/config/services", json={}).status_code == 403
    assert player.get(f"{API}/admin/glossary/stats").status_code == 403
    assert player.post(f"{API}/admin/glossary/import", json={"csv": "x", "mode": "merge"}).status_code == 403
    assert player.post(f"{API}/admin/config/services/test", json={"task": "llm"}).status_code == 403


def test_anon_unauthorized():
    assert requests.get(f"{API}/admin/config/services").status_code in (401, 403)


# glossary
def test_glossary_stats_and_audit_search(mgr):
    st = mgr.get(f"{API}/admin/glossary/stats").json()
    print(st)
    assert 11000 <= st["terms"] <= 11500
    rows = mgr.get(f"{API}/admin/glossary", params={"q": "audit"}).json()
    a = [x for x in rows if x["en"].lower() == "audit"]
    assert a, [x["en"] for x in rows[:10]]
    assert a[0]["hi"] == "लेखापरीक्षा"
    assert set(["संपरीक्षा", "लेखापरीक्षा करना", "ऑडिट"]) <= set(a[0]["accepted_variants"])
    assert a[0]["avoid_forms"] == []


def test_glossary_import_bad_csv(mgr):
    r = mgr.post(f"{API}/admin/glossary/import", json={"csv": "foo,bar\n1,2", "mode": "merge"})
    assert r.status_code == 400 and r.json()["error"] == "no_rows"
