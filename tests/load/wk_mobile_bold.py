# WebKit mobile: toolbar Bold with a real DOM selection (Ctrl+A is not a mobile gesture); then submit
import asyncio, os, re, subprocess, sys, time
from playwright.async_api import async_playwright
BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
EMAIL, VP = sys.argv[1], sys.argv[2]
W, H = map(int, VP.split("x"))


async def main():
    code = "%06d" % (int(time.time() * 1000) % 1000000)
    subprocess.run(["/app/scripts/emergent/test-otp.sh", EMAIL, code], check=True, capture_output=True)
    async with async_playwright() as p:
        b = await p.webkit.launch()
        ctx = await b.new_context(viewport={"width": W, "height": H}, is_mobile=True, has_touch=True)
        page = await ctx.new_page()
        await page.goto(BASE + "/", wait_until="networkidle")
        await page.request.post(BASE + "/api/auth/otp/verify", data={"email": EMAIL, "code": code})
        await page.goto(BASE + "/play/trial", wait_until="networkidle")
        await page.get_by_role("button", name=re.compile("^(Start Mission|Resume)", re.I)).first.click(timeout=15000)
        await page.wait_for_url(re.compile(r"/round/"), timeout=20000); await page.wait_for_timeout(2500)
        ed = page.locator(".ProseMirror[contenteditable=true]").first
        await ed.click(); await page.keyboard.type("sarkar vibhag ", delay=120); await page.wait_for_timeout(1500)
        for how in ["ctrl+a", "dom-range"]:
            if how == "ctrl+a":
                await page.keyboard.press("Control+a")
            else:
                await page.evaluate("() => { const e = document.querySelector('.ProseMirror p'); const r = document.createRange(); r.selectNodeContents(e); const s = getSelection(); s.removeAllRanges(); s.addRange(r); document.dispatchEvent(new Event('selectionchange')); }")
            await page.wait_for_timeout(400)
            sel = await page.evaluate("() => String(getSelection())")
            bold = page.get_by_role("toolbar").first.get_by_role("button", name="Bold", exact=True)
            await bold.tap() if how == "dom-range" else await bold.click()
            await page.wait_for_timeout(500)
            html = await ed.inner_html()
            print(how, "sel=", repr(sel[:30]), "bold=", "<strong" in html, html[:80])
        await page.screenshot(path=f"/app/tests/load/shots2/webkit_{VP}_bold_domrange.jpg", quality=40, type="jpeg")
        await page.wait_for_timeout(2000)
        await page.get_by_role("button", name=re.compile("Submit", re.I)).first.click()
        await page.wait_for_timeout(800)
        a = page.get_by_role("button", name=re.compile("Submit anyway", re.I))
        if await a.count(): await a.first.click()
        await page.wait_for_url(re.compile(r"/report/"), timeout=25000)
        print("submitted")
        await b.close()

asyncio.run(main())
