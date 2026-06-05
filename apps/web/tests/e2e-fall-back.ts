/**
 * End-to-end "Sextortion + UPI" fall-back flow:
 * 1. Open /, click the "Sextortion + UPI demand" preset
 * 2. Submit intake, expect fall-back routing
 * 3. Verify supportive, non-shaming language in the result and on /fall-back
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

  try {
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.getByTestId("scenario-sextortion").waitFor({
      state: "visible",
      timeout: 20000,
    });
    await page.getByTestId("scenario-sextortion").scrollIntoViewIfNeeded();
    await page.getByTestId("scenario-sextortion").click();
    await page.waitForTimeout(300);
    await page.getByRole("button", { name: /Route to the right flow/i }).scrollIntoViewIfNeeded();
    await page.getByRole("button", { name: /Route to the right flow/i }).click();
    const continueBtn = page.getByRole("button", { name: /Start Fall-Back guided flow/i });
    await continueBtn.waitFor({ state: "visible", timeout: 20000 });
    await page.screenshot({ path: join(OUT, "06-intake-sextortion-result.png"), fullPage: true });
    await continueBtn.click();
    await page.waitForURL(/\/fall-back$/, { timeout: 15000 });
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(800);
    await page.screenshot({ path: join(OUT, "07-fall-back-start.png"), fullPage: true });

    // Verify non-shaming language: there should be no "stupid" or "fool" text.
    const html = await page.content();
    if (/\bstupid\b|\bidiot\b|\bfoolish\b|\bblame\b/i.test(html)) {
      failures.push("Sextortion page contains judgmental or shaming language");
    }

    // Start a guided flow.
    await page.getByRole("button", { name: /Start guided flow/i }).click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: join(OUT, "08-fall-back-question-1.png"), fullPage: true });
  } catch (err) {
    failures.push(`Execution error: ${String(err)}`);
  } finally {
    await context.close();
    await browser.close();
  }

  const filteredErrors = consoleErrors.filter((e) => !/favicon/i.test(e));
  if (filteredErrors.length) {
    failures.push(`Console errors: ${JSON.stringify(filteredErrors.slice(0, 3))}`);
  }

  if (failures.length) {
    console.error("FAILURES:");
    for (const f of failures) console.error(" -", f);
    process.exit(1);
  }
  console.log("Sextortion fall-back flow passed.");
}

run().catch((err) => {
  console.error("Unhandled E2E Fallback Error:", err);
  process.exit(1);
});
