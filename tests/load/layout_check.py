# Layout check: /register at 360/390 (form card right edge) and /journey header at 768 (user menu right edge), all engines
import asyncio, os, subprocess, sys, time
from playwright.async_api import async_playwright
BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
EMAIL = sys.argv[1]
JS = """() => { const out = []; for (const el of document.querySelectorAll('h1, input, button, a, img')) { const r = el.getBoundingClientRect();
  if (r.width > 2 && r.right > innerWidth + 2 && !el.closest('[role=toolbar]')) out.push((el.innerText || el.getAttribute('aria-label') || el.placeholder || el.tagName).trim().slice(0, 25) + '@' + Math.round(r.right)); }
  return {iw: innerWidth, sw: document.documentElement.scrollWidth, bodyOverflowX: getComputedStyle(document.body).overflowX, out: out.slice(0, 8)}; }"""


async def main():
    async with async_playwright() as p:
        for eng in ["chromium", "firefox", "webkit"]:
            b = await getattr(p, eng).launch()
            for w, h in [(360, 740), (390, 844)]:
                ctx = await b.new_context(viewport={"width": w, "height": h}, is_mobile=eng != "firefox", has_touch=True)
                page = await ctx.new_page()
                await page.goto(BASE + "/register", wait_until="networkidle"); await page.wait_for_timeout(3000)
                print(eng, f"{w}x{h}", "/register", await page.evaluate(JS))
                await page.screenshot(path=f"/app/tests/load/shots2/layout_{eng}_{w}_register.jpg", quality=40, type="jpeg")
                await ctx.close()
            for w, h in [(768, 1024), (820, 1180), (1024, 768)]:
                code = "%06d" % (int(time.time() * 1000) % 1000000)
                subprocess.run(["/app/scripts/emergent/test-otp.sh", EMAIL, code], check=True, capture_output=True)
                ctx = await b.new_context(viewport={"width": w, "height": h})
                page = await ctx.new_page()
                await page.goto(BASE + "/", wait_until="networkidle")
                await page.request.post(BASE + "/api/auth/otp/verify", data={"email": EMAIL, "code": code})
                await page.goto(BASE + "/journey", wait_until="networkidle"); await page.wait_for_timeout(1500)
                print(eng, f"{w}x{h}", "/journey", await page.evaluate(JS))
                await page.screenshot(path=f"/app/tests/load/shots2/layout_{eng}_{w}_journey.jpg", quality=40, type="jpeg")
                await ctx.close()
            await b.close()

asyncio.run(main())
