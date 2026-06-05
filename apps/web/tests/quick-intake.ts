import { chromium } from "playwright";
import { mkdirSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

const OUT = resolve("screenshots");
mkdirSync(OUT, { recursive: true });

async function main() {
  const defaultPath = "/home/wysh/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome";
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    ...(existsSync(defaultPath) ? { executablePath: defaultPath } : {}),
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  await page.goto("http://127.0.0.1:3000/", { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await page.screenshot({ path: join(OUT, "00-intake-upgraded-desktop.png"), fullPage: true });

  const mobileCtx = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const mobilePage = await mobileCtx.newPage();
  await mobilePage.goto("http://127.0.0.1:3000/", { waitUntil: "networkidle" });
  await mobilePage.waitForTimeout(800);
  await mobilePage.screenshot({ path: join(OUT, "00-intake-upgraded-mobile.png"), fullPage: true });

  await context.close();
  await mobileCtx.close();
  await browser.close();
  console.log("done");
}
main().catch((e) => { console.error(e); process.exit(1); });
