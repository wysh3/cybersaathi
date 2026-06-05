/**
 * End-to-end "Priya" flow:
 * 1. Open /, click the "Priya: hostel warden UPI scam" preset
 * 2. Submit intake, expect golden-hour routing
 * 3. Capture key UI states on the intake, emergency, and documents pages
 */
import { chromium } from "playwright";
import { mkdirSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const BASE = "http://127.0.0.1:3000";
const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(TEST_DIR, "../../../screenshots/flow");
mkdirSync(OUT, { recursive: true });

async function run() {
  const defaultPath = "/home/wysh/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome";
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    ...(existsSync(defaultPath) ? { executablePath: defaultPath } : {}),
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const failures: string[] = [];

  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });

  // 1. Open intake
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.getByTestId("scenario-priya").waitFor({
    state: "visible",
    timeout: 20000,
  });
  await page.screenshot({ path: join(OUT, "01-intake-initial.png"), fullPage: true });

  // 2. Click the Priya demo button (prominent, with isPrimary=true)
  await page.getByTestId("scenario-priya").scrollIntoViewIfNeeded();
  await page.getByTestId("scenario-priya").click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(OUT, "02-intake-priya-preset.png"), fullPage: true });

  // 3. Submit intake (this triggers API classify and shows routing result)
  await page.getByRole("button", { name: /Route to the right flow/i }).scrollIntoViewIfNeeded();
  await page.getByRole("button", { name: /Route to the right flow/i }).click();
  // Wait for the result panel to show "Open Golden Hour flow"
  const continueBtn = page.getByRole("button", { name: /Open Golden Hour flow/i });
  await continueBtn.waitFor({ state: "visible", timeout: 20000 });
  await page.screenshot({ path: join(OUT, "03-intake-routing-result.png"), fullPage: true });
  // Click the continue button to navigate
  await continueBtn.click();
  await page.waitForURL(/\/emergency$/, { timeout: 15000 });
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(OUT, "04-emergency-after-priya.png"), fullPage: true });

  // 4. Confirm the page shows "Golden hour" and a countdown
  const heading = await page.getByRole("heading", { level: 1 }).first().textContent();
  if (!heading || !/Golden hour/i.test(heading)) {
    failures.push(`Expected golden-hour heading, got: ${heading}`);
  }
  const countdown = page.getByTestId("golden-hour-countdown");
  const countdownText = (await countdown.first().textContent({ timeout: 1000 })) ?? "";
  if (!/\d\d:\d\d/.test(countdownText)) {
    failures.push(`Expected countdown MM:SS, got: "${countdownText}"`);
  }

  // 5. Enter a helpline reference number
  const refInput = page.getByPlaceholder(/1930REF0001/i);
  if (await refInput.isVisible()) {
    await refInput.fill("1930REF0001");
    await page.waitForTimeout(300);
    const saveBtn = page.getByRole("button", { name: /Save reference and continue/i });
    if (await saveBtn.isEnabled()) {
      await saveBtn.click();
      await page.waitForURL(/\/documents/, { timeout: 15000 }).catch(() => null);
      // Wait for actual content (recovery card / document tabs) to render.
      await page
        .waitForSelector("text=Recovery outlook", { timeout: 20000 })
        .catch(() => null);
      await page.waitForTimeout(2500);
      await page.screenshot({ path: join(OUT, "05-documents-after-priya.png"), fullPage: true });
    }
  } else {
    failures.push("Helpline reference number input not visible");
  }

  await context.close();
  await browser.close();

  const filteredErrors = consoleErrors.filter((e) => !/favicon/i.test(e));
  if (filteredErrors.length) {
    failures.push(`Console errors: ${JSON.stringify(filteredErrors.slice(0, 3))}`);
  }

  if (failures.length) {
    console.error("FAILURES:");
    for (const f of failures) console.error(" -", f);
    process.exit(1);
  }
  console.log("Priya E2E flow passed.");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
