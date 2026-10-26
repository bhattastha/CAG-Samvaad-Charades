# Probe: why /register form is wider than 360px viewport - list form ancestors/children widths and min-content
import asyncio, os
from playwright.async_api import async_playwright
BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(viewport={"width": 360, "height": 740}, is_mobile=True, has_touch=True)
        await pg.goto(BASE + "/register", wait_until="networkidle"); await pg.wait_for_timeout(1500)
        print(await pg.evaluate("""() => { const f = document.querySelector('form'); const out = [];
          let e = f; while (e && e !== document.body) { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e);
            out.push(['ANC', e.tagName, (e.className||'').toString().slice(0,90), Math.round(r.width), cs.display, cs.gridTemplateColumns, cs.minWidth]); e = e.parentElement; }
          for (const c of f.querySelectorAll('*')) { const r = c.getBoundingClientRect(); if (r.right > 361 && c.children.length < 4) out.push(['CH', c.tagName, (c.className||'').toString().slice(0,70), Math.round(r.width), c.scrollWidth, (c.innerText||'').slice(0,30)]); }
          return out.slice(0, 40); }"""))
        await b.close()
asyncio.run(main())
