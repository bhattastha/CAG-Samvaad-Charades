import { expect, test } from "@playwright/test";

const shots = process.env.SHOTS_DIR;
const shot = async (page: any, name: string) => { if (shots) { await page.waitForTimeout(900); await page.screenshot({ path: `${shots}/${name}.png` }); } };

test.describe.configure({ mode: "serial" });

/** The review build ships with every level open ("all-open"); the console setting is checked and left unchanged. */
test.beforeAll(async ({ playwright }, info) => {
  const rq = await playwright.request.newContext();
  const cfg = await (await rq.get(`${info.project.use.baseURL}/api/config`)).json();
  if (cfg.levels.unlockRule !== "all-open") throw new Error("expected the all-open review build");
  await rq.dispose();
});

test("new player: landing → player card → training → rules → map → Trial → report → profile menu → Primary workbench", async ({ page }) => {
  // Sahayika must never start talking on her own (default voice mode: tap to listen)
  await page.addInitScript(() => {
    (window as any).__spoke = 0;
    const s = window.speechSynthesis;
    if (s) { const orig = s.speak.bind(s); s.speak = (u: any) => { (window as any).__spoke++; orig(u); }; }
  });
  const email = `e2e.${Date.now()}@cag.gov.in`;
  await page.goto("/");
  await expect(page.getByRole("button", { name: /Start Playing/ }).first()).toBeVisible();
  await expect(page.getByText("Samvaad").first()).toBeVisible();
  // official marks together in the header; the five milestones on the journey
  await expect(page.getByAltText("Comptroller and Auditor General of India")).toBeVisible();
  await expect(page.getByAltText("Digital India BHASHINI")).toBeVisible();
  await expect(page.locator("[data-state]:visible")).toHaveCount(5);
  await expect(page.locator('[data-state="upcoming"]:visible')).toHaveCount(1);
  await expect(page.getByRole("switch", { name: "Sahayak voice guide" })).toHaveAttribute("aria-checked", "false");
  await shot(page, "01_title");
  await page.getByRole("button", { name: /Start Playing/ }).first().click();

  await expect(page).toHaveURL(/register/);
  await page.locator("#name").fill("Ramesh Kumar");
  await page.locator("#mobile").fill("9876543210");
  await page.locator("#email").fill(email);
  await page.locator("#office").fill("central");
  await page.locator("#office-list li").first().click();
  // the player card fills in live as the officer types
  await expect(page.getByTestId("player-card")).toContainText("Ramesh Kumar");
  await shot(page, "02_profile");
  await page.getByRole("button", { name: /Create my player card/ }).click();
  await page.locator("#otp").fill("123456");
  await page.getByRole("button", { name: /Verify & enter/ }).click();
  await expect(page.getByText("You're in.")).toBeVisible();
  await shot(page, "02b_profile_created");
  await page.getByRole("button", { name: /Start training/ }).click();

  await expect(page).toHaveURL(/how-to-play/);
  await expect(page.getByRole("heading", { name: "Your Mission" })).toBeVisible();
  await page.getByRole("button", { name: /^Next/ }).click();
  await expect(page.getByRole("heading", { name: "How You Score" })).toBeVisible();
  await shot(page, "03_training_score");
  await page.getByRole("button", { name: /^Next/ }).click();
  await expect(page.getByRole("heading", { name: "Your Translation Toolkit" })).toBeVisible();
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
  await expect(page.getByRole("heading", { name: /Meet Your Guide/ })).toBeVisible();
  await page.getByRole("button", { name: /I'm ready/ }).click();

  await expect(page).toHaveURL(/rules/);
  await expect(page.getByRole("button", { name: /Enter the Challenge/ })).toBeDisabled();
  await page.getByLabel(/I have understood/).check();
  await shot(page, "04_rules");
  await page.getByRole("button", { name: /Enter the Challenge/ }).click();
  await expect(page).toHaveURL(/journey/);
  await expect(page.getByText("You are here")).toBeVisible();
  await expect(page.getByText(/Start with the Trial/).first()).toBeVisible();
  await shot(page, "05_journey");
  // Level 5 is visible but preview-only
  await page.getByRole("button", { name: /Level 5 PhD Shodharthi Round/ }).click();
  await expect(page.getByText(/PhD Shodharthi opens in Phase 2/)).toBeVisible();
  await shot(page, "05b_varchaspati_preview");
  await page.getByRole("button", { name: /Back/ }).click();
  await page.getByRole("button", { name: /Level 1 Trial Round/ }).click();

  await expect(page).toHaveURL(/play\/trial/);
  await expect(page.getByText("Chance 1/3")).toBeVisible();
  await shot(page, "06_briefing");
  await page.getByRole("button", { name: /Start mission/i }).click();
  await expect(page).toHaveURL(/round\//, { timeout: 10_000 });

  const ed = page.locator(".hc-editor .ProseMirror").first();
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
  // every level stays open; Secondary can be opened directly, without Primary
  await page.getByRole("link", { name: /Back to map/ }).click();
  await expect(page.getByText(/Warm-up done/)).toBeVisible();
  await shot(page, "05c_journey_unlocked");
  await page.getByRole("button", { name: /Level 3 Secondary Round/ }).click();
  await expect(page).toHaveURL(/play\/secondary/);
  await page.getByRole("button", { name: /Back/ }).click();
  // signed-in portal: profile menu → leaderboard and profile
  await page.getByTestId("profile-menu").click();
  await page.getByRole("menuitem", { name: /Leaderboard/ }).click();
  await expect(page).toHaveURL(/leaderboard/);
  await expect(page.getByText(/Rank \d+ of \d+/)).toBeVisible();
  await page.getByTestId("profile-menu").click();
  await page.getByRole("menuitem", { name: /My profile/ }).click();
  await expect(page.getByText("Attempt history")).toBeVisible();
  await shot(page, "05d_profile");
  await page.goto("/journey");
  await page.getByRole("button", { name: /Level 2 Primary Round/ }).click();
  await expect(page).toHaveURL(/play\/primary/);
  await page.getByRole("button", { name: /Start mission/i }).click();
  await expect(page.getByText("BHASHINI draft").locator("visible=true").first()).toBeVisible({ timeout: 15_000 });
  // the 10-page report bundle has a page navigator
  await expect(page.getByRole("button", { name: /Page 1 of 10/ })).toBeVisible();
  await page.waitForTimeout(800);
  await shot(page, "10_primary_round");
  await page.locator(".hc-source-term").first().click();
  await expect(page.getByRole("menu", { name: "Glossary options" })).toBeVisible();

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
  await page.getByLabel("Official email").fill("manager@cag.gov.in");
  await page.getByRole("button", { name: "Send code" }).click();
  await page.getByLabel("One-time password").fill("123456");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText("Registered players").first()).toBeVisible();
});
