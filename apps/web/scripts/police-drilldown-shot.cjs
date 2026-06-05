/**
 * Captures the Police Dashboard with the cluster drilldown dialog open.
 * Run after browser-smoke.ts passes.
 * Usage: node scripts/police-drilldown-shot.cjs
 */
const { chromium } = require("playwright");
const path = require("path");

const BASE = "http://127.0.0.1:3000";
const OUT = "/home/wysh/Documents/coding/cybersaathi/screenshots/v4";

async function run() {
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    executablePath:
      "/home/wysh/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome",
  });

  const viewports = [
    { name: "police-drilldown-desktop", width: 1440, height: 900 },
    { name: "police-drilldown-mobile", width: 375, height: 812 },
  ];

  for (const vp of viewports) {
    const context = await browser.newContext({ viewport: vp });
    const page = await context.newPage();

    const consoleErrors = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    try {
      await page.goto(`${BASE}/dashboards/police`, {
        waitUntil: "domcontentloaded",
        timeout: 20000,
      });
      await page.waitForSelector('table tbody tr[tabindex="0"][role="button"]', {
        timeout: 20000,
      });
      await page.waitForTimeout(1000);

      // Click the first data row to open drilldown dialog
      const rows = page.locator(
        'table tbody tr[tabindex="0"][role="button"]'
      );
      const count = await rows.count();
      if (count > 0) {
        await rows.first().click();
        await page.waitForTimeout(800);
      }

      const shotPath = path.join(OUT, `${vp.name}.png`);
      await page.screenshot({ path: shotPath, fullPage: true });

      const filteredErrors = consoleErrors.filter(
        (e) => !/favicon/i.test(e)
      );
      if (filteredErrors.length) {
        console.error(
          `[warn] ${vp.name} console errors:`,
          JSON.stringify(filteredErrors.slice(0, 3))
        );
      }
      console.log(`[ok] ${vp.name} -> ${shotPath}`);
    } catch (err) {
      console.error(`[fail] ${vp.name}:`, String(err));
    } finally {
      await context.close();
    }
  }

  await browser.close();
  console.log("Done.");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
