const { chromium } = require("/home/wysh/Documents/coding/cybersaathi/apps/web/node_modules/playwright");

const ROUTES = [
  { path: "/", name: "intake", mobile: false },
  { path: "/", name: "intake-mobile", mobile: true },
  { path: "/emergency", name: "emergency", mobile: false },
  { path: "/emergency", name: "emergency-mobile", mobile: true },
  { path: "/documents", name: "documents", mobile: false },
  { path: "/documents", name: "documents-mobile", mobile: true },
  { path: "/dashboards/heatmap", name: "heatmap", mobile: false },
  { path: "/dashboards/heatmap", name: "heatmap-mobile", mobile: true },
  { path: "/dashboards/journalist", name: "journalist", mobile: false },
  { path: "/dashboards/police", name: "police", mobile: false },
  { path: "/dashboards/public", name: "public", mobile: false },
  { path: "/accountability", name: "accountability", mobile: false },
  { path: "/accountability", name: "accountability-mobile", mobile: true },
  { path: "/demo", name: "demo", mobile: false },
  { path: "/demo", name: "demo-mobile", mobile: true },
  { path: "/fall-back", name: "fallback", mobile: false },
];

const VIEWPORTS = {
  desktop: { width: 1280, height: 800 },
  mobile: { width: 390, height: 844 },
};

const EXEC = "/home/wysh/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome";
const OUT_DIR = "/home/wysh/Documents/coding/cybersaathi/screenshots-v4";

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: EXEC,
  });
  for (const route of ROUTES) {
    const viewport = route.mobile ? VIEWPORTS.mobile : VIEWPORTS.desktop;
    const ctx = await browser.newContext({ viewport });
    const page = await ctx.newPage();
    try {
      await page.goto(`http://127.0.0.1:3000${route.path}`, {
        waitUntil: "networkidle",
        timeout: 30000,
      });
    } catch {
      await page.goto(`http://127.0.0.1:3000${route.path}`, {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });
    }
    await page.waitForTimeout(800);
    await page.screenshot({
      path: `${OUT_DIR}/${route.name}.png`,
      fullPage: true,
    });
    console.log(`OK ${route.name} (${viewport.width}x${viewport.height})`);
    await ctx.close();
  }
  await browser.close();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
