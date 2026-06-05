import { chromium, type Page } from "playwright";
import { writeFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const WEB_BASE = process.env.WEB_BASE ?? "http://127.0.0.1:3000";
const EXEC_PATH =
  "/home/wysh/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome";

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const SCREENSHOT_DIR = resolve(TEST_DIR, "../../../screenshots");
const errors: string[] = [];

async function expect(cond: unknown, msg: string) {
  if (!cond) throw new Error(`assertion failed: ${msg}`);
}

async function shot(page: Page, name: string) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${SCREENSHOT_DIR}/${name}.png`, fullPage: true });
  console.log(`[shot] ${name}`);
}

async function main() {
  const browser = await chromium.launch({
    ...(existsSync(EXEC_PATH) ? { executablePath: EXEC_PATH } : {}),
    args: ["--no-sandbox"],
  });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console.error: ${m.text()}`);
  });

  // 1. Go to home, run Priya golden-hour demo
  await page.goto(`${WEB_BASE}/`, { waitUntil: "domcontentloaded" });
  await page.getByTestId("scenario-priya").waitFor({
    state: "visible",
    timeout: 20000,
  });
  await page.getByTestId("scenario-priya").scrollIntoViewIfNeeded();
  await page.getByTestId("scenario-priya").click();
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: /Route to the right flow/i }).scrollIntoViewIfNeeded();
  await page.getByRole("button", { name: /Route to the right flow/i }).click();
  const continueBtn = page.getByRole("button", { name: /Open Golden Hour flow/i });
  await continueBtn.waitFor({ state: "visible", timeout: 20000 });
  await continueBtn.click();
  await page.waitForURL(/\/emergency$/, { timeout: 15000 });
  await page.waitForLoadState("domcontentloaded");
  await page.waitForSelector('[data-testid="golden-hour-countdown"]', { timeout: 10000 });

  // Verify the bilingual tablist exists
  const tablist = await page.getByRole("tablist", { name: /Call script language/i }).count();
  await expect(tablist === 1, "tablist for call script language exists");

  // Verify do-not-share card
  const doNotShare = await page.getByText(/Never share these with anyone/i).count();
  await expect(doNotShare === 1, "do-not-share card present");

  // Click English tab
  await page.getByRole("tab", { name: "English" }).click();
  await page.waitForTimeout(200);
  const english = await page
    .getByText(/Hello, I want to register a cyber-fraud complaint/i)
    .count();
  await expect(english >= 1, "English call script visible after tab switch");

  // Back to Hindi
  await page.getByRole("tab", { name: /हिन्दी|Hindi/ }).click();
  await page.waitForTimeout(200);
  const hindi = await page
    .getByText(/Namaskar, main apni cyber fraud ki report/i)
    .count();
  await expect(hindi >= 1, "Hindi call script visible after tab switch");

  await shot(page, "11-emergency-active-golden-hour-desktop");

  // Mobile
  await ctx.close();
  const mobileCtx = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const mobile = await mobileCtx.newPage();
  await mobile.goto(`${WEB_BASE}/`, { waitUntil: "domcontentloaded" });
  await mobile.getByTestId("scenario-priya").waitFor({
    state: "visible",
    timeout: 20000,
  });
  await mobile.waitForTimeout(4000);

  // Hide the mobile bottom nav so it doesn't intercept clicks
  await mobile.evaluate(() => {
    const nav = document.querySelector('nav[aria-label="Primary"]');
    if (nav) (nav as HTMLElement).style.display = 'none';
  });

  // Click preset button
  await mobile.getByTestId("scenario-priya").scrollIntoViewIfNeeded();
  await mobile.getByTestId("scenario-priya").click();
  await mobile.waitForTimeout(500);

  // Click "Route to the right flow"
  await mobile.getByRole("button", { name: /Route to the right flow/i }).scrollIntoViewIfNeeded();
  await mobile.getByRole("button", { name: /Route to the right flow/i }).click();

  const mobileContinue = mobile.getByRole("button", { name: /Open Golden Hour flow/i });
  await mobileContinue.waitFor({ state: "visible", timeout: 20000 });
  await mobileContinue.click();

  await mobile.waitForURL(/\/emergency$/, { timeout: 15000 });
  await mobile.waitForSelector('[data-testid="golden-hour-countdown"]', { timeout: 10000 });
  await shot(mobile, "11-emergency-active-golden-hour-mobile");

  await browser.close();

  if (errors.length) {
    writeFileSync(`${SCREENSHOT_DIR}/_errors.txt`, errors.join("\n"));
    throw new Error(`found ${errors.length} page errors`);
  }
  console.log("Golden Hour bilingual + do-not-share smoke passed.");
}

main().catch((e) => {
  console.error("Accumulated console/page errors:", errors);
  console.error(e);
  process.exit(1);
});
