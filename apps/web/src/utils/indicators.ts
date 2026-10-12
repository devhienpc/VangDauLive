// src/utils/indicators.ts
// Các chỉ báo kỹ thuật tài chính tính toán phía client: SMA, EMA, Bollinger Bands, RSI

export interface TimePoint {
  time: string; // YYYY-MM-DD
  value: number;
}

export interface CandlePoint {
  time: string; // YYYY-MM-DD
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface BollingerBandsResult {
  upper: TimePoint[];
  middle: TimePoint[];
  lower: TimePoint[];
}

/**
 * Đường trung bình động đơn giản (Simple Moving Average - SMA)
 */
export function calculateSMA(data: CandlePoint[], period: number): TimePoint[] {
  if (!data || data.length < period || period <= 0) return [];

  const result: TimePoint[] = [];
  let sum = 0;

  for (let i = 0; i < data.length; i++) {
    sum += data[i].close;

    if (i >= period) {
      sum -= data[i - period].close;
    }

    if (i >= period - 1) {
      result.push({
        time: data[i].time,
        value: Math.round((sum / period) * 100) / 100,
      });
    }
  }

  return result;
}

/**
 * Đường trung bình động hàm mũ (Exponential Moving Average - EMA)
 */
export function calculateEMA(data: CandlePoint[], period: number): TimePoint[] {
  if (!data || data.length < period || period <= 0) return [];

  const result: TimePoint[] = [];
  const multiplier = 2 / (period + 1);

  // Khởi tạo giá trị đầu tiên bằng SMA của 'period' điểm đầu
  let initialSum = 0;
  for (let i = 0; i < period; i++) {
    initialSum += data[i].close;
  }
  let prevEma = initialSum / period;

  result.push({
    time: data[period - 1].time,
    value: Math.round(prevEma * 100) / 100,
  });

  for (let i = period; i < data.length; i++) {
    const currentClose = data[i].close;
    const currentEma = (currentClose - prevEma) * multiplier + prevEma;
    result.push({
      time: data[i].time,
      value: Math.round(currentEma * 100) / 100,
    });
    prevEma = currentEma;
  }

  return result;
}

/**
 * Dải Bollinger Bands (mặc định period = 20, multiplier = 2)
 */
export function calculateBollingerBands(
  data: CandlePoint[],
  period: number = 20,
  multiplier: number = 2,
): BollingerBandsResult {
  const emptyResult: BollingerBandsResult = { upper: [], middle: [], lower: [] };
  if (!data || data.length < period || period <= 0) return emptyResult;

  const upper: TimePoint[] = [];
  const middle: TimePoint[] = [];
  const lower: TimePoint[] = [];

  for (let i = period - 1; i < data.length; i++) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) {
      sum += data[j].close;
    }
    const sma = sum / period;

    let varianceSum = 0;
    for (let j = i - period + 1; j <= i; j++) {
      varianceSum += Math.pow(data[j].close - sma, 2);
    }
    const stdDev = Math.sqrt(varianceSum / period);

    const time = data[i].time;
    const upVal = sma + multiplier * stdDev;
    const lowVal = sma - multiplier * stdDev;

    middle.push({ time, value: Math.round(sma * 100) / 100 });
    upper.push({ time, value: Math.round(upVal * 100) / 100 });
    lower.push({ time, value: Math.round(lowVal * 100) / 100 });
  }

  return { upper, middle, lower };
}

/**
 * Chỉ số sức mạnh tương đối RSI (Relative Strength Index) theo phương pháp Wilder (period = 14)
 */
export function calculateRSI(data: CandlePoint[], period: number = 14): TimePoint[] {
  if (!data || data.length <= period || period <= 0) return [];

  const result: TimePoint[] = [];

  // Tính sự thay đổi giá từng phiên
  let gainSum = 0;
  let lossSum = 0;

  for (let i = 1; i <= period; i++) {
    const diff = data[i].close - data[i - 1].close;
    if (diff > 0) gainSum += diff;
    else lossSum += Math.abs(diff);
  }

  let avgGain = gainSum / period;
  let avgLoss = lossSum / period;

  let rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  let rsi = avgLoss === 0 ? 100 : 100 - 100 / (1 + rs);

  result.push({
    time: data[period].time,
    value: Math.round(rsi * 100) / 100,
  });

  // Smoothing theo Wilder cho các điểm tiếp theo
  for (let i = period + 1; i < data.length; i++) {
    const diff = data[i].close - data[i - 1].close;
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    if (avgLoss === 0) {
      rsi = 100;
    } else {
      rs = avgGain / avgLoss;
      rsi = 100 - 100 / (1 + rs);
    }

    result.push({
      time: data[i].time,
      value: Math.round(rsi * 100) / 100,
    });
  }

  return result;
}

/**
 * Chuẩn hóa chuỗi giá thành % thay đổi so với điểm đầu kỳ (dùng cho chế độ So sánh)
 */
export function normalizeToPercentageChange(data: CandlePoint[]): TimePoint[] {
  if (!data || data.length === 0) return [];
  const basePrice = data[0].close;
  if (basePrice === 0) return [];

  return data.map((d) => ({
    time: d.time,
    value: Math.round(((d.close - basePrice) / basePrice) * 10000) / 100,
  }));
}
