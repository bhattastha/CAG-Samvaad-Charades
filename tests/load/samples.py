# Summarise CPU/RSS + BHASHINI breaker samples from a result_<tag>.json
import json, re, sys
d = json.load(open(sys.argv[1]))
mx = {}
for s in d["samples"]:
    for line in s["ps"].splitlines():
        p = line.split()
        if len(p) >= 3:
            cpu, rss, comm = float(p[0]), int(p[1]) // 1024, p[2]
            o = mx.get(comm, (0, 0))
            mx[comm] = (max(o[0], cpu), max(o[1], rss))
    m = re.search(r"Cpu\(s\):\s*([\d.]+) us,\s*([\d.]+) sy.*?([\d.]+) id", s["top"])
    mem = re.search(r"MiB Mem :\s*([\d.]+) total,\s*([\d.]+) free,\s*([\d.]+) used", s["top"])
    h = s["health"] or ""
    hj = None
    try:
        hj = json.loads(h)
    except Exception:
        pass
    hs = ""
    if isinstance(hj, list):
        hs = " ".join(f"{x['task'][:5]}:{'OPEN' if x['open'] else 'ok'}/{x['recentFailures']}" for x in hj)
    elif isinstance(hj, dict):
        hl = hj.get("health") or hj.get("services") or hj
        hs = json.dumps(hl)[:300]
    else:
        hs = h[:300]
    print(s["t"], "cpu us/sy/id", m.groups() if m else "?", "mem used MiB", mem.group(3) if mem else "?", "|", hs)
print("max %cpu (ps lifetime avg) / RSS MiB per process:", mx)
