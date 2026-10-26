# Cross-browser / device smoke v2: landing, login, journey, Trial workbench (terms, glossary menu, Hindi typing + xlit, toolbar bold), submit -> score
# Fixes vs ui_matrix.py: mobile landing via Start Playing / /login; tablet+mobile pane tabs; no Escape (fair-play modal handled)
# usage: ui_matrix2.py <engine> <WxH> <email>
import asyncio, json, os, re, subprocess, sys, time
from playwright.async_api import async_playwright
BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
ENGINE, VP, EMAIL = sys.argv[1], sys.argv[2], sys.argv[3]
W, H = map(int, VP.split("x"))
D = "/app/tests/load/shots2"
SHOT = f"{D}/{ENGINE}_{VP}"
os.makedirs(D, exist_ok=True)
R = {"engine": ENGINE, "vp": VP, "email": EMAIL, "steps": {}, "console": [], "hscroll": {}, "overlap": {}, "fairplay_modals": 0}
NOISE = ("cloudflareinsights", "inline script", "unsafe-inline", "Content Security Policy", "beacon.min.js")


def ok(step, val=True, note=""):
    R["steps"][step] = val if not note else f"{val} {note}"
    print(f"[{ENGINE} {VP}] {step}: {val} {note}", flush=True)


async def hscroll(page, name):
    sw = await page.evaluate("() => [document.documentElement.scrollWidth, window.innerWidth]")
    if sw[0] > sw[1] + 1:
        R["hscroll"][name] = sw


async def overlap(page, name):
    # visible buttons/inputs/links that are covered by another element at their centre, or extend beyond the viewport width
    res = await page.evaluate("""() => {
      const out = [];
      for (const el of document.querySelectorAll('button, a, input, select, [role=option]')) {
        const r = el.getBoundingClientRect();
        if (r.width < 4 || r.height < 4 || r.bottom < 0 || r.top > innerHeight) continue;
        const st = getComputedStyle(el); if (st.visibility === 'hidden' || st.opacity === '0') continue;
        if (r.right > innerWidth + 2 && !el.closest('[role=toolbar]')) out.push('offscreen:' + (el.innerText || el.getAttribute('aria-label') || el.tagName).trim().slice(0, 30));
        const cx = Math.min(innerWidth - 1, r.left + r.width / 2), cy = r.top + r.height / 2;
        if (cy < 0 || cy > innerHeight) continue;
        const top = document.elementFromPoint(cx, cy);
        if (top && top !== el && !el.contains(top) && !top.contains(el)) out.push('covered:' + (el.innerText || el.getAttribute('aria-label') || el.tagName).trim().slice(0, 30) + ' by ' + (top.className || top.tagName).toString().slice(0, 40));
      }
      return out.slice(0, 8);
    }""")
    if res:
        R["overlap"][name] = res


async def fairplay(page):
    b = page.get_by_role("button", name="Back to the mission", exact=True)
    if await b.count() and await b.first.is_visible():
        R["fairplay_modals"] += 1
        await b.first.click()
        await page.wait_for_timeout(600)
        return True
    return False


async def main():
    code = "%06d" % (int(time.time() * 1000) % 1000000)
    subprocess.run(["/app/scripts/emergent/test-otp.sh", EMAIL, code], check=True, capture_output=True)
    async with async_playwright() as p:
        b = await getattr(p, ENGINE).launch()
        mobile = W < 500
        ctx = await b.new_context(viewport={"width": W, "height": H}, is_mobile=mobile and ENGINE != "firefox", has_touch=mobile)
        page = await ctx.new_page()
        page.on("console", lambda m: R["console"].append(m.text[:160]) if m.type == "error" and not any(n in m.text for n in NOISE) else None)
        page.on("pageerror", lambda e: R["console"].append("PAGEERROR " + str(e)[:160]))
        try:
            await page.goto(BASE + "/", wait_until="networkidle")
            logos = await page.evaluate("() => Array.from(document.images).filter(i => /cag-logo|bhashini-logo/.test(i.src)).map(i => [i.src.split('/').pop(), i.naturalWidth, Math.round(i.getBoundingClientRect().width)])")
            ok("landing_logos", len(logos) == 2 and all(l[1] > 0 and l[2] > 0 for l in logos), str(logos))
            await hscroll(page, "landing"); await overlap(page, "landing")
            await page.screenshot(path=SHOT + "_1landing.jpg", quality=40, type="jpeg")
            si = page.get_by_text("Sign in", exact=True)
            how = "sign-in"
            if await si.count() and await si.first.is_visible():
                await si.first.click(timeout=8000)
            else:
                how = "start-playing"
                await page.get_by_role("button", name=re.compile("Start Playing", re.I)).first.click(timeout=8000)
            email_in0 = page.locator("input[type=email], input[autocomplete=email], input[name=email]").first
            try:
                await email_in0.wait_for(state="visible", timeout=6000)
            except Exception:
                pass
            email_in = page.locator("input[type=email], input[autocomplete=email], input[name=email]").first
            if not (await email_in.count() and await email_in.is_visible()):
                how += "->/login"
                await page.goto(BASE + "/login", wait_until="networkidle")
            ok("login_email_input", await email_in.is_visible(), f"via {how} url={page.url.replace(BASE, '')}")
            await hscroll(page, "login"); await overlap(page, "login")
            await page.screenshot(path=SHOT + "_2login.jpg", quality=40, type="jpeg")
            r = await page.request.post(BASE + "/api/auth/otp/verify", data={"email": EMAIL, "code": code})
            ok("otp_verify", r.status == 200)
            await page.goto(BASE + "/journey", wait_until="networkidle")
            ok("journey", "Trial" in await page.inner_text("body"))
            await hscroll(page, "journey"); await overlap(page, "journey")
            await page.screenshot(path=SHOT + "_3journey.jpg", quality=40, type="jpeg")
            await page.goto(BASE + "/play/trial", wait_until="networkidle")
            await page.get_by_role("button", name=re.compile("^(Start Mission|Resume)", re.I)).first.click(timeout=15000)
            await page.wait_for_url(re.compile(r"/round/"), timeout=20000)
            await page.wait_for_timeout(3000)
            fs = await page.evaluate("() => !!(document.fullscreenElement || document.webkitFullscreenElement)")
            ok("round_open", True, f"{page.url.split('/')[-1][:8]} fullscreen={fs}")
            await fairplay(page)
            await hscroll(page, "round"); await overlap(page, "round")
            await page.screenshot(path=SHOT + "_4round.jpg", quality=40, type="jpeg")
            src_tab = page.get_by_role("button", name="Original document", exact=True)
            dst_tab = page.get_by_role("button", name="Translated document", exact=True)
            tabs = await src_tab.count() > 0 and await src_tab.first.is_visible()
            if tabs:
                await src_tab.first.click(); await page.wait_for_timeout(600)
            terms = page.locator(".hc-source-term")
            n = await terms.count()
            vis_terms = 0
            for i in range(min(n, 40)):
                if await terms.nth(i).is_visible():
                    vis_terms += 1
            ok("source_underlines", vis_terms > 0, f"count={n} visible={vis_terms} tabs={tabs}")
            if vis_terms:
                t = terms.first
                for i in range(n):
                    if await terms.nth(i).is_visible():
                        t = terms.nth(i); break
                await t.scroll_into_view_if_needed()
                await t.click(timeout=10000)
                await page.wait_for_timeout(1500)
                menu = page.locator("[role=menu][aria-label='Glossary options']").first
                vis = await menu.is_visible() if await page.locator("[role=menu][aria-label='Glossary options']").count() else False
                box = await menu.bounding_box() if vis else None
                inview = bool(box and box["x"] >= -1 and box["x"] + box["width"] <= W + 1)
                items = await menu.get_by_role("menuitem").all_inner_texts() if vis else []
                ok("glossary_menu", vis and len(items) > 0, f"inViewport={inview} box={[round(v) for v in box.values()] if box else None} options={[x.replace(chr(10), ' ')[:25] for x in items[:4]]}")
                await page.screenshot(path=SHOT + "_5menu.jpg", quality=40, type="jpeg")
                # close by clicking elsewhere (no Escape: Escape exits real fullscreen -> fair-play modal)
                if tabs:
                    await dst_tab.first.click()
                else:
                    await page.locator(".ProseMirror[contenteditable=true]").first.click()
                await page.wait_for_timeout(600)
                still = await page.locator("[role=menu][aria-label='Glossary options']").count() and await page.locator("[role=menu][aria-label='Glossary options']").first.is_visible()
                ok("glossary_menu_closes_on_outside_click", not still)
                await fairplay(page)
            elif tabs:
                await dst_tab.first.click(); await page.wait_for_timeout(500)
            if tabs and not await page.locator(".ProseMirror[contenteditable=true]").first.is_visible():
                await dst_tab.first.click(); await page.wait_for_timeout(500)
            ed = page.locator(".ProseMirror[contenteditable=true]").first
            await ed.scroll_into_view_if_needed()
            await ed.click()
            await page.keyboard.type("sarkar", delay=120)
            sug = page.locator("[role=option]").filter(has_text=re.compile("[\u0900-\u097F]")).first
            try:
                t0 = time.time()
                await sug.wait_for(state="visible", timeout=6000)
                opts = [f"{time.time()-t0:.1f}s"] + await page.locator("[role=option]").all_inner_texts()
                ok("xlit_suggestions", True, str([o.replace(chr(10), ' ') for o in opts[:4]]))
            except Exception:
                ok("xlit_suggestions", False)
            await overlap(page, "xlit")
            await page.screenshot(path=SHOT + "_6xlit.jpg", quality=40, type="jpeg")
            await page.keyboard.press("Space")
            await page.keyboard.type("vibhag ", delay=120)
            await page.wait_for_timeout(2500)
            txt = await ed.inner_text()
            ok("hindi_typed", bool(re.search(r"[\u0900-\u097F]", txt)), repr(txt[:60]))
            await fairplay(page)
            tb = page.get_by_role("toolbar").first
            if await page.get_by_role("toolbar").count() and await tb.is_visible():
                await ed.click()
                await page.keyboard.press("ControlOrMeta+a")
                sel = await page.evaluate("() => String(getSelection())")
                bold = tb.get_by_role("button", name="Bold", exact=True)
                await bold.click(timeout=8000)
                await page.wait_for_timeout(500)
                html = await ed.inner_html()
                ok("toolbar_bold", "<strong" in html or "<b>" in html, f"selBefore={sel[:20]!r} html={html[:60]!r}")
            else:
                ok("toolbar_bold", False, "no visible role=toolbar")
            await fairplay(page)
            await page.wait_for_timeout(2500)  # let autosave flush
            sub = page.get_by_role("button", name=re.compile("Submit Translation", re.I)).first
            await sub.scroll_into_view_if_needed()
            await sub.click(timeout=10000)
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
            await hscroll(page, "report"); await overlap(page, "report")
            await page.screenshot(path=SHOT + "_7report.jpg", quality=40, type="jpeg")
        except Exception as e:
            ok("EXCEPTION", False, str(e).splitlines()[0][:200])
            await page.screenshot(path=SHOT + "_err.jpg", quality=40, type="jpeg")
        await b.close()
    print("RESULT", json.dumps(R, ensure_ascii=False), flush=True)

asyncio.run(main())
