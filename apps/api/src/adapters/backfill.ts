// src/adapters/backfill.ts
// Script backfill dữ liệu nến OHLC (mặc định 2 năm) từ Yahoo chart API
// Đảm bảo mỗi chuỗi dữ liệu chỉ sử dụng một nguồn đồng nhất (Yahoo Finance).

import type { DailyCandle, Env } from '../types.js';
import { upsertDailyCandles } from '../db.js';

/**
 * Bản đồ mã Yahoo Ticker sang các symbol lưu trữ trong bảng daily_candles
 * - RB=F: Xăng RBOB (mã tham chiếu xăng thành phẩm)
 * - HO=F: Dầu sưởi / Diesel ULSD (mã tham chiếu dầu diesel)
 * - BZ=F: Dầu Brent (lưu cả BZ=F và alias BRENT)
 * - CL=F: Dầu WTI (lưu cả CL=F và alias WTI)
 * - GC=F: Vàng thế giới XAU_USD
 * - SI=F: Bạc thế giới XAG_USD
 */
export const YAHOO_SYMBOLS_MAP: Record<string, string[]> = {
  'RB=F': ['RB=F'],
  'HO=F': ['HO=F'],
  'BZ=F': ['BZ=F', 'BRENT'],
  'CL=F': ['CL=F', 'WTI'],
  'GC=F': ['XAU_USD'],
  'SI=F': ['XAG_USD'],
};

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * Làm tròn giá: đối với các hàng hóa giá nhỏ (< 10 USD như xăng RBOB, Heating Oil),
 * giữ độ chính xác 4 chữ số thập phân (USD/gallon); đối với tài sản >= 10 làm tròn 2 chữ số.
 */
function roundPrice(val: number): number {
  if (val >= 10) return Math.round(val * 100) / 100;
  return Math.round(val * 10000) / 10000;
}

/**
 * Lấy nến OHLC từ Yahoo Finance chart API cho 1 ticker với range tùy chọn (mặc định: 2y)
 */
export async function fetchYahooCandles(
  yahooTicker: string,
  targetSymbols: string | string[],
  range: string = '2y',
): Promise<DailyCandle[]> {
  const symbols = Array.isArray(targetSymbols) ? targetSymbols : [targetSymbols];
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooTicker)}?range=${encodeURIComponent(range)}&interval=1d`;

  const res = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    throw new Error(`Yahoo Finance API trả về HTTP ${res.status} cho ticker ${yahooTicker}`);
  }

  const json: any = await res.json();
  const result = json?.chart?.result?.[0];
  if (!result || !result.timestamp || !result.indicators?.quote?.[0]) {
    throw new Error(`Cấu trúc phản hồi từ Yahoo Finance không hợp lệ cho ticker ${yahooTicker}`);
  }

  const timestamps: number[] = result.timestamp;
  const quote = result.indicators.quote[0];
  const opens: (number | null)[] = quote.open || [];
  const highs: (number | null)[] = quote.high || [];
  const lows: (number | null)[] = quote.low || [];
  const closes: (number | null)[] = quote.close || [];

  const candles: DailyCandle[] = [];
  const seenDates = new Set<string>();

  for (let i = 0; i < timestamps.length; i++) {
    const ts = timestamps[i];
    const rawO = opens[i];
    const rawH = highs[i];
    const rawL = lows[i];
    const rawC = closes[i];

    if (!ts || rawO == null || rawH == null || rawL == null || rawC == null) {
      continue;
    }

    const o = Number(rawO);
    const h = Number(rawH);
    const l = Number(rawL);
    const c = Number(rawC);

    // Sanity check: giá > 0 và số hợp lệ
    if (isNaN(o) || isNaN(h) || isNaN(l) || isNaN(c) || o <= 0 || c <= 0) {
      continue;
    }

    // Đảm bảo sanity: high là đỉnh cao nhất, low là đáy thấp nhất
    const saneHigh = Math.max(h, o, c);
    const saneLow = Math.max(0.0001, Math.min(l, o, c));

    if (saneHigh < saneLow) {
      continue;
    }

    const dateStr = new Date(ts * 1000).toISOString().slice(0, 10);
    if (seenDates.has(dateStr)) continue;
    seenDates.add(dateStr);

    const openVal = roundPrice(o);
    const highVal = roundPrice(saneHigh);
    const lowVal = roundPrice(saneLow);
    const closeVal = roundPrice(c);

    for (const sym of symbols) {
      candles.push({
        symbol: sym,
        date: dateStr,
        open: openVal,
        high: highVal,
        low: lowVal,
        close: closeVal,
        source: 'Yahoo Finance',
      });
    }
  }

  return candles;
}

/** Wrapper tương thích ngược */
export async function fetchYahooCandles1Y(
  yahooTicker: string,
  targetSymbol: string,
): Promise<DailyCandle[]> {
  return fetchYahooCandles(yahooTicker, targetSymbol, '1y');
}

/**
 * Backfill các tài sản trong nước (SJC, Xăng dầu, Ngoại tệ) từ bảng prices đã có
 * Với các tài sản này: open = high = low = close
 */
export async function backfillFromExistingPrices(db: D1Database): Promise<number> {
  const { results } = await db
    .prepare(
      `SELECT
         symbol,
         substr(fetched_at, 1, 10) as date,
         COALESCE(ask, bid) as price,
         source
       FROM prices
       WHERE (ask > 0 OR bid > 0)
       GROUP BY symbol, substr(fetched_at, 1, 10)
       ORDER BY date ASC`,
    )
    .all<{ symbol: string; date: string; price: number; source: string }>();

  if (!results || results.length === 0) return 0;

  const candles: DailyCandle[] = [];
  for (const row of results) {
    const p = Number(row.price);
    if (isNaN(p) || p <= 0 || !row.date) continue;

    const sourceStr = String(row.source || 'Hệ thống');
    const symStr = String(row.symbol);

    candles.push({
      symbol: symStr,
      date: String(row.date),
      open: p,
      high: p,
      low: p,
      close: p,
      source: sourceStr,
    });

    // Nếu là USD_VND, bổ sung thêm bí danh USD/VND
    if (symStr === 'USD_VND') {
      candles.push({
        symbol: 'USD/VND',
        date: String(row.date),
        open: p,
        high: p,
        low: p,
        close: p,
        source: sourceStr,
      });
    }
  }

  return await upsertDailyCandles(db, candles);
}

/**
 * Hàm điều phối toàn bộ quá trình backfill (2 năm dữ liệu Yahoo Finance cho các mã)
 */
export async function runFullBackfill(
  db: D1Database,
  env?: Env,
  range: string = '2y',
): Promise<{ total: number; details: Record<string, number> }> {
  const details: Record<string, number> = {};
  let total = 0;

  // 1. Backfill Yahoo Finance OHLC (2 năm) cho RB=F, HO=F, BZ=F, CL=F, GC=F, SI=F
  for (const [ticker, targetSymbols] of Object.entries(YAHOO_SYMBOLS_MAP)) {
    try {
      const candles = await fetchYahooCandles(ticker, targetSymbols, range);
      if (candles.length > 0) {
        const count = await upsertDailyCandles(db, candles);
        total += count;
        // Ghi nhận số dòng thành công cho từng symbol
        for (const sym of targetSymbols) {
          const symCount = candles.filter((c) => c.symbol === sym).length;
          details[sym] = symCount;
        }
        console.log(`[Backfill] Yahoo Finance ${ticker} -> [${targetSymbols.join(', ')}]: ${candles.length} nến (${range})`);
      }
    } catch (err) {
      console.error(`[Backfill] Lỗi khi lấy ${ticker}:`, err);
      for (const sym of targetSymbols) {
        details[sym] = 0;
      }
    }
  }

  // 2. Backfill các tài sản nội địa từ bảng prices hiện có
  try {
    const domesticCount = await backfillFromExistingPrices(db);
    details['domestic_prices'] = domesticCount;
    total += domesticCount;
    console.log(`[Backfill] Domestic prices: ${domesticCount} nến`);
  } catch (err) {
    console.error('[Backfill] Lỗi khi backfill từ bảng prices:', err);
  }

  return { total, details };
}
