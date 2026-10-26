# Fix 1 check: Chromium, Start Mission -> real fullscreen + navigator.keyboard.lock(['Escape']); Escape in editor / glossary menu must not
# trigger the fair-play "left the mission page" modal. Control: keyboard.unlock() then Escape -> fullscreen exits -> modal expected.
# usage: fix1_escape.py <email>
import asyncio, json, os, re, subprocess, sys, time
from playwright.async_api import async_playwright
BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
EMAIL = sys.argv[1]
ENGINE = sys.argv[2] if len(sys.argv) > 2 else "chromium"
D = "/app/tests/load/shots2"
os.makedirs(D, exist_ok=True)
MENU = "[role=menu][aria-label='Glossary options']"


async def state(page):
    return await page.evaluate("() => ({fs: !!document.fullscreenElement, kb: !!(navigator.keyboard && navigator.keyboard.lock)})")


async def modal(page):
    b = page.get_by_role("button", name="Back to the mission", exact=True)
    return bool(await b.count() and await b.first.is_visible())


async def main():
    code = "%06d" % (int(time.time() * 1000) % 1000000)
    subprocess.run(["/app/scripts/emergent/test-otp.sh", EMAIL, code], check=True, capture_output=True)
    async with async_playwright() as p:
        b = await getattr(p, ENGINE).launch()
        ctx = await b.new_context(viewport={"width": 1366, "height": 768})
        page = await ctx.new_page()
        # record keyboard.lock calls (pass-through) to prove enterFullscreen requested the Escape lock
        await page.add_init_script("""(() => { const k = navigator.keyboard; if (!k) return; const orig = k.lock.bind(k); window.__locks = [];
          k.lock = (keys) => orig(keys).then(() => { window.__locks.push(['ok', keys]); }, (e) => { window.__locks.push(['err', keys, String(e)]); throw e; }); })()""")
        try:
            await page.goto(BASE + "/", wait_until="networkidle")
            r = await page.request.post(BASE + "/api/auth/otp/verify", data={"email": EMAIL, "code": code})
            print("otp_verify", r.status)
            await page.goto(BASE + "/play/trial", wait_until="networkidle")
            await page.get_by_role("button", name="Start Mission").click(timeout=15000)
            await page.wait_for_url(re.compile(r"/round/"), timeout=20000)
            await page.wait_for_timeout(3000)
            print("after start:", await state(page), "modal:", await modal(page), "lock calls:", await page.evaluate("() => window.__locks"))
            # 1) Escape with glossary menu open
            t = page.locator(".hc-source-term").first
            await t.scroll_into_view_if_needed(); await t.click(); await page.wait_for_timeout(1200)
            print("menu open:", await page.locator(MENU).count())
            await page.keyboard.press("Escape"); await page.wait_for_timeout(2500)
            print("ESC in glossary menu -> menu closed:", await page.locator(MENU).count() == 0, await state(page), "modal:", await modal(page))
            await page.screenshot(path=f"{D}/fix1_{ENGINE}_after_esc_menu.jpg", quality=40, type="jpeg")
            b2 = page.get_by_role("button", name="Back to the mission", exact=True)
            if await b2.count() and await b2.first.is_visible():
                await b2.first.click(); await page.wait_for_timeout(1500); print("  clicked Back to the mission ->", await state(page))
            # 2) Escape inside the editor with xlit suggestions open
            ed = page.locator(".ProseMirror[contenteditable=true]").first
            await ed.click(); await page.keyboard.type("sarkar", delay=100); await page.wait_for_timeout(1500)
            n_opt = await page.locator("[role=option]").count()
            await page.keyboard.press("Escape"); await page.wait_for_timeout(2500)
            print(f"ESC in editor (suggestions before={n_opt}, after={await page.locator('[role=option]').count()}):", await state(page), "modal:", await modal(page))
            b2 = page.get_by_role("button", name="Back to the mission", exact=True)
            if await b2.count() and await b2.first.is_visible():
                await b2.first.click(); await page.wait_for_timeout(1500); print("  clicked Back to the mission ->", await state(page))
            # 3) control: unlock keyboard, Escape should now exit fullscreen in this headless build
            await page.evaluate("() => navigator.keyboard && navigator.keyboard.unlock()")
            await ed.click(); await page.keyboard.press("Escape"); await page.wait_for_timeout(2500)
            m = await modal(page)
            print("CONTROL unlock+ESC:", await state(page), "modal:", m)
            await page.screenshot(path=f"{D}/fix1_{ENGINE}_control.jpg", quality=40, type="jpeg")
            if m:
                await page.get_by_role("button", name="Back to the mission", exact=True).click(); await page.wait_for_timeout(1500)
                print("after Back to the mission:", await state(page), "modal:", await modal(page))
            # submit so the attempt is not left active
            await page.wait_for_timeout(2000)
            await page.get_by_role("button", name=re.compile("Submit Translation", re.I)).first.click()
            await page.wait_for_timeout(800)
            a = page.get_by_role("button", name=re.compile("Submit anyway", re.I))
            if await a.count(): await a.first.click()
            await page.wait_for_url(re.compile(r"/report/"), timeout=25000)
            prof = await (await page.request.get(BASE + "/api/me/profile")).json()
            print("submitted:", prof["history"][0]["status"], prof["history"][0]["score"])
        except Exception as e:
            print("EXCEPTION", str(e).splitlines()[0][:200])
        await b.close()

asyncio.run(main())
