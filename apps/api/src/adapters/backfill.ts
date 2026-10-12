// src/adapters/backfill.ts
// Script backfill dữ liệu nến OHLC 1 năm từ Yahoo chart API và EIA API

import type { DailyCandle, Env } from '../types.js';
import { upsertDailyCandles } from '../db.js';

const YAHOO_SYMBOLS: Record<string, string> = {
  'GC=F': 'XAU_USD', // Vàng thế giới
  'SI=F': 'XAG_USD', // Bạc thế giới
  'BZ=F': 'BRENT',   // Dầu Brent
  'CL=F': 'WTI',     // Dầu WTI
};

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * Lấy OHLC 1 năm từ Yahoo Finance chart API cho 1 symbol
 */
export async function fetchYahooCandles1Y(
  yahooTicker: string,
  targetSymbol: string,
): Promise<DailyCandle[]> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooTicker)}?range=1y&interval=1d`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(12000),
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

    // Đảm bảo tính toán sanity chặt chẽ: high là đỉnh cao nhất, low là đáy thấp nhất
    const saneHigh = Math.max(h, o, c);
    const saneLow = Math.max(0.0001, Math.min(l, o, c));

    if (saneHigh < saneLow) {
      continue;
    }

    const dateStr = new Date(ts * 1000).toISOString().slice(0, 10);
    if (seenDates.has(dateStr)) continue;
    seenDates.add(dateStr);

    candles.push({
      symbol: targetSymbol,
      date: dateStr,
      open: Math.round(o * 100) / 100,
      high: Math.round(saneHigh * 100) / 100,
      low: Math.round(saneLow * 100) / 100,
      close: Math.round(c * 100) / 100,
      source: 'Yahoo Finance',
    });
  }

  return candles;
}

/**
 * Lấy dữ liệu 1 năm từ EIA cho dầu Brent / WTI (khi có EIA_API_KEY)
 * Với EIA chỉ có 1 giá/ngày -> open = high = low = close
 */
export async function fetchEiaCandles1Y(
  apiKey: string,
  series: 'RBRTE' | 'RWTC',
  targetSymbol: string,
): Promise<DailyCandle[]> {
  if (!apiKey) return [];

  const url = `https://api.eia.gov/v2/petroleum/pri/spt/data/?api_key=${apiKey}&frequency=daily&data[0]=value&facets[series][]=${series}&sort[0][column]=period&sort[0][direction]=asc&length=365`;
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(12000),
  });

  if (!res.ok) {
    console.warn(`[Backfill EIA] HTTP ${res.status}`);
    return [];
  }

  const json: any = await res.json();
  const data: any[] = json?.response?.data || [];
  const candles: DailyCandle[] = [];

  for (const item of data) {
    if (!item.period || item.value == null) continue;
    const val = typeof item.value === 'string' ? parseFloat(item.value) : Number(item.value);
    if (isNaN(val) || val <= 0) continue;

    candles.push({
      symbol: targetSymbol,
      date: item.period,
      open: Math.round(val * 100) / 100,
      high: Math.round(val * 100) / 100,
      low: Math.round(val * 100) / 100,
      close: Math.round(val * 100) / 100,
      source: 'EIA',
    });
  }

  return candles;
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

    candles.push({
      symbol: String(row.symbol),
      date: String(row.date),
      open: p,
      high: p,
      low: p,
      close: p,
      source: String(row.source || 'Hệ thống'),
    });
  }

  return await upsertDailyCandles(db, candles);
}

/**
 * Hàm điều phối toàn bộ quá trình backfill
 */
export async function runFullBackfill(
  db: D1Database,
  env: Env,
): Promise<{ total: number; details: Record<string, number> }> {
  const details: Record<string, number> = {};
  let total = 0;

  // 1. Backfill Yahoo Finance OHLC cho GC=F, SI=F, BZ=F, CL=F
  for (const [ticker, targetSymbol] of Object.entries(YAHOO_SYMBOLS)) {
    try {
      const candles = await fetchYahooCandles1Y(ticker, targetSymbol);
      if (candles.length > 0) {
        const count = await upsertDailyCandles(db, candles);
        details[targetSymbol] = count;
        total += count;
        console.log(`[Backfill] Yahoo Finance ${ticker} -> ${targetSymbol}: ${count} nến`);
      }
    } catch (err) {
      console.error(`[Backfill] Lỗi khi lấy ${ticker}:`, err);
      details[targetSymbol] = 0;
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
