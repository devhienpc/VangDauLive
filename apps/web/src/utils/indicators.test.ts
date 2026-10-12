// src/utils/indicators.test.ts
import { describe, it, expect } from 'vitest';
import {
  calculateSMA,
  calculateEMA,
  calculateBollingerBands,
  calculateRSI,
  normalizeToPercentageChange,
  type CandlePoint,
} from './indicators';

function makeMockCandles(prices: number[]): CandlePoint[] {
  return prices.map((close, i) => ({
    time: `2026-01-${String(i + 1).padStart(2, '0')}`,
    open: close * 0.99,
    high: close * 1.01,
    low: close * 0.98,
    close,
  }));
}

describe('Technical Indicators', () => {
  it('calculateSMA calculates correct moving average', () => {
    const data = makeMockCandles([10, 20, 30, 40, 50]);
    const sma3 = calculateSMA(data, 3);

    expect(sma3.length).toBe(3);
    // (10 + 20 + 30) / 3 = 20
    expect(sma3[0]).toEqual({ time: '2026-01-03', value: 20 });
    // (20 + 30 + 40) / 3 = 30
    expect(sma3[1]).toEqual({ time: '2026-01-04', value: 30 });
    // (30 + 40 + 50) / 3 = 40
    expect(sma3[2]).toEqual({ time: '2026-01-05', value: 40 });
  });

  it('calculateEMA calculates exponential moving average properly', () => {
    const data = makeMockCandles([10, 20, 30, 40, 50]);
    const ema3 = calculateEMA(data, 3);

    expect(ema3.length).toBe(3);
    // first EMA = SMA(3) = 20
    expect(ema3[0].value).toBe(20);
    // multiplier = 2 / (3 + 1) = 0.5
    // next EMA = 40 * 0.5 + 20 * 0.5 = 30
    expect(ema3[1].value).toBe(30);
    // next EMA = 50 * 0.5 + 30 * 0.5 = 40
    expect(ema3[2].value).toBe(40);
  });

  it('calculateBollingerBands calculates upper, middle, lower bands correctly', () => {
    const prices = [10, 12, 11, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 30];
    const data = makeMockCandles(prices);
    const bb = calculateBollingerBands(data, 5, 2);

    expect(bb.upper.length).toBe(data.length - 5 + 1);
    expect(bb.middle.length).toBe(data.length - 5 + 1);
    expect(bb.lower.length).toBe(data.length - 5 + 1);

    // For any point, upper should be >= middle and middle should be >= lower
    for (let i = 0; i < bb.upper.length; i++) {
      expect(bb.upper[i].value).toBeGreaterThanOrEqual(bb.middle[i].value);
      expect(bb.middle[i].value).toBeGreaterThanOrEqual(bb.lower[i].value);
    }
  });

  it('calculateRSI returns values in [0, 100]', () => {
    // 20 data points with alternate up and down
    const prices = [
      44, 44.5, 43.5, 45, 45.5, 46, 45.8, 46.2, 47, 46.8, 47.5, 48, 48.5, 47.9, 49,
      50, 49.5, 51, 52, 51.5
    ];
    const data = makeMockCandles(prices);
    const rsi = calculateRSI(data, 14);

    expect(rsi.length).toBeGreaterThan(0);
    for (const point of rsi) {
      expect(point.value).toBeGreaterThanOrEqual(0);
      expect(point.value).toBeLessThanOrEqual(100);
    }
  });

  it('normalizeToPercentageChange normalizes properly', () => {
    const data = makeMockCandles([100, 105, 95, 110]);
    const normalized = normalizeToPercentageChange(data);

    expect(normalized).toEqual([
      { time: '2026-01-01', value: 0 },
      { time: '2026-01-02', value: 5 },
      { time: '2026-01-03', value: -5 },
      { time: '2026-01-04', value: 10 },
    ]);
  });
});
