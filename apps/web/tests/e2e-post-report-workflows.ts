/**
 * E2E tests for F015: Post-Report Response Workflows.
 * Verifies rendering of primary/secondary badges, checklist cards, and checkoff state sync.
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

  // Use a known seed complaint ID: c-seed-cl1-000 (which is a post_golden_hour financial scam)
  const caseId = "c-seed-cl1-000";
  console.log(`Navigating to /response?caseId=${caseId}...`);
  await page.goto(`${BASE}/response?caseId=${caseId}`, { waitUntil: "domcontentloaded" });
  
  // Wait for the Incident Response Guide section to load
  await page.waitForSelector("text=Incident Response Guide", { timeout: 20000 });
  await page.screenshot({ path: join(OUT, "10-post-report-initial.png"), fullPage: true });

  // 1. Verify the Incident Response Guide title is rendered
  const guideTitle = await page.locator("h2:has-text('Incident Response Guide')").first().textContent();
  if (!guideTitle) {
    failures.push("Incident Response Guide header not found on the page.");
  }
  console.log("Guide Title:", guideTitle);

  // 2. Verify primary workflow badge is shown
  const primaryBadge = page.locator("text=Primary: Money Movement Fraud").first();
  if (!(await primaryBadge.isVisible())) {
    failures.push("Primary workflow badge 'Primary: Money Movement Fraud' is not visible.");
  }

  // 3. Verify secondary workflow badge is shown
  const secondaryBadge = page.locator("text=Secondary: Platform & Suspect Content").first();
  if (!(await secondaryBadge.isVisible())) {
    failures.push("Secondary workflow badge 'Secondary: Platform & Suspect Content' is not visible.");
  }

  // 4. Verify checklist items exist
  const firstCheckbox = page.locator("button[aria-label='Mark as complete']").first();
  if (!(await firstCheckbox.isVisible())) {
    failures.push("Action checklist checkboxes are not visible.");
  } else {
    console.log("Found checkoff checkbox. Clicking to complete step...");
    // 5. Toggle checkoff step
    await firstCheckbox.click();
    await page.waitForTimeout(1000); // Wait for API patch and reload
    await page.screenshot({ path: join(OUT, "11-post-report-checked.png"), fullPage: true });
    
    // Check if checkbox is now checked (renders CircleCheck with aria-label='Mark as incomplete')
    const completedCheckbox = page.locator("button[aria-label='Mark as incomplete']").first();
    if (!(await completedCheckbox.isVisible())) {
      failures.push("Step did not toggle to completed status in the DOM.");
    } else {
      console.log("Step successfully toggled to completed status.");
    }
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
  console.log("Post-Report Workflows E2E flow passed.");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
