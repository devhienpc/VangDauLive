// test/adapters.test.js
// Unit tests kiểm tra:
// 1. Phép nhân 10 và bỏ dấu chấm ngăn cách nghìn của vàng SJC
// 2. Bỏ dấu phẩy ngăn cách nghìn và ngày MM/DD/YYYY của Vietcombank
// 3. Parse bảng giá xăng dầu Petrolimex
// 4. Định dạng period dd/MM của EIA
// 5. Kiểm tra sanity bounds và lệch giá >20%

import test from 'node:test';
import assert from 'node:assert/strict';

import { parseVnCurrency, convertChiToLuong, parseSjcHtml } from '../src/adapters/sjc.ts';
import { parseVcbNumber, parseVcbDateTime, parseVietcombankXml } from '../src/adapters/forex.ts';
import {
  parseFuelPrice,
  parsePetrolimexHtml,
  extractWebGiaFuelEffectiveTime,
  crossCheckFuelPrices,
} from '../src/adapters/fuel.ts';
import { formatPeriodDayMonth } from '../src/adapters/oil.ts';
import { checkPriceSanity } from '../src/adapters/sanity.ts';


test('SJC: Bỏ dấu chấm ngăn cách nghìn chính xác', () => {
  assert.equal(parseVnCurrency('14.130.000'), 14130000);
  assert.equal(parseVnCurrency('14.432.000'), 14432000);
  assert.equal(parseVnCurrency('85.500.000'), 85500000);
  assert.equal(parseVnCurrency('-'), null);
  assert.equal(parseVnCurrency(''), null);
});

test('SJC: Phép nhân 10 quy đổi từ đơn vị chỉ sang đơn vị lượng (1 lượng = 10 chỉ)', () => {
  const priceInChi = 14130000;
  const priceInLuong = convertChiToLuong(priceInChi);
  assert.equal(priceInLuong, 141300000);
  assert.equal(convertChiToLuong(8500000), 85000000);
});

test('SJC: Parse HTML webgia.com trích xuất SJC 1 lượng và nhân 10', () => {
  const mockHtml = `
    <table class="table">
      <tbody>
        <tr>
          <th>Hồ Chí Minh</th>
          <td>Vàng SJC 1L, 10L, 1KG</td>
          <td class="text-right">14.130.000</td>
          <td class="text-right">14.430.000</td>
        </tr>
      </tbody>
    </table>
  `;

  const records = parseSjcHtml(mockHtml);
  assert.equal(records.length, 2); // SJC-01 và SJC-05
  const sjc01 = records.find((r) => r.symbol === 'SJC-01');
  assert.ok(sjc01);
  assert.equal(sjc01.bid, 141300000); // 14.130.000 x 10
  assert.equal(sjc01.ask, 144300000); // 14.430.000 x 10
  assert.equal(sjc01.unit, 'VND/lượng');
  assert.equal(sjc01.source, 'WebGia (SJC)');
});

test('Vietcombank: Bỏ dấu phẩy ngăn cách nghìn và parse số', () => {
  assert.equal(parseVcbNumber('25,710.00'), 25710);
  assert.equal(parseVcbNumber('26,120.50'), 26120.5);
  assert.equal(parseVcbNumber('-'), null);
});

test('Vietcombank: Parse ngày dạng MM/DD/YYYY thành chuẩn ISO', () => {
  const parsed = parseVcbDateTime('10/12/2026 9:02:57 PM');
  assert.ok(parsed.startsWith('2026-10-12'));
});

test('Vietcombank: Parse XML trích xuất USD_VND và các ngoại tệ chính', () => {
  const mockXml = `
    <ExrateList>
      <DateTime>10/12/2026 9:02:57 PM</DateTime>
      <Exrate CurrencyCode="USD" CurrencyName="US DOLLAR" Buy="25,710.00" Transfer="25,740.00" Sell="26,120.00" />
      <Exrate CurrencyCode="EUR" CurrencyName="EURO" Buy="28,277.86" Transfer="28,563.49" Sell="29,769.32" />
    </ExrateList>
  `;

  const records = parseVietcombankXml(mockXml);
  assert.equal(records.length, 2);
  const usd = records.find((r) => r.symbol === 'USD_VND');
  assert.ok(usd);
  assert.equal(usd.bid, 25710);
  assert.equal(usd.ask, 26120);
  assert.equal(usd.source, 'Vietcombank');
});

test('Petrolimex Mẫu 1 (Tên cũ): Parse bảng xăng dầu với tên cũ RON 95-III', () => {
  const mockHtml = `
    <h1>Giá bán lẻ xăng dầu <small>- Cập nhật lúc 15:00:00 08/10/2026</small></h1>
    <table class="table">
      <tbody>
        <tr><th>Xăng RON 95-III</th><td class="text-right">28.250</td><td class="text-right">28.810</td></tr>
        <tr><th>Xăng E5 RON 92-II</th><td class="text-right">27.700</td><td class="text-right">28.250</td></tr>
        <tr><th>DO 0,05S-II</th><td class="text-right">29.120</td><td class="text-right">29.700</td></tr>
        <tr><th>DO 0,001S-V</th><td class="text-right">30.520</td><td class="text-right">31.130</td></tr>
      </tbody>
    </table>
  `;

  const records = parsePetrolimexHtml(mockHtml);
  assert.equal(records.length, 4);

  const ron95 = records.find((r) => r.symbol === 'RON95_III');
  assert.ok(ron95);
  assert.equal(ron95.ask, 28250);
  assert.equal(ron95.unit, 'VND/lít');

  const ron92 = records.find((r) => r.symbol === 'RON92_E5');
  assert.ok(ron92);
  assert.equal(ron92.ask, 27700);

  const do05 = records.find((r) => r.symbol === 'DO0005');
  assert.ok(do05);
  assert.equal(do05.ask, 29120);

  const do01 = records.find((r) => r.symbol === 'DO001');
  assert.ok(do01);
  assert.equal(do01.ask, 30520);
});

test('Petrolimex Mẫu 2 (Tên mới E10): Parse bảng xăng dầu với Xăng E10 RON 95-III', () => {
  const mockHtml = `
    <p>Bảng giá bán lẻ xăng dầu Petrolimex được cập nhật mới nhất vào lúc <strong>15:00:00 08/10/2026</strong></p>
    <table class="table">
      <tbody>
        <tr><th>Xăng E10 RON 95-III</th><td class="text-right">28.250</td><td class="text-right">28.810</td></tr>
        <tr><th>Xăng E5 RON 92-II</th><td class="text-right">27.700</td><td class="text-right">28.250</td></tr>
        <tr><th>DO 0,05S-II</th><td class="text-right">29.120</td><td class="text-right">29.700</td></tr>
        <tr><th>DO 0,001S-V</th><td class="text-right">30.520</td><td class="text-right">31.130</td></tr>
      </tbody>
    </table>
  `;

  const records = parsePetrolimexHtml(mockHtml);
  assert.equal(records.length, 4);

  const ron95 = records.find((r) => r.symbol === 'RON95_III');
  assert.ok(ron95, 'Phải match được RON95_III từ Xăng E10 RON 95-III');
  assert.equal(ron95.ask, 28250);
  assert.equal(ron95.effective_at, '2026-10-08 15:00:00');
});

test('Petrolimex Mẫu 3 (Dòng có giá "-"): Bỏ qua các dòng có giá "-" và chỉ nhận dòng hợp lệ', () => {
  const mockHtml = `
    <table class="table">
      <tbody>
        <tr><th>Xăng RON 95-V</th><td class="text-right">-</td><td class="text-right">-</td></tr>
        <tr><th>Xăng RON 95-III</th><td class="text-right">-</td><td class="text-right">-</td></tr>
        <tr><th>Xăng E5 RON 92-II</th><td class="text-right">26.390</td><td class="text-right">26.910</td></tr>
        <tr><th>DO 0,05S-II</th><td class="text-right">30.490</td><td class="text-right">31.090</td></tr>
        <tr><th>DO 0,001S-V</th><td class="text-right">-</td><td class="text-right">-</td></tr>
      </tbody>
    </table>
  `;

  const records = parsePetrolimexHtml(mockHtml);
  // Chỉ có 2 dòng có giá hợp lệ: RON92_E5 và DO0005
  assert.equal(records.length, 2);

  const ron95 = records.find((r) => r.symbol === 'RON95_III');
  assert.equal(ron95, undefined, 'Dòng có giá "-" không được đưa vào records');

  const ron92 = records.find((r) => r.symbol === 'RON92_E5');
  assert.ok(ron92);
  assert.equal(ron92.ask, 26390);

  const do05 = records.find((r) => r.symbol === 'DO0005');
  assert.ok(do05);
  assert.equal(do05.ask, 30490);
});

test('Petrolimex: Đọc mốc "Cập nhật lúc" và đánh dấu stale=1 nếu cũ hơn 3 ngày', () => {
  // Giả lập HTML cũ: Cập nhật lúc 01/10/2026 (> 3 ngày so với hiện tại 13/10/2026)
  const oldHtml = `
    <h1>Giá bán lẻ xăng dầu <small>- Cập nhật lúc 14:02:05 01/10/2026</small></h1>
    <table>
      <tr><th>Xăng E5 RON 92-II</th><td>26.390</td><td>26.910</td></tr>
    </table>
  `;
  const timeInfoOld = extractWebGiaFuelEffectiveTime(oldHtml);
  assert.equal(timeInfoOld.effectiveAt, '2026-10-01 14:02:05');
  assert.equal(timeInfoOld.isStale, true);
  assert.equal(timeInfoOld.warning, 'warning: nguồn có thể đã cũ');

  const oldRecords = parsePetrolimexHtml(oldHtml);
  assert.equal(oldRecords[0].stale, 1);
  assert.equal(oldRecords[0].effective_at, '2026-10-01 14:02:05');

  // Giả lập HTML mới: Cập nhật lúc hôm nay hoặc 1 ngày trước
  const today = new Date();
  const d = String(today.getDate()).padStart(2, '0');
  const m = String(today.getMonth() + 1).padStart(2, '0');
  const y = today.getFullYear();
  const freshHtml = `
    <h1>Giá bán lẻ xăng dầu <small>- Cập nhật lúc 08:00:00 ${d}/${m}/${y}</small></h1>
    <table>
      <tr><th>Xăng E5 RON 92-II</th><td>27.700</td><td>28.250</td></tr>
    </table>
  `;
  const timeInfoFresh = extractWebGiaFuelEffectiveTime(freshHtml);
  assert.equal(timeInfoFresh.isStale, false);
  assert.equal(timeInfoFresh.warning, undefined);

  const freshRecords = parsePetrolimexHtml(freshHtml);
  assert.equal(freshRecords[0].stale, 0);
});

test('Petrolimex: Đối chiếu chéo 2 nguồn, phát hiện lệch > 1%', () => {
  const recordA = {
    symbol: 'RON92_E5',
    name: 'Xăng E5',
    category: 'fuel',
    ask: 27700,
    unit: 'VND/lít',
    source: 'PVOIL',
  };
  const recordB = {
    symbol: 'RON92_E5',
    name: 'Xăng E5',
    category: 'fuel',
    ask: 26390, // Lệch ~4.7%
    unit: 'VND/lít',
    source: 'WebGia',
  };

  const check = crossCheckFuelPrices(recordA, recordB);
  assert.equal(check.match, false);
  assert.ok(check.diffPct > 0.01);
  assert.ok(check.warning?.includes('không tự ghi đè'));

  // Trường hợp lệch nhỏ dưới 1%
  const recordC = { ...recordB, ask: 27600 }; // Lệch ~0.36%
  const checkClose = crossCheckFuelPrices(recordA, recordC);
  assert.equal(checkClose.match, true);
});

test('EIA: Định dạng period YYYY-MM-DD sang dd/MM', () => {
  assert.equal(formatPeriodDayMonth('2026-10-06'), '06/10');
  assert.equal(formatPeriodDayMonth('2026-05-18'), '18/05');
});

test('Sanity: Phát hiện giá bất thường và lệch quá 20%', () => {
  // 1. Giá âm hoặc <= 0
  const badPrice = checkPriceSanity({
    symbol: 'USD_VND',
    name: 'USD',
    category: 'forex',
    bid: -100,
    ask: 0,
    unit: 'VND',
    source: 'Test',
  });
  assert.equal(badPrice.valid, false);

  // 2. Vi phạm biên sanity (USD/VND = 50.000 vượt quá max 35.000)
  const outOfBounds = checkPriceSanity({
    symbol: 'USD_VND',
    name: 'USD',
    category: 'forex',
    bid: 49000,
    ask: 50000,
    unit: 'VND',
    source: 'Test',
  });
  assert.equal(outOfBounds.valid, false);

  // 3. Lệch quá 20% so với bản ghi trước (giá trước 25.000, giá mới 31.000 lệch 24%)
  const priceSpike = checkPriceSanity(
    {
      symbol: 'USD_VND',
      name: 'USD',
      category: 'forex',
      bid: 30000,
      ask: 31000,
      unit: 'VND',
      source: 'Test',
    },
    25000
  );
  assert.equal(priceSpike.valid, false);
  assert.ok(priceSpike.reason?.includes('lệch quá 20%'));

  // 4. Giá biến động bình thường trong ngưỡng (25.000 -> 25.500 lệch 2%)
  const normalPrice = checkPriceSanity(
    {
      symbol: 'USD_VND',
      name: 'USD',
      category: 'forex',
      bid: 25400,
      ask: 25500,
      unit: 'VND',
      source: 'Test',
    },
    25000
  );
  assert.equal(normalPrice.valid, true);
});
