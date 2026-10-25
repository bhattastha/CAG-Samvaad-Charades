# Hosting shim only: forwards /api (HTTP + websockets) to the Fastify API on 127.0.0.1:3000, unchanged.
import asyncio

import httpx
import websockets
from fastapi import FastAPI, Request, WebSocket
from starlette.responses import StreamingResponse

UPSTREAM = "127.0.0.1:3000"
HOP = {"host", "connection", "keep-alive", "transfer-encoding", "upgrade", "te", "trailer", "proxy-authorization", "proxy-connection"}

app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
client = httpx.AsyncClient(base_url=f"http://{UPSTREAM}", timeout=httpx.Timeout(120.0, connect=10.0))


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
