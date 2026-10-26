# Load-test setup: plant OTPs, verify (burst), register qa.load01..25 and save cookies to cookies.json
import asyncio, json, os, subprocess, sys, time, random
import httpx

BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
N = int(sys.argv[1]) if len(sys.argv) > 1 else 25
OUT = os.path.join(os.path.dirname(__file__), "cookies.json")
emails = [f"qa.load{i:02d}@gmail.com" for i in range(1, N + 1)]


def plant(email, code):
    subprocess.run(["/app/scripts/emergent/test-otp.sh", email, code], check=True, capture_output=True)


async def login(email, code, office, lat):
    async with httpx.AsyncClient(base_url=BASE, timeout=30) as c:
        t = time.perf_counter()
        r = await c.post("/api/auth/otp/verify", json={"email": email, "code": code})
        lat.append(("otp_verify", r.status_code, (time.perf_counter() - t) * 1000))
        if r.status_code != 200:
            return email, None, r.status_code, r.text[:200]
        st = r.json()["status"]
        if st == "new":
            t = time.perf_counter()
            n = int(email[7:9])
            r2 = await c.post("/api/players/register", json={
                "name": f"QA Load {n:02d}", "mobile": f"98{n:08d}", "officeId": office["id"],
                "officeAddress": "Indraprastha Estate, New Delhi 110002"})
            lat.append(("register", r2.status_code, (time.perf_counter() - t) * 1000))
            if r2.status_code != 200:
                return email, None, r2.status_code, r2.text[:200]
        cookie = c.cookies.get("hc_session")
        p = await c.get("/api/me/progress")
        return email, cookie, st, p.json().get("registered")


async def main():
    async with httpx.AsyncClient(base_url=BASE, timeout=30) as c:
        offices = (await c.get("/api/offices", params={"q": "delhi"})).json()
    office = offices[0]
    print("office:", office["id"], office.get("nameEn"))
    codes = {e: f"{random.randint(0, 999999):06d}" for e in emails}
    for e in emails:
        plant(e, codes[e])
    lat = []
    t0 = time.perf_counter()
    res = await asyncio.gather(*[login(e, codes[e], office, lat) for e in emails])
    wall = (time.perf_counter() - t0) * 1000
    cookies = {}
    for e, ck, st, reg in res:
        print(e, "OK" if ck else "FAIL", st, reg)
        if ck:
            cookies[e] = ck
    json.dump(cookies, open(OUT, "w"), indent=1)
    for name in ("otp_verify", "register"):
        xs = sorted(l for n, s, l in lat if n == name)
        errs = [s for n, s, l in lat if n == name and s != 200]
        if xs:
            print(f"{name}: n={len(xs)} p50={xs[len(xs)//2]:.0f}ms p95={xs[int(len(xs)*.95)-1]:.0f}ms max={xs[-1]:.0f}ms errors={errs}")
    print(f"burst wall time {wall:.0f}ms, cookies saved {len(cookies)}/{N}")


asyncio.run(main())
