import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const WEB_DIR = path.resolve(ROOT_DIR, 'apps/web');
const ARTIFACT_DIR = 'C:\\Users\\devhpc\\.gemini\\antigravity-ide\\brain\\e6ec9c23-2394-43d2-bf02-badcb6198db0';

async function main() {
  const playwrightPath = pathToFileURL(path.resolve(WEB_DIR, 'node_modules/playwright/index.mjs')).href;
  const { chromium } = await import(playwrightPath);
  const browser = await chromium.launch({ headless: true });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1.5,
  });
  const page = await context.newPage();

  console.log('Navigating to live site...');
  await page.goto('https://vangdau-live.hienpcthichlamit.workers.dev', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);

  const forecastSection = page.locator('#fuel-forecast');
  if (await forecastSection.count() > 0) {
    await forecastSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1000);
    const liveBlockPath = path.join(ARTIFACT_DIR, 'live_forecast_block.png');
    await page.screenshot({ path: liveBlockPath, fullPage: false });
    console.log(`Saved screenshot to ${liveBlockPath}`);
  }

  await browser.close();
}

main().catch(console.error);
