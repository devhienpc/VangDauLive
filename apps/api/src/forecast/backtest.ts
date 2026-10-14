// apps/api/src/forecast/backtest.ts
// Bộ kiểm thử lịch sử (backtest) và tối ưu hóa ngưỡng nhận định giá xăng dầu

import type {
  BacktestReport,
  ForecastDirection,
  ProductBacktestMetrics,
} from './types.ts';
import { getBenchmarkForProduct, DEFAULT_USD_VND_RATE } from './mechanism.ts';

export interface BacktestDataInput {
  adjustments: Array<{
    effective_at: string;
    product: string;
    price_zone1: number;
    delta: number;
  }>;
  candles: Array<{
    symbol: string;
    date: string;
    close: number;
  }>;
}

export interface PeriodSample {
  date: string;
  product: string;
  actualDelta: number;
  refChangePct: number;
  brentChangePct: number;
}

/**
 * Trích xuất danh sách các cặp quan sát lịch sử từ adjustments và candles
 */
export function extractBacktestSamples(data: BacktestDataInput): {
  samples: PeriodSample[];
  uniqueDates: string[];
} {
  // Gom candles theo symbol và date
  const candleMap: Record<string, Map<string, number>> = {};
  for (const c of data.candles) {
    const sym = c.symbol === 'USD/VND' ? 'USD_VND' : c.symbol;
    if (!candleMap[sym]) candleMap[sym] = new Map();
    candleMap[sym]!.set(c.date, Number(c.close));
  }

  // Nhóm adjustments theo ngày
  const periodsMap = new Map<string, any[]>();
  for (const adj of data.adjustments) {
    const key = adj.effective_at.slice(0, 10);
    if (!periodsMap.has(key)) periodsMap.set(key, []);
    periodsMap.get(key)!.push(adj);
  }

  const uniqueDates = Array.from(periodsMap.keys()).sort();
  const samples: PeriodSample[] = [];

  const getCycleAvg = (sym: string, start: string, end: string) => {
    const map = candleMap[sym];
    if (!map) return null;
    const vals: number[] = [];
    for (const [d, v] of map.entries()) {
      // Ngày giao dịch trong chu kỳ (start, end]
      if (d > start && d <= end) {
        const fx = candleMap['USD_VND']?.get(d) || DEFAULT_USD_VND_RATE;
        vals.push(v * fx);
      }
    }
    if (vals.length === 0) return null;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  };

  for (let i = 1; i < uniqueDates.length; i++) {
    const prevDate = uniqueDates[i - 1]!;
    const curDate = uniqueDates[i]!;
    const prevPrevDate = i >= 2 ? uniqueDates[i - 2]! : null;

    if (!prevPrevDate) continue;

    const curBrent = getCycleAvg('BZ=F', prevDate, curDate);
    const prevBrent = getCycleAvg('BZ=F', prevPrevDate, prevDate);
    const brentChangePct =
      curBrent && prevBrent ? ((curBrent - prevBrent) / prevBrent) * 100 : 0;

    const items = periodsMap.get(curDate)!;
    for (const item of items) {
      const benchSym = getBenchmarkForProduct(item.product);
      const curBench = getCycleAvg(benchSym, prevDate, curDate);
      const prevBench = getCycleAvg(benchSym, prevPrevDate, prevDate);

      if (curBench && prevBench && prevBench > 0) {
        const refChangePct = ((curBench - prevBench) / prevBench) * 100;
        samples.push({
          date: curDate,
          product: item.product,
          actualDelta: item.delta,
          refChangePct,
          brentChangePct,
        });
      }
    }
  }

  return { samples, uniqueDates };
}

/**
 * Phân loại hướng dự báo dựa trên % biến động và ngưỡng theta
 */
export function classifyDirection(
  changePct: number,
  thresholdPct: number
): ForecastDirection {
  if (changePct > thresholdPct) return 'tăng';
  if (changePct < -thresholdPct) return 'giảm';
  return 'đi ngang';
}

/**
 * Phân loại hướng thực tế của kỳ điều hành trong nước (ngưỡng biến động giá thường là +-50 đ/lít)
 */
export function classifyActualDirection(actualDelta: number): ForecastDirection {
  if (actualDelta > 50) return 'tăng';
  if (actualDelta < -50) return 'giảm';
  return 'đi ngang';
}

/**
 * Tính toán hồi quy tuyến tính đơn giản: y = alpha + beta * x
 */
export function calculateOLS(
  samples: Array<{ x: number; y: number }>
): { alpha: number; beta: number; r2: number; stdError: number } {
  const n = samples.length;
  if (n < 3) {
    return { alpha: 0, beta: 0, r2: 0, stdError: 0 };
  }

  const meanX = samples.reduce((acc, s) => acc + s.x, 0) / n;
  const meanY = samples.reduce((acc, s) => acc + s.y, 0) / n;

  let ssXX = 0;
  let ssYY = 0;
  let ssXY = 0;

  for (const s of samples) {
    const dx = s.x - meanX;
    const dy = s.y - meanY;
    ssXX += dx * dx;
    ssYY += dy * dy;
    ssXY += dx * dy;
  }

  if (ssXX === 0 || ssYY === 0) {
    return { alpha: meanY, beta: 0, r2: 0, stdError: 0 };
  }

  const beta = ssXY / ssXX;
  const alpha = meanY - beta * meanX;
  const r2 = (ssXY * ssXY) / (ssXX * ssYY);

  let sse = 0;
  for (const s of samples) {
    const predY = alpha + beta * s.x;
    sse += (s.y - predY) ** 2;
  }
  const stdError = Math.sqrt(sse / Math.max(1, n - 2));

  return { alpha, beta, r2, stdError };
}

/**
 * Chạy tối ưu hóa ngưỡng và lập báo cáo Backtest hoàn chỉnh
 */
export function runBacktest(data: BacktestDataInput): BacktestReport {
  const { samples, uniqueDates } = extractBacktestSamples(data);

  if (samples.length === 0) {
    throw new Error('Không đủ dữ liệu quan sát để thực hiện backtest.');
  }

  // 1. Quét tìm ngưỡng theta tối ưu từ 0.05% đến 3.0% (bước 0.05%)
  let bestThreshold = 0.5;
  let maxCorrect = 0;

  for (let th = 0.05; th <= 3.0; th += 0.05) {
    const roundedTh = Math.round(th * 100) / 100;
    let correct = 0;
    for (const s of samples) {
      const pred = classifyDirection(s.refChangePct, roundedTh);
      const actual = classifyActualDirection(s.actualDelta);
      if (pred === actual) correct++;
    }
    if (correct > maxCorrect) {
      maxCorrect = correct;
      bestThreshold = roundedTh;
    }
  }

  const overallAccuracyPct = (maxCorrect / samples.length) * 100;

  // 2. Tính phân vị độ lớn biến động (|refChangePct|)
  const absChanges = samples.map((s) => Math.abs(s.refChangePct)).sort((a, b) => a - b);
  const p33 = absChanges[Math.floor(absChanges.length * 0.33)] || 1.5;
  const p67 = absChanges[Math.floor(absChanges.length * 0.67)] || 4.5;

  // 3. Phân tích chi tiết theo từng sản phẩm
  const uniqueProducts = Array.from(new Set(samples.map((s) => s.product)));
  const productMetrics: Record<string, ProductBacktestMetrics> = {};

  let maxR2 = 0;

  for (const prod of uniqueProducts) {
    const sub = samples.filter((s) => s.product === prod);
    let correct = 0;
    const cm = {
      tăng: { tăng: 0, giảm: 0, 'đi ngang': 0 },
      giảm: { tăng: 0, giảm: 0, 'đi ngang': 0 },
      'đi ngang': { tăng: 0, giảm: 0, 'đi ngang': 0 },
    };

    for (const s of sub) {
      const pred = classifyDirection(s.refChangePct, bestThreshold);
      const actual = classifyActualDirection(s.actualDelta);
      if (pred === actual) correct++;
      cm[actual][pred]++;
    }

    const ols = calculateOLS(sub.map((s) => ({ x: s.refChangePct, y: s.actualDelta })));
    if (ols.r2 > maxR2) maxR2 = ols.r2;

    productMetrics[prod] = {
      product: prod,
      benchmark: getBenchmarkForProduct(prod),
      totalPeriods: sub.length,
      correctCount: correct,
      accuracyPct: (correct / sub.length) * 100,
      confusionMatrix: cm,
      ols,
    };
  }

  return {
    generatedAt: new Date().toISOString(),
    totalPeriods: uniqueDates.length,
    evaluatedPairs: samples.length,
    optimalThresholdPct: bestThreshold,
    overallAccuracyPct: Math.round(overallAccuracyPct * 100) / 100,
    meetsAccuracyThreshold: overallAccuracyPct >= 60.0,
    meetsR2Threshold: maxR2 >= 0.5,
    percentile33Pct: Math.round(p33 * 100) / 100,
    percentile67Pct: Math.round(p67 * 100) / 100,
    productMetrics,
  };
}
