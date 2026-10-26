# Iteration 8 retest (one Trial round per run): GlossMenu outside-click x5 during timer, Arrow+Enter pick, Escape close (Chromium);
# Esc fullscreen exit must not count in Firefox/WebKit; tab-hidden + window blur must still count in all engines; submit.
# usage: fix8_round.py <engine> <email>
import asyncio, json, os, random, re, subprocess, sys, time
from playwright.async_api import async_playwright
BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
ENGINE, EMAIL = sys.argv[1], sys.argv[2]
D = "/app/tests/load/shots3"; os.makedirs(D, exist_ok=True)
MENU = "[role=menu][aria-label='Glossary options']"
R = {"engine": ENGINE, "email": EMAIL}
events = []


def log(k, v):
    R[k] = v; print(f"[{ENGINE}] {k}: {v}", flush=True)


async def st(page):
    return await page.evaluate("() => ({fs: !!(document.fullscreenElement || document.webkitFullscreenElement), kb: !!(navigator.keyboard && navigator.keyboard.lock)})")


async def modal(page):
    b = page.get_by_role("button", name="Back to the mission", exact=True)
    return bool(await b.count() and await b.first.is_visible())


async def back(page):
    if await modal(page):
        await page.get_by_role("button", name="Back to the mission", exact=True).first.click(); await page.wait_for_timeout(1200)
        return True
    return False


async def menu_open(page):
    return bool(await page.locator(MENU).count() and await page.locator(MENU).first.is_visible())


async def open_menu(page, idx):
    terms = page.locator(".hc-source-term")
    n = await terms.count()
    vis = [i for i in range(min(n, 30)) if await terms.nth(i).is_visible()]
    t = terms.nth(vis[idx % len(vis)])
    await t.scroll_into_view_if_needed(); await t.click(); await page.wait_for_timeout(700)
    return await menu_open(page)


async def main():
    code = "%06d" % random.randint(0, 999999)
    subprocess.run(["/app/scripts/emergent/test-otp.sh", EMAIL, code], check=True, capture_output=True)
    async with async_playwright() as p:
        b = await getattr(p, ENGINE).launch()
        ctx = await b.new_context(viewport={"width": 1366, "height": 768})
        page = await ctx.new_page()
        async def on_resp(r):
            if "/events" in r.url and r.request.method == "POST":
                try:
                    events.append([json.loads(r.request.post_data or "{}").get("type"), (await r.json()).get("leftPageCount")])
                except Exception as e:
                    events.append(["?", str(e)[:60]])
        page.on("response", lambda r: asyncio.ensure_future(on_resp(r)))
        errs = []
        page.on("pageerror", lambda e: errs.append(str(e)[:150]))
        try:
            await page.goto(BASE + "/", wait_until="networkidle")
            r = await page.request.post(BASE + "/api/auth/otp/verify", data={"email": EMAIL, "code": code})
            assert r.status == 200, r.status
            await page.goto(BASE + "/play/trial", wait_until="networkidle")
            await page.get_by_role("button", name=re.compile("^(Start Mission|Resume)", re.I)).first.click(timeout=15000)
            await page.wait_for_url(re.compile(r"/round/"), timeout=20000)
            await page.wait_for_timeout(3000)
            log("after_start", await st(page)); await back(page)
            ed = page.locator(".ProseMirror[contenteditable=true]").first
            # A) outside click x5 while the timer runs (random delay so clicks land at different points of the 1 s tick)
            res = []
            for i in range(5):
                o = await open_menu(page, i)
                await page.wait_for_timeout(random.randint(50, 1100))
                await ed.click(position={"x": 30 + 40 * i, "y": 20})
                await page.wait_for_timeout(400)
                res.append([o, not await menu_open(page)])
            log("outside_click_open_then_closed", res)
            log("outside_click_pass", all(a and c for a, c in res))
            # B) Arrow keys + Enter pick (editor focused first so the menu inserts at the cursor)
            await ed.click(); await page.keyboard.press("End")
            before = await ed.inner_text()
            await open_menu(page, 0)
            items = await page.locator(MENU).first.get_by_role("menuitem").all_inner_texts()
            dis = await page.locator(MENU).first.get_by_role("menuitem").first.is_disabled()
            await page.keyboard.press("ArrowDown"); await page.wait_for_timeout(200)
            await page.keyboard.press("ArrowUp"); await page.wait_for_timeout(200)
            await page.keyboard.press("Enter"); await page.wait_for_timeout(900)
            after = await ed.inner_text()
            first_hi = items[0].split("\n")[0].strip() if items else ""
            log("arrow_enter_pick", {"options": [x.split("\n")[0] for x in items[:3]], "disabled": dis, "menu_closed": not await menu_open(page),
                                     "inserted": bool(first_hi) and after.count(first_hi) > before.count(first_hi), "editor": after[-40:]})
            await back(page)
            # C) Escape with menu open (and in editor)
            fs0 = (await st(page))["fs"]
            n_ev = len(events)
            await open_menu(page, 1)
            await page.keyboard.press("Escape"); await page.wait_for_timeout(2500)
            log("esc_menu", {"fs_before": fs0, "after": await st(page), "menu_closed": not await menu_open(page), "modal": await modal(page)})
            await page.screenshot(path=f"{D}/{ENGINE}_esc_menu.jpg", quality=40, type="jpeg")
            await back(page)
            # re-enter fullscreen to test Esc in editor too (FF/WK: the button in the workbench toggles fullscreen)
            if not (await st(page))["fs"]:
                await page.evaluate("() => document.documentElement.requestFullscreen && document.documentElement.requestFullscreen().catch(()=>{})")
                await page.wait_for_timeout(800)
            await ed.click(); await page.keyboard.type("sarkar", delay=90); await page.wait_for_timeout(1500)
            fs1 = (await st(page))["fs"]
            await page.keyboard.press("Escape"); await page.wait_for_timeout(2500)
            log("esc_editor", {"fs_before": fs1, "after": await st(page), "modal": await modal(page), "options_left": await page.locator("[role=option]").count()})
            log("events_after_esc", events[n_ev:])
            await back(page)
            await page.wait_for_timeout(2200)
            # D) tab switch (visibilitychange hidden -> visible)
            n_ev = len(events)
            await page.evaluate("""() => { const set = (v) => { Object.defineProperty(document, 'visibilityState', {configurable: true, get: () => v});
                Object.defineProperty(document, 'hidden', {configurable: true, get: () => v === 'hidden'}); document.dispatchEvent(new Event('visibilitychange')); };
                window.__setVis = set; set('hidden'); }""")
            await page.wait_for_timeout(1000)
            await page.evaluate("() => window.__setVis('visible')"); await page.wait_for_timeout(1200)
            m_tab = await modal(page)
            await page.screenshot(path=f"{D}/{ENGINE}_tab_modal.jpg", quality=40, type="jpeg")
            await back(page); await page.wait_for_timeout(2300)
            # E) window blur -> focus
            await page.evaluate("() => window.dispatchEvent(new Event('blur'))"); await page.wait_for_timeout(800)
            await page.evaluate("() => window.dispatchEvent(new Event('focus'))"); await page.wait_for_timeout(1200)
            m_blur = await modal(page)
            await back(page)
            log("tab_and_blur", {"tab_modal": m_tab, "blur_modal": m_blur, "events": events[n_ev:]})
            # submit
            await page.wait_for_timeout(2000)
            await page.get_by_role("button", name=re.compile("Submit Translation", re.I)).first.click()
            await page.wait_for_timeout(800)
            a = page.get_by_role("button", name=re.compile("Submit anyway", re.I))
            if await a.count(): await a.first.click()
            await page.wait_for_url(re.compile(r"/report/"), timeout=25000)
            prof = await (await page.request.get(BASE + "/api/me/profile")).json()
            h = prof["history"][0]
            log("submitted", {k: h.get(k) for k in ("status", "score", "chance", "leftPageCount", "left_page_count")})
        except Exception as e:
            log("EXCEPTION", str(e).splitlines()[0][:200])
            await page.screenshot(path=f"{D}/{ENGINE}_err.jpg", quality=40, type="jpeg")
        log("all_events", events); log("pageerrors", errs)
        await b.close()

asyncio.run(main())
