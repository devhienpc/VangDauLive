// src/routes/news.ts
// GET /api/news?category=&limit= – Tin tức thị trường mới nhất

import { Hono } from 'hono';
import type { Env } from '../types.js';
import { getNews, getLastUpdated } from '../db.js';
import { getFromCache, putInCache, CACHE_HEADERS } from '../cache.js';
import { parseCategory, parseLimit } from '../validate.js';

const news = new Hono<{ Bindings: Env }>();

/**
 * GET /api/news
 * Query params:
 *   - category: gold | silver | fuel | forex | oil  (tuỳ chọn)
 *   - limit:    1–50, default 10
 *
 * Response: { success, data: NewsRecord[], updatedAt }
 */
news.get('/', async (c) => {
  // ── 1. Validate params ────────────────────────────────────────────────────
  const rawCategory = c.req.query('category');
  const rawLimit    = c.req.query('limit');

  const category = rawCategory ? parseCategory(rawCategory) : null;

  if (rawCategory && !category) {
    return c.json(
      {
        success: false,
        error: `Danh mục không hợp lệ: "${rawCategory}". Chọn: gold | silver | fuel | forex | oil`,
        data: null,
        updatedAt: null,
      },
      400,
    );
  }

  const limit = parseLimit(rawLimit, 10, 50);

  // ── 2. Cache lookup ───────────────────────────────────────────────────────
  const cacheKey = new URL(c.req.url);
  if (category) cacheKey.searchParams.set('category', category);
  else cacheKey.searchParams.delete('category');
  cacheKey.searchParams.set('limit', String(limit));
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
    const [data, updatedAt] = await Promise.all([
      getNews(c.env.DB, { category, limit }),
      getLastUpdated(c.env.DB),
    ]);

    const body = JSON.stringify({
      success: true,
      data,
      updatedAt,
      meta: {
        count: data.length,
        category: category ?? 'all',
        limit,
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

    await putInCache(cacheUrl, response.clone());
    return response;
  } catch (err) {
    console.error('[/api/news] Error:', err);
    return c.json(
      {
        success: false,
        error: 'Lỗi khi lấy tin tức',
        data: null,
        updatedAt: null,
      },
      500,
    );
  }
});

export { news as newsRoute };
