import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyActualDirection,
  calculateHit,
  checkAutoShutoff,
  evaluateForecastAccuracy,
  getForecastAccuracyStats,
  ACTUAL_DELTA_THRESHOLD,
} from '../src/forecast/index.ts';

test('1. Hit/Miss: Phân loại hướng thực tế theo ngưỡng 50 đ/lít (Prompt 11)', () => {
  // Ngưỡng Prompt 11 là 50 đ/lít
  assert.equal(ACTUAL_DELTA_THRESHOLD, 50);

  // Đi ngang khi |delta| <= 50
  assert.equal(classifyActualDirection(0), 'đi ngang');
  assert.equal(classifyActualDirection(30), 'đi ngang');
  assert.equal(classifyActualDirection(-30), 'đi ngang');
  assert.equal(classifyActualDirection(50), 'đi ngang');
  assert.equal(classifyActualDirection(-50), 'đi ngang');

  // Tăng khi delta > 50
  assert.equal(classifyActualDirection(51), 'tăng');
  assert.equal(classifyActualDirection(350), 'tăng');

  // Giảm khi delta < -50
  assert.equal(classifyActualDirection(-51), 'giảm');
  assert.equal(classifyActualDirection(-400), 'giảm');
});

test('2. Hit/Miss: Tính hit=1 khi khớp hướng và hit=0 khi lệch hướng', () => {
  // Trùng hướng -> hit = 1
  assert.equal(calculateHit('tăng', 'tăng'), 1);
  assert.equal(calculateHit('giảm', 'giảm'), 1);
  assert.equal(calculateHit('đi ngang', 'đi ngang'), 1);

  // Khác hướng -> hit = 0
  assert.equal(calculateHit('tăng', 'giảm'), 0);
  assert.equal(calculateHit('tăng', 'đi ngang'), 0);
  assert.equal(calculateHit('giảm', 'tăng'), 0);
  assert.equal(calculateHit('giảm', 'đi ngang'), 0);
  assert.equal(calculateHit('đi ngang', 'tăng'), 0);
  assert.equal(calculateHit('đi ngang', 'giảm'), 0);
});

test('3. Auto-shutoff: Kiểm tra điều kiện tự tắt khi tỷ lệ 10 kỳ gần nhất < 55%', () => {
  // 5/10 đúng = 50% < 55% -> Tự tắt
  const underThreshold = checkAutoShutoff(10, 50.0);
  assert.equal(underThreshold.isAutoShutoff, true);
  assert.equal(underThreshold.displayStatus, 'Chưa đủ cơ sở nhận định');

  // 4/10 đúng = 40% < 55% -> Tự tắt
  const severeUnder = checkAutoShutoff(10, 40.0);
  assert.equal(severeUnder.isAutoShutoff, true);
  assert.equal(severeUnder.displayStatus, 'Chưa đủ cơ sở nhận định');

  // 6/10 đúng = 60% >= 55% -> Hoạt động bình thường
  const normal = checkAutoShutoff(10, 60.0);
  assert.equal(normal.isAutoShutoff, false);
  assert.equal(normal.displayStatus, 'Hoạt động bình thường');

  // 8/10 đúng = 80% >= 55% -> Hoạt động bình thường
  const high = checkAutoShutoff(10, 80.0);
  assert.equal(high.isAutoShutoff, false);
  assert.equal(high.displayStatus, 'Hoạt động bình thường');

  // Chưa có kỳ đánh giá nào (0 kỳ)
  const zero = checkAutoShutoff(0, 0);
  assert.equal(zero.isAutoShutoff, false);
  assert.equal(zero.displayStatus, 'Hoạt động bình thường');
});

test('4. Đối chiếu: Chỉ đối chiếu với nhận định status="published", bỏ qua draft / insufficient_data', async () => {
  // Tạo bộ nhớ giả lập in-memory cho các bảng forecasts và forecast_results
  const forecastsTable = [
    {
      id: 1,
      product: 'PET-RON95III',
      target_period_start: '2026-10-01 15:00:00',
      direction: 'tăng',
      status: 'draft', // Bản nháp -> phải bị bỏ qua
    },
    {
      id: 2,
      product: 'PET-RON95III',
      target_period_start: '2026-10-08 15:00:00',
      direction: 'tăng',
      status: 'insufficient_data', // Chưa đủ cơ sở -> phải bị bỏ qua
    },
    {
      id: 3,
      product: 'PET-RON95III',
      target_period_start: '2026-10-15 15:00:00',
      direction: 'tăng',
      status: 'published', // Đã công bố -> được tính
    },
  ];

  const resultsTable = [];
  const logsTable = [];

  const mockDb = {
    prepare: (query) => ({
      bind: (...params) => ({
        first: async () => {
          if (query.includes('FROM forecasts f')) {
            const [product, effectiveAt] = params;
            // Tìm forecast published gần nhất thỏa mãn target_period_start <= effectiveAt và chưa có trong results
            const candidates = forecastsTable
              .filter(
                (f) =>
                  f.product === product &&
                  f.status === 'published' &&
                  f.direction &&
                  f.target_period_start <= effectiveAt &&
                  !resultsTable.some((r) => r.forecast_id === f.id)
              )
              .sort((a, b) => b.id - a.id);
            return candidates[0] || null;
          }
          return null;
        },
        run: async () => {
          if (query.includes('INSERT INTO forecast_results')) {
            const [forecast_id, actual_delta, actual_direction, hit, evaluated_at] = params;
            resultsTable.push({
              id: resultsTable.length + 1,
              forecast_id,
              actual_delta,
              actual_direction,
              hit,
              evaluated_at,
            });
          }
          if (query.includes('INSERT INTO ingest_log')) {
            const [source, status, message, created_at] = params;
            logsTable.push({ source, status, message, created_at });
          }
          return { success: true };
        },
        all: async () => ({ results: [] }),
      }),
      all: async () => {
        if (query.includes('FROM forecast_results r')) {
          // Join với forecasts status='published'
          const joined = resultsTable
            .map((r) => {
              const f = forecastsTable.find((fc) => fc.id === r.forecast_id);
              if (!f || f.status !== 'published') return null;
              return {
                id: r.id,
                forecast_id: r.forecast_id,
                product: f.product,
                target_period_start: f.target_period_start,
                forecast_direction: f.direction,
                actual_delta: r.actual_delta,
                actual_direction: r.actual_direction,
                hit: r.hit,
                evaluated_at: r.evaluated_at,
              };
            })
            .filter(Boolean)
            .sort((a, b) => b.id - a.id);
          return { results: joined };
        }
        return { results: [] };
      },
    }),
  };

  // Kỳ 2026-10-08: chỉ có draft và insufficient_data -> không đối chiếu được
  const res1 = await evaluateForecastAccuracy(mockDb, {
    product: 'PET-RON95III',
    delta: 200,
    effective_at: '2026-10-08 15:00:00',
  });
  assert.equal(res1, null, 'Không được đối chiếu forecast draft/insufficient_data');
  assert.equal(resultsTable.length, 0);

  // Kỳ 2026-10-15: có forecast id=3 (status=published, direction='tăng')
  // delta thực tế = 120 (> 50 -> thực tế tăng -> hit = 1)
  const res2 = await evaluateForecastAccuracy(mockDb, {
    product: 'PET-RON95III',
    delta: 120,
    effective_at: '2026-10-15 15:00:00',
  });
  assert.notEqual(res2, null);
  assert.equal(res2.forecast_id, 3);
  assert.equal(res2.forecast_direction, 'tăng');
  assert.equal(res2.actual_direction, 'tăng');
  assert.equal(res2.hit, 1);
  assert.equal(resultsTable.length, 1);
});

test('5. Bất biến: Không sửa nhận định đã công bố và không ghi đè kết quả đã đánh giá', async () => {
  const forecastsTable = [
    {
      id: 10,
      product: 'PET-E5RON92',
      target_period_start: '2026-10-20 15:00:00',
      direction: 'giảm',
      status: 'published',
    },
  ];

  const resultsTable = [];

  const mockDb = {
    prepare: (query) => {
      // Đảm bảo không có câu lệnh UPDATE nào trên bảng forecasts
      assert.ok(!query.toUpperCase().includes('UPDATE FORECASTS'), 'Nghiêm cấm sửa bảng forecasts!');
      return {
        bind: (...params) => ({
          first: async () => {
            if (query.includes('FROM forecasts f')) {
              const [product, effectiveAt] = params;
              const found = forecastsTable.find(
                (f) =>
                  f.product === product &&
                  f.status === 'published' &&
                  f.target_period_start <= effectiveAt &&
                  !resultsTable.some((r) => r.forecast_id === f.id)
              );
              return found || null;
            }
            return null;
          },
          run: async () => {
            if (query.includes('INSERT INTO forecast_results')) {
              const [forecast_id, actual_delta, actual_direction, hit, evaluated_at] = params;
              resultsTable.push({ forecast_id, actual_delta, actual_direction, hit, evaluated_at });
            }
            return { success: true };
          },
          all: async () => ({ results: [] }),
        }),
        all: async () => ({ results: [] }),
      };
    },
  };

  // Đánh giá lần đầu -> Thành công
  const eval1 = await evaluateForecastAccuracy(mockDb, {
    product: 'PET-E5RON92',
    delta: -150,
    effective_at: '2026-10-20 15:00:00',
  });
  assert.notEqual(eval1, null);
  assert.equal(eval1.hit, 1);
  assert.equal(resultsTable.length, 1);

  // Đánh giá lại cùng kỳ đó -> Phải trả về null do nhận định đã được đánh giá rồi (không ghi đè)
  const eval2 = await evaluateForecastAccuracy(mockDb, {
    product: 'PET-E5RON92',
    delta: -150,
    effective_at: '2026-10-20 15:00:00',
  });
  assert.equal(eval2, null, 'Không được đánh giá lại hoặc ghi đè kết quả đã có');
  assert.equal(resultsTable.length, 1);
});

test('6. Tự tắt & Ghi ingest_log: Khi tỷ lệ đúng 10 kỳ gần nhất < 55% thì tự tắt và ghi warning log', async () => {
  const forecastsTable = [];
  const resultsTable = [];
  const logsTable = [];

  // Tạo 10 kỳ nhận định và kết quả: 5 đúng, 5 sai -> 50% < 55%
  for (let i = 1; i <= 10; i++) {
    const fId = i;
    forecastsTable.push({
      id: fId,
      product: 'PET-DO005',
      target_period_start: `2026-08-${String(i).padStart(2, '0')}`,
      direction: 'tăng',
      status: 'published',
    });

    // Kỳ 1..5 đúng (delta = 100), Kỳ 6..10 sai (delta = -100)
    const isHit = i <= 5 ? 1 : 0;
    resultsTable.push({
      id: i,
      forecast_id: fId,
      actual_delta: isHit === 1 ? 100 : -100,
      actual_direction: isHit === 1 ? 'tăng' : 'giảm',
      hit: isHit,
      evaluated_at: `2026-08-${String(i).padStart(2, '0')} 15:00:00`,
    });
  }

  const mockDb = {
    prepare: (query) => ({
      bind: (...params) => ({
        first: async () => null,
        run: async () => {
          if (query.includes('INSERT INTO ingest_log')) {
            const [source, status, message, created_at] = params;
            logsTable.push({ source, status, message, created_at });
          }
          return { success: true };
        },
        all: async () => ({ results: [] }),
      }),
      all: async () => {
        if (query.includes('FROM forecast_results r')) {
          const joined = resultsTable.map((r) => {
            const f = forecastsTable.find((fc) => fc.id === r.forecast_id);
            return {
              id: r.id,
              forecast_id: r.forecast_id,
              product: f.product,
              target_period_start: f.target_period_start,
              forecast_direction: f.direction,
              actual_delta: r.actual_delta,
              actual_direction: r.actual_direction,
              hit: r.hit,
              evaluated_at: r.evaluated_at,
            };
          }).sort((a, b) => b.id - a.id);
          return { results: joined };
        }
        return { results: [] };
      },
    }),
  };

  const stats = await getForecastAccuracyStats(mockDb);
  assert.equal(stats.total_evaluations, 10);
  assert.equal(stats.total_hits, 5);
  assert.equal(stats.overall_accuracy_pct, 50.0);
  assert.equal(stats.recent_evaluations, 10);
  assert.equal(stats.recent_hits, 5);
  assert.equal(stats.recent_accuracy_pct, 50.0);

  // Điều kiện tự tắt kích hoạt
  assert.equal(stats.is_auto_shutoff, true);
  assert.equal(stats.display_status, 'Chưa đủ cơ sở nhận định');

  // Thêm 1 kỳ mới (kỳ 11) để kích hoạt evaluateForecastAccuracy và kiểm tra ghi ingest_log
  forecastsTable.push({
    id: 11,
    product: 'PET-DO005',
    target_period_start: '2026-09-01',
    direction: 'tăng',
    status: 'published',
  });

  // Mock DB hỗ trợ insert forecast_results cho kỳ 11
  const dbWithEval = {
    prepare: (query) => ({
      bind: (...params) => ({
        first: async () => {
          if (query.includes('FROM forecasts f')) {
            return forecastsTable.find((f) => f.id === 11);
          }
          return null;
        },
        run: async () => {
          if (query.includes('INSERT INTO forecast_results')) {
            resultsTable.unshift({
              id: 11,
              forecast_id: 11,
              actual_delta: -80,
              actual_direction: 'giảm',
              hit: 0,
              evaluated_at: '2026-09-01 15:00:00',
            });
          }
          if (query.includes('INSERT INTO ingest_log')) {
            const [source, status, message, created_at] = params;
            logsTable.push({ source, status, message, created_at });
          }
          return { success: true };
        },
        all: async () => ({ results: [] }),
      }),
      all: async () => {
        const joined = resultsTable.map((r) => {
          const f = forecastsTable.find((fc) => fc.id === r.forecast_id);
          return {
            id: r.id,
            forecast_id: r.forecast_id,
            product: f.product,
            target_period_start: f.target_period_start,
            forecast_direction: f.direction,
            actual_delta: r.actual_delta,
            actual_direction: r.actual_direction,
            hit: r.hit,
            evaluated_at: r.evaluated_at,
          };
        }).sort((a, b) => b.id - a.id);
        return { results: joined };
      },
    }),
  };

  await evaluateForecastAccuracy(dbWithEval, {
    product: 'PET-DO005',
    delta: -80,
    effective_at: '2026-09-01',
  });

  // Đã ghi ingest_log loại warning
  assert.ok(logsTable.length > 0, 'Phải ghi ingest_log khi tỷ lệ < 55%');
  const lastLog = logsTable[logsTable.length - 1];
  assert.equal(lastLog.source, 'Fuel Forecast Accuracy');
  assert.equal(lastLog.status, 'warning');
  assert.ok(lastLog.message.includes('Chưa đủ cơ sở nhận định'));
});

test('7. Phục hồi: Khi tỷ lệ đúng 10 kỳ gần nhất đạt >= 55% thì trạng thái trở lại bình thường', async () => {
  const forecastsTable = [];
  const resultsTable = [];

  // Tạo 10 kỳ với 6 đúng, 4 sai -> 60% >= 55%
  for (let i = 1; i <= 10; i++) {
    const fId = i;
    forecastsTable.push({
      id: fId,
      product: 'PET-RON95III',
      target_period_start: `2026-09-${String(i).padStart(2, '0')}`,
      direction: 'tăng',
      status: 'published',
    });

    const isHit = i <= 6 ? 1 : 0;
    resultsTable.push({
      id: i,
      forecast_id: fId,
      actual_delta: isHit === 1 ? 100 : -100,
      actual_direction: isHit === 1 ? 'tăng' : 'giảm',
      hit: isHit,
      evaluated_at: `2026-09-${String(i).padStart(2, '0')} 15:00:00`,
    });
  }

  const mockDb = {
    prepare: (query) => ({
      all: async () => {
        const joined = resultsTable.map((r) => {
          const f = forecastsTable.find((fc) => fc.id === r.forecast_id);
          return {
            id: r.id,
            forecast_id: r.forecast_id,
            product: f.product,
            target_period_start: f.target_period_start,
            forecast_direction: f.direction,
            actual_delta: r.actual_delta,
            actual_direction: r.actual_direction,
            hit: r.hit,
            evaluated_at: r.evaluated_at,
          };
        }).sort((a, b) => b.id - a.id);
        return { results: joined };
      },
    }),
  };

  const stats = await getForecastAccuracyStats(mockDb);
  assert.equal(stats.recent_evaluations, 10);
  assert.equal(stats.recent_hits, 6);
  assert.equal(stats.recent_accuracy_pct, 60.0);
  assert.equal(stats.is_auto_shutoff, false);
  assert.equal(stats.display_status, 'Hoạt động bình thường');
});
