# Iteration 4: manager glossary paging (whole 11,387 terms A→Z), search en/hi/variant, CSV completeness, legacy array, RBAC
import csv
import os
import random
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
PLAYER = "qa.tester2@gmail.com"
CSV = "/app/seed/glossary.anuvaad.csv"


def login(email, code):
    subprocess.run(["/app/scripts/emergent/test-otp.sh", email, code], check=True, capture_output=True)
    s = requests.Session()
    r = s.post(f"{API}/auth/otp/verify", json={"email": email, "code": code})
    assert r.status_code == 200, r.text
    return s


@pytest.fixture(scope="module")
def mgr():
    return login(MANAGER, "482613")


@pytest.fixture(scope="module")
def player():
    return login(PLAYER, "593724")


def norm(s):
    import re, unicodedata
    return re.sub(r"[\s\-]+$", "", unicodedata.normalize("NFC", s.strip()))


def split(v):
    return [norm(x) for x in (v or "").split("|") if norm(x)]


# paging: shape + total
def test_paged_shape_and_total(mgr):
    r = mgr.get(f"{API}/admin/glossary", params={"page": 1, "size": 200})
    assert r.status_code == 200
    d = r.json()
    assert set(["items", "total", "page", "size"]) <= set(d)
    assert d["total"] == 11387 and d["page"] == 1 and d["size"] == 200
    assert len(d["items"]) == 200
    assert "sector" in d["items"][0]


def test_stats_total(mgr):
    assert mgr.get(f"{API}/admin/glossary/stats").json()["terms"] == 11387


def test_last_page(mgr):
    d = mgr.get(f"{API}/admin/glossary", params={"page": 57, "size": 200}).json()
    assert len(d["items"]) == 187
    assert d["items"][-1]["en"].lower() == "zoology"
    d2 = mgr.get(f"{API}/admin/glossary", params={"page": 58, "size": 200}).json()
    assert d2["items"] == [] and d2["total"] == 11387


def test_full_walk_unique_and_sorted(mgr):
    ids, ens = [], []
    for p in range(1, 24):
        d = mgr.get(f"{API}/admin/glossary", params={"page": p, "size": 500}).json()
        ids += [x["id"] for x in d["items"]]
        ens += [x["en"].lower() for x in d["items"]]
    assert len(ids) == 11387 and len(set(ids)) == 11387
    assert ens == sorted(ens) or sum(1 for a, b in zip(ens, ens[1:]) if a > b) == 0


@pytest.mark.parametrize("size", [100, 500])
def test_page_sizes(mgr, size):
    d = mgr.get(f"{API}/admin/glossary", params={"page": 1, "size": size}).json()
    assert len(d["items"]) == size and d["size"] == size


@pytest.mark.parametrize("bad", [{"page": 0}, {"page": 1, "size": 5}, {"page": 1, "size": 1000}, {"page": "x"}])
def test_bad_params(mgr, bad):
    r = mgr.get(f"{API}/admin/glossary", params=bad)
    assert r.status_code == 400, (bad, r.status_code, r.text[:200])


@pytest.mark.parametrize("q", ["audit", "लेखापरीक्षा", "संपरीक्षा"])
def test_search(mgr, q):
    d = mgr.get(f"{API}/admin/glossary", params={"q": q, "page": 1, "size": 200}).json()
    assert d["total"] > 0 and len(d["items"]) == min(200, d["total"])
    for it in d["items"]:
        assert q.lower() in it["en"].lower() or q in it["hi"] or any(q in v for v in it["accepted_variants"])


def test_flagged_filter(mgr):
    d = mgr.get(f"{API}/admin/glossary", params={"flagged": 1, "page": 1, "size": 200}).json()
    assert d["total"] < 11387
    for it in d["items"]:
        assert it["flags"] or it["override"] is not None


def test_legacy_array(mgr):
    r = mgr.get(f"{API}/admin/glossary", params={"q": "audit"})
    assert r.status_code == 200
    d = r.json()
    assert isinstance(d, list) and 0 < len(d) <= 100


def test_player_forbidden(player):
    assert player.get(f"{API}/admin/glossary", params={"page": 1}).status_code == 403
    assert player.get(f"{API}/admin/glossary").status_code == 403


def test_csv_spot_check(mgr):
    rows = list(csv.DictReader(open(CSV, encoding="utf-8")))
    random.seed(2026)
    misses = []
    for r in random.sample(rows, 25):
        en = r["Source term"].strip()
        d = mgr.get(f"{API}/admin/glossary", params={"q": en[:80], "page": 1, "size": 500}).json()
        hit = [x for x in d["items"] if x["en"].strip().lower() == en.lower()]
        if not hit:
            misses.append((en, "not found"))
            continue
        g = hit[0]
        forms = {norm(x) for x in [g["hi"], *g["accepted_variants"]]}
        t1 = norm(r["Target term 1"])
        others = split(r["Other target terms"])
        if t1 and t1 not in forms:
            misses.append((en, "t1", t1, g["hi"]))
        missing_o = [o for o in others if o not in forms]
        if missing_o:
            misses.append((en, "others", missing_o))
    assert not misses, misses


# CSV rows whose Target term 1 is "-" (above, account for, civil) should still be imported using the other target terms
@pytest.mark.parametrize("en,form", [("above", "के ऊपर"), ("account for", "हिसाब देना"), ("civil", "दीवानी")])
def test_dash_target_rows_imported(mgr, en, form):
    d = mgr.get(f"{API}/admin/glossary", params={"q": en, "page": 1, "size": 500}).json()
    hit = [x for x in d["items"] if x["en"].lower() == en]
    assert hit, f"{en} missing from glossary"
    assert any(form in [g["hi"], *g["accepted_variants"]] for g in hit), (en, hit)
