import { expect, test } from "@playwright/test";

const shots = process.env.SHOTS_DIR;
const shot = async (page: any, name: string) => { if (shots) await page.waitForTimeout(900), await page.screenshot({ path: `${shots}/${name}.png`, fullPage: false }); };

test.describe.configure({ mode: "serial" });

test("new player: register → how to play → rules → trial round → report → primary", async ({ page }) => {
  const email = `e2e.${Date.now()}@cag.gov.in`;
  await page.goto("/");
  await expect(page.getByRole("button", { name: /शुरू करें/ })).toBeVisible();
  await shot(page, "01_title");
  await page.getByRole("button", { name: /शुरू करें/ }).click();

  await expect(page).toHaveURL(/register/);
  await page.locator("#name").fill("रमेश कुमार");
  await page.locator("#mobile").fill("9876543210");
  await page.locator("#email").fill(email);
  await page.locator("#office").fill("central");
  await page.locator("#office-list li").first().click();
  await shot(page, "02_registration");
  await page.getByRole("button", { name: /पंजीकरण करें/ }).click();
  await page.locator("#otp").fill("123456");
  await page.getByRole("button", { name: /कोड जाँचें/ }).click();
  await expect(page.getByText("+2 पंजीकरण क्रेडिट")).toBeVisible();
  await page.waitForURL(/how-to-play/, { timeout: 8000 });

  // practice editor: Roman → Hindi helper, Space commits suggestion 1
  const practice = page.locator(".hc-editor .ProseMirror").first();
  await practice.click();
  await page.keyboard.type("sarkar", { delay: 60 });
  await expect(page.getByRole("listbox")).toBeVisible();
  await page.waitForTimeout(900);
  await shot(page, "03_how_to_play_xlit");
  await page.keyboard.press("Space");
  await expect(practice).toContainText("सरकार");
  // Esc keeps Roman
  await page.keyboard.type("audit", { delay: 40 });
  await page.waitForTimeout(500);
  await page.keyboard.press("Escape");
  await page.keyboard.type(" ");
  await expect(practice).toContainText("audit");
  // paste is blocked
  await page.evaluate(() => navigator.clipboard?.writeText?.("कॉपी किया हुआ लंबा पाठ").catch(() => {}));
  await page.getByRole("button", { name: /आगे/ }).click();

  await expect(page).toHaveURL(/rules/);
  await shot(page, "04_rules");
  await page.getByRole("button", { name: /समझ गया, शुरू करें/ }).click();
  await expect(page).toHaveURL(/play\/trial/);
  await expect(page.getByText("मौका 1 / 3")).toBeVisible();
  await shot(page, "07_pre_round_trial");
  await page.getByRole("button", { name: /^शुरू करें/ }).click();

  await expect(page).toHaveURL(/round\//);
  const ed = page.locator(".hc-editor .ProseMirror").first();
  await ed.click();
  await page.keyboard.press("Escape");
  // device-keyboard style direct Hindi input (insertText bypasses the helper only in device mode)
  await page.locator("#kbd").selectOption("device");
  await ed.click();
  await page.keyboard.type("स्टील अथॉरिटी ऑफ इंडिया लिमिटेड भारत की अग्रणी इस्पात उत्पादक कंपनियों में से एक है। कंपनी के पास लौह अयस्क की खदानें हैं।");
  await expect(page.getByText(/वाक्य 2 \/ 16 पूरे/)).toBeVisible();
  await page.waitForTimeout(2600);
  await expect(page.getByText("सेव हो गया")).toBeVisible();
  await shot(page, "05_trial_round");

  // refresh keeps text and clock
  await page.reload();
  await expect(page.locator(".hc-editor .ProseMirror").first()).toContainText("लौह अयस्क");

  // submit with parts left: two presses
  await page.getByRole("button", { name: "जमा करें" }).click();
  await expect(page.getByRole("button", { name: "पक्का जमा करें?" })).toBeVisible();
  await page.getByRole("button", { name: "पक्का जमा करें?" }).click();
  await expect(page).toHaveURL(/report\//);
  await expect(page.getByText(/\/ 100/).first()).toBeVisible();
  await page.waitForTimeout(1500);
  await shot(page, "06_trial_report_card");
  await expect(page.getByText("अगले राउंड से आपको टाइप करके ही लिखना होगा।")).toBeVisible();

  await page.getByRole("link", { name: /अपना अनुवाद देखिए/ }).click();
  await expect(page.locator("p.whitespace-pre-wrap").first()).toContainText("लौह अयस्क");
  await page.goBack();

  await page.getByRole("button", { name: /प्राथमिक राउंड/ }).click();
  await expect(page).toHaveURL(/play\/primary/);
  await expect(page.getByText(/अब से आपको टाइप करके ही लिखना है/).first()).toBeVisible();
  await page.getByRole("button", { name: /^शुरू करें/ }).click();
  await expect(page.getByText("भाषिणी अनुवाद").first()).toBeVisible();
  await page.waitForTimeout(800);
  await shot(page, "08_primary_round");
  // locked numbers render as chips; watch words are underlined
  await expect(page.locator(".hc-watch").first()).toBeVisible();
  await page.locator(".hc-watch").first().click();
  await shot(page, "08b_primary_watch_popover");
  await page.keyboard.press("Escape");
  // a source glossary term offers Hindi (on phones, switch to the English panel first)
  const srcTab = page.getByRole("button", { name: "मूल पाठ" });
  if (await srcTab.isVisible()) await srcTab.click();
  await page.locator(".hc-source-term").first().click();
  await expect(page.getByText("शब्दावली सुझाव").first()).toBeVisible();
  await shot(page, "08c_source_term_popover");
});

test("manager console opens for a manager", async ({ page }) => {
  await page.goto("/manager");
  await page.getByPlaceholder("you@cag.gov.in").fill("manager@cag.gov.in");
  test.skip(test.info().project.name !== "chrome", "console is desktop-first");
  await page.getByRole("button", { name: "Send code" }).click();
  await page.getByPlaceholder("OTP").fill("123456");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Pages per round")).toBeVisible();
  await shot(page, "20_manager_dashboard");
  await page.getByRole("link", { name: "Pages" }).click();
  await page.getByText("Report 38/2025 · p. 2").click();
  await expect(page.getByText("reference verified").first()).toBeVisible();
  await shot(page, "21_manager_page_editor");
});
