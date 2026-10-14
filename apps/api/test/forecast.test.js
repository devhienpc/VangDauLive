// apps/api/test/forecast.test.js
// Unit tests cho module nhận định giá xăng dầu

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  determineCycles,
  calculateCycleAverageVND,
  computeReferenceChange,
  getBenchmarkForProduct,
} from '../src/forecast/mechanism.ts';

import {
  classifyDirection,
  classifyActualDirection,
  calculateOLS,
  runBacktest,
} from '../src/forecast/backtest.ts';

import {
  evaluateConfidence,
  evaluateMagnitude,
  generateForecast,
} from '../src/forecast/engine.ts';

import { FORECAST_CONFIG } from '../src/forecast/config.ts';

test('1. Mechanism: Xác định đúng chu kỳ điều hành hiện tại và kỳ trước', () => {
  const dates = [
    '2026-09-17 15:00:00',
    '2026-09-24 15:00:00',
    '2026-10-01 15:00:00',
    '2026-10-08 15:00:00',
  ];

  const { currentCycle, previousCycle } = determineCycles(dates, '2026-10-14');

  // Kỳ hiện tại tính từ lần điều chỉnh gần nhất (2026-10-08) đến ngày hôm nay (2026-10-14)
  assert.equal(currentCycle.startDate, '2026-10-08');
  assert.equal(currentCycle.endDate, '2026-10-14');
  assert.equal(currentCycle.isCurrentCycle, true);

  // Kỳ trước tính từ kỳ liền kề trước đó (2026-10-01) đến lần điều chỉnh gần nhất (2026-10-08)
  assert.equal(previousCycle.startDate, '2026-10-01');
  assert.equal(previousCycle.endDate, '2026-10-08');
  assert.equal(previousCycle.isCurrentCycle, false);
});

test('2. Mechanism: Quy đổi giá tham chiếu sang VND theo tỷ giá bình quân kỳ', () => {
  const candleMap = new Map([
    ['2026-10-09', 2.0],
    ['2026-10-10', 2.2],
    ['2026-10-11', 2.4],
  ]);

  const fxMap = new Map([
    ['2026-10-09', 25000],
    ['2026-10-10', 25000],
    ['2026-10-11', 25000],
  ]);

  const res = calculateCycleAverageVND(
    candleMap,
    fxMap,
    '2026-10-08',
    '2026-10-11',
    false
  );

  assert.equal(res.daysCount, 3);
  // (2.0*25000 + 2.2*25000 + 2.4*25000) / 3 = 55.000 VND
  assert.equal(res.avgVND, 55000);
});

test('3. Mechanism: Ánh xạ chuẩn xác mã tham chiếu cho nhóm xăng và nhóm dầu', () => {
  assert.equal(getBenchmarkForProduct('PET-RON95III'), 'RB=F');
  assert.equal(getBenchmarkForProduct('PET-RON95V'), 'RB=F');
  assert.equal(getBenchmarkForProduct('PET-E5RON92'), 'RB=F');
  assert.equal(getBenchmarkForProduct('PET-DO005'), 'HO=F');
  assert.equal(getBenchmarkForProduct('PET-DO001'), 'HO=F');
});

test('4. Backtest: Phân loại hướng tăng/giảm/đi ngang theo ngưỡng theta', () => {
  const theta = 0.5;

  assert.equal(classifyDirection(0.8, theta), 'tăng');
  assert.equal(classifyDirection(-0.9, theta), 'giảm');
  assert.equal(classifyDirection(0.3, theta), 'đi ngang');
  assert.equal(classifyDirection(-0.2, theta), 'đi ngang');

  assert.equal(classifyActualDirection(150), 'tăng');
  assert.equal(classifyActualDirection(-200), 'giảm');
  assert.equal(classifyActualDirection(30), 'đi ngang');
  assert.equal(classifyActualDirection(-40), 'đi ngang');
});

test('5. Backtest: Tính hồi quy OLS và hệ số xác định R²', () => {
  // Quan sát tương quan hoàn hảo: y = 200 * x
  const perfectData = [
    { x: -2, y: -400 },
    { x: -1, y: -200 },
    { x: 0, y: 0 },
    { x: 1, y: 200 },
    { x: 2, y: 400 },
  ];
  const olsPerfect = calculateOLS(perfectData);
  assert.ok(Math.abs(olsPerfect.r2 - 1.0) < 0.001);
  assert.ok(Math.abs(olsPerfect.beta - 200) < 0.001);

  // Quan sát nhiễu không có tương quan
  const noisyData = [
    { x: -2, y: 100 },
    { x: -1, y: -50 },
    { x: 0, y: 80 },
    { x: 1, y: -70 },
    { x: 2, y: 10 },
  ];
  const olsNoisy = calculateOLS(noisyData);
  assert.ok(olsNoisy.r2 < 0.5);
});

test('6. Engine: Phân loại mức độ biến động (nhẹ, vừa, mạnh)', () => {
  const p33 = 1.68;
  const p67 = 4.73;

  assert.equal(evaluateMagnitude(0.8, p33, p67), 'nhẹ');
  assert.equal(evaluateMagnitude(-1.5, p33, p67), 'nhẹ');
  assert.equal(evaluateMagnitude(2.5, p33, p67), 'vừa');
  assert.equal(evaluateMagnitude(-3.8, p33, p67), 'vừa');
  assert.equal(evaluateMagnitude(5.2, p33, p67), 'mạnh');
  assert.equal(evaluateMagnitude(-6.0, p33, p67), 'mạnh');
});

test('7. Engine: Đánh giá độ tin cậy và xử lý can thiệp Quỹ bình ổn giá (BOG)', () => {
  const th = 0.5;

  // Tín hiệu mạnh + nhất quán với Brent -> Cao
  const highConf = evaluateConfidence(4.0, th, true);
  assert.equal(highConf, 'cao');

  // Can thiệp BOG từ tin tức làm giảm độ tin cậy từ cao xuống trung bình
  const bogIntervention = {
    hasIntervention: true,
    reason: 'Liên Bộ thông báo chi sử dụng Quỹ BOG kìm đà tăng giá',
  };
  const downgraded = evaluateConfidence(4.0, th, true, bogIntervention);
  assert.equal(downgraded, 'trung bình');

  // Tín hiệu yếu -> Thấp
  const lowConf = evaluateConfidence(0.3, th, false);
  assert.equal(lowConf, 'thấp');
});

test('8. Engine: Điều kiện "Chưa đủ cơ sở" khi lịch sử dưới 30 kỳ', async () => {
  // Mock DB với ít hơn 30 kỳ
  const mockDb = {
    prepare: (query) => ({
      all: async () => {
        if (query.includes('fuel_adjustments')) {
          return {
            results: [
              { effective_at: '2026-10-01 15:00:00', product: 'PET-RON95III', price_zone1: 27000, delta: 0 },
              { effective_at: '2026-10-08 15:00:00', product: 'PET-RON95III', price_zone1: 28000, delta: 1000 },
            ],
          };
        }
        return { results: [] };
      },
      bind: () => ({ run: async () => {} }),
    }),
  };

  const res = await generateForecast(mockDb, { asOfDate: '2026-10-14' });
  assert.equal(res.status, 'insufficient_data');
  assert.ok(res.reasons.some((r) => r.includes('30 kỳ')));
  assert.equal(res.forecasts[0].status, 'insufficient_data');
  assert.equal(res.forecasts[0].direction, null);
});

test('9. Engine: Điều kiện "Chưa đủ cơ sở" khi độ chính xác backtest dưới 60%', async () => {
  // Tạo đủ 35 kỳ nhưng với độ chính xác backtest mặc định là 44.62% (< 60%)
  const periods = [];
  for (let i = 1; i <= 35; i++) {
    const day = String(i).padStart(2, '0');
    periods.push({
      effective_at: `2026-01-${day} 15:00:00`,
      product: 'PET-RON95III',
      price_zone1: 25000 + i * 50,
      delta: 50,
    });
  }

  const mockDb = {
    prepare: (query) => ({
      all: async () => {
        if (query.includes('fuel_adjustments')) return { results: periods };
        if (query.includes('daily_candles')) {
          return {
            results: [
              { symbol: 'RB=F', date: '2026-01-34', close: 2.1 },
              { symbol: 'RB=F', date: '2026-01-35', close: 2.2 },
            ],
          };
        }
        return { results: [] };
      },
      bind: () => ({ run: async () => {} }),
    }),
  };

  const res = await generateForecast(mockDb, {
    asOfDate: '2026-01-35',
    customConfig: { overallAccuracyPct: 44.62 },
  });

  assert.equal(res.status, 'insufficient_data');
  assert.ok(res.reasons.some((r) => r.includes('60%')));
  assert.equal(res.forecasts[0].status, 'insufficient_data');
});

test('10. Engine: Khởi tạo đầy đủ schema và không hiển thị khoảng ước lượng khi R² < 0.5', async () => {
  // Tạo 34 kỳ kết thúc tại 2026-01-34, ngày khảo sát asOfDate là 2026-01-35
  const periods = [];
  for (let i = 1; i <= 34; i++) {
    const day = String(i).padStart(2, '0');
    periods.push({
      effective_at: `2026-01-${day} 15:00:00`,
      product: 'PET-RON95III',
      price_zone1: 25000 + i * 50,
      delta: 50,
    });
  }

  const mockDb = {
    prepare: (query) => ({
      all: async () => {
        if (query.includes('fuel_adjustments')) return { results: periods };
        if (query.includes('daily_candles')) {
          return {
            results: [
              { symbol: 'RB=F', date: '2026-01-33', close: 2.0 },
              { symbol: 'RB=F', date: '2026-01-34', close: 2.1 },
              { symbol: 'RB=F', date: '2026-01-35', close: 2.4 },
              { symbol: 'BZ=F', date: '2026-01-33', close: 73.0 },
              { symbol: 'BZ=F', date: '2026-01-34', close: 74.0 },
              { symbol: 'BZ=F', date: '2026-01-35', close: 78.0 },
            ],
          };
        }
        return { results: [] };
      },
      bind: () => ({ run: async () => {} }),
    }),
  };

  // Giả lập accuracy >= 60% để kiểm tra các trường kết quả khi đủ điều kiện
  const res = await generateForecast(mockDb, {
    asOfDate: '2026-01-35',
    customConfig: {
      overallAccuracyPct: 65.0,
      r2: 0.016, // R² < 0.5
    },
    targetProducts: ['PET-RON95III'],
  });

  assert.equal(res.forecasts.length, 1);
  const f = res.forecasts[0];
  assert.equal(f.product, 'PET-RON95III');
  assert.equal(f.direction, 'tăng');
  assert.ok(f.status === 'ready' || f.status === 'published');

  // Do R² < 0.5 nên range_low và range_high phải là null
  assert.equal(f.range_low, null);
  assert.equal(f.range_high, null);

  const reasons = JSON.parse(f.reasons_json);
  assert.ok(reasons.r2Explanation.includes('Hệ số xác định R² < 0.5'));
});
