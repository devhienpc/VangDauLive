// src/cron.ts – Orchestrator thu thập dữ liệu tự động cho VàngDầu Live
// Tuân thủ toàn bộ quy tắc:
// 1. USD/VND: chính Vietcombank XML, dự phòng open.er-api.com
// 2. Brent/WTI: chính EIA v2 kèm period dd/MM, dự phòng Yahoo Finance, lưu đúng cột source
// 3. XAU/XAG: chính Metals.dev, dự phòng Yahoo Finance
// 4. Vàng SJC: parse webgia.com, nhân 10 ra VND/lượng
// 5. Xăng dầu: parse webgia.com lấy Vùng 1 cho RON95-III, E5, DO 0.05S, DO 0.001S
// 6. Guardrails: kiểm tra sanity, lệch quá 20% thì ghi ingest_log mức "warning" và giữ giá cũ
// 7. Chỉ insert khi giá đổi hoặc sang ngày mới, tính change_pct so với bản ghi trước
// 8. Promise.allSettled cho toàn bộ các nguồn

import type { Env, PriceRecord } from './types.js';
import { fetchForexPrices } from './adapters/forex.js';
import { fetchOilPrices } from './adapters/oil.js';
import { fetchMetalPrices } from './adapters/metals.js';
import { fetchSjcPrices } from './adapters/sjc.js';
import { fetchFuelPrices, fetchFuelSuggestions } from './adapters/fuel.js';
import { fetchAndStoreNews } from './adapters/news.js';
import { checkPriceSanity } from './adapters/sanity.js';
import { sendTelegramAlert } from './telegram.js';
import {
  getLatestSinglePrice,
  upsertPrices,
  updateTodayCandle,
  logIngest,
  getLatestFuelManual,
  insertFuelSuggestion,
} from './db.js';

export interface AdapterResult {
  adapter: string;
  sourceUsed: string;
  count: number;
  inserted: number;
  skipped: number;
  warnings: string[];
  error?: string | undefined;
}

/**
 * Xử lý lưu các bản ghi giá với đầy đủ kiểm tra sanity, chống lệch giá >20%, dedup và tính change_pct
 */
export async function processAndStorePriceRecords(
  db: D1Database,
  records: PriceRecord[],
): Promise<{ inserted: number; skipped: number; warnings: string[] }> {
  const toInsert: PriceRecord[] = [];
  const warnings: string[] = [];
  let skipped = 0;

  for (const record of records) {
    // 0. Nếu là xăng dầu, kiểm tra xem có giá nhập tay mới hơn không (ưu tiên giá nhập tay)
    if (record.category === 'fuel') {
      try {
        const manualRows = await getLatestFuelManual(db, record.symbol);
        const manual = manualRows[0];
        if (manual && (!record.effective_at || manual.effective_at >= record.effective_at)) {
          const skipMsg = `[Ưu tiên giá thủ công] Bỏ qua ghi đè ${record.symbol} vì giá nhập tay (${manual.effective_at}) mới hơn giá scrape (${record.effective_at ?? 'N/A'}).`;
          warnings.push(skipMsg);
          skipped++;
          continue;
        }
      } catch (err) {
        console.warn(`[Cron] Lỗi kiểm tra fuel_manual cho ${record.symbol}:`, err);
      }
    }

    const prevRecord = await getLatestSinglePrice(db, record.symbol);
    const prevPrice = prevRecord ? (prevRecord.ask ?? prevRecord.bid) : null;
    const currPrice = record.ask ?? record.bid ?? record.sellPrice ?? record.buyPrice;

    // 1. Kiểm tra Sanity & Lệch quá 20%
    const sanityCheck = checkPriceSanity(record, prevPrice);
    if (!sanityCheck.valid) {
      const warnMsg = sanityCheck.reason ?? 'Lỗi kiểm tra sanity';
      warnings.push(warnMsg);
      // Ghi log mức warning vào ingest_log, KHÔNG ghi đè giá mới
      await logIngest(db, record.source, 'warning', warnMsg);
      skipped++;
      continue;
    }

    // 2. Tính change_pct so với bản ghi gần nhất
    if (prevPrice != null && prevPrice > 0 && currPrice != null) {
      record.change_pct = Math.round(((currPrice - prevPrice) / prevPrice) * 10000) / 100;
    } else {
      record.change_pct = 0;
    }

    // 3. Chỉ insert bản ghi mới nếu giá thực sự thay đổi HOẶC đã sang ngày mới
    const recordDate = (record.fetched_at ?? new Date().toISOString()).slice(0, 10);
    const prevDate = prevRecord?.fetched_at ? prevRecord.fetched_at.slice(0, 10) : '';

    const isPriceDifferent = prevPrice == null || (currPrice != null && Math.abs(currPrice - prevPrice) > 0.0001);
    const isNewDay = recordDate !== prevDate;

    if (isPriceDifferent || isNewDay) {
      toInsert.push(record);
    } else {
      skipped++;
    }

    // 4. Cập nhật nến ngày hiện tại (A.3): open = lần đầu ngày, high = max, low = min, close = mới nhất
    if (currPrice != null && currPrice > 0) {
      try {
        await updateTodayCandle(db, record.symbol, recordDate, currPrice, record.source);
      } catch (err) {
        console.warn(`[Cron] Lỗi cập nhật candle cho ${record.symbol}:`, err);
      }
    }
  }

  if (toInsert.length > 0) {
    await upsertPrices(db, toInsert);
  }

  return {
    inserted: toInsert.length,
    skipped,
    warnings,
  };
}

/**
 * Orchestrator chính: chạy tất cả 5 adapters giá + 1 adapter tin tức
 * Dùng Promise.allSettled để một nguồn lỗi không làm ảnh hưởng các nguồn khác
 */
export async function runFetchAll(env: Env): Promise<AdapterResult[]> {
  const results: AdapterResult[] = [];

  // Danh sách các tác vụ thu thập giá
  const tasks = [
    {
      name: 'forex',
      fn: () => fetchForexPrices(),
    },
    {
      name: 'oil',
      fn: () => fetchOilPrices(env.EIA_API_KEY),
    },
    {
      name: 'metals',
      fn: () => fetchMetalPrices(env.METALS_API_KEY),
    },
    {
      name: 'sjc',
      fn: () => fetchSjcPrices(),
    },
    {
      name: 'fuel_suggestions',
      fn: () => fetchFuelSuggestions(),
    },
  ];

  // Chạy đồng thời các adapter với Promise.allSettled
  const settled = await Promise.allSettled(tasks.map((t) => t.fn()));

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    const outcome = settled[i];
    if (!task || !outcome) continue;

    if (outcome.status === 'fulfilled') {
      const val = outcome.value as any;

      // Xử lý riêng cho gợi ý xăng dầu: KHÔNG ghi đè giá hiển thị (Yêu cầu 3 & 4)
      if (task.name === 'fuel_suggestions') {
        const suggestions = val.suggestions || [];
        const fuelWarnings = val.warnings || [];
        let diffCount = 0;
        const alertMessages: string[] = [];

        for (const s of suggestions) {
          // Lưu vào bảng fuel_suggestions
          await insertFuelSuggestion(env.DB, s);

          // Kiểm tra xem gợi ý có khác giá đang hiển thị không
          const manualRows = await getLatestFuelManual(env.DB, s.symbol);
          const currentPrice = manualRows[0]?.price_zone1;
          if (currentPrice != null && Math.abs(s.price_zone1 - currentPrice) > 1) {
            diffCount++;
            alertMessages.push(
              `• <b>${s.symbol}</b>: Gợi ý <b>${s.price_zone1.toLocaleString('vi-VN')}đ</b> (Hiện tại: ${currentPrice.toLocaleString('vi-VN')}đ) từ <i>${s.source}</i>`,
            );
          }
        }

        if (alertMessages.length > 0) {
          const alertHeader =
            `🔔 <b>[VàngDầu Live] Phát hiện gợi ý thay đổi giá xăng dầu:</b>\n` +
            alertMessages.join('\n') +
            `\n\n👉 Vui lòng vào trang /admin để xác nhận duyệt hoặc sửa giá.`;
          await sendTelegramAlert(env, alertHeader);
        }

        const logMsg = `Thu thập ${suggestions.length} gợi ý xăng dầu, ${diffCount} mã có giá khác hiện tại. Gợi ý KHÔNG ghi đè giá hiển thị.`;
        await logIngest(env.DB, 'Scraper Fuel Suggestions', diffCount > 0 ? 'warning' : 'ok', logMsg);

        results.push({
          adapter: 'fuel_suggestions',
          sourceUsed: 'WebGia / Petrolimex (Thông cáo)',
          count: suggestions.length,
          inserted: suggestions.length,
          skipped: 0,
          warnings: fuelWarnings,
        });
        continue;
      }

      const records = val.records || [];
      const sourceUsed = val.sourceUsed || 'Unknown';
      const isStale = val.isStale;
      const effectiveAt = val.effectiveAt;
      const fuelWarning = val.warning;

      // Yêu cầu 3: Nếu nguồn xăng dầu cũ hơn 3 ngày, ghi ingest_log mức warning
      if (task.name === 'fuel' && isStale) {
        await logIngest(
          env.DB,
          sourceUsed,
          'warning',
          fuelWarning || `warning: nguồn có thể đã cũ (Cập nhật lúc ${effectiveAt ?? 'N/A'})`,
        );
      }

      try {
        const storeResult = await processAndStorePriceRecords(env.DB, records);
        const allWarnings = [...storeResult.warnings];
        if (fuelWarning && !allWarnings.includes(fuelWarning)) {
          allWarnings.push(fuelWarning);
        }

        results.push({
          adapter: task.name,
          sourceUsed,
          count: records.length,
          inserted: storeResult.inserted,
          skipped: storeResult.skipped,
          warnings: allWarnings,
        });

        // Ghi log vào ingest_log
        await logIngest(
          env.DB,
          sourceUsed,
          allWarnings.length === 0 ? 'ok' : 'warning',
          `Lấy ${records.length} bản ghi, lưu mới ${storeResult.inserted}, bỏ qua ${storeResult.skipped}. Cảnh báo: ${allWarnings.length}`,
        );
      } catch (storeErr) {
        const msg = storeErr instanceof Error ? storeErr.message : String(storeErr);
        results.push({
          adapter: task.name,
          sourceUsed,
          count: records.length,
          inserted: 0,
          skipped: records.length,
          warnings: [],
          error: msg,
        });
        await logIngest(env.DB, sourceUsed, 'error', `Lỗi lưu DB: ${msg}`);
      }
    } else {
      const reason = outcome.reason;
      const errMsg = reason instanceof Error ? reason.message : String(reason);
      results.push({
        adapter: task.name,
        sourceUsed: 'None',
        count: 0,
        inserted: 0,
        skipped: 0,
        warnings: [],
        error: errMsg,
      });
      // Ghi log lỗi vào ingest_log và giữ nguyên giá cũ
      await logIngest(env.DB, task.name, 'error', `Lỗi fetch: ${errMsg}`);
    }
  }


  // Thu thập tin tức RSS
  try {
    const newsRes = await fetchAndStoreNews(env.DB);
    results.push({
      adapter: 'news',
      sourceUsed: 'RSS Feeds (VnExpress, CafeF, VietnamBiz, Tuổi Trẻ)',
      count: newsRes.totalFetched,
      inserted: newsRes.totalInserted,
      skipped: newsRes.totalFetched - newsRes.totalInserted,
      warnings: newsRes.errors,
      error: newsRes.errors.length > 0 ? newsRes.errors.join('; ') : undefined,
    });
  } catch (newsErr) {
    const msg = newsErr instanceof Error ? newsErr.message : String(newsErr);
    results.push({
      adapter: 'news',
      sourceUsed: 'RSS Feeds',
      count: 0,
      inserted: 0,
      skipped: 0,
      warnings: [],
      error: msg,
    });
  }

  return results;
}
