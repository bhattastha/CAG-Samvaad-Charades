# Cross-browser / device smoke: landing, login, journey, Trial workbench (terms, glossary menu, Hindi typing + xlit, toolbar), submit -> score
# usage: ui_matrix.py <engine> <WxH> <email>   (engine: chromium|firefox|webkit)
import asyncio, json, os, re, subprocess, sys, time
from playwright.async_api import async_playwright
BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
ENGINE, VP, EMAIL = sys.argv[1], sys.argv[2], sys.argv[3]
W, H = map(int, VP.split("x"))
SHOT = f"/app/tests/load/shots/{ENGINE}_{VP}"
os.makedirs("/app/tests/load/shots", exist_ok=True)
R = {"engine": ENGINE, "vp": VP, "email": EMAIL, "steps": {}, "console": [], "hscroll": {}}


def ok(step, val=True, note=""):
    R["steps"][step] = val if not note else f"{val} {note}"
    print(f"[{ENGINE} {VP}] {step}: {val} {note}")


async def hscroll(page, name):
    sw = await page.evaluate("() => [document.documentElement.scrollWidth, window.innerWidth]")
    if sw[0] > sw[1] + 1:
        R["hscroll"][name] = sw


async def main():
    code = "%06d" % (int(time.time() * 1000) % 1000000)
    subprocess.run(["/app/scripts/emergent/test-otp.sh", EMAIL, code], check=True, capture_output=True)
    async with async_playwright() as p:
        bt = getattr(p, ENGINE)
        b = await bt.launch()
        mobile = W < 500
        ctx = await b.new_context(viewport={"width": W, "height": H}, is_mobile=mobile and ENGINE != "firefox", has_touch=mobile)
        page = await ctx.new_page()
        page.on("console", lambda m: R["console"].append(m.text[:160]) if m.type == "error" and "cloudflareinsights" not in m.text and "inline script" not in m.text else None)
        page.on("pageerror", lambda e: R["console"].append("PAGEERROR " + str(e)[:160]))
        try:
            await page.goto(BASE + "/", wait_until="networkidle")
            logos = await page.evaluate("() => Array.from(document.images).filter(i => /cag-logo|bhashini-logo/.test(i.src)).map(i => [i.src.split('/').pop(), i.naturalWidth, Math.round(i.getBoundingClientRect().width)])")
            ok("landing_logos", len(logos) == 2 and all(l[1] > 0 and l[2] > 0 for l in logos), str(logos))
            await hscroll(page, "landing")
            await page.screenshot(path=SHOT + "_1landing.jpg", quality=40, type="jpeg")
            await page.get_by_text("Sign in", exact=True).first.click(timeout=8000)
            await page.wait_for_timeout(1200)
            email_in = page.locator("input[type=email], input[autocomplete=email], input[name=email]").first
            ok("login_email_input", await email_in.is_visible())
            await hscroll(page, "login")
            await page.screenshot(path=SHOT + "_2login.jpg", quality=40, type="jpeg")
            r = await page.request.post(BASE + "/api/auth/otp/verify", data={"email": EMAIL, "code": code})
            ok("otp_verify", r.status == 200)
            await page.goto(BASE + "/journey", wait_until="networkidle")
            ok("journey", "Trial" in await page.inner_text("body"))
            await hscroll(page, "journey")
            await page.screenshot(path=SHOT + "_3journey.jpg", quality=40, type="jpeg")
            await page.goto(BASE + "/play/trial", wait_until="networkidle")
            await page.get_by_role("button", name="Start Mission").click()
            await page.wait_for_url(re.compile(r"/round/"), timeout=20000)
            await page.wait_for_timeout(3000)
            ok("round_open", True, page.url.split("/")[-1][:8])
            # dismiss any dialog (intro / fullscreen prompts)
            for name in ["Continue", "Got it", "Start", "OK", "Close"]:
                bt_ = page.get_by_role("button", name=name, exact=True)
                if await bt_.count() and await bt_.first.is_visible():
                    await bt_.first.click(); await page.wait_for_timeout(500)
            await hscroll(page, "round")
            await page.screenshot(path=SHOT + "_4round.jpg", quality=40, type="jpeg")
            terms = page.locator(".hc-source-term")
            n = await terms.count()
            ok("source_underlines", n > 0, f"count={n}")
            if n:
                await terms.first.scroll_into_view_if_needed()
                await terms.first.click()
                await page.wait_for_timeout(1500)
                menu = page.get_by_role("menu").first
                vis = await menu.is_visible() if await page.get_by_role("menu").count() else False
                box = await menu.bounding_box() if vis else None
                inview = bool(box and box["x"] >= -1 and box["x"] + box["width"] <= W + 1)
                ok("glossary_menu", vis, f"inViewport={inview} box={[round(v) for v in box.values()] if box else None}")
                await page.screenshot(path=SHOT + "_5menu.jpg", quality=40, type="jpeg")
                await page.keyboard.press("Escape")
                await page.wait_for_timeout(400)
            ed = page.locator(".ProseMirror[contenteditable=true]").first
            await ed.scroll_into_view_if_needed()
            await ed.click()
            await page.keyboard.type("sarkar", delay=120)
            sug = page.locator("[role=option]").filter(has_text=re.compile("[\u0900-\u097F]")).first
            try:
                t0 = time.time()
                await sug.wait_for(state="visible", timeout=6000)
                opts = [f"{time.time()-t0:.1f}s"] + await page.locator("[role=option]").all_inner_texts()
                ok("xlit_suggestions", True, str(opts[:4]))
            except Exception:
                ok("xlit_suggestions", False)
            await page.screenshot(path=SHOT + "_6xlit.jpg", quality=40, type="jpeg")
            await page.keyboard.press("Space")
            await page.keyboard.type("vibhag ", delay=120)
            await page.wait_for_timeout(2500)
            txt = await ed.inner_text()
            ok("hindi_typed", bool(re.search(r"[\u0900-\u097F]", txt)), repr(txt[:60]))
            tb = page.get_by_role("toolbar").first
            if await page.get_by_role("toolbar").count():
                await page.keyboard.press("Control+a") if ENGINE != "webkit" else await page.keyboard.press("Meta+a")
                tbtns = tb.locator("button")
                labels = [(await tbtns.nth(i).get_attribute("aria-label")) or (await tbtns.nth(i).inner_text()) for i in range(await tbtns.count())]
                await tbtns.first.click()
                await page.wait_for_timeout(500)
                html = await ed.inner_html()
                ok("toolbar", True, f"buttons={labels[:8]} boldApplied={'<strong' in html or '<b>' in html}")
            else:
                ok("toolbar", False, "no role=toolbar")
            await page.wait_for_timeout(2500)  # let autosave flush
            sub = page.get_by_role("button", name=re.compile("Submit Translation", re.I)).first
            await sub.scroll_into_view_if_needed()
            await sub.click()
            await page.wait_for_timeout(800)
            anyway = page.get_by_role("button", name=re.compile("Submit anyway", re.I))
            if await anyway.count():
                await anyway.first.click()
            await page.wait_for_url(re.compile(r"/report/"), timeout=25000)
            await page.wait_for_timeout(3500)
            sk = page.get_by_role("button", name=re.compile("^Skip"))
            if await sk.count():
                await sk.first.click(); await page.wait_for_timeout(2000)
            prof = await (await page.request.get(BASE + "/api/me/profile")).json()
            h0 = prof["history"][0]
            ok("submit_score", h0["status"] == "submitted", f"score={h0['score']} chance={h0['chance']}")
            await hscroll(page, "report")
            await page.screenshot(path=SHOT + "_7report.jpg", quality=40, type="jpeg")
        except Exception as e:
            ok("EXCEPTION", False, str(e).splitlines()[0][:200])
            await page.screenshot(path=SHOT + "_err.jpg", quality=40, type="jpeg")
        await b.close()
    print("RESULT", json.dumps(R, ensure_ascii=False))

asyncio.run(main())
