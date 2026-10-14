// scripts/capture-forecast-screenshots.js
// Script chụp ảnh màn hình desktop và mobile cho tính năng Nhận định giá xăng

import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const WEB_DIR = path.resolve(ROOT_DIR, 'apps/web');
const ARTIFACT_DIR = 'C:\\Users\\devhpc\\.gemini\\antigravity-ide\\brain\\e6ec9c23-2394-43d2-bf02-badcb6198db0';
const PORT = 5174;
const BASE_URL = `http://localhost:${PORT}`;

async function waitUrl(url, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status === 200 || res.status === 304) return true;
    } catch {
      // wait
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`Timeout waiting for ${url}`);
}

async function run() {
  if (!fs.existsSync(ARTIFACT_DIR)) {
    fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  }

  console.log(`[1/4] Khởi động Vite preview trên cổng ${PORT}...`);
  const previewProcess = spawn(
    'npx.cmd',
    ['vite', 'preview', '--port', String(PORT), '--strictPort'],
    {
      cwd: WEB_DIR,
      stdio: 'pipe',
      shell: true,
    }
  );

  previewProcess.stdout?.on('data', (d) => console.log(`[Preview] ${d.toString().trim()}`));
  previewProcess.stderr?.on('data', (d) => console.error(`[Preview Err] ${d.toString().trim()}`));

  try {
    await waitUrl(BASE_URL);
    console.log(`[2/4] Máy chủ Vite preview sẵn sàng tại ${BASE_URL}`);
    const playwrightPath = pathToFileURL(path.resolve(WEB_DIR, 'node_modules/playwright/index.mjs')).href;
    const { chromium } = await import(playwrightPath);
    const browser = await chromium.launch({ headless: true });

    // ── 1. Desktop Mode (1440 x 900) ──────────────────────────────────
    console.log('[3/4] Chụp ảnh màn hình Desktop (1440x900)...');
    const desktopContext = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1.5,
    });
    const desktopPage = await desktopContext.newPage();

    // 1a. Desktop Home Page (Toàn cảnh 5 thẻ KPI + Khối Nhận định)
    await desktopPage.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await desktopPage.waitForTimeout(2000);

    const desktopHomePath = path.join(ARTIFACT_DIR, 'desktop_forecast_home.png');
    await desktopPage.screenshot({ path: desktopHomePath, fullPage: false });
    console.log(`   ✓ Đã lưu: ${desktopHomePath}`);

    // 1b. Desktop Scroll xuống khối Nhận định chi tiết
    const forecastSection = desktopPage.locator('#fuel-forecast');
    if (await forecastSection.count() > 0) {
      await forecastSection.scrollIntoViewIfNeeded();
      await desktopPage.waitForTimeout(800);
      const desktopBlockPath = path.join(ARTIFACT_DIR, 'desktop_forecast_block.png');
      await desktopPage.screenshot({ path: desktopBlockPath, fullPage: false });
      console.log(`   ✓ Đã lưu: ${desktopBlockPath}`);
    }

    // 1c. Desktop Trang Độ chính xác /nhan-dinh/do-chinh-xac
    await desktopPage.goto(`${BASE_URL}/nhan-dinh/do-chinh-xac`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await desktopPage.waitForTimeout(1500);
    const desktopAccuracyPath = path.join(ARTIFACT_DIR, 'desktop_accuracy_page.png');
    await desktopPage.screenshot({ path: desktopAccuracyPath, fullPage: false });
    console.log(`   ✓ Đã lưu: ${desktopAccuracyPath}`);

    await desktopContext.close();

    // ── 2. Mobile Mode (390 x 844 iPhone 14) ──────────────────────────
    console.log('[4/4] Chụp ảnh màn hình Mobile (390x844)...');
    const mobileContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    });
    const mobilePage = await mobileContext.newPage();

    // 2a. Mobile Home Page cuộn đến khối Nhận định (xếp 1 cột)
    await mobilePage.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await mobilePage.waitForTimeout(2000);

    const mobileForecastEl = mobilePage.locator('#fuel-forecast');
    if (await mobileForecastEl.count() > 0) {
      await mobileForecastEl.scrollIntoViewIfNeeded();
      await mobilePage.waitForTimeout(800);
    }

    const mobileHomePath = path.join(ARTIFACT_DIR, 'mobile_forecast_home.png');
    await mobilePage.screenshot({ path: mobileHomePath, fullPage: false });
    console.log(`   ✓ Đã lưu: ${mobileHomePath}`);

    // 2b. Mobile Trang Độ chính xác
    await mobilePage.goto(`${BASE_URL}/nhan-dinh/do-chinh-xac`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await mobilePage.waitForTimeout(1500);

    const mobileAccuracyPath = path.join(ARTIFACT_DIR, 'mobile_accuracy_page.png');
    await mobilePage.screenshot({ path: mobileAccuracyPath, fullPage: false });
    console.log(`   ✓ Đã lưu: ${mobileAccuracyPath}`);

    await mobileContext.close();
    await browser.close();

    console.log('\n🎉 Hoàn thành xuất sắc toàn bộ ảnh chụp màn hình desktop và mobile!');
  } finally {
    previewProcess.kill();
  }
}

run().catch((err) => {
  console.error('Lỗi chụp ảnh:', err);
  process.exit(1);
});
