# Cross-browser setup: plant OTPs, verify, register qa.xb01..15@gmail.com (one per browser/viewport combo)
import asyncio, os, subprocess, random
import httpx

BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
emails = [f"qa.xb{i:02d}@gmail.com" for i in range(1, 16)]


async def login(email, code, office):
    async with httpx.AsyncClient(base_url=BASE, timeout=30) as c:
        r = await c.post("/api/auth/otp/verify", json={"email": email, "code": code})
        if r.status_code != 200:
            return email, r.status_code, r.text[:200]
        st = r.json()["status"]
        if st == "new":
            n = int(email[5:7])
            r2 = await c.post("/api/players/register", json={
                "name": f"QA Cross Browser {n:02d}", "mobile": f"97{n:08d}", "officeId": office["id"],
                "officeAddress": "Indraprastha Estate, New Delhi 110002"})
            if r2.status_code != 200:
                return email, r2.status_code, r2.text[:200]
        p = await c.get("/api/me/progress")
        return email, st, p.json().get("registered")


async def main():
    async with httpx.AsyncClient(base_url=BASE, timeout=30) as c:
        office = (await c.get("/api/offices", params={"q": "delhi"})).json()[0]
    codes = {e: f"{random.randint(0, 999999):06d}" for e in emails}
    for e in emails:
        subprocess.run(["/app/scripts/emergent/test-otp.sh", e, codes[e]], check=True, capture_output=True)
    for res in await asyncio.gather(*[login(e, codes[e], office) for e in emails]):
        print(*res)

asyncio.run(main())
