// apps/web/diagnose_responsive.js
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const VIEWPORTS = [
  { name: 'mobile_360x740', width: 360, height: 740 },
  { name: 'mobile_390x844', width: 390, height: 844 },
  { name: 'tablet_portrait_768x1024', width: 768, height: 1024 },
  { name: 'tablet_landscape_1024x768', width: 1024, height: 768 },
  { name: 'desktop_1440x900', width: 1440, height: 900 },
];

const OUT_DIR = 'C:/Users/devhpc/.gemini/antigravity-ide/brain/6aa986f2-9015-4774-8de3-501de8599e54/diagnostic_before';
if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const results = [];

  for (const vp of VIEWPORTS) {
    const page = await browser.newPage({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 1,
    });

    try {
      await page.goto('http://localhost:5173/', { waitUntil: 'networkidle', timeout: 15000 });
    } catch {
      await page.goto('http://localhost:5173/', { waitUntil: 'load', timeout: 10000 });
    }
    await page.waitForTimeout(1500);

    // Kiểm tra overflow
    const overflowReport = await page.evaluate(() => {
      const docW = document.documentElement.scrollWidth;
      const winW = window.innerWidth;
      const bodyW = document.body.scrollWidth;
      const hasHorizontalScroll = docW > winW || bodyW > winW;

      const overflowingElements = [];
      const allElements = document.querySelectorAll('*');
      for (const el of allElements) {
        const rect = el.getBoundingClientRect();
        // Kiểm tra phần tử vượt quá chiều ngang màn hình
        if (rect.right > winW + 1) {
          overflowingElements.push({
            tag: el.tagName.toLowerCase(),
            id: el.id || '',
            className: (el.className && typeof el.className === 'string') ? el.className.slice(0, 80) : '',
            rectRight: Math.round(rect.right),
            winW,
            overflowBy: Math.round(rect.right - winW),
          });
        }
      }

      // Lấy danh sách kích thước nút / tap targets nhỏ hơn 44x44
      const smallTapTargets = [];
      const clickables = document.querySelectorAll('button, a, input, select');
      for (const el of clickables) {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0 && (rect.width < 44 || rect.height < 44)) {
          smallTapTargets.push({
            tag: el.tagName.toLowerCase(),
            text: (el.innerText || el.getAttribute('aria-label') || el.getAttribute('title') || '').slice(0, 30).trim(),
            w: Math.round(rect.width),
            h: Math.round(rect.height),
            className: (el.className && typeof el.className === 'string') ? el.className.slice(0, 50) : '',
          });
        }
      }

      return {
        docW,
        winW,
        bodyW,
        hasHorizontalScroll,
        overflowCount: overflowingElements.length,
        overflowSample: overflowingElements.slice(0, 8),
        smallTargetsCount: smallTapTargets.length,
        smallTargetsSample: smallTapTargets.slice(0, 6),
      };
    });

    const shotPath = path.join(OUT_DIR, `${vp.name}.png`);
    await page.screenshot({ path: shotPath, fullPage: true });

    results.push({
      viewport: vp,
      overflowReport,
      screenshot: shotPath,
    });

    await page.close();
  }

  await browser.close();

  fs.writeFileSync(
    path.join(OUT_DIR, 'diagnostic_report.json'),
    JSON.stringify(results, null, 2),
    'utf8'
  );
  console.log('Diagnosis completed! Results written to diagnostic_report.json');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
