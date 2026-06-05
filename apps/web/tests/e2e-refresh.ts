/**
 * End-to-end refresh & direct-route navigation test:
 * 1. Open /, click the "Priya: hostel warden UPI scam" preset.
 * 2. Submit intake, route to Golden Hour.
 * 3. Save helpline reference, redirecting to /documents?caseId=xxx.
 * 4. Extract the caseId from the URL.
 * 5. Navigate directly to /emergency?caseId=xxx and verify state (countdown, call script).
 * 6. Refresh /emergency?caseId=xxx and verify state persists.
 * 7. Navigate directly to /documents?caseId=xxx and verify documents render.
 * 8. Refresh /documents?caseId=xxx and verify state persists.
 */
import { chromium } from "playwright";
import { mkdirSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
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
    // 1. Open intake
    console.log("Navigating to home page...");
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.getByTestId("scenario-priya").waitFor({
      state: "visible",
      timeout: 20000,
    });

    // 2. Click Priya preset
    console.log("Clicking Priya preset button...");
    await page.getByTestId("scenario-priya").scrollIntoViewIfNeeded();
    await page.getByTestId("scenario-priya").click();
    await page.waitForTimeout(300);

    // 3. Route to right flow
    console.log("Routing intake...");
    await page.getByRole("button", { name: /Route to the right flow/i }).scrollIntoViewIfNeeded();
    await page.getByRole("button", { name: /Route to the right flow/i }).click();
    
    const continueBtn = page.getByRole("button", { name: /Open Golden Hour flow/i });
    await continueBtn.waitFor({ state: "visible", timeout: 20000 });
    await continueBtn.click();
    
    await page.waitForURL(/\/emergency$/, { timeout: 15000 });
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(500);

    // 4. Save helpline reference to create case and redirect
    console.log("Entering helpline reference and saving...");
    const refInput = page.getByPlaceholder(/1930REF0001/i);
    await refInput.waitFor({ state: "visible", timeout: 5000 });
    await refInput.fill("1930REF0001");
    await page.waitForTimeout(300);
    
    const saveBtn = page.getByRole("button", { name: /Save reference and continue/i });
    await saveBtn.click();
    
    console.log("Waiting for redirection to /documents?caseId=...");
    await page.waitForURL(/\/documents\?caseId=.+/, { timeout: 20000 });
    await page.waitForLoadState("domcontentloaded");
    
    const urlStr = page.url();
    console.log("Current URL:", urlStr);
    const parsedUrl = new URL(urlStr);
    const caseId = parsedUrl.searchParams.get("caseId");
    if (!caseId) {
      throw new Error(`Failed to extract caseId from URL: ${urlStr}`);
    }
    console.log(`Extracted caseId: ${caseId}`);

    // Wait for actual document package UI to load
    await page.waitForSelector("text=Recovery outlook", { timeout: 20000 });

    // 5. Navigate directly to /emergency?caseId=xxx and verify countdown/script render
    console.log(`Directly navigating to /emergency?caseId=${caseId}...`);
    await page.goto(`${BASE}/emergency?caseId=${caseId}`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1000);
    
    // Verify Golden Hour cockpit details
    const heading = await page.getByRole("heading", { level: 1 }).first().textContent();
    if (!heading || !/Golden hour/i.test(heading)) {
      failures.push(`Expected golden-hour heading on direct navigate, got: ${heading}`);
    }
    const countdown = page.getByTestId("golden-hour-countdown");
    const countdownText = (await countdown.first().textContent({ timeout: 2000 })) ?? "";
    if (!/\d\d:\d\d/.test(countdownText)) {
      failures.push(`Expected countdown MM:SS on direct navigate, got: "${countdownText}"`);
    }

    // Verify the saved reference number is pre-filled in the reference input
    const filledRef = await page.locator("input#reference").inputValue();
    if (filledRef !== "1930REF0001") {
      failures.push(`Expected prefilled reference to be '1930REF0001', got: '${filledRef}'`);
    }

    // 6. Refresh /emergency?caseId=xxx and verify state persists
    console.log("Refreshing /emergency page...");
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(1000);

    const headingAfterReload = await page.getByRole("heading", { level: 1 }).first().textContent();
    if (!headingAfterReload || !/Golden hour/i.test(headingAfterReload)) {
      failures.push(`Expected golden-hour heading after refresh, got: ${headingAfterReload}`);
    }
    const filledRefAfterReload = await page.locator("input#reference").inputValue();
    if (filledRefAfterReload !== "1930REF0001") {
      failures.push(`Expected prefilled reference after refresh to be '1930REF0001', got: '${filledRefAfterReload}'`);
    }

    // 7. Navigate directly to /documents?caseId=xxx and verify docs render
    console.log(`Directly navigating to /documents?caseId=${caseId}...`);
    await page.goto(`${BASE}/documents?caseId=${caseId}`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("text=Recovery outlook", { timeout: 20000 });
    
    const docPackageTitle = await page.getByRole("heading", { level: 1 }).first().textContent();
    if (!docPackageTitle || !/Case file/i.test(docPackageTitle)) {
      failures.push(`Expected Case file title on direct documents page, got: ${docPackageTitle}`);
    }

    // 8. Refresh /documents?caseId=xxx and verify state persists
    console.log("Refreshing /documents page...");
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForSelector("text=Recovery outlook", { timeout: 20000 });

    const docPackageTitleAfterReload = await page.getByRole("heading", { level: 1 }).first().textContent();
    if (!docPackageTitleAfterReload || !/Case file/i.test(docPackageTitleAfterReload)) {
      failures.push(`Expected Case file title on documents page after refresh, got: ${docPackageTitleAfterReload}`);
    }

    console.log("All direct navigation and refresh checks passed!");
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
  console.log("Refresh/direct-route E2E flow passed successfully.");
}

run().catch((err) => {
  console.error("Unhandled E2E Refresh Error:", err);
  process.exit(1);
});
