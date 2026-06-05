import { chromium, type ConsoleMessage } from "playwright";
import { mkdirSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

interface Viewport {
  width: number;
  height: number;
}

interface PageSpec {
  name: string;
  path: string;
  viewport: Viewport;
}

const BASE = "http://127.0.0.1:3000";
const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(TEST_DIR, "../../../screenshots");
mkdirSync(OUT, { recursive: true });

const PAGES: PageSpec[] = [
  { name: "01-intake-desktop", path: "/", viewport: { width: 1440, height: 900 } },
  { name: "01-intake-mobile", path: "/", viewport: { width: 375, height: 812 } },
  { name: "02-emergency-desktop", path: "/emergency", viewport: { width: 1440, height: 900 } },
  { name: "02-emergency-mobile", path: "/emergency", viewport: { width: 375, height: 812 } },
  { name: "03-documents-desktop", path: "/documents", viewport: { width: 1440, height: 900 } },
  { name: "03-documents-mobile", path: "/documents", viewport: { width: 375, height: 812 } },
  { name: "04-fall-back-desktop", path: "/fall-back", viewport: { width: 1440, height: 900 } },
  { name: "04-fall-back-mobile", path: "/fall-back", viewport: { width: 375, height: 812 } },
{ name: "06-dashboards-heatmap-desktop", path: "/dashboards/heatmap", viewport: { width: 1440, height: 900 } },
  { name: "07-dashboards-journalist-desktop", path: "/dashboards/journalist", viewport: { width: 1440, height: 900 } },
  { name: "08-dashboards-police-desktop", path: "/dashboards/police", viewport: { width: 1440, height: 900 } },
  { name: "09-accountability-desktop", path: "/accountability", viewport: { width: 1440, height: 900 } },
  { name: "09-accountability-mobile", path: "/accountability", viewport: { width: 375, height: 812 } },
  { name: "10-demo-desktop", path: "/demo", viewport: { width: 1440, height: 900 } },
  { name: "10-demo-mobile", path: "/demo", viewport: { width: 375, height: 812 } },
];

async function run() {
  const defaultPath = "/home/wysh/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome";
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    ...(existsSync(defaultPath) ? { executablePath: defaultPath } : {}),
  });
  const failures: string[] = [];
  for (const spec of PAGES) {
    const context = await browser.newContext({ viewport: spec.viewport });
    const page = await context.newPage();
    const consoleErrors: string[] = [];
    page.on("console", (msg: ConsoleMessage) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    try {
      const response = await page.goto(`${BASE}${spec.path}`, {
        waitUntil: "domcontentloaded",
        timeout: 20000,
      });
      if (!response || response.status() >= 500) {
        failures.push(`${spec.name} ${spec.path} status ${response?.status() ?? "none"}`);
      }
      await page.waitForTimeout(700);
      const shotPath = join(OUT, `${spec.name}.png`);
      await page.screenshot({ path: shotPath, fullPage: true });
      const filteredErrors = consoleErrors.filter(
        (e) => !/favicon/i.test(e) && !/_next\/webpack-hmr/i.test(e),
      );
      if (filteredErrors.length) {
        failures.push(`${spec.name} console errors: ${JSON.stringify(filteredErrors.slice(0, 3))}`);
      }
      console.log(`[ok] ${spec.name} ${spec.path} -> ${shotPath}`);
    } catch (err) {
      failures.push(`${spec.name} ${spec.path} exception: ${String(err)}`);
    } finally {
      await context.close();
    }
  }
  await browser.close();
  if (failures.length) {
    console.error("FAILURES:");
    for (const f of failures) console.error(" -", f);
    process.exit(1);
  }
  console.log("All browser checks passed.");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
