# Hosting shim only: forwards /api (HTTP + websockets) to the Fastify API on 127.0.0.1:3000, unchanged.
# On Emergent's published hosting (no monorepo checkout) it also starts the bundled API from ./hc with the bundled Node runtime.
import asyncio
import fcntl
import logging
import os
import socket
import subprocess
from urllib.parse import urlparse

import httpx
import websockets
from fastapi import FastAPI, Request, WebSocket
from starlette.responses import JSONResponse, StreamingResponse

UPSTREAM = "127.0.0.1:3000"
HOP = {"host", "connection", "keep-alive", "transfer-encoding", "upgrade", "te", "trailer", "proxy-authorization", "proxy-connection"}
HERE = os.path.dirname(os.path.abspath(__file__))
HC = os.path.join(HERE, "hc")
log = logging.getLogger("hc-shim")


def _open(host: str, port: int) -> bool:
    try:
        with socket.create_connection((host, port), timeout=1.5):
            return True
    except OSError:
        return False


def _dotenv() -> dict:
    out = {}
    p = os.path.join(HERE, ".env")
    if os.path.exists(p):
        for line in open(p, encoding="utf-8"):
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                out[k.strip()] = v.strip().strip('"').strip("'")
    return out


def _start_bundled_api():
    """Published mode only: preview runs the API from the monorepo via supervisor (scripts/emergent/start.sh)."""
    if os.path.isdir("/app/apps/api/node_modules") or not os.path.exists(os.path.join(HC, "api.mjs")):
        return
    lock = open("/tmp/hc-api.lock", "w")
    try:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except OSError:
        return  # another worker owns the API process
    if _open("127.0.0.1", 3000):
        return
    import nodejs_wheel
    node = os.path.join(os.path.dirname(nodejs_wheel.__file__), "bin", "node")
    env = {**_dotenv(), **os.environ}
    db = urlparse(env.get("DATABASE_URL", ""))
    if not env.get("DATABASE_URL") or (db.hostname in ("127.0.0.1", "localhost") and not _open(db.hostname, db.port or 5432)):
        data = os.path.join(HERE, ".data", "pglite")
        os.makedirs(data, exist_ok=True)
        env["DATABASE_URL"] = f"pglite:{data}"
        log.warning("DATABASE_URL is not reachable: using embedded PGlite at %s. Data will NOT survive a redeploy or pod restart. Set DATABASE_URL to an external PostgreSQL.", data)
    env.update({"HC_ROOT": HC, "HOST": "127.0.0.1", "PORT": "3000", "WEB_DIST": os.path.join(HC, "no-web"), "SEED_PUBLISH_SAMPLES": env.get("SEED_PUBLISH_SAMPLES", "1")})
    app.state.api_cmd = ([node, os.path.join(HC, "api.mjs")], env)
    app.state.api_proc = subprocess.Popen(app.state.api_cmd[0], cwd=HC, env=env)
    app.state.api_lock = lock


async def _watch_api():
    """Restarts the bundled API if it exits (published mode only)."""
    while True:
        await asyncio.sleep(5)
        proc = getattr(app.state, "api_proc", None)
        if proc and proc.poll() is not None:
            log.error("bundled API exited with code %s; restarting", proc.returncode)
            cmd, env = app.state.api_cmd
            app.state.api_proc = subprocess.Popen(cmd, cwd=HC, env=env)


app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
client = httpx.AsyncClient(base_url=f"http://{UPSTREAM}", timeout=httpx.Timeout(120.0, connect=10.0))


@app.on_event("startup")
async def _startup():
    _start_bundled_api()
    if getattr(app.state, "api_proc", None):
        app.state.api_watch = asyncio.create_task(_watch_api())


@app.on_event("shutdown")
async def _shutdown():
    proc = getattr(app.state, "api_proc", None)
    if proc and proc.poll() is None:
        proc.terminate()


@app.get("/api/health")
async def health():
    try:
        r = await client.get("/api/health", timeout=5.0)
        return JSONResponse(r.json(), status_code=r.status_code)
    except (httpx.HTTPError, ValueError):
        proc = getattr(app.state, "api_proc", None)
        if proc and proc.poll() is not None:
            return JSONResponse({"ok": False, "api": "down"}, status_code=503)
        # the API is still seeding on first boot; the shim itself is healthy
        return JSONResponse({"ok": True, "api": "starting"}, status_code=200)


@app.api_route("/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"])
async def proxy(path: str, request: Request):
    headers = [(k, v) for k, v in request.headers.items() if k.lower() not in HOP]
    headers.append(("x-forwarded-host", request.headers.get("host", "")))
    req = client.build_request(request.method, "/" + path, params=request.query_params.multi_items(),
                               headers=headers, content=request.stream())
    try:
        up = await client.send(req, stream=True)
    except httpx.ConnectError:
        return StreamingResponse(iter([b'{"error":"api_starting"}']), status_code=503, media_type="application/json")
    out = [(k, v) for k, v in up.headers.multi_items() if k.lower() not in HOP | {"content-length"}]
    resp = StreamingResponse(up.aiter_raw(), status_code=up.status_code, background=None)
    resp.raw_headers = [(k.encode("latin-1"), v.encode("latin-1")) for k, v in out]
    resp.background = None
    async def close():
        await up.aclose()
    from starlette.background import BackgroundTask
    resp.background = BackgroundTask(close)
    return resp


@app.websocket("/{path:path}")
async def ws_proxy(ws: WebSocket, path: str):
    qs = ws.url.query
    url = f"ws://{UPSTREAM}/{path}" + (f"?{qs}" if qs else "")
    fwd = {k: v for k, v in ws.headers.items() if k.lower() in ("cookie", "origin", "user-agent")}
    await ws.accept()
    try:
        async with websockets.connect(url, additional_headers=fwd, max_size=None) as up:
            async def c2u():
                while True:
                    m = await ws.receive()
                    if m["type"] == "websocket.disconnect":
                        await up.close()
                        return
                    await up.send(m["bytes"] if m.get("bytes") is not None else m.get("text", ""))

            async def u2c():
                async for m in up:
                    await (ws.send_bytes(m) if isinstance(m, bytes) else ws.send_text(m))
                await ws.close()

            await asyncio.gather(c2u(), u2c())
    except Exception:
        try:
            await ws.close()
        except Exception:
            pass
