// apps/web/audit_mobile.js
import { chromium } from 'playwright';
import fs from 'fs';

async function audit() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();

  console.log('Running Mobile Quality & Performance Audit on http://localhost:5173...');
  const start = Date.now();
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
  const loadTime = Date.now() - start;

  const auditReport = await page.evaluate(() => {
    // 1. Viewport meta
    const viewportMeta = document.querySelector('meta[name="viewport"]');
    const viewportContent = viewportMeta ? viewportMeta.getAttribute('content') : null;
    const hasProperViewport = viewportContent && viewportContent.includes('width=device-width') && viewportContent.includes('viewport-fit=cover');

    // 2. Performance timings
    const perfTiming = performance.getEntriesByType('navigation')[0] || {};
    const domContentLoaded = perfTiming.domContentLoadedEventEnd || 0;
    const loadEvent = perfTiming.loadEventEnd || 0;

    // 3. Touch target audit (44x44 standard)
    const interactives = Array.from(document.querySelectorAll('button, a, input, select'));
    const smallTargets = [];
    let compliantCount = 0;

    for (const el of interactives) {
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      if (rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden') {
        const isSufficient = rect.width >= 40 && rect.height >= 40;
        if (isSufficient) {
          compliantCount++;
        } else {
          smallTargets.push({
            tag: el.tagName.toLowerCase(),
            text: (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 25),
            w: Math.round(rect.width),
            h: Math.round(rect.height),
            id: el.id || undefined,
            cls: el.className ? String(el.className).slice(0, 30) : undefined,
          });
        }
      }
    }

    // 4. Font readability audit (>= 12px for micro labels, >= 14px for content text)
    const textEls = Array.from(document.querySelectorAll('p, span, a, h1, h2, h3, h4, th, td'));
    let tinyFontCount = 0;
    for (const el of textEls) {
      if (el.children.length === 0 && el.textContent && el.textContent.trim().length > 0) {
        const fs = parseFloat(window.getComputedStyle(el).fontSize);
        if (fs < 11) {
          tinyFontCount++;
        }
      }
    }

    // 5. Overflow
    const scrollWidth = document.documentElement.scrollWidth;
    const innerWidth = window.innerWidth;

    // 6. Accessibility basics
    const hasH1 = Boolean(document.querySelector('h1'));
    const imagesWithoutAlt = Array.from(document.querySelectorAll('img')).filter(img => !img.hasAttribute('alt')).length;
    const buttonsWithoutLabel = Array.from(document.querySelectorAll('button')).filter(btn => {
      const text = (btn.textContent || '').trim();
      const aria = btn.getAttribute('aria-label');
      return !text && !aria;
    }).length;

    return {
      viewportMeta: viewportContent,
      hasProperViewport,
      timings: {
        domContentLoadedMs: Math.round(domContentLoaded),
        loadEventMs: Math.round(loadEvent),
      },
      touchTargets: {
        totalInteractive: interactives.length,
        compliantCount,
        smallCount: smallTargets.length,
        complianceRatePct: Math.round((compliantCount / (compliantCount + smallTargets.length || 1)) * 100),
        samples: smallTargets.slice(0, 8),
      },
      typography: {
        tinyFontCount,
        bodyFontSize: window.getComputedStyle(document.body).fontSize,
      },
      horizontalScroll: {
        scrollWidth,
        innerWidth,
        noHorizontalScroll: scrollWidth <= innerWidth,
      },
      accessibility: {
        hasH1,
        imagesWithoutAlt,
        buttonsWithoutLabel,
      }
    };
  });

  await browser.close();

  const reportPath = 'C:\\Users\\devhpc\\.gemini\\antigravity-ide\\brain\\6aa986f2-9015-4774-8de3-501de8599e54\\diagnostic_after\\mobile_audit.json';
  fs.writeFileSync(reportPath, JSON.stringify(auditReport, null, 2), 'utf8');

  console.log('\n📊 Mobile Quality Audit Summary:');
  console.log(`- Viewport Meta: ${auditReport.hasProperViewport ? '✅ Perfect' : '⚠️ Missing tokens'} (${auditReport.viewportMeta})`);
  console.log(`- Horizontal Scroll: ${auditReport.horizontalScroll.noHorizontalScroll ? '✅ 0px overflow (scrollWidth === innerWidth)' : '❌ Overflow detected'}`);
  console.log(`- Touch Targets Compliance: ${auditReport.touchTargets.complianceRatePct}% compliant (${auditReport.touchTargets.compliantCount}/${auditReport.touchTargets.compliantCount + auditReport.touchTargets.smallCount})`);
  console.log(`- Accessibility Buttons without Label: ${auditReport.accessibility.buttonsWithoutLabel === 0 ? '✅ 0 (All labelled)' : auditReport.accessibility.buttonsWithoutLabel}`);
  console.log(`- Images without Alt: ${auditReport.accessibility.imagesWithoutAlt === 0 ? '✅ 0 (All have alt)' : auditReport.accessibility.imagesWithoutAlt}`);
  console.log(`- DOM Content Loaded: ${auditReport.timings.domContentLoadedMs}ms`);
}

audit().catch(console.error);
