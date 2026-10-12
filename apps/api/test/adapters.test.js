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
import { parseFuelPrice, parsePetrolimexHtml } from '../src/adapters/fuel.ts';
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

test('Petrolimex: Parse bảng xăng dầu webgia.com lấy Vùng 1 cho 4 loại nhiên liệu', () => {
  const mockHtml = `
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
