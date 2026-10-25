# Samvaad Charades API regression: auth OTP, registration, offices, rounds/attempts (no_pages), admin RBAC, manager console
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
PLAYER = "qa.backend1@cag.gov.in"
MANAGER = "bhattastha.dibd@gmail.com"


def plant(email, code):
    subprocess.run(["/app/scripts/emergent/test-otp.sh", email, code], check=True, capture_output=True)


def login(email, code="482913"):
    s = requests.Session()
    r = s.post(f"{API}/auth/otp/request", json={"email": email})
    # request may 500 for @cag.gov.in (email proxy rejects domain) - planted code still lets us continue
    assert r.status_code in (200, 429, 500), r.text
    plant(email, code)
    r = s.post(f"{API}/auth/otp/verify", json={"email": email, "code": code})
    assert r.status_code == 200, r.text
    return s, r.json()


@pytest.fixture(scope="module")
def player():
    s, data = login(PLAYER)
    if data["status"] == "new":
        offs = s.get(f"{API}/offices", params={"q": "Delhi"}).json()
        r = s.post(f"{API}/players/register", json={"name": "TEST Backend", "mobile": "9876543210",
                                                     "officeId": offs[0]["id"], "officeAddress": offs[0]["address"] or "Delhi office address"})
        assert r.status_code == 200, r.text
    yield s
    # teardown: remove the TEST player and its attempts so the leaderboard/analytics stay clean
    sql = (f"DELETE FROM attempt_events WHERE attempt_id IN (SELECT a.id FROM attempts a JOIN players p ON p.id=a.player_id WHERE p.email='{PLAYER}');"
           f"DELETE FROM attempts WHERE player_id IN (SELECT id FROM players WHERE email='{PLAYER}');"
           f"DELETE FROM players WHERE email='{PLAYER}';"
           "DELETE FROM otp_challenges WHERE email LIKE 'qa.devcode%' OR email='game_admin@cag.gov.in';")
    subprocess.run(["su", "postgres", "-c", f'psql -q -d hindi_charades -c "{sql}"'], capture_output=True)


# health / public
def test_public_config_and_rounds():
    assert requests.get(f"{API}/config").status_code == 200
    r = requests.get(f"{API}/rounds")
    assert r.status_code == 200
    keys = [x["key"] for x in r.json()]
    assert {"trial", "primary", "secondary", "pro"} <= set(keys)


# auth: dev code must be rejected
def test_dev_code_rejected():
    s = requests.Session()
    s.post(f"{API}/auth/otp/request", json={"email": "qa.devcode@cag.gov.in"})
    r = s.post(f"{API}/auth/otp/verify", json={"email": "qa.devcode@cag.gov.in", "code": "123456"})
    assert r.status_code == 400
    assert r.json().get("error") == "otp_invalid"


def test_otp_request_no_devcode():
    r = requests.post(f"{API}/auth/otp/request", json={"email": "qa.devcode2@cag.gov.in"})
    assert r.status_code in (200, 429)
    if r.status_code == 200:
        assert not r.json().get("devCode")


# offices with address (autofill source)
@pytest.mark.parametrize("q", ["Guwahati", "Delhi"])
def test_offices_search_has_address(q):
    r = requests.get(f"{API}/offices", params={"q": q})
    assert r.status_code == 200
    rows = r.json()
    assert len(rows) > 0
    assert any(o.get("address") for o in rows), "no address on offices"


def test_player_progress(player):
    d = player.get(f"{API}/me/progress").json()
    assert d["registered"] is True
    assert d["role"] is None


# glossary
def test_glossary_search():
    r = requests.get(f"{API}/glossary", params={"q": "audit"})
    assert r.status_code == 200
    rows = r.json()
    assert len(rows) > 0 and rows[0]["hi"]


# no_pages fix: start trial attempt
def test_start_trial_attempt(player):
    r = player.post(f"{API}/rounds/trial/attempts", json={"clientId": "qa-" + uuid.uuid4().hex[:12]})
    assert r.status_code == 200, r.text
    d = r.json()
    assert "no_pages" not in r.text
    assert d.get("id")


# RBAC
def test_player_admin_forbidden(player):
    for ep in ["/admin/me", "/admin/library", "/admin/pages", "/admin/dashboard"]:
        r = player.get(f"{API}{ep}")
        assert r.status_code == 403, f"{ep} -> {r.status_code}"


def test_anon_admin_denied():
    r = requests.get(f"{API}/admin/library")
    assert r.status_code in (401, 403)


def test_old_admin_not_manager():
    # NOTE: /auth/otp/request currently 500s for @cag.gov.in (email proxy rejects the domain), so verify via planted code only
    s = requests.Session()
    plant("game_admin@cag.gov.in", "551177")
    r = s.post(f"{API}/auth/otp/verify", json={"email": "game_admin@cag.gov.in", "code": "551177"})
    assert r.status_code == 200, r.text
    assert r.json()["role"] is None
    assert s.get(f"{API}/admin/me").status_code == 403


# BUG regression: OTP request for the primary player domain must not 500
def test_otp_request_cag_domain_not_500():
    r = requests.post(f"{API}/auth/otp/request", json={"email": "qa.domaincheck@cag.gov.in"})
    assert r.status_code != 500, f"OTP request 500 for cag.gov.in: {r.text}"


def test_manager_console():
    s, data = login(MANAGER, "739154")
    assert data["role"] == "manager"
    assert s.get(f"{API}/admin/me").status_code == 200
    r = s.get(f"{API}/admin/pages")
    assert r.status_code == 200
    txt = r.text
    assert txt.count("published") >= 5, txt[:500]
    assert s.get(f"{API}/admin/sahayika/lines").status_code == 200
