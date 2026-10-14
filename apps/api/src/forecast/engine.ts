// apps/api/src/forecast/engine.ts
// Bộ máy tính toán nhận định giá xăng dầu Việt Nam

import type {
  ForecastConfig,
  ForecastResult,
  NewsInterventionSignal,
  ForecastConfidence,
  ForecastDirection,
  ForecastMagnitude,
  ForecastStatus,
} from './types.ts';
import { FORECAST_CONFIG } from './config.ts';
import {
  determineCycles,
  computeReferenceChange,
} from './mechanism.ts';
import { runBacktest } from './backtest.ts';
import { getForecastAccuracyStats } from './accuracy.ts';
import {
  analyzeNewsImpactFactors,
} from './news-factor.ts';
import type { NewsFactorsAnalysisResult } from './news-factor.ts';

export interface GenerateForecastOptions {
  asOfDate?: string;
  newsIntervention?: NewsInterventionSignal;
  customConfig?: Partial<ForecastConfig>;
  targetProducts?: string[];
  env?: any;
  customAiCaller?: (prompt: string) => Promise<string>;
}

export const DEFAULT_TARGET_PRODUCTS = [
  'PET-RON95III',
  'PET-E5RON92',
  'PET-DO005',
  'PET-RON95V',
  'PET-DO001',
];

/**
 * Đánh giá mức độ tin cậy dựa trên:
 * 1. Độ mạnh của tín hiệu (% thay đổi / ngưỡng)
 * 2. Tính nhất quán giữa mã sản phẩm chuyên biệt và dầu thô Brent
 * 3. Sự can thiệp của Quỹ bình ổn giá (BOG) từ tin tức
 */
export function evaluateConfidence(
  changePct: number,
  thresholdPct: number,
  consistentWithBrent: boolean,
  newsIntervention?: NewsInterventionSignal
): ForecastConfidence {
  const signalRatio = Math.abs(changePct) / Math.max(0.01, thresholdPct);

  let confidence: ForecastConfidence = 'thấp';
  if (signalRatio >= 5.0 && consistentWithBrent) {
    confidence = 'cao';
  } else if (signalRatio >= 1.5) {
    confidence = 'trung bình';
  } else {
    confidence = 'thấp';
  }

  // Nếu tin tức cho thấy có can thiệp Quỹ BOG thì hạ mức tin cậy
  if (newsIntervention?.hasIntervention) {
    if (confidence === 'cao') confidence = 'trung bình';
    else confidence = 'thấp';
  }

  return confidence;
}

/**
 * Phân loại mức độ biến động định tính (nhẹ / vừa / mạnh) theo phân vị lịch sử
 */
export function evaluateMagnitude(
  changePct: number,
  p33: number,
  p67: number
): ForecastMagnitude {
  const absVal = Math.abs(changePct);
  if (absVal < p33) return 'nhẹ';
  if (absVal <= p67) return 'vừa';
  return 'mạnh';
}

/**
 * Hàm sinh nhận định giá xăng dầu cho kỳ điều hành kế tiếp
 */
export async function generateForecast(
  db: any,
  options: GenerateForecastOptions = {}
): Promise<{
  forecasts: ForecastResult[];
  status: ForecastStatus;
  reasons: string[];
  backtestAccuracy: number;
}> {
  const config: ForecastConfig = {
    ...FORECAST_CONFIG,
    ...options.customConfig,
  };

  const asOfDate = options.asOfDate || new Date().toISOString().slice(0, 10);
  const targetProducts = options.targetProducts || DEFAULT_TARGET_PRODUCTS;

  // 1. Truy vấn lịch sử điều hành từ D1
  const adjStmt = await db
    .prepare('SELECT effective_at, product, price_zone1, delta FROM fuel_adjustments ORDER BY effective_at ASC')
    .all();
  const adjustments = (adjStmt.results || []) as Array<{
    effective_at: string;
    product: string;
    price_zone1: number;
    delta: number;
  }>;

  // 2. Truy vấn daily_candles từ D1
  const candleStmt = await db
    .prepare(
      "SELECT symbol, date, close FROM daily_candles WHERE symbol IN ('RB=F', 'HO=F', 'BZ=F', 'USD/VND', 'USD_VND') ORDER BY date ASC"
    )
    .all();
  const rawCandles = (candleStmt.results || []) as Array<{
    symbol: string;
    date: string;
    close: number;
  }>;

  // Xây dựng cache candles
  const candleCache: Record<string, Map<string, number>> = {};
  for (const c of rawCandles) {
    const sym = c.symbol === 'USD/VND' ? 'USD_VND' : c.symbol;
    if (!candleCache[sym]) candleCache[sym] = new Map();
    candleCache[sym]!.set(c.date, Number(c.close));
  }

  // 3. Đếm số kỳ lịch sử độc lập
  const uniquePeriodDates = Array.from(
    new Set(adjustments.map((a) => a.effective_at.slice(0, 10)))
  ).sort();

  // 4. Chạy backtest trên dữ liệu hiện có để kiểm tra độ chính xác hướng
  let backtestAccuracy = config.overallAccuracyPct;
  try {
    if (adjustments.length >= 10 && rawCandles.length >= 30) {
      const btReport = runBacktest({
        adjustments,
        candles: rawCandles,
      });
      backtestAccuracy = btReport.overallAccuracyPct;
    }
  } catch {}

  // 5. Phân tích yếu tố tác động từ tin tức (7 ngày gần nhất, tối đa 40 tin, có cache)
  let newsAnalysis: NewsFactorsAnalysisResult | null = null;
  let effectiveNewsIntervention = options.newsIntervention;

  try {
    newsAnalysis = await analyzeNewsImpactFactors(db, options.env, {
      customAiCaller: options.customAiCaller,
    });

    // Nếu tin tức có yếu tố "Chính sách trong nước/quỹ bình ổn/thuế" -> gắn cờ và hạ mức tin cậy
    if (newsAnalysis.hasDomesticPolicyIntervention) {
      effectiveNewsIntervention = {
        hasIntervention: true,
        reason: newsAnalysis.domesticPolicyReason || 'Chính sách trong nước / Quỹ bình ổn / Thuế phí',
      };
    }
  } catch (err) {
    console.warn('[Forecast Engine] Lỗi phân tích tin tức:', err);
  }

  // 6. Kiểm tra 3 điều kiện "Chưa đủ cơ sở":
  const failureReasons: string[] = [];
  let isInsufficient = false;

  // Điều kiện 1: ít hơn 30 kỳ lịch sử
  if (uniquePeriodDates.length < config.minRequiredPeriods) {
    isInsufficient = true;
    failureReasons.push(
      `Lịch sử điều hành (${uniquePeriodDates.length} kỳ) ít hơn mức tối thiểu yêu cầu (${config.minRequiredPeriods} kỳ).`
    );
  }

  // Điều kiện 2: Kiểm tra dữ liệu kỳ hiện tại
  const { currentCycle, previousCycle } = determineCycles(uniquePeriodDates, asOfDate);

  // Điều kiện 3: Độ chính xác backtest hướng dưới 60%
  if (backtestAccuracy < config.minAccuracyThreshold) {
    isInsufficient = true;
    failureReasons.push(
      `Độ chính xác backtest hướng đạt ${backtestAccuracy.toFixed(1)}%, dưới ngưỡng yêu cầu tối thiểu ${config.minAccuracyThreshold}% để đưa ra nhận định định lượng có căn cứ.`
    );
  }

  // Điều kiện 4: Cơ chế tự tắt nếu tỷ lệ đúng 10 kỳ gần nhất dưới 55%
  if (db && typeof db.prepare === 'function') {
    try {
      const accuracyStats = await getForecastAccuracyStats(db);
      if (accuracyStats.is_auto_shutoff) {
        isInsufficient = true;
        failureReasons.push(
          `Chưa đủ cơ sở nhận định: Tỷ lệ đúng 10 kỳ gần nhất đạt ${accuracyStats.recent_accuracy_pct}% (< 55%). Hệ thống tạm thời tự tắt hiển thị nhận định cho đến khi phục hồi.`
        );
      }
    } catch {
      // bỏ qua lỗi kiểm tra thống kê
    }
  }

  const results: ForecastResult[] = [];
  const status: ForecastStatus = isInsufficient ? 'insufficient_data' : 'published';

  for (const prod of targetProducts) {
    const metric = computeReferenceChange(
      prod,
      candleCache,
      currentCycle,
      previousCycle
    );

    // Kiểm tra thiếu dữ liệu nến tham chiếu trong kỳ hiện tại
    const hasMissingCandles = metric.validDaysInCurrentPeriod === 0;
    const prodReasons = [...failureReasons];

    if (hasMissingCandles) {
      prodReasons.push('Thiếu dữ liệu nến tham chiếu trong kỳ hiện tại.');
    }

    const direction: ForecastDirection | null = isInsufficient || hasMissingCandles
      ? null
      : metric.changePct > config.thresholdPct
      ? 'tăng'
      : metric.changePct < -config.thresholdPct
      ? 'giảm'
      : 'đi ngang';

    const magnitude: ForecastMagnitude | null = isInsufficient || hasMissingCandles
      ? null
      : evaluateMagnitude(metric.changePct, config.p33Magnitude, config.p67Magnitude);

    // Ước lượng đồng/lít chỉ khi R² >= 0.5 (ở đây R² < 0.5 nên để null)
    const range_low: number | null = null;
    const range_high: number | null = null;

    let confidence: ForecastConfidence = evaluateConfidence(
      metric.changePct,
      config.thresholdPct,
      metric.consistentWithBrent,
      effectiveNewsIntervention
    );

    if (isInsufficient || hasMissingCandles) {
      confidence = 'thấp';
    }

    if (effectiveNewsIntervention?.hasIntervention) {
      prodReasons.push(
        `Quỹ bình ổn giá (BOG) / Thuế phí có dấu hiệu can thiệp: ${effectiveNewsIntervention.reason || 'Dự báo có trích lập/chi sử dụng Quỹ'}. Độ tin cậy bị hạ.`
      );
    }

    const reasonsJson = JSON.stringify({
      status,
      benchmark: metric.benchmarkSymbol,
      changePct: Math.round(metric.changePct * 100) / 100,
      brentChangePct: Math.round(metric.brentChangePct * 100) / 100,
      consistentWithBrent: metric.consistentWithBrent,
      validDaysInCurrentPeriod: metric.validDaysInCurrentPeriod,
      thresholdUsed: config.thresholdPct,
      backtestAccuracy: Math.round(backtestAccuracy * 100) / 100,
      r2: config.r2,
      r2Explanation:
        'Hệ số xác định R² < 0.5 nên không hiển thị khoảng ước lượng đồng/lít để đảm bảo tính thận trọng và chính xác.',
      reasons: prodReasons,
      currentCycle,
      previousCycle,
      news_factors: newsAnalysis?.topFactors || [],
    });

    results.push({
      target_period_start: currentCycle.startDate,
      product: prod,
      direction,
      magnitude,
      range_low,
      range_high,
      confidence,
      status: hasMissingCandles ? 'insufficient_data' : status,
      reasons_json: reasonsJson,
      model_version: config.modelVersion,
    });
  }

  // 6. Lưu kết quả vào bảng forecasts nếu db hỗ trợ câu lệnh INSERT
  if (db && typeof db.prepare === 'function') {
    try {
      for (const f of results) {
        await db
          .prepare(
            `INSERT INTO forecasts (
              target_period_start, product, direction, magnitude,
              range_low, range_high, confidence, status,
              reasons_json, model_version
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(
            f.target_period_start,
            f.product,
            f.direction,
            f.magnitude,
            f.range_low,
            f.range_high,
            f.confidence,
            f.status,
            f.reasons_json,
            f.model_version
          )
          .run();
      }
    } catch (e: any) {
      console.warn('Lỗi lưu forecast vào D1:', e.message);
    }
  }

  return {
    forecasts: results,
    status,
    reasons: failureReasons,
    backtestAccuracy,
  };
}
