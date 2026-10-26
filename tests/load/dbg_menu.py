# Debug: glossary menu outside-click close + viewport size after fullscreen, per engine
# usage: dbg_menu.py <engine> <WxH> <email>
import asyncio, os, re, subprocess, sys, time
from playwright.async_api import async_playwright
BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
ENGINE, VP, EMAIL = sys.argv[1], sys.argv[2], sys.argv[3]
W, H = map(int, VP.split("x"))
MENU = "[role=menu][aria-label='Glossary options']"


async def main():
    code = "%06d" % (int(time.time() * 1000) % 1000000)
    subprocess.run(["/app/scripts/emergent/test-otp.sh", EMAIL, code], check=True, capture_output=True)
    async with async_playwright() as p:
        b = await getattr(p, ENGINE).launch()
        ctx = await b.new_context(viewport={"width": W, "height": H})
        page = await ctx.new_page()
        await page.goto(BASE + "/", wait_until="networkidle")
        await page.request.post(BASE + "/api/auth/otp/verify", data={"email": EMAIL, "code": code})
        await page.goto(BASE + "/play/trial", wait_until="networkidle")
        print("before start inner:", await page.evaluate("() => [innerWidth, innerHeight, screen.width, screen.height]"))
        await page.get_by_role("button", name=re.compile("Start Mission|Resume|Continue mission|Back to", re.I)).first.click(timeout=15000)
        await page.wait_for_url(re.compile(r"/round/"), timeout=20000)
        await page.wait_for_timeout(3000)
        print("after start inner/screen/fs:", await page.evaluate("() => [innerWidth, innerHeight, screen.width, screen.height, !!document.fullscreenElement]"))
        await page.evaluate("() => { window.__md = []; document.addEventListener('mousedown', e => window.__md.push([e.target.className && e.target.className.toString().slice(0,40), e.defaultPrevented]), false); }")
        for target in (sys.argv[4].split(",") if len(sys.argv) > 4 else ["editor", "heading", "mouse"]):
            t = page.locator(".hc-source-term").nth(int(os.environ.get("TERM_IX", "3")))
            await t.scroll_into_view_if_needed(); await t.click(); await page.wait_for_timeout(1000)
            print(target, "menu open:", await page.locator(MENU).count())
            if os.environ.get("SHOT"):
                await page.wait_for_timeout(500)
                await page.screenshot(path=f"/app/tests/load/shots2/dbg_menu_{ENGINE}.jpg", quality=40, type="jpeg")
                print("  after screenshot menu count:", await page.locator(MENU).count(), "fs:", await page.evaluate("() => !!document.fullscreenElement"))
            if target == "editor":
                await page.locator(".ProseMirror[contenteditable=true]").first.click()
            elif target == "heading":
                await page.locator("main, body").first.click(position={"x": 5, "y": H - 60})
            else:
                await page.mouse.click(W - 50, H - 120)
            await page.wait_for_timeout(int(os.environ.get("WAIT_MS", "800")))
            print("  after click", target, "menu count:", await page.locator(MENU).count(), "mousedowns:", await page.evaluate("() => window.__md.splice(0)"))
            for _ in range(2):
                bb = page.get_by_role("button", name="Back to the mission", exact=True)
                if await bb.count() and await bb.first.is_visible():
                    print("  fairplay modal!"); await bb.first.click(); await page.wait_for_timeout(500)
        await page.screenshot(path=f"/app/tests/load/shots2/dbg_{ENGINE}_{VP}.jpg", quality=40, type="jpeg")
        await b.close()

asyncio.run(main())
