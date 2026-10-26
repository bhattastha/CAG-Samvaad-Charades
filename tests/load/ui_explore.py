# Exploration: dump buttons on journey / preround / round for one engine
import asyncio, os, subprocess, sys
from playwright.async_api import async_playwright
BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
EMAIL = sys.argv[1]
JS = "() => Array.from(document.querySelectorAll('button,a,[role=menuitem]')).map(b => (b.innerText||b.getAttribute('aria-label')||'').trim().replace(/\\s+/g,' ').slice(0,35)).filter(Boolean)"


async def main():
    subprocess.run(["/app/scripts/emergent/test-otp.sh", EMAIL, "112233"], check=True, capture_output=True)
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={"width": 1366, "height": 768})
        page = await ctx.new_page()
        page.on("console", lambda m: print("CONSOLE", m.type, m.text[:150]) if m.type in ("error", "warning") else None)
        r = await page.request.post(BASE + "/api/auth/otp/verify", data={"email": EMAIL, "code": "112233"})
        print("verify", r.status)
        for path in ["/journey", "/play/trial"]:
            await page.goto(BASE + path)
            await page.wait_for_timeout(3000)
            print(path, "->", page.url, await page.evaluate(JS))
        await page.screenshot(path="/tmp/preround.jpg", quality=40, type="jpeg")
        await b.close()

asyncio.run(main())
