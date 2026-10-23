import { defineConfig, devices } from "@playwright/test";

/** e2e against a running dev stack (pnpm dev). Chromium + WebKit approximate the target browsers (§4). */
export default defineConfig({
  testDir: "e2e",
  timeout: 90_000,
  use: { baseURL: process.env.BASE_URL ?? "http://localhost:5173", locale: "hi-IN", viewport: { width: 1366, height: 860 } },
  projects: [
    { name: "chrome", use: { ...devices["Desktop Chrome"], channel: "chrome", viewport: { width: 1366, height: 860 } } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
    { name: "iphone", use: { ...devices["iPhone 14"] } },
    // phone layout + touch on Chrome, for machines where Playwright WebKit cannot launch
    { name: "phone-chrome", use: { ...devices["iPhone 14"], browserName: "chromium", channel: "chrome", defaultBrowserType: "chromium" } },
  ],
});
