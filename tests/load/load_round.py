# Load test: N concurrent virtual players play a realistic Trial round loop against the public URL.
# usage: python3 load_round.py <first_idx> <n_players> <duration_s> <tag>
import asyncio, json, os, random, string, subprocess, sys, time, uuid
from collections import defaultdict
import httpx

BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
HERE = os.path.dirname(__file__)
COOKIES = json.load(open(os.path.join(HERE, "cookies.json")))
FIRST, N, DUR, TAG = int(sys.argv[1]), int(sys.argv[2]), int(sys.argv[3]), sys.argv[4]
ROUND = sys.argv[5] if len(sys.argv) > 5 else "trial"
SUBMIT_AT = 0.0
MANAGER = "bhattastha.dibd@gmail.com"

WORDS = ("sarkar lekha pariksha vibhag rajya kendra niyantrak mahalekhakar anuvaad prativedan vitt varsh bajat "
         "vyay aay rashi karya yojana samiti adhiniyam niyam lekhapariksha anupalan vishleshan sudhar suchna "
         "praman patra vivaran dastavez samay seema adhikari karmchari sachiv mantralay nideshak upkram nigam "
         "parishad nagar palika gram panchayat vikas shiksha swasthya krishi sinchai urja parivahan sadak bhavan "
         "nirman anubandh thekedar bhugtan vasuli hani labh pariyojana lagat anuman vilamb jurmana dand vyavastha "
         "aantarik niyantran jokhim prabandhan nidhi kosh rajkosh pravishti sankhya pratishat aankde tulna "
         "sanshodhan pratikriya uttar prashn sujhav sifarish nishkarsh adhyay khand anuchhed paragraph tippani "
         "abhilekh suchi parishisht saransh bhumika uddeshya kshetra paddhati namuna chayan avadhi tithi maah").split()
STATS = defaultdict(list)          # endpoint -> [(status, ms)]
XLIT_ERR = defaultdict(int)        # xlit soft errors (BHASHINI fallback) by message
BREAKER = []


async def call(c, name, method, url, **kw):
    t = time.perf_counter()
    try:
        r = await c.request(method, url, **kw)
        STATS[name].append((r.status_code, (time.perf_counter() - t) * 1000))
        return r
    except Exception as e:
        STATS[name].append((f"EXC:{type(e).__name__}", (time.perf_counter() - t) * 1000))
        return None


def hindi_text(n):
    letters = "कखगघचछजझटठडढतथदधनपफबभमयरलवशसह"
    return " ".join("".join(random.choice(letters) for _ in range(random.randint(2, 6))) + "ा" for _ in range(n))


async def player(email, start_delay):
    await asyncio.sleep(start_delay)
    c = httpx.AsyncClient(base_url=BASE, timeout=30, cookies={"hc_session": COOKIES[email]}, http2=False)
    cid = uuid.uuid4().hex
    res = {"email": email}
    try:
        # journey
        await call(c, "GET /me/progress", "GET", "/api/me/progress")
        await call(c, "GET /config", "GET", "/api/config")
        await call(c, "GET /sahayika/lines", "GET", "/api/sahayika/lines", params={"section": "journey"})
        await call(c, "GET /leaderboard", "GET", "/api/leaderboard")
        await call(c, "GET /rounds/:k/intro", "GET", f"/api/rounds/{ROUND}/intro")
        r = await call(c, "POST /rounds/:k/attempts", "POST", f"/api/rounds/{ROUND}/attempts", json={"clientId": cid})
        if not r or r.status_code != 200:
            res["error"] = f"start {r.status_code if r else 'exc'} {r.text[:120] if r else ''}"
            return res
        view = r.json()
        aid = view["id"]
        res["attempt"] = aid
        r = await call(c, "GET /attempts/:id", "GET", f"/api/attempts/{aid}", params={"clientId": cid})
        answers = r.json()["answers"] if r and r.status_code == 200 else view["answers"]
        version = view["version"]
        await call(c, "GET /glossary", "GET", "/api/glossary", params={"q": random.choice(["audit", "budget", "grant", "expenditure"])})
        # play loop
        t_end = time.time() + DUR
        next_save = time.time() + 10
        chats = 0
        ttsd = 0
        parts = list(answers.keys())
        while time.time() < t_end:
            await asyncio.sleep(random.uniform(2, 3))
            w = random.choice(WORDS)
            if random.random() < 0.3:
                w = w[: random.randint(2, len(w))]  # partial word while typing
            r = await call(c, "GET /xlit", "GET", "/api/xlit", params={"word": w})
            if r is not None and r.status_code == 200:
                j = r.json()
                if j.get("error"):
                    XLIT_ERR[j["error"][:60]] += 1
                if j.get("suggestions") and random.random() < 0.5:
                    await call(c, "POST /attempts/:id/events", "POST", f"/api/attempts/{aid}/events", json={"type": "xlit_accept", "meta": {"index": 0}})
            # type into a field
            if parts:
                p = random.choice(parts)
                for k in answers[p]["fields"]:
                    answers[p]["fields"][k] = (answers[p]["fields"][k] + " " + hindi_text(2)).strip()[-2000:]
                    break
            if time.time() >= next_save:
                next_save = time.time() + 10
                version += 1
                r = await call(c, "PUT /attempts/:id/autosave", "PUT", f"/api/attempts/{aid}/autosave", json={"version": version, "clientId": cid, "answers": answers})
                if r is not None and r.status_code == 409:
                    res.setdefault("autosave409", []).append(r.text[:80])
                await call(c, "GET /attempts/:id/clock", "GET", f"/api/attempts/{aid}/clock")
            if chats < 2 and random.random() < 0.03:
                chats += 1
                await call(c, "POST /sahayika/chat", "POST", "/api/sahayika/chat", json={"attemptId": aid, "quick": random.choice(["hint", "time", "glossary"])})
            if ttsd < 1 and random.random() < 0.02:
                ttsd += 1
                txt = random.choice(["Well done, keep going.", "Remember to use the glossary terms.", "You have time left, check your figures."])
                await call(c, "POST /sahayika/tts", "POST", "/api/sahayika/tts", json={"text": txt})
        for p in parts:
            answers[p]["done"] = True
        if SUBMIT_AT:
            await asyncio.sleep(max(0, SUBMIT_AT - time.time()))  # everyone submits at the same instant
        res["submit_at"] = time.time()
        r = await call(c, "POST /attempts/:id/submit", "POST", f"/api/attempts/{aid}/submit", json={"version": version + 1, "clientId": cid, "answers": answers})
        res["score"] = r.json().get("score") if r is not None and r.status_code == 200 else f"ERR {r.status_code if r else 'exc'} {r.text[:100] if r else ''}"
        await call(c, "GET /attempts/:id/report", "GET", f"/api/attempts/{aid}/report")
        await call(c, "GET /me/progress", "GET", "/api/me/progress")
    except Exception as e:
        res["error"] = repr(e)
    finally:
        await c.aclose()
    return res


async def monitor(stop, mgr_cookie):
    samples = []
    async with httpx.AsyncClient(base_url=BASE, timeout=30, cookies={"hc_session": mgr_cookie} if mgr_cookie else None) as c:
        while not stop.is_set():
            ps = (await asyncio.to_thread(subprocess.run, "top -b -n2 -d1 -w 200 | awk '/^top -/{b++} b==2' | grep -E 'node|postgres|uvicorn' | awk '{c[$12]+=$9; m[$12]+=$6} END{for(k in c) printf \"%.1f %d %s\\n\", c[k], m[k], k}'", shell=True, capture_output=True, text=True)).stdout
            cpu = (await asyncio.to_thread(subprocess.run, "top -b -n2 -d1 | grep -E '^(%Cpu|MiB Mem)' | tail -2", shell=True, capture_output=True, text=True)).stdout
            h = None
            if mgr_cookie:
                r = await call(c, "GET /admin/config/services (mgr)", "GET", "/api/admin/config/services")
                if r is not None and r.status_code == 200:
                    h = json.dumps(r.json().get("health"))
            samples.append({"t": time.strftime("%H:%M:%S"), "ps": ps, "top": cpu, "health": h})
            try:
                await asyncio.wait_for(stop.wait(), 15)
            except asyncio.TimeoutError:
                pass
    return samples


def mgr_login():
    code = f"{random.randint(0, 999999):06d}"
    subprocess.run(["/app/scripts/emergent/test-otp.sh", MANAGER, code], check=True, capture_output=True)
    r = httpx.post(BASE + "/api/auth/otp/verify", json={"email": MANAGER, "code": code}, timeout=30)
    return r.cookies.get("hc_session")


def pct(xs, p):
    return xs[min(len(xs) - 1, int(round(p * (len(xs) - 1))))]


async def main():
    mgr = mgr_login()
    emails = [f"qa.load{i:02d}@gmail.com" for i in range(FIRST, FIRST + N)]
    stop = asyncio.Event()
    mon = asyncio.create_task(monitor(stop, mgr))
    t0 = time.time()
    global SUBMIT_AT
    if os.environ.get("SYNC_SUBMIT"):
        SUBMIT_AT = t0 + 5 + DUR + 4
    # players arrive within ~5 s, like a live session start
    results = await asyncio.gather(*[player(e, random.uniform(0, 5)) for e in emails])
    stop.set()
    samples = await mon
    wall = time.time() - t0
    out = {"tag": TAG, "players": N, "duration_s": DUR, "wall_s": round(wall), "endpoints": {}, "results": results,
           "xlit_soft_errors": dict(XLIT_ERR), "samples": samples}
    print(f"=== {TAG}: {N} players, {DUR}s loop, wall {wall:.0f}s ===")
    print(f"{'endpoint':38s} {'n':>5s} {'p50':>7s} {'p95':>7s} {'max':>7s} err  codes")
    tot = errs = 0
    for k, v in sorted(STATS.items()):
        ms = sorted(x[1] for x in v)
        bad = [x[0] for x in v if x[0] != 200]
        tot += len(v); errs += len(bad)
        codes = {str(b): bad.count(b) for b in set(bad)}
        out["endpoints"][k] = {"n": len(v), "p50": round(pct(ms, .5)), "p95": round(pct(ms, .95)), "max": round(ms[-1]), "errors": codes}
        print(f"{k:38s} {len(v):5d} {pct(ms,.5):7.0f} {pct(ms,.95):7.0f} {ms[-1]:7.0f} {len(bad):3d}  {codes}")
    print(f"TOTAL requests {tot}, non-200 {errs} ({100*errs/max(tot,1):.2f}%), rps {tot/wall:.1f}")
    print("xlit soft errors:", dict(XLIT_ERR))
    for r in results:
        print(r.get("email"), "score", r.get("score"), r.get("error", ""), r.get("autosave409", ""))
    sub = [r["submit_at"] for r in results if "submit_at" in r]
    if sub:
        print(f"submit spread {max(sub)-min(sub):.2f}s over {len(sub)} players")
    json.dump(out, open(os.path.join(HERE, f"result_{TAG}.json"), "w"), indent=1, ensure_ascii=False, default=str)


asyncio.run(main())
