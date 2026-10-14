// src/routes/prices.ts
// GET /api/prices – Giá mới nhất mỗi symbol, kèm change_pct và fetched_at

import { Hono } from 'hono';
import type { Env } from '../types.js';
import { getLatestPrices, getPricesByCategory, getLastUpdated, getFuelPeriodsHistory } from '../db.js';
import { getFromCache, putInCache, CACHE_HEADERS } from '../cache.js';
import { parseCategory } from '../validate.js';

const prices = new Hono<{ Bindings: Env }>();

/**
 * GET /api/prices/fuel-history
 * Lấy lịch sử các kỳ điều hành xăng dầu Petrolimex (so sánh đa kỳ)
 */
prices.get('/fuel-history', async (c) => {
  const url = c.req.url;
  const isLocal = url.includes('localhost') || url.includes('127.0.0.1');
  const noCache =
    isLocal ||
    c.env.APP_ENV === 'development' ||
    c.req.query('fresh') === '1' ||
    Boolean(c.req.header('Cache-Control')?.includes('no-cache'));

  if (!noCache) {
    const cached = await getFromCache(url);
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
  }

  try {
    const limit = Number(c.req.query('limit')) || 10;
    const data = await getFuelPeriodsHistory(c.env.DB, limit);

    const body = JSON.stringify({
      success: true,
      data,
      updatedAt: new Date().toISOString(),
      meta: {
        count: data.length,
      },
    });

    const response = new Response(body, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'X-Cache': 'MISS',
        ...CACHE_HEADERS,
      },
    });

    if (!noCache) {
      await putInCache(url, response.clone());
    }

    return response;
  } catch (err) {
    console.error('[/api/prices/fuel-history] Error:', err);
    return c.json(
      {
        success: false,
        error: 'Lỗi khi lấy dữ liệu lịch sử các kỳ xăng dầu',
        data: [],
        updatedAt: null,
      },
      500,
    );
  }
});

/**
 * GET /api/prices
 * Query params:
 *   - category: gold|silver|fuel|forex|oil  (tuỳ chọn, lọc theo danh mục)
 *
 * Response: { success, data: PriceRecord[], updatedAt }
 */
prices.get('/', async (c) => {
  const url = c.req.url;
  const isLocal = url.includes('localhost') || url.includes('127.0.0.1');
  const noCache = isLocal || c.env.APP_ENV === 'development' || c.req.query('fresh') === '1' || Boolean(c.req.header('Cache-Control')?.includes('no-cache'));

  // ── 1. Cache lookup ──────────────────────────────────────────────────────
  if (!noCache) {
    const cached = await getFromCache(url);
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
  }

  // ── 2. Validate query params ─────────────────────────────────────────────
  const rawCategory = c.req.query('category');
  const category = rawCategory ? parseCategory(rawCategory) : null;

  if (rawCategory && !category) {
    return c.json(
      {
        success: false,
        error: `Danh mục không hợp lệ: "${rawCategory}". Chọn: gold | silver | fuel | forex | oil`,
        data: null,
        updatedAt: null,
      },
      500,
    );
  }

  // ── 3. Query D1 ──────────────────────────────────────────────────────────
  try {
    const [data, updatedAt] = await Promise.all([
      category
        ? getPricesByCategory(c.env.DB, category)
        : getLatestPrices(c.env.DB),
      getLastUpdated(c.env.DB),
    ]);

    const body = JSON.stringify({
      success: true,
      data,
      updatedAt,
      meta: {
        count: data.length,
        category: category ?? 'all',
        cachedAt: new Date().toISOString(),
      },
    });

    const response = new Response(body, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'X-Cache': 'MISS',
        ...CACHE_HEADERS,
      },
    });

    // ── 4. Store in cache ──────────────────────────────────────────────────
    if (!noCache) {
      await putInCache(url, response.clone());
    }

    return response;
  } catch (err) {
    console.error('[/api/prices] Error:', err);
    return c.json(
      {
        success: false,
        error: 'Lỗi khi lấy dữ liệu giá',
        data: null,
        updatedAt: null,
      },
      500,
    );
  }
});

export { prices as pricesRoute };
