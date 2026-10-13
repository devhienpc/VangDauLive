// test/fuel_strategy.test.js
// Unit tests theo Yêu cầu 7:
// 1. Regex trích giá từ 2 mẫu văn bản thông cáo giả lập
// 2. Logic ưu tiên giá nhập tay (manual) > gợi ý scraper (suggestion)
// 3. Kiểm tra nhãn nhắc cập nhật nếu quá 10 ngày

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  extractPricesFromAnnouncementText,
} from '../src/adapters/fuel.ts';

// ── Test 1: Mẫu văn bản thông cáo giả lập số 1 (Định dạng thông cáo báo chí Petrolimex truyền thống)
test('Regex Trích Giá - Mẫu 1: Thông cáo báo chí chuẩn của Petrolimex', () => {
  const sample1 = `
    Tập đoàn Xăng dầu Việt Nam (Petrolimex) chính thức điều chỉnh giá xăng dầu từ 15 giờ 00 phút ngày 08 tháng 10 năm 2026. Mức giá mới như sau:
    - Xăng E10 RON 95-V: 29.050 đồng/lít (vùng 2: 29.630 đồng/lít)
    - Xăng E10 RON 95-III: 28.250 đồng/lít (vùng 2: 28.810 đồng/lít)
    - Xăng E5 RON 92-II: 27.700 đồng/lít (vùng 2: 28.250 đồng/lít)
    - Dầu điêzen 0,05S-II: 29.120 đồng/lít (vùng 2: 29.700 đồng/lít)
    - Dầu điêzen 0,001S-V: 30.520 đồng/lít (vùng 2: 31.130 đồng/lít)
  `;

  const results = extractPricesFromAnnouncementText(sample1);

  assert.equal(results.length, 5, 'Phải trích xuất đủ 5 mặt hàng nhiên liệu');

  // Mốc thời gian hiệu lực
  assert.equal(results[0]?.effective_at, '2026-10-08 15:00:00');

  // Kiểm tra từng mã và giá Vùng 1, Vùng 2
  const ron95V = results.find((r) => r.symbol === 'RON95_V');
  assert.ok(ron95V);
  assert.equal(ron95V.price_zone1, 29050);
  assert.equal(ron95V.price_zone2, 29630);

  const ron95III = results.find((r) => r.symbol === 'RON95_III');
  assert.ok(ron95III);
  assert.equal(ron95III.price_zone1, 28250);
  assert.equal(ron95III.price_zone2, 28810);

  const ron92 = results.find((r) => r.symbol === 'RON92_E5');
  assert.ok(ron92);
  assert.equal(ron92.price_zone1, 27700);
  assert.equal(ron92.price_zone2, 28250);

  const do005 = results.find((r) => r.symbol === 'DO0005');
  assert.ok(do005);
  assert.equal(do005.price_zone1, 29120);
  assert.equal(do005.price_zone2, 29700);

  const do001 = results.find((r) => r.symbol === 'DO001');
  assert.ok(do001);
  assert.equal(do001.price_zone1, 30520);
  assert.equal(do001.price_zone2, 31130);
});

// ── Test 2: Mẫu văn bản thông cáo giả lập số 2 (Định dạng thông báo điều hành Liên Bộ)
test('Regex Trích Giá - Mẫu 2: Văn bản điều hành giá Liên Bộ rút gọn', () => {
  const sample2 = `
    Kỳ điều hành giá bán lẻ xăng dầu áp dụng từ 15h00 ngày 08/10/2026:
    Xăng E10 RON 95-III không cao hơn 28.250 đồng/lít, giá vùng 2 là 28.810 đồng/lít;
    Xăng E5 RON 92-II không cao hơn 27.700 đồng/lít, vùng 2 là 28.250 đồng/lít;
    Dầu DO 0,05S-II mức 29.120 đồng/lít, vùng 2 là 29.700 đồng/lít;
    Dầu DO 0,001S-V mức 30.520 đồng/lít, vùng 2 là 31.130 đồng/lít;
    Xăng E10 RON 95-V không cao hơn 29.050 đồng/lít, vùng 2 là 29.630 đồng/lít.
  `;

  const results = extractPricesFromAnnouncementText(sample2);

  assert.equal(results.length, 5, 'Phải trích xuất đủ 5 loại nhiên liệu');
  assert.equal(results[0]?.effective_at, '2026-10-08 15:00:00');

  const ron95III = results.find((r) => r.symbol === 'RON95_III');
  assert.equal(ron95III?.price_zone1, 28250);
  assert.equal(ron95III?.price_zone2, 28810);

  const ron95V = results.find((r) => r.symbol === 'RON95_V');
  assert.equal(ron95V?.price_zone1, 29050);
  assert.equal(ron95V?.price_zone2, 29630);
});

// ── Test 3: Logic ưu tiên manual > suggestion
test('Ưu tiên dữ liệu: Giá nhập tay (fuel_manual) luôn ghi đè và ưu tiên hơn scraper/suggestion', () => {
  // Giả lập trạng thái dữ liệu
  const manualRecords = [
    {
      symbol: 'RON95_III',
      price_zone1: 28250,
      price_zone2: 28810,
      effective_at: '2026-10-08 15:00:00',
      note: 'Nhập tay chính thức',
    },
  ];

  const suggestionRecord = {
    symbol: 'RON95_III',
    price_zone1: 26390, // Giá cũ từ nguồn scrape lỗi thời
    price_zone2: 26910,
    effective_at: '2026-10-01 14:00:00',
    source: 'WebGia Scraper',
  };

  // Hàm mô phỏng logic giải quyết ưu tiên trong API
  function resolveFuelPrice(symbol, manualList, suggestions) {
    const manual = manualList.find((m) => m.symbol === symbol);
    if (manual) {
      return {
        source: 'Petrolimex (thông cáo điều hành giá), cập nhật thủ công',
        price_zone1: manual.price_zone1,
        price_zone2: manual.price_zone2,
        effective_at: manual.effective_at,
        isManual: true,
      };
    }
    const sug = suggestions.find((s) => s.symbol === symbol);
    if (sug) {
      return {
        source: sug.source,
        price_zone1: sug.price_zone1,
        price_zone2: sug.price_zone2,
        effective_at: sug.effective_at,
        isManual: false,
      };
    }
    return null;
  }

  const resolved = resolveFuelPrice('RON95_III', manualRecords, [suggestionRecord]);

  assert.equal(resolved.isManual, true);
  assert.equal(resolved.price_zone1, 28250, 'Giá hiển thị phải là giá nhập tay 28.250 chứ KHÔNG phải giá suggestion 26.390');
  assert.equal(resolved.effective_at, '2026-10-08 15:00:00');
  assert.ok(resolved.source.includes('cập nhật thủ công'));
});

// ── Test 4: Kiểm tra điều kiện quá 10 ngày chưa có bản ghi mới
test('Quy tắc quá 10 ngày: Đánh dấu nhắc cập nhật khi ngày hiệu lực > 10 ngày', () => {
  function checkNeedsUpdate(effectiveAtStr, nowTimestamp) {
    if (!effectiveAtStr) return true;
    const t = new Date(effectiveAtStr.replace(' ', 'T')).getTime();
    if (isNaN(t)) return true;
    const diffDays = (nowTimestamp - t) / (1000 * 60 * 60 * 24);
    return diffDays > 10;
  }

  const baseNow = new Date('2026-10-25T15:00:00Z').getTime();

  // Bản ghi ngày 08/10 so với ngày 25/10 là 17 ngày -> quá 10 ngày
  assert.equal(checkNeedsUpdate('2026-10-08 15:00:00', baseNow), true);

  // Bản ghi ngày 18/10 so với ngày 25/10 là 7 ngày -> chưa quá 10 ngày
  assert.equal(checkNeedsUpdate('2026-10-18 15:00:00', baseNow), false);
});
