# Probe the edge rate limit: R requests/s to /api/health from this single IP for S seconds, report 429s + headers
import asyncio, os, sys, time
import httpx
BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
R, S = int(sys.argv[1]), int(sys.argv[2])


async def main():
    codes, first429 = {}, None
    per_sec = {}
    async with httpx.AsyncClient(base_url=BASE, timeout=20, limits=httpx.Limits(max_connections=100)) as c:
        async def one(sec):
            nonlocal first429
            r = await c.get("/api/health")
            codes[r.status_code] = codes.get(r.status_code, 0) + 1
            per_sec.setdefault(sec, []).append(r.status_code)
            if r.status_code == 429 and not first429:
                first429 = (dict(r.headers), r.text[:300])
        tasks = []
        t0 = time.time()
        for i in range(R * S):
            tasks.append(asyncio.create_task(one(int(i / R))))
            await asyncio.sleep(max(0, t0 + (i + 1) / R - time.time()))
        await asyncio.gather(*tasks)
    print(f"rate {R}/s for {S}s:", codes)
    print("429 per second:", {k: v.count(429) for k, v in sorted(per_sec.items()) if 429 in v})
    if first429:
        print("429 headers:", {k: v for k, v in first429[0].items() if k.lower() in ("server", "retry-after", "cf-ray", "x-ratelimit-limit", "x-ratelimit-remaining", "content-type", "via")})
        print("429 body:", first429[1])

asyncio.run(main())
