import { expect, test } from "@playwright/test";

const shots = process.env.SHOTS_DIR;
const shot = async (page: any, name: string) => { if (shots) { await page.waitForTimeout(900); await page.screenshot({ path: `${shots}/${name}.png` }); } };

test.describe.configure({ mode: "serial" });

/** For the browser journey the Trial qualifying score is lowered from the console API (configurable, not hard-coded), then restored. */
async function setQualify(request: any, baseURL: string, n: number) {
  await request.post(`${baseURL}/api/auth/otp/request`, { data: { email: "manager@cag.gov.in" } });
  await request.post(`${baseURL}/api/auth/otp/verify`, { data: { email: "manager@cag.gov.in", code: "123456" } });
  const r = await request.put(`${baseURL}/api/admin/config/settings`, { data: { trialQualifyingScore: n } });
  if (!r.ok()) throw new Error(`settings ${r.status()}`);
}
test.beforeAll(async ({ playwright }, info) => { const base = info.project.use.baseURL!; const rq = await playwright.request.newContext(); await setQualify(rq, base, 10); await rq.dispose(); });
test.afterAll(async ({ playwright }, info) => { const base = info.project.use.baseURL!; const rq = await playwright.request.newContext(); await setQualify(rq, base, 33); await rq.dispose(); });

test("new player: profile → training → rules → map → briefing → Level 1 → report → Level 2", async ({ page }) => {
  // Sahayika must never start talking on her own (default voice mode: tap to listen)
  await page.addInitScript(() => {
    (window as any).__spoke = 0;
    const s = window.speechSynthesis;
    if (s) { const orig = s.speak.bind(s); s.speak = (u: any) => { (window as any).__spoke++; orig(u); }; }
  });
  const email = `e2e.${Date.now()}@cag.gov.in`;
  await page.goto("/");
  await expect(page.getByRole("button", { name: /Press Start/ })).toBeVisible();
  await expect(page.getByText("Samvaad").first()).toBeVisible();
  await expect(page.getByRole("switch", { name: "Sahayak voice guide" })).toHaveAttribute("aria-checked", "false");
  await shot(page, "01_title");
  await page.getByRole("button", { name: /Press Start/ }).click();

  await expect(page).toHaveURL(/register/);
  await page.locator("#name").fill("Ramesh Kumar");
  await page.locator("#mobile").fill("9876543210");
  await page.locator("#email").fill(email);
  await page.locator("#office").fill("central");
  await page.locator("#office-list li").first().click();
  await shot(page, "02_profile");
  await page.getByRole("button", { name: /Create profile/ }).click();
  await page.locator("#otp").fill("123456");
  await page.getByRole("button", { name: /Verify & enter/ }).click();
  await expect(page.getByText("Profile created!")).toBeVisible();
  await shot(page, "02b_profile_created");
  await page.getByRole("button", { name: /Continue/ }).click();

  await expect(page).toHaveURL(/how-to-play/);
  await page.getByRole("button", { name: /^Next/ }).click();
  await shot(page, "03_training_score");
  await page.getByRole("button", { name: /^Next/ }).click();
  // practice pad: Roman → Hindi helper, Space commits suggestion 1
  const practice = page.locator(".hc-editor .ProseMirror").first();
  await practice.click();
  await page.keyboard.type("sarkar", { delay: 60 });
  await expect(page.getByRole("listbox")).toBeVisible();
  await page.waitForTimeout(800);
  await shot(page, "03b_training_practice");
  await page.keyboard.press("Space");
  await expect(practice).toContainText("सरकार");
  // the Listen button plays only on tap, and can be paused/stopped
  await page.getByRole("button", { name: /^Next/ }).click();
  await page.getByRole("button", { name: /I'm ready/ }).click();

  await expect(page).toHaveURL(/rules/);
  await shot(page, "04_rules");
  await page.getByRole("button", { name: /Open the map/ }).click();
  await expect(page).toHaveURL(/journey/);
  await expect(page.getByText("You are here")).toBeVisible();
  await expect(page.getByText(/Start here: the Trial is your entry ticket/)).toBeVisible();
  await shot(page, "05_journey");
  // Level 5 is visible but preview-only
  await page.getByRole("button", { name: /Level 5 Varchaspati Round/ }).click();
  await expect(page.getByText(/Varchaspati opens in Phase 2/)).toBeVisible();
  await shot(page, "05b_varchaspati_preview");
  await page.getByRole("button", { name: /Back/ }).click();
  await page.getByRole("button", { name: /Level 1 Trial Round/ }).click();

  await expect(page).toHaveURL(/play\/trial/);
  await expect(page.getByText("Chance 1/3")).toBeVisible();
  await shot(page, "06_briefing");
  await page.getByRole("button", { name: /Start mission/ }).click();
  await expect(page).toHaveURL(/round\//, { timeout: 10_000 });

  const ed = page.locator(".hc-editor .ProseMirror").first();
  await page.locator("#kbd").selectOption("device");
  await ed.click();
  await page.keyboard.type("स्टील अथॉरिटी ऑफ इंडिया लिमिटेड भारत की अग्रणी इस्पात उत्पादक कंपनियों में से एक है। कंपनी के पास लौह अयस्क की खदानें हैं।");
  await expect(page.getByText(/^2\/(12|16) sentences$/).first()).toBeVisible();
  await page.waitForTimeout(2600);
  await expect(page.getByText("Saved").first()).toBeVisible();
  await shot(page, "07_trial_round");

  await page.reload();
  await expect(page.locator(".hc-editor .ProseMirror").first()).toContainText("लौह अयस्क");

  await page.getByRole("button", { name: "Submit", exact: true }).click();
  await expect(page.getByRole("button", { name: "Submit anyway?" })).toBeVisible();
  await page.getByRole("button", { name: "Submit anyway?" }).click();
  await expect(page.getByText("Mission complete!")).toBeVisible();
  await shot(page, "08_mission_complete");
  await page.waitForTimeout(1900);
  await shot(page, "08b_scoring");
  await page.getByRole("button", { name: /Skip/ }).click();
  await expect(page.getByText("Your five stats")).toBeVisible();
  await page.waitForTimeout(1500);
  await shot(page, "09_report_card");

  await page.getByRole("link", { name: /Review my translation/ }).click();
  await expect(page.locator("p.whitespace-pre-wrap").first()).toContainText("लौह अयस्क");
  await page.goBack();
  await expect(page.getByText("Trial cleared! Every level is now open.")).toBeVisible();
  // Secondary can be opened directly, without Primary
  await page.getByRole("link", { name: /Back to map/ }).click();
  await expect(page.getByText(/Trial cleared! Primary, Secondary and Pro are open/)).toBeVisible();
  await shot(page, "05c_journey_unlocked");
  await page.getByRole("button", { name: /Level 3 Secondary Round/ }).click();
  await expect(page).toHaveURL(/play\/secondary/);
  await page.getByRole("button", { name: /Back/ }).click();
  await page.getByRole("button", { name: /Level 2 Primary Round/ }).click();
  await expect(page).toHaveURL(/play\/primary/);
  await page.getByRole("button", { name: /Start mission/ }).click();
  await expect(page.getByText("BHASHINI draft").first()).toBeVisible({ timeout: 10_000 });
  await page.waitForTimeout(800);
  await shot(page, "10_primary_round");
  await expect(page.locator(".hc-watch").first()).toBeVisible();
  await page.locator(".hc-watch").first().click();
  await shot(page, "10b_watch_popover");
  await page.keyboard.press("Escape");
  const srcTab = page.getByRole("button", { name: "Source page" });
  if (await srcTab.isVisible()) await srcTab.click();
  await page.locator(".hc-source-term").first().click();
  await expect(page.getByText("Glossary suggestion").first()).toBeVisible();

  // nothing was spoken without a tap
  expect(await page.evaluate(() => (window as any).__spoke)).toBe(0);
});

test("settings: voice control and accessibility toggles", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page.getByText("Sahayak voice guide").first()).toBeVisible();
  await page.getByRole("button", { name: "XL" }).click();
  await page.getByRole("switch", { name: /High contrast/ }).click();
  await shot(page, "11_settings");
  expect(await page.evaluate(() => document.documentElement.classList.contains("hc-contrast"))).toBe(true);
  expect(await page.evaluate(() => document.documentElement.style.fontSize)).toBe("125%");
});

test("manager console opens for a manager", async ({ page }) => {
  test.skip(test.info().project.name !== "chrome", "console is desktop-first");
  await page.goto("/manager");
  await page.getByPlaceholder("you@cag.gov.in").fill("manager@cag.gov.in");
  await page.getByRole("button", { name: "Send code" }).click();
  await page.getByPlaceholder("OTP").fill("123456");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Pages per round")).toBeVisible();
});
