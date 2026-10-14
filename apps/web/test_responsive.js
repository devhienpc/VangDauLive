// apps/web/test_responsive.js
// Automated responsive test script using Playwright

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const ARTIFACT_DIR = 'C:\\Users\\devhpc\\.gemini\\antigravity-ide\\brain\\6aa986f2-9015-4774-8de3-501de8599e54\\diagnostic_after';
const BASE_URL = 'http://localhost:5173';

const VIEWPORTS = [
  { name: 'mobile_320x568', width: 320, height: 568, deviceScaleFactor: 2, isMobile: true, label: 'Mobile Extra Small (320px)' },
  { name: 'mobile_360x740', width: 360, height: 740, deviceScaleFactor: 2, isMobile: true, label: 'Mobile Android (360x740)' },
  { name: 'mobile_390x844', width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, label: 'Mobile iPhone (390x844)' },
  { name: 'mobile_landscape_740x360', width: 740, height: 360, deviceScaleFactor: 2, isMobile: true, label: 'Mobile Landscape (740x360)' },
  { name: 'tablet_portrait_768x1024', width: 768, height: 1024, deviceScaleFactor: 2, isMobile: true, label: 'Tablet Portrait (768x1024)' },
  { name: 'tablet_landscape_1024x768', width: 1024, height: 768, deviceScaleFactor: 2, isMobile: false, label: 'Tablet Landscape (1024x768)' },
  { name: 'desktop_1440x900', width: 1440, height: 900, deviceScaleFactor: 1, isMobile: false, label: 'Desktop (1440x900)' },
];

async function runTests() {
  if (!fs.existsSync(ARTIFACT_DIR)) {
    fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  }

  console.log('🚀 Starting Automated Responsive Validation Suite...');
  const browser = await chromium.launch({ headless: true });
  const results = [];
  let allPassed = true;

  for (const vp of VIEWPORTS) {
    console.log(`\n🔍 Testing Viewport: ${vp.label} [${vp.width}x${vp.height}]`);
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: vp.deviceScaleFactor,
      isMobile: vp.isMobile,
      hasTouch: vp.isMobile,
    });

    const page = await context.newPage();

    try {
      await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
      // Allow charts and animations to settle
      await page.waitForTimeout(1500);

      // Measure scrollWidth vs innerWidth
      const metrics = await page.evaluate(() => {
        const docElem = document.documentElement;
        const body = document.body;
        const innerWidth = window.innerWidth;
        const scrollWidth = Math.max(docElem.scrollWidth, body.scrollWidth);
        const hasHorizontalOverflow = scrollWidth > innerWidth;

        // Check if any element protrudes past window.innerWidth
        const protruding = [];
        const allElements = document.querySelectorAll('*');
        for (const el of allElements) {
          const rect = el.getBoundingClientRect();
          if (rect.right > innerWidth + 1 && rect.width > 0) {
            const style = window.getComputedStyle(el);
            // Ignore fixed background or hidden elements
            if (style.display !== 'none' && style.visibility !== 'hidden' && style.position !== 'fixed') {
              protruding.push({
                tag: el.tagName.toLowerCase(),
                id: el.id || undefined,
                className: el.className ? String(el.className).slice(0, 40) : undefined,
                right: Math.round(rect.right),
                width: Math.round(rect.width),
                overflowAmount: Math.round(rect.right - innerWidth),
              });
            }
          }
        }

        // Measure touch targets on mobile
        const smallTouchTargets = [];
        if (window.innerWidth < 768) {
          const clickables = document.querySelectorAll('button, a, input, select');
          for (const el of clickables) {
            const rect = el.getBoundingClientRect();
            const style = window.getComputedStyle(el);
            if (rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden') {
              // We check if either width or height is less than 36px (strict minimum for compact pills)
              if (rect.width < 36 || rect.height < 36) {
                smallTouchTargets.push({
                  tag: el.tagName.toLowerCase(),
                  id: el.id || undefined,
                  className: el.className ? String(el.className).slice(0, 30) : undefined,
                  text: (el.textContent || '').trim().slice(0, 20),
                  w: Math.round(rect.width),
                  h: Math.round(rect.height),
                });
              }
            }
          }
        }

        return {
          innerWidth,
          scrollWidth,
          hasHorizontalOverflow,
          protrudingCount: protruding.length,
          protrudingElements: protruding.slice(0, 5),
          smallTouchTargetCount: smallTouchTargets.length,
          smallTouchTargets: smallTouchTargets.slice(0, 5),
        };
      });

      // Capture full-page screenshot
      const screenshotPath = path.join(ARTIFACT_DIR, `${vp.name}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });

      const passed = !metrics.hasHorizontalOverflow;
      if (!passed) allPassed = false;

      results.push({
        viewport: vp.label,
        width: vp.width,
        height: vp.height,
        scrollWidth: metrics.scrollWidth,
        innerWidth: metrics.innerWidth,
        hasHorizontalOverflow: metrics.hasHorizontalOverflow,
        protrudingCount: metrics.protrudingCount,
        protrudingElements: metrics.protrudingElements,
        smallTouchTargetCount: metrics.smallTouchTargetCount,
        screenshot: `${vp.name}.png`,
        status: passed ? 'PASS' : 'FAIL',
      });

      console.log(`   Status: ${passed ? '✅ PASS' : '❌ FAIL'} | scrollWidth: ${metrics.scrollWidth}px vs innerWidth: ${metrics.innerWidth}px`);
      if (metrics.hasHorizontalOverflow) {
        console.log(`   ⚠️ Elements causing overflow:`, metrics.protrudingElements);
      }
      console.log(`   📸 Screenshot saved: ${screenshotPath}`);

    } catch (err) {
      console.error(`   ❌ Error testing ${vp.label}:`, err.message);
      results.push({
        viewport: vp.label,
        error: err.message,
        status: 'ERROR',
      });
      allPassed = false;
    } finally {
      await context.close();
    }
  }

  // Interactive Test: Open drawer on mobile (390x844) and take screenshot
  console.log('\n📱 Testing Mobile Navigation Drawer interaction...');
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  const mobilePage = await mobileContext.newPage();
  await mobilePage.goto(BASE_URL, { waitUntil: 'networkidle' });
  await mobilePage.waitForTimeout(1000);

  // Click hamburger menu button
  const menuBtn = mobilePage.locator('#btn-menu-mobile');
  if (await menuBtn.isVisible()) {
    await menuBtn.click();
    await mobilePage.waitForTimeout(400); // wait for slide transition
    const drawerScreenshot = path.join(ARTIFACT_DIR, 'mobile_drawer_open.png');
    await mobilePage.screenshot({ path: drawerScreenshot });
    console.log(`   ✅ Drawer opened successfully. Screenshot saved: ${drawerScreenshot}`);
  }
  await mobileContext.close();

  await browser.close();

  // Save report
  const reportPath = path.join(ARTIFACT_DIR, 'test_report.json');
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2), 'utf8');
  console.log(`\n📊 Complete test report saved to: ${reportPath}`);

  if (allPassed) {
    console.log('\n🎉 ALL RESPONSIVE TESTS PASSED! ZERO HORIZONTAL OVERFLOW DETECTED.');
    process.exit(0);
  } else {
    console.log('\n❌ SOME RESPONSIVE TESTS FAILED. Check report for details.');
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
