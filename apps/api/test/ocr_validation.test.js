// test/ocr_validation.test.js
// Unit tests theo Yêu cầu 7:
// Kiểm tra bộ validate OCR: đủ/thiếu sản phẩm, giá vô lý, lệch >10%, zone2 < zone1, và so sánh 2 lần chạy

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  validateOcrFuelData,
  compareTwoRuns,
  mapProductToSymbol,
  extractJsonFromAiResponse,
} from '../src/adapters/ocr-fuel.ts';

// ── Test 1: Đủ 5 sản phẩm, giá hợp lệ, không có cờ cảnh báo
test('OCR Validate 1: Dữ liệu chuẩn đủ 5 sản phẩm, giá hợp lý, zone2 >= zone1 -> Hợp lệ', () => {
  const validItems = [
    { symbol: 'RON95_V', zone1: 29050, zone2: 29630 },
    { symbol: 'RON95_III', zone1: 28250, zone2: 28810 },
    { symbol: 'RON92_E5', zone1: 27700, zone2: 28250 },
    { symbol: 'DO0005', zone1: 29120, zone2: 29700 },
    { symbol: 'DO001', zone1: 30520, zone2: 31130 },
  ];

  const refPrices = new Map([
    ['RON95_V', 29050],
    ['RON95_III', 28250],
    ['RON92_E5', 27700],
    ['DO0005', 29120],
    ['DO001', 30520],
  ]);

  const res = validateOcrFuelData(validItems, refPrices);

  assert.equal(res.isValid, true);
  assert.equal(res.needsReview, false);
  assert.equal(res.flags.length, 0);
  assert.equal(res.reasons.length, 0);
});

// ── Test 2: Thiếu sản phẩm (chỉ có 4 mặt hàng)
test('OCR Validate 2: Thiếu sản phẩm -> Gắn cờ missing_products và needsReview = true', () => {
  const incompleteItems = [
    // Thiếu RON95_V
    { symbol: 'RON95_III', zone1: 28250, zone2: 28810 },
    { symbol: 'RON92_E5', zone1: 27700, zone2: 28250 },
    { symbol: 'DO0005', zone1: 29120, zone2: 29700 },
    { symbol: 'DO001', zone1: 30520, zone2: 31130 },
  ];

  const res = validateOcrFuelData(incompleteItems);

  assert.equal(res.isValid, false);
  assert.equal(res.needsReview, true);
  assert.ok(res.flags.includes('missing_products'));
  assert.ok(res.reasons.some((r) => r.includes('RON95_V')));
});

// ── Test 3: Giá vô lý (<10.000 hoặc >60.000)
test('OCR Validate 3: Giá vô lý (<10.000đ hoặc >60.000đ) -> Gắn cờ invalid_range', () => {
  const unreasonableItems = [
    { symbol: 'RON95_V', zone1: 2905, zone2: 29630 }, // zone1 quá thấp (2.905đ)
    { symbol: 'RON95_III', zone1: 28250, zone2: 88810 }, // zone2 quá cao (88.810đ)
    { symbol: 'RON92_E5', zone1: 27700, zone2: 28250 },
    { symbol: 'DO0005', zone1: 29120, zone2: 29700 },
    { symbol: 'DO001', zone1: 30520, zone2: 31130 },
  ];

  const res = validateOcrFuelData(unreasonableItems);

  assert.equal(res.isValid, false);
  assert.equal(res.needsReview, true);
  assert.ok(res.flags.some((f) => f.includes('invalid_range_RON95_V_zone1')));
  assert.ok(res.flags.some((f) => f.includes('invalid_range_RON95_III_zone2')));
});

// ── Test 4: Lệch >10% so với giá fuel_manual gần nhất
test('OCR Validate 4: Giá lệch >10% so với bản ghi fuel_manual gần nhất -> Gắn cờ diff_over_10pct', () => {
  const deviatedItems = [
    { symbol: 'RON95_V', zone1: 29050, zone2: 29630 },
    // Giá tham chiếu là 28.250đ, OCR đọc nhầm thành 33.000đ (lệch ~16.8% > 10%)
    { symbol: 'RON95_III', zone1: 33000, zone2: 33500 },
    { symbol: 'RON92_E5', zone1: 27700, zone2: 28250 },
    { symbol: 'DO0005', zone1: 29120, zone2: 29700 },
    { symbol: 'DO001', zone1: 30520, zone2: 31130 },
  ];

  const refPrices = new Map([
    ['RON95_V', 29050],
    ['RON95_III', 28250],
    ['RON92_E5', 27700],
    ['DO0005', 29120],
    ['DO001', 30520],
  ]);

  const res = validateOcrFuelData(deviatedItems, refPrices);

  assert.equal(res.needsReview, true);
  assert.ok(res.flags.some((f) => f.includes('diff_over_10pct_RON95_III')));
  assert.ok(res.reasons.some((r) => r.includes('>10%')));
});

// ── Test 5: Vi phạm điều kiện zone2 >= zone1
test('OCR Validate 5: Giá Vùng 2 nhỏ hơn Vùng 1 (zone2 < zone1) -> Gắn cờ cảnh báo', () => {
  const invertedZoneItems = [
    { symbol: 'RON95_V', zone1: 29050, zone2: 29630 },
    // Vùng 1 = 28.250, nhưng Vùng 2 = 27.800 (sai quy luật phân vùng)
    { symbol: 'RON95_III', zone1: 28250, zone2: 27800 },
    { symbol: 'RON92_E5', zone1: 27700, zone2: 28250 },
    { symbol: 'DO0005', zone1: 29120, zone2: 29700 },
    { symbol: 'DO001', zone1: 30520, zone2: 31130 },
  ];

  const res = validateOcrFuelData(invertedZoneItems);

  assert.equal(res.needsReview, true);
  assert.ok(res.flags.some((f) => f.includes('zone2_less_than_zone1_RON95_III')));
});

// ── Test 6: Yêu cầu 3 - Đối chiếu 2 lần chạy mô hình
test('OCR Compare 6: Hai lần chạy khác số liệu -> Phát hiện không khớp (inconsistent)', () => {
  const run1 = [
    { symbol: 'RON95_V', name: 'Xăng E10 RON 95-V', product: 'RON95-V', zone1: 29050, zone2: 29630 },
    { symbol: 'RON95_III', name: 'Xăng E10 RON 95-III', product: 'RON95-III', zone1: 28250, zone2: 28810 },
  ];

  const run2Different = [
    { symbol: 'RON95_V', name: 'Xăng E10 RON 95-V', product: 'RON95-V', zone1: 29050, zone2: 29630 },
    // Lần 2 đọc nhầm 28.250 thành 28.520
    { symbol: 'RON95_III', name: 'Xăng E10 RON 95-III', product: 'RON95-III', zone1: 28520, zone2: 28810 },
  ];

  const compareRes = compareTwoRuns(run1, run2Different);
  assert.equal(compareRes.isConsistent, false);
  assert.ok(compareRes.diffDetails.length > 0);
  assert.ok(compareRes.diffDetails[0].includes('RON95_III'));
});

// ── Test 7: Trích xuất JSON từ phản hồi Markdown / Codeblock của AI
test('OCR Parser 7: Bóc tách JSON an toàn từ phản hồi text markdown của AI', () => {
  const markdownText = `
    Dưới đây là bảng giá trích xuất được:
    \`\`\`json
    [
      {"product": "Xăng E10 RON 95 Mức 5", "zone1": 29050, "zone2": 29630},
      {"product": "Xăng E10 RON 95 Mức 3", "zone1": 28250, "zone2": 28810}
    ]
    \`\`\`
  `;

  const parsed = extractJsonFromAiResponse(markdownText);
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].zone1, 29050);

  const mapped = mapProductToSymbol(parsed[0].product);
  assert.equal(mapped?.symbol, 'RON95_V');
});
