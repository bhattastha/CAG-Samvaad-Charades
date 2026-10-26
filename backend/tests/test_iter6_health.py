# Iteration 6: public health endpoints (/api/health, /api/health/db) on preview + published-mode sim + quick regression
import os
import re
import subprocess
import time
from datetime import datetime

import pytest
import requests

BASE = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/") + "/api"
PUB = os.environ.get("PUBSIM_URL", "http://127.0.0.1:3997").rstrip("/") + "/api"
FORBIDDEN = re.compile(r"(DATABASE_URL|JWT|SECRET|postgres|pglite|NODE_ENV|version|hostname|127\.0\.0\.1|/app/|/tmp/)", re.I)


def _check_health(r):
    assert r.status_code == 200, r.text
    assert "no-store" in r.headers.get("cache-control", "")
    # Cloudflare edge may add __cf_bm on the public URL; the app itself must not set cookies
    cookies = [v for k, v in r.headers.items() if k.lower() == "set-cookie"]
    assert all(c.strip().startswith("__cf_bm=") for c in ",".join(cookies).split(", __") if c) or not cookies, cookies
    assert "session" not in r.headers.get("set-cookie", "").lower()
    d = r.json()
    assert d["ok"] is True and d["status"] == "healthy"
    assert d["message"] == "Samvaad Charades backend is running"
    datetime.fromisoformat(d["timestamp"].replace("Z", "+00:00"))
    assert isinstance(d["uptime"], int) and d["uptime"] >= 0
    assert set(d) == {"ok", "status", "message", "timestamp", "uptime"}
    assert not FORBIDDEN.search(r.text)


def _check_db(r):
    assert r.status_code == 200, r.text
    assert "no-store" in r.headers.get("cache-control", "")
    d = r.json()
    assert d["status"] == "healthy" and d["database"] == "connected"
    assert isinstance(d["latencyMs"], int)
    datetime.fromisoformat(d["timestamp"].replace("Z", "+00:00"))
    assert not FORBIDDEN.search(r.text)


# preview health
class TestPreviewHealth:
    def test_get(self):
        t = time.time()
        r = requests.get(f"{BASE}/health", timeout=10)
        el = time.time() - t
        print("elapsed", el, r.text)
        _check_health(r)
        assert el < 1.0

    def test_head(self):
        r = requests.head(f"{BASE}/health", timeout=10)
        assert r.status_code == 200
        assert r.content == b""

    def test_uptime_monotonic(self):
        a = requests.get(f"{BASE}/health").json()["uptime"]
        time.sleep(1.2)
        b = requests.get(f"{BASE}/health").json()["uptime"]
        assert b >= a

    def test_ignores_bad_cookie(self):
        r = requests.get(f"{BASE}/health", cookies={"session": "garbage"}, headers={"Authorization": "Bearer junk"})
        _check_health(r)

    def test_db(self):
        r = requests.get(f"{BASE}/health/db", timeout=10)
        print(r.text)
        _check_db(r)

    def test_db_head(self):
        assert requests.head(f"{BASE}/health/db", timeout=10).status_code == 200


# published-mode sim (bundle on PGlite, port 3997)
class TestPublishedHealth:
    @pytest.fixture(autouse=True)
    def alive(self):
        try:
            requests.get(f"{PUB}/health", timeout=3)
        except requests.RequestException:
            pytest.skip("published sim not running")

    def test_get(self):
        _check_health(requests.get(f"{PUB}/health"))

    def test_head(self):
        assert requests.head(f"{PUB}/health").status_code == 200

    def test_db(self):
        _check_db(requests.get(f"{PUB}/health/db"))


# quick regression
class TestRegression:
    def test_landing(self):
        r = requests.get(BASE.rsplit("/api", 1)[0] + "/")
        assert r.status_code == 200 and "<div id=\"root\"" in r.text or "root" in r.text

    def test_manager_page(self):
        r = requests.get(BASE.rsplit("/api", 1)[0] + "/manager")
        assert r.status_code == 200 and "<html" in r.text.lower()

    @pytest.mark.parametrize("path", ["/admin/me", "/admin/dashboard", "/admin/players", "/admin/config/services"])
    def test_admin_anon(self, path):
        assert requests.get(f"{BASE}{path}").status_code in (401, 403)

    def _login(self, email, code):
        subprocess.run(["/app/scripts/emergent/test-otp.sh", email, code], check=True, capture_output=True)
        s = requests.Session()
        r = s.post(f"{BASE}/auth/otp/verify", json={"email": email, "code": code})
        assert r.status_code == 200, r.text
        return s

    def test_player_login_me(self):
        s = self._login("qa.tester2@gmail.com", "481516")
        r = s.get(f"{BASE}/me/profile")
        assert r.status_code == 200, r.text
        assert "qa.tester2@gmail.com" in r.text

    def test_manager_login_admin_me(self):
        s = self._login("bhattastha.dibd@gmail.com", "623342")
        r = s.get(f"{BASE}/admin/me")
        assert r.status_code == 200, r.text
