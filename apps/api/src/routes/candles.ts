// src/routes/candles.ts
// GET /api/candles?symbol=XAU_USD&range=1w|1m|3m|6m|1y|all

import { Hono } from 'hono';
import type { Env } from '../types.js';
import { getDailyCandles } from '../db.js';
import { getFromCache, putInCache } from '../cache.js';

const candles = new Hono<{ Bindings: Env }>();

const RANGE_DAYS: Record<string, number | null> = {
  '1w': 7,
  '1m': 30,
  '3m': 90,
  '6m': 180,
  '1y': 365,
  'all': null,
};

function calculateStartDate(range: string): string | undefined {
  const days = RANGE_DAYS[range.toLowerCase()];
  if (days == null) return undefined;
  const d = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

/**
 * GET /api/candles
 * Query params:
 *   - symbol: e.g. "XAU_USD", "BRENT", "SJC-01", "USD_VND" (mặc định: XAU_USD)
 *   - range:  1w | 1m | 3m | 6m | 1y | all (mặc định: 1y)
 */
candles.get('/', async (c) => {
  const symbol = (c.req.query('symbol') || 'XAU_USD').trim().toUpperCase();
  const range = (c.req.query('range') || '1y').trim().toLowerCase();

  // 1. Cache lookup: Local dev hoặc header no-cache thì bỏ qua cache để luôn thấy dữ liệu mới nhất
  const isLocal = c.req.url.includes('localhost') || c.req.url.includes('127.0.0.1');
  const isDev = isLocal || c.env.APP_ENV === 'development';
  const noCache = isDev || c.req.header('Cache-Control')?.includes('no-cache') || c.req.query('fresh') === 'true';

  const cacheKey = new URL(c.req.url);
  cacheKey.searchParams.set('symbol', symbol);
  cacheKey.searchParams.set('range', range);
  cacheKey.searchParams.sort();
  const cacheUrl = cacheKey.toString();

  if (!noCache) {
    const cached = await getFromCache(cacheUrl);
    if (cached) {
      return new Response(cached.body, {
        status: cached.status,
        headers: {
          ...Object.fromEntries(cached.headers),
          'X-Cache': 'HIT',
          'Cache-Control': 'public, max-age=1800',
        },
      });
    }
  }

  try {
    const startDate = calculateStartDate(range);
    let rows = await getDailyCandles(c.env.DB, symbol, startDate);

    // Fallback thông minh cho các bí danh thông dụng nếu chưa tìm thấy
    if (rows.length === 0) {
      const aliasMap: Record<string, string> = {
        'USD/VND': 'USD_VND',
        'USD_VND': 'USD/VND',
        'BZ=F': 'BRENT',
        'BRENT': 'BZ=F',
        'CL=F': 'WTI',
        'WTI': 'CL=F',
      };
      const alias = aliasMap[symbol];
      if (alias) {
        rows = await getDailyCandles(c.env.DB, alias, startDate);
      }
    }

    // Xác định nguồn dữ liệu đồng nhất của chuỗi (A.5)
    const lastRow = rows.length > 0 ? rows[rows.length - 1] : undefined;
    const source = lastRow ? lastRow.source : 'Hệ thống';

    // Xác định hasOHLC: true nếu có ít nhất 1 nến có biến động trong ngày (high !== low hoặc open !== close)
    let hasOHLC = false;
    for (const r of rows) {
      if (Math.abs(r.high - r.low) > 0.0001 || Math.abs(r.open - r.close) > 0.0001) {
        hasOHLC = true;
        break;
      }
    }

    const candlePoints = rows.map((r) => ({
      time: r.date,
      open: r.open,
      high: r.high,
      low: r.low,
      close: r.close,
    }));

    const responseBody = JSON.stringify({
      success: true,
      data: {
        symbol,
        source,
        hasOHLC,
        candles: candlePoints,
      },
      updatedAt: lastRow ? `${lastRow.date}T23:59:59Z` : null,
      meta: {
        symbol,
        range,
        count: candlePoints.length,
        hasOHLC,
      },
    });

    const response = new Response(responseBody, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=1800',
        'X-Cache': 'MISS',
      },
    });

    if (!noCache) {
      await putInCache(cacheUrl, response.clone());
    }
    return response;
  } catch (err) {
    console.error('[/api/candles] Error:', err);
    return c.json(
      {
        success: false,
        error: 'Lỗi khi truy vấn dữ liệu nến ngày',
        data: null,
        updatedAt: null,
      },
      500,
    );
  }
});

export { candles as candlesRoute };
