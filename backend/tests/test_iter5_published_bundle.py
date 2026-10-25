# Published-mode simulation: the bundled API (backend/hc/api.mjs) on embedded PGlite. Start it first (see iteration_5.json), set PUBSIM_URL.
import os
import pytest
import requests

PUB = os.environ.get("PUBSIM_URL", "http://127.0.0.1:3998").rstrip("/") + "/api"


@pytest.fixture(scope="module", autouse=True)
def alive():
    try:
        r = requests.get(f"{PUB}/health", timeout=5)
    except requests.RequestException:
        pytest.skip("published-mode bundle not running")
    assert r.status_code == 200 and r.json().get("ok") is True


# public stats: SEED_PUBLISH_SAMPLES=1 publishes the 5 seeded pages
def test_public_stats_bundles():
    r = requests.get(f"{PUB}/stats/public")
    assert r.status_code == 200, r.text
    d = r.json()
    print(d)
    assert d.get("bundles") == 5


# offices seed loaded
def test_offices_delhi():
    r = requests.get(f"{PUB}/offices", params={"q": "delhi"})
    assert r.status_code == 200
    rows = r.json()
    assert isinstance(rows, list) and len(rows) > 0
    assert any("delhi" in (o.get("name", "") + (o.get("address") or "")).lower() for o in rows)


def test_config_and_rounds():
    assert requests.get(f"{PUB}/config").status_code == 200
    r = requests.get(f"{PUB}/rounds")
    assert r.status_code == 200
    assert {"trial", "primary", "secondary", "pro"} <= {x["key"] for x in r.json()}


# glossary seeded (11,389 incl. '-' fix) - public search works
def test_glossary_search():
    r = requests.get(f"{PUB}/glossary", params={"q": "audit"})
    assert r.status_code == 200, r.text
    assert len(r.json()) > 0


# production: dev OTP 123456 rejected
def test_dev_code_rejected():
    s = requests.Session()
    s.post(f"{PUB}/auth/otp/request", json={"email": "qa.pubsim@gmail.com"})
    r = s.post(f"{PUB}/auth/otp/verify", json={"email": "qa.pubsim@gmail.com", "code": "123456"})
    assert r.status_code == 400
    assert r.json().get("error") == "otp_invalid"


@pytest.mark.parametrize("path", ["/admin/me", "/admin/dashboard", "/admin/glossary", "/admin/pages", "/admin/players", "/admin/config/services"])
def test_admin_requires_session(path):
    r = requests.get(f"{PUB}{path}")
    assert r.status_code in (401, 403), f"{path} -> {r.status_code}"


def test_me_anon():
    r = requests.get(f"{PUB}/me/profile")
    assert r.status_code in (401, 403, 404)


# web is not served by the API in published mode (nginx serves frontend/build)
def test_no_web_served():
    r = requests.get(PUB.rsplit("/api", 1)[0] + "/")
    assert r.status_code in (404, 200)
    assert "<script" not in r.text or r.status_code == 404


# E2E on the bundle (needs codes 482913 planted in PGlite for qa.pub1@gmail.com + manager while the API is stopped)
def _login(email):
    if not os.environ.get("PUBSIM_PLANTED"):
        pytest.skip("no planted OTP")
    r = requests.post(f"{PUB}/auth/otp/verify", json={"email": email, "code": "482913"})
    assert r.status_code == 200, r.text
    tok = r.cookies.get_dict() or {}
    # cookie is Secure (production), requests won't resend it over http: pass it explicitly
    s = requests.Session()
    s.headers["Cookie"] = "; ".join(f"{k}={v}" for k, v in tok.items())
    return s, r.json()


@pytest.fixture(scope="module")
def pub_player():
    s, d = _login("qa.pub1@gmail.com")
    if d["status"] == "new":
        offs = s.get(f"{PUB}/offices", params={"q": "Delhi"}).json()
        r = s.post(f"{PUB}/players/register", json={"name": "TEST Pub", "mobile": "9876543210",
                                                    "officeId": offs[0]["id"], "officeAddress": offs[0]["address"] or "Delhi"})
        assert r.status_code == 200, r.text
        if r.cookies.get_dict():  # register re-issues the session cookie with the player id
            s.headers["Cookie"] = "; ".join(f"{k}={v}" for k, v in r.cookies.get_dict().items())
    return s


def test_pub_trial_submit_scores(pub_player):
    import uuid
    s = pub_player
    assert s.get(f"{PUB}/me/progress").json()["registered"] is True
    cid = "qa-" + uuid.uuid4().hex[:12]
    r = s.post(f"{PUB}/rounds/trial/attempts", json={"clientId": cid})
    assert r.status_code == 200, r.text
    aid = r.json()["id"]
    a = s.get(f"{PUB}/attempts/{aid}")
    assert a.status_code == 200, a.text
    print("attempt keys", list(a.json().keys())[:20])
    r = s.post(f"{PUB}/attempts/{aid}/submit", json={})
    assert r.status_code == 200, r.text
    rep = s.get(f"{PUB}/attempts/{aid}/report")
    assert rep.status_code == 200, rep.text
    print("report", rep.text[:400])


def test_pub_player_admin_forbidden(pub_player):
    assert pub_player.get(f"{PUB}/admin/me").status_code == 403


def test_pub_manager_console():
    s, d = _login("bhattastha.dibd@gmail.com")
    assert d["role"] == "manager"
    assert s.get(f"{PUB}/admin/me").status_code == 200
    g = s.get(f"{PUB}/admin/glossary", params={"page": 1, "size": 100})
    assert g.status_code == 200, g.text
    assert g.json()["total"] == 11389
    p = s.get(f"{PUB}/admin/pages")
    assert p.status_code == 200 and p.text.count("published") >= 5
    assert s.get(f"{PUB}/admin/config/services").status_code == 200
    assert s.get(f"{PUB}/admin/dashboard").status_code == 200
