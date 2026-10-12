// src/routes/history.ts
// GET /api/history?symbols=SJC-01,BRENT&range=30d|90d|1y

import { Hono } from 'hono';
import type { Env } from '../types.js';
import { getPriceHistoryMulti, getLastUpdated } from '../db.js';
import { getFromCache, putInCache, CACHE_HEADERS } from '../cache.js';
import { parseSymbols, parseRange } from '../validate.js';

const history = new Hono<{ Bindings: Env }>();

/**
 * GET /api/history
 * Query params:
 *   - symbols: comma-separated, e.g. "SJC-01,BRENT,XAU_USD"  (bắt buộc)
 *   - range:   30d | 90d | 1y                                  (default: 30d)
 *
 * Trả 1 điểm/ngày (điểm mới nhất trong ngày) cho từng symbol.
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     [symbol: string]: Array<{ date, price, unit, source }>
 *   },
 *   updatedAt: string | null,
 *   meta: { symbols, range, days }
 * }
 */
history.get('/', async (c) => {
  // ── 1. Validate params ────────────────────────────────────────────────────
  const rawSymbols = c.req.query('symbols');
  const symbols = parseSymbols(rawSymbols);

  if (symbols.length === 0) {
    return c.json(
      {
        success: false,
        error: 'Tham số "symbols" là bắt buộc. Ví dụ: ?symbols=SJC-01,BRENT',
        data: null,
        updatedAt: null,
      },
      400,
    );
  }

  const { days, range } = parseRange(c.req.query('range'));

  // ── 2. Cache lookup (dùng canonical URL) ─────────────────────────────────
  // Normalize URL để tránh cache miss do thứ tự param khác nhau
  const cacheKey = new URL(c.req.url);
  cacheKey.searchParams.set('symbols', symbols.join(','));
  cacheKey.searchParams.set('range', range);
  cacheKey.searchParams.sort();
  const cacheUrl = cacheKey.toString();

  const cached = await getFromCache(cacheUrl);
  if (cached) {
    return new Response(cached.body, {
      status: cached.status,
      headers: {
        ...Object.fromEntries(cached.headers),
        'X-Cache': 'HIT',
        ...CACHE_HEADERS,
      },
    });
  }

  // ── 3. Query D1 ───────────────────────────────────────────────────────────
  try {
    const [rows, updatedAt] = await Promise.all([
      getPriceHistoryMulti(c.env.DB, symbols, days),
      getLastUpdated(c.env.DB),
    ]);

    // Group by symbol → { SJC-01: [{date, price, unit, source}, ...], ... }
    const grouped: Record<string, Array<{ date: string; price: number; unit: string; source: string }>> = {};

    for (const symbol of symbols) {
      grouped[symbol] = [];
    }

    for (const row of rows) {
      const sym = String(row.symbol);
      if (grouped[sym]) {
        grouped[sym].push({
          date:   String(row.date),
          price:  Number(row.price),
          unit:   String(row.unit ?? ''),
          source: String(row.source ?? ''),
        });
      }
    }

    const body = JSON.stringify({
      success: true,
      data: grouped,
      updatedAt,
      meta: { symbols, range, days },
    });

    const response = new Response(body, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'X-Cache': 'MISS',
        ...CACHE_HEADERS,
      },
    });

    await putInCache(cacheUrl, response.clone());
    return response;
  } catch (err) {
    console.error('[/api/history] Error:', err);
    return c.json(
      {
        success: false,
        error: 'Lỗi khi lấy lịch sử giá',
        data: null,
        updatedAt: null,
      },
      500,
    );
  }
});

export { history as historyRoute };
