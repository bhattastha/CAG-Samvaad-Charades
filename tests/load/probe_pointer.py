# Probe: pointer media query + synthetic window blur listener in each engine (explains blur counting)
import asyncio, sys
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        for eng in ("chromium", "firefox", "webkit"):
            b = await getattr(p, eng).launch(); pg = await b.new_page()
            await pg.set_content("<p>x</p>")
            print(eng, await pg.evaluate("""() => { let n = 0; window.addEventListener('blur', () => n++); window.dispatchEvent(new Event('blur'));
              return {fine: matchMedia('(pointer: fine)').matches, coarse: matchMedia('(pointer: coarse)').matches, none: matchMedia('(pointer: none)').matches, anyFine: matchMedia('(any-pointer: fine)').matches, hover: matchMedia('(hover: hover)').matches, blurFired: n}; }"""))
            await b.close()
asyncio.run(main())
