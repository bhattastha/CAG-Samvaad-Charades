# Iteration 8 layout retest: header profile menu at tablet widths (logged in) + mobile landing sign-in link and /register overflow (logged out)
# usage: fix8_layout.py <engine> <email>
import asyncio, json, os, random, re, subprocess, sys
from playwright.async_api import async_playwright
BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
ENGINE, EMAIL = sys.argv[1], sys.argv[2]
D = "/app/tests/load/shots3"; os.makedirs(D, exist_ok=True)
IN = "(el) => { const r = el.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.right), innerWidth, r.left >= -1 && r.right <= innerWidth + 1 && r.width > 0]; }"


def ctxargs(w, h):
    m = w < 500
    return dict(viewport={"width": w, "height": h}, is_mobile=m and ENGINE != "firefox", has_touch=m)


async def main():
    out = {}
    async with async_playwright() as p:
        b = await getattr(p, ENGINE).launch()
        code = "%06d" % random.randint(0, 999999)
        subprocess.run(["/app/scripts/emergent/test-otp.sh", EMAIL, code], check=True, capture_output=True)
        c0 = await b.new_context()
        r = await c0.request.post(BASE + "/api/auth/otp/verify", data={"email": EMAIL, "code": code})
        state = await c0.storage_state(); await c0.close()
        print(ENGINE, "otp", r.status)
        for vp in ("768x1024", "820x1180", "1024x768", "1366x768", "390x844", "360x740"):
            w, h = map(int, vp.split("x"))
            ctx = await b.new_context(storage_state=state, **ctxargs(w, h)); pg = await ctx.new_page()
            try:
                await pg.goto(BASE + "/journey", wait_until="networkidle")
                btn = pg.get_by_test_id("profile-menu")
                await btn.wait_for(state="visible", timeout=10000)
                bb = await btn.evaluate(IN)
                nav_vis = await pg.locator("nav[aria-label]").first.is_visible() if await pg.locator("header nav").count() else False
                await btn.click(timeout=5000); await pg.wait_for_timeout(500)
                menu = pg.locator("header [role=menu]").first
                mvis = await menu.is_visible()
                mb = await menu.evaluate(IN) if mvis else None
                items = await menu.get_by_role("menuitem").all_inner_texts() if mvis else []
                await pg.screenshot(path=f"{D}/{ENGINE}_{vp}_hdr.jpg", quality=40, type="jpeg")
                nav_ok = None
                if mvis:
                    lb = menu.get_by_role("menuitem").nth(2)
                    await lb.click(); await pg.wait_for_timeout(1200); nav_ok = pg.url.replace(BASE, "")
                hs = await pg.evaluate("() => document.documentElement.scrollWidth > innerWidth + 1")
                out[vp] = {"btn": bb, "navVisible": nav_vis, "menuVisible": mvis, "menuBox": mb, "items": items, "item3->": nav_ok, "hscroll": hs}
            except Exception as e:
                out[vp] = "EXC " + str(e).splitlines()[0][:150]
            print(ENGINE, vp, json.dumps(out[vp], ensure_ascii=False), flush=True)
            await ctx.close()
        # logged out mobile: landing sign-in + register overflow
        for vp in ("390x844", "360x740"):
            w, h = map(int, vp.split("x"))
            ctx = await b.new_context(**ctxargs(w, h)); pg = await ctx.new_page()
            res = {}
            try:
                await pg.goto(BASE + "/", wait_until="networkidle")
                si = pg.get_by_test_id("landing-signin")
                res["signin_visible"] = await si.is_visible()
                res["signin_box"] = await si.evaluate(IN)
                await si.click(); await pg.wait_for_timeout(2500)
                res["url"] = pg.url.replace(BASE, "")
                em = pg.locator("input[type=email]").first
                res["email_visible"] = await em.count() > 0 and await em.is_visible()
                body = await pg.inner_text("body")
                res["name_field_visible"] = await pg.locator("input[autocomplete=name], input[name=name]").count() > 0 and await pg.locator("input[autocomplete=name], input[name=name]").first.is_visible()
                res["heading"] = (await pg.locator("h1, h2").first.inner_text())[:60]
                await pg.screenshot(path=f"{D}/{ENGINE}_{vp}_signin.jpg", quality=40, type="jpeg")
                await pg.goto(BASE + "/register", wait_until="networkidle"); await pg.wait_for_timeout(1500)
                over = await pg.evaluate("""() => { const bad = []; const W = innerWidth;
                  for (const el of document.querySelectorAll('form h1, form h2, form input, form select, form textarea, form button, form.card, form label')) {
                    const r = el.getBoundingClientRect(); if (!r.width) continue;
                    if (r.right > W + 0.5 || r.left < -0.5) bad.push((el.tagName + ':' + (el.innerText || el.placeholder || el.name || '')).slice(0, 40) + ' ' + Math.round(r.left) + '-' + Math.round(r.right));
                  } const f = document.querySelector('form'); const fr = f && f.getBoundingClientRect();
                  return {W, form: fr && [Math.round(fr.left), Math.round(fr.right)], bad, scrollW: document.documentElement.scrollWidth}; }""")
                res["register"] = over
                listen = pg.get_by_role("button", name=re.compile("Listen", re.I))
                res["listen"] = await listen.first.evaluate(IN) if await listen.count() else "no Listen button"
                await pg.screenshot(path=f"{D}/{ENGINE}_{vp}_register.jpg", quality=40, type="jpeg")
            except Exception as e:
                res["EXC"] = str(e).splitlines()[0][:150]
            print(ENGINE, vp, "LOGGED-OUT", json.dumps(res, ensure_ascii=False), flush=True)
            await ctx.close()
        await b.close()

asyncio.run(main())
