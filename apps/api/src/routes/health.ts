// src/routes/health.ts
// GET /api/health – Trạng thái hệ thống và ingest log

import { Hono } from 'hono';
import type { Env } from '../types.js';
import { getIngestStatus, getLastUpdated, countPrices } from '../db.js';

const health = new Hono<{ Bindings: Env }>();

/**
 * GET /api/health
 * Không cache – luôn trả kết quả mới nhất để monitor.
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     status: 'healthy' | 'degraded' | 'empty',
 *     updatedAt: string | null,
 *     priceCount: number,
 *     sources: Array<{ source, status, message, created_at }>
 *   },
 *   updatedAt: string | null
 * }
 */
health.get('/', async (c) => {
  try {
    const [sources, updatedAt, priceCount] = await Promise.all([
      getIngestStatus(c.env.DB),
      getLastUpdated(c.env.DB),
      countPrices(c.env.DB),
    ]);

    // Xác định trạng thái tổng:
    // - healthy: tất cả source có status 'ok'
    // - degraded: có ít nhất 1 source lỗi nhưng vẫn có dữ liệu
    // - empty: chưa có dữ liệu trong DB
    let overallStatus: 'healthy' | 'degraded' | 'empty';
    if (priceCount === 0) {
      overallStatus = 'empty';
    } else if (sources.some((s) => s.status === 'error')) {
      overallStatus = 'degraded';
    } else {
      overallStatus = 'healthy';
    }

    // Kiểm tra thời gian cập nhật: nếu > 25 tiếng → stale
    let stale = false;
    if (updatedAt) {
      const diff = Date.now() - new Date(updatedAt).getTime();
      stale = diff > 25 * 60 * 60 * 1000; // 25 giờ
    }

    return c.json(
      {
        success: true,
        data: {
          status: overallStatus,
          stale,
          updatedAt,
          priceCount,
          workerVersion: c.env.APP_ENV ?? 'unknown',
          serverTime: new Date().toISOString(),
          sources: sources.map((s) => ({
            source:    s.source,
            status:    s.status,
            message:   s.message ?? null,
            createdAt: s.created_at,
          })),
        },
        updatedAt,
      },
      200,
      {
        // Không cache health endpoint
        'Cache-Control': 'no-store, must-revalidate',
        'Content-Type': 'application/json',
      },
    );
  } catch (err) {
    console.error('[/api/health] Error:', err);
    return c.json(
      {
        success: false,
        data: null,
        error: 'Lỗi khi kiểm tra trạng thái hệ thống',
        updatedAt: null,
      },
      500,
      { 'Cache-Control': 'no-store' },
    );
  }
});

export { health as healthRoute };
