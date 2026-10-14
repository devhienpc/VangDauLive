// apps/api/src/forecast/mechanism.ts
// Hiện thực hóa logic chu kỳ và công thức giá theo cơ chế điều hành (NĐ 80/2023/NĐ-CP & TT 104/2021/TT-BTC)

import type { PeriodWindow, ReferenceChangeMetric } from './types.ts';

export const BENCHMARK_MAP: Record<string, string> = {
  'PET-RON95III': 'RB=F', // Xăng RBOB (NYMEX) tham chiếu xăng Mogas 95
  'PET-RON95V':   'RB=F',
  'PET-E5RON92':  'RB=F', // Xăng RBOB tham chiếu xăng Mogas 92
  'PET-DO005':    'HO=F', // Heating Oil / ULSD tham chiếu dầu Diesel 0.05S
  'PET-DO001':    'HO=F', // Heating Oil / ULSD tham chiếu dầu Diesel 0.001S
  'PET-KO':       'HO=F',
};

export const BRENT_BENCHMARK = 'BZ=F';
export const FX_BENCHMARK = 'USD_VND';
export const DEFAULT_USD_VND_RATE = 25000;

export function getBenchmarkForProduct(product: string): string {
  return BENCHMARK_MAP[product] || 'RB=F';
}

/**
 * Căn cứ theo Nghị định 80/2023/NĐ-CP:
 * Chu kỳ điều hành là 07 ngày, định kỳ vào thứ Năm hằng tuần.
 * "Kỳ hiện tại" được xác định từ ngày hiệu lực của lần điều chỉnh gần nhất đến hôm nay (hoặc ngày chỉ định).
 * "Kỳ trước" là khoảng giữa kỳ điều chỉnh liền kề trước đó đến kỳ điều chỉnh gần nhất.
 */
export function determineCycles(
  sortedAdjustmentDates: string[],
  asOfDateStr: string = new Date().toISOString().slice(0, 10)
): {
  currentCycle: PeriodWindow;
  previousCycle: PeriodWindow;
} {
  // Lọc các kỳ điều hành đã diễn ra trước hoặc trong asOfDate
  const pastDates = sortedAdjustmentDates
    .map((d) => d.slice(0, 10))
    .filter((d) => d <= asOfDateStr)
    .sort();

  if (pastDates.length === 0) {
    throw new Error('Không có lịch sử kỳ điều hành nào trước ngày khảo sát.');
  }

  const lastEffectiveDate = pastDates[pastDates.length - 1]!;
  const prevEffectiveDate =
    pastDates.length >= 2 ? pastDates[pastDates.length - 2]! : lastEffectiveDate;

  return {
    currentCycle: {
      cycleIndex: pastDates.length,
      startDate: lastEffectiveDate,
      endDate: asOfDateStr,
      isCurrentCycle: true,
    },
    previousCycle: {
      cycleIndex: pastDates.length - 1,
      startDate: prevEffectiveDate,
      endDate: lastEffectiveDate,
      isCurrentCycle: false,
    },
  };
}

/**
 * Tính giá bình quân của mã tham chiếu trong một kỳ tính giá, quy đổi sang VND.
 * Theo Thông tư 104/2021/TT-BTC:
 * Bình quân tính theo số ngày thực tế có giá giao dịch giữa hai kỳ điều hành.
 * @param candleMap Map ngày -> giá đóng cửa của mã tham chiếu
 * @param fxMap Map ngày -> tỷ giá USD/VND
 * @param startDate Ngày bắt đầu kỳ (thường là ngày điều hành trước)
 * @param endDate Ngày kết thúc kỳ
 * @param inclusiveStart Nếu true tính cả ngày bắt đầu, nếu false tính các ngày sau startDate
 */
export function calculateCycleAverageVND(
  candleMap: Map<string, number>,
  fxMap: Map<string, number>,
  startDate: string,
  endDate: string,
  inclusiveStart: boolean = false
): { avgVND: number | null; daysCount: number } {
  const dailyVNDValues: number[] = [];

  for (const [date, price] of candleMap.entries()) {
    const isWithinRange = inclusiveStart
      ? date >= startDate && date <= endDate
      : date > startDate && date <= endDate;

    if (isWithinRange) {
      const fxRate = fxMap.get(date) || DEFAULT_USD_VND_RATE;
      dailyVNDValues.push(price * fxRate);
    }
  }

  if (dailyVNDValues.length === 0) {
    return { avgVND: null, daysCount: 0 };
  }

  const sum = dailyVNDValues.reduce((acc, val) => acc + val, 0);
  return {
    avgVND: sum / dailyVNDValues.length,
    daysCount: dailyVNDValues.length,
  };
}

/**
 * Tính toán số liệu thay đổi của mã tham chiếu cho một sản phẩm giữa kỳ hiện tại và kỳ trước.
 */
export function computeReferenceChange(
  product: string,
  candleCache: Record<string, Map<string, number>>,
  currentCycle: PeriodWindow,
  previousCycle: PeriodWindow
): ReferenceChangeMetric {
  const benchmark = getBenchmarkForProduct(product);
  const benchMap = candleCache[benchmark] || new Map();
  const brentMap = candleCache[BRENT_BENCHMARK] || new Map();
  const fxMap = candleCache[FX_BENCHMARK] || candleCache['USD/VND'] || new Map();

  const curBench = calculateCycleAverageVND(
    benchMap,
    fxMap,
    currentCycle.startDate,
    currentCycle.endDate,
    false
  );
  const prevBench = calculateCycleAverageVND(
    benchMap,
    fxMap,
    previousCycle.startDate,
    previousCycle.endDate,
    false
  );

  const curBrent = calculateCycleAverageVND(
    brentMap,
    fxMap,
    currentCycle.startDate,
    currentCycle.endDate,
    false
  );
  const prevBrent = calculateCycleAverageVND(
    brentMap,
    fxMap,
    previousCycle.startDate,
    previousCycle.endDate,
    false
  );

  const curAvgVND = curBench.avgVND ?? 0;
  const prevAvgVND = prevBench.avgVND ?? 0;

  let changePct = 0;
  if (prevAvgVND > 0 && curAvgVND > 0) {
    changePct = ((curAvgVND - prevAvgVND) / prevAvgVND) * 100;
  }

  let brentChangePct = 0;
  if (curBrent.avgVND && prevBrent.avgVND && prevBrent.avgVND > 0) {
    brentChangePct = ((curBrent.avgVND - prevBrent.avgVND) / prevBrent.avgVND) * 100;
  }

  // Nhất quán với Brent: cùng chiều biến động (cả 2 cùng tăng hoặc cùng giảm hoặc cùng nhỏ)
  const consistentWithBrent =
    (changePct >= 0 && brentChangePct >= -0.5) ||
    (changePct <= 0 && brentChangePct <= 0.5);

  return {
    symbol: product,
    benchmarkSymbol: benchmark,
    brentSymbol: BRENT_BENCHMARK,
    fxSymbol: FX_BENCHMARK,
    currentAvgVND: curAvgVND,
    prevAvgVND: prevAvgVND,
    changePct,
    brentChangePct,
    consistentWithBrent,
    validDaysInCurrentPeriod: curBench.daysCount,
  };
}
