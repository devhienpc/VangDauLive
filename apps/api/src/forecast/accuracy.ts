// apps/api/src/forecast/accuracy.ts
// Cơ chế tự đánh giá độ chính xác của nhận định giá xăng dầu

import type { D1Database } from '@cloudflare/workers-types';
import type {
  ForecastDirection,
  ForecastEvaluationResult,
  ForecastAccuracyStats,
} from './types.ts';
import { ACTUAL_DELTA_THRESHOLD } from './config.ts';
import { classifyActualDirection } from './backtest.ts';
import { logIngest } from '../db.ts';

/**
 * Tính toán hit (đúng/sai): 1 nếu hướng nhận định trùng hướng thực tế, 0 nếu sai
 */
export function calculateHit(
  forecastDirection: ForecastDirection,
  actualDirection: ForecastDirection,
): number {
  return forecastDirection === actualDirection ? 1 : 0;
}

/**
 * Kiểm tra điều kiện tự tắt:
 * Tự tắt nếu tỷ lệ đúng theo 10 kỳ gần nhất dưới 55%
 */
export function checkAutoShutoff(
  recentEvaluations: number,
  recentAccuracyPct: number,
): { isAutoShutoff: boolean; displayStatus: 'Hoạt động bình thường' | 'Chưa đủ cơ sở nhận định' } {
  const isAutoShutoff = recentEvaluations > 0 && recentAccuracyPct < 55.0;
  return {
    isAutoShutoff,
    displayStatus: isAutoShutoff ? 'Chưa đủ cơ sở nhận định' : 'Hoạt động bình thường',
  };
}

/**
 * Đánh giá độ chính xác cho một kỳ điều hành mới được ghi vào fuel_adjustments
 * Đối chiếu với nhận định gần nhất của kỳ đó (chỉ xét status = 'published')
 */
export async function evaluateForecastAccuracy(
  db: D1Database,
  adjustment: {
    product: string;
    delta: number;
    effective_at: string;
  },
): Promise<ForecastEvaluationResult | null> {
  if (!db || typeof db.prepare !== 'function') return null;

  // 1. Tìm nhận định gần nhất đã công bố của kỳ đó chưa từng được đánh giá
  // Nhận định có target_period_start <= effective_at và status = 'published'
  const row = await db
    .prepare(
      `SELECT f.id, f.product, f.target_period_start, f.direction, f.status
       FROM forecasts f
       LEFT JOIN forecast_results r ON f.id = r.forecast_id
       WHERE f.product = ?
         AND f.status = 'published'
         AND f.direction IS NOT NULL
         AND f.target_period_start <= ?
         AND r.id IS NULL
       ORDER BY f.target_period_start DESC, f.id DESC
       LIMIT 1`,
    )
    .bind(adjustment.product, adjustment.effective_at)
    .first<{
      id: number;
      product: string;
      target_period_start: string;
      direction: ForecastDirection;
      status: string;
    }>();

  if (!row) {
    return null;
  }

  // 2. Xác định hướng thực tế và tính hit
  const actualDirection = classifyActualDirection(adjustment.delta);
  const hit = calculateHit(row.direction, actualDirection);
  const evaluatedAt = new Date().toISOString().replace('T', ' ').slice(0, 19);

  // 3. Ghi vào bảng forecast_results (chỉ thêm, không sửa lại nhận định đã công bố)
  try {
    await db
      .prepare(
        `INSERT INTO forecast_results (forecast_id, actual_delta, actual_direction, hit, evaluated_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .bind(row.id, adjustment.delta, actualDirection, hit, evaluatedAt)
      .run();
  } catch (err: any) {
    // Nếu đã tồn tại bản ghi đánh giá cho forecast này, không ghi đè
    console.warn(`[evaluateForecastAccuracy] forecast_id ${row.id} đã được đánh giá:`, err.message);
    return null;
  }

  const result: ForecastEvaluationResult = {
    forecast_id: row.id,
    product: row.product,
    target_period_start: row.target_period_start,
    forecast_direction: row.direction,
    actual_delta: adjustment.delta,
    actual_direction: actualDirection,
    hit,
    evaluated_at: evaluatedAt,
  };

  // 4. Kiểm tra điều kiện tự tắt theo 10 kỳ gần nhất và ghi ingest_log cảnh báo nếu cần
  try {
    const stats = await getForecastAccuracyStats(db);
    if (stats.is_auto_shutoff) {
      await logIngest(
        db,
        'Fuel Forecast Accuracy',
        'warning',
        `Tự tắt nhận định xăng: Tỷ lệ đúng 10 kỳ gần nhất đạt ${stats.recent_accuracy_pct}% (< 55%). Đã chuyển trạng thái hiển thị sang "Chưa đủ cơ sở nhận định".`,
      );
    }
  } catch (e: any) {
    console.warn('[evaluateForecastAccuracy] Lỗi kiểm tra stats hoặc ghi log:', e.message);
  }

  return result;
}

/**
 * Đánh giá danh sách các kỳ điều hành vừa được nạp (batch)
 */
export async function evaluateBatchFuelAdjustments(
  db: D1Database,
  items: Array<{ product: string; delta?: number | null; effective_at: string }>,
): Promise<ForecastEvaluationResult[]> {
  const evaluations: ForecastEvaluationResult[] = [];
  for (const item of items) {
    if (item.delta !== null && item.delta !== undefined && !isNaN(Number(item.delta))) {
      const res = await evaluateForecastAccuracy(db, {
        product: item.product,
        delta: Number(item.delta),
        effective_at: item.effective_at,
      });
      if (res) evaluations.push(res);
    }
  }
  return evaluations;
}

/**
 * Lấy thống kê độ chính xác của nhận định:
 * - Tổng số nhận định
 * - Số đúng
 * - Tỷ lệ đúng tổng
 * - Tỷ lệ đúng 10 kỳ gần nhất
 * - Trạng thái tự tắt nếu 10 kỳ gần nhất dưới 55%
 */
export async function getForecastAccuracyStats(
  db: D1Database,
): Promise<ForecastAccuracyStats> {
  if (!db || typeof db.prepare !== 'function') {
    return {
      total_evaluations: 0,
      total_hits: 0,
      overall_accuracy_pct: 0,
      recent_evaluations: 0,
      recent_hits: 0,
      recent_accuracy_pct: 0,
      is_auto_shutoff: false,
      display_status: 'Hoạt động bình thường',
      items: [],
    };
  }

  // Chỉ lấy nhận định đã công bố (status = 'published')
  const query = `
    SELECT
      r.id,
      r.forecast_id,
      f.product,
      f.target_period_start,
      f.direction AS forecast_direction,
      r.actual_delta,
      r.actual_direction,
      r.hit,
      r.evaluated_at
    FROM forecast_results r
    JOIN forecasts f ON r.forecast_id = f.id
    WHERE f.status = 'published'
    ORDER BY r.evaluated_at DESC, r.id DESC
  `;

  const { results } = await db.prepare(query).all<{
    id: number;
    forecast_id: number;
    product: string;
    target_period_start: string;
    forecast_direction: ForecastDirection;
    actual_delta: number;
    actual_direction: ForecastDirection;
    hit: number;
    evaluated_at: string;
  }>();

  const items = results || [];
  const total_evaluations = items.length;
  const total_hits = items.filter((r) => r.hit === 1).length;
  const overall_accuracy_pct =
    total_evaluations > 0
      ? Number(((total_hits / total_evaluations) * 100).toFixed(2))
      : 0;

  const recentItems = items.slice(0, 10);
  const recent_evaluations = recentItems.length;
  const recent_hits = recentItems.filter((r) => r.hit === 1).length;
  const recent_accuracy_pct =
    recent_evaluations > 0
      ? Number(((recent_hits / recent_evaluations) * 100).toFixed(2))
      : 0;

  const { isAutoShutoff, displayStatus } = checkAutoShutoff(
    recent_evaluations,
    recent_accuracy_pct,
  );

  return {
    total_evaluations,
    total_hits,
    overall_accuracy_pct,
    recent_evaluations,
    recent_hits,
    recent_accuracy_pct,
    is_auto_shutoff: isAutoShutoff,
    display_status: displayStatus,
    items,
  };
}
