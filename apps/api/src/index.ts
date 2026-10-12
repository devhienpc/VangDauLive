// src/index.ts – Entry point: Hono API + Cloudflare Workers Cron
// Đã refactor: routes tách ra files riêng, CORS + Cache được cấu hình tập trung

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { prettyJSON } from 'hono/pretty-json';
import type { Env } from './types.js';

import { pricesRoute }  from './routes/prices.js';
import { historyRoute } from './routes/history.js';
import { newsRoute }    from './routes/news.js';
import { healthRoute }  from './routes/health.js';
import { candlesRoute } from './routes/candles.js';
import { runFetchAll }  from './cron.js';
import { runFullBackfill } from './adapters/backfill.js';

const app = new Hono<{ Bindings: Env }>();

// ─── Middleware ────────────────────────────────────────────────────────────────

// CORS: cho phép frontend domain + localhost dev
app.use('*', cors({
  origin: (origin) => {
    if (!origin) return '*';
    if (
      origin.includes('localhost') ||
      origin.endsWith('.pages.dev') ||
      origin.endsWith('.workers.dev') ||
      origin.includes('vangdau')
    ) {
      return origin;
    }
    return origin;
  },
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Accept', 'X-Admin-Key', 'X-Admin-Token', 'Authorization'],
  exposeHeaders: ['X-Cache', 'Cache-Control'],
  maxAge: 86400, // preflight cache 24h
}));

// Pretty JSON chỉ khi có ?pretty=1 (tiết kiệm bandwidth mặc định)
app.use('*', (c, next) => {
  if (c.req.query('pretty') === '1') {
    return prettyJSON()(c, next);
  }
  return next();
});

// ─── Routes ───────────────────────────────────────────────────────────────────

// Mount các route modules
app.route('/api/prices',  pricesRoute);
app.route('/api/history', historyRoute);
app.route('/api/news',    newsRoute);
app.route('/api/health',  healthRoute);
app.route('/api/candles', candlesRoute);

/**
 * POST /api/admin/backfill – Backfill 1 năm dữ liệu nến OHLC từ Yahoo Finance & EIA
 * Bảo vệ bằng secret header: X-Admin-Key hoặc X-Admin-Token hoặc Authorization.
 */
app.post('/api/admin/backfill', async (c) => {
  const secret = c.req.header('X-Admin-Key') || c.req.header('X-Admin-Token') || c.req.header('Authorization');
  if (c.env.APP_ENV === 'production' && !secret) {
    return c.json({ success: false, error: 'Không được phép: thiếu header bí mật X-Admin-Key' }, 403);
  }

  try {
    const result = await runFullBackfill(c.env.DB, c.env);
    return c.json({
      success: true,
      data: result,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[/api/admin/backfill] Error:', err);
    return c.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Lỗi khi thực hiện backfill',
        data: null,
      },
      500,
    );
  }
});

/**
 * POST /api/admin/ingest (và alias /api/admin/fetch) – Trigger ingest thủ công (dev / test / admin)
 * Bảo vệ bằng secret header: X-Admin-Key hoặc X-Admin-Token.
 */
const handleAdminIngest = async (c: any) => {
  const secret = c.req.header('X-Admin-Key') || c.req.header('X-Admin-Token') || c.req.header('Authorization');
  if (c.env.APP_ENV === 'production' && !secret) {
    return c.json({ success: false, error: 'Không được phép: thiếu header bí mật X-Admin-Key' }, 403);
  }

  try {
    const results = await runFetchAll(c.env);
    return c.json({
      success: true,
      data: results,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    return c.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Lỗi không xác định',
        data: null,
        updatedAt: null,
      },
      500,
    );
  }
};

app.post('/api/admin/ingest', handleAdminIngest);
app.post('/api/admin/fetch', handleAdminIngest);


/** Catch-all 404 – trả JSON thống nhất */
app.notFound((c) =>
  c.json(
    {
      success: false,
      error: `Endpoint không tồn tại: ${c.req.method} ${new URL(c.req.url).pathname}`,
      data: null,
      updatedAt: null,
    },
    404,
  ),
);

/** Error handler */
app.onError((err, c) => {
  console.error('[Unhandled]', err);
  return c.json(
    {
      success: false,
      error: 'Lỗi máy chủ nội bộ',
      data: null,
      updatedAt: null,
    },
    500,
  );
});

// ─── Scheduled Handler (Cron Triggers) ────────────────────────────────────────
const scheduled: ExportedHandlerScheduledHandler<Env> = async (_event, env, ctx) => {
  ctx.waitUntil(
    runFetchAll(env).then((results) => {
      const errors = results.filter((r) => r.error);
      if (errors.length > 0) {
        console.error('[Cron] Lỗi adapter:', JSON.stringify(errors));
      } else {
        console.log('[Cron] Fetch hoàn tất:', JSON.stringify(results));
      }
    }),
  );
};

// ─── Export ───────────────────────────────────────────────────────────────────
export default {
  fetch: app.fetch,
  scheduled,
} satisfies ExportedHandler<Env>;
