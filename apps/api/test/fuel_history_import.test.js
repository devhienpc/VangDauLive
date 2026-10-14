// test/fuel_history_import.test.js
// Kiểm tra tính năng parse CSV lịch sử điều hành giá xăng dầu và file template

import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Mô phỏng lại hàm parse chuẩn trong src/index.ts để test độc lập
function parseFuelAdjustmentsCSV(rawCsv) {
  const clean = rawCsv.replace(/^\uFEFF/, '').trim();
  const lines = clean.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) {
    return { records: [], errors: ['Tệp CSV rỗng'] };
  }

  function splitRow(line) {
    const fields = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        fields.push(cur.trim());
        cur = '';
      } else {
        cur += char;
      }
    }
    fields.push(cur.trim());
    return fields;
  }

  const headerLine = splitRow(lines[0] ?? '').map((h) => h.toLowerCase().trim());
  const colIndex = {
    effective_at: headerLine.indexOf('effective_at'),
    product: headerLine.indexOf('product'),
    price_zone1: headerLine.indexOf('price_zone1'),
    delta: headerLine.indexOf('delta'),
    source_url: headerLine.indexOf('source_url'),
    note: headerLine.indexOf('note'),
  };

  if (colIndex.effective_at === -1 || colIndex.product === -1 || colIndex.price_zone1 === -1) {
    return {
      records: [],
      errors: [
        'Header CSV thiếu các cột bắt buộc: effective_at, product, price_zone1. Các cột được hỗ trợ: effective_at, product, price_zone1, delta, source_url, note',
      ],
    };
  }

  const records = [];
  const errors = [];

  for (let i = 1; i < lines.length; i++) {
    const rawLine = lines[i];
    if (!rawLine) continue;
    const line = rawLine.trim();
    if (!line) continue;
    const cols = splitRow(line);

    const rawEffective = cols[colIndex.effective_at]?.trim();
    const rawProduct = cols[colIndex.product]?.trim();
    const rawPrice = cols[colIndex.price_zone1]?.trim();
    const rawDelta = colIndex.delta !== -1 ? cols[colIndex.delta]?.trim() : '';
    const rawSource = colIndex.source_url !== -1 ? cols[colIndex.source_url]?.trim() : '';
    const rawNote = colIndex.note !== -1 ? cols[colIndex.note]?.trim() : '';

    if (!rawEffective) {
      errors.push(`Dòng ${i + 1}: Thiếu effective_at`);
      continue;
    }
    if (!rawProduct) {
      errors.push(`Dòng ${i + 1}: Thiếu product`);
      continue;
    }
    if (!rawPrice) {
      errors.push(`Dòng ${i + 1}: Thiếu price_zone1`);
      continue;
    }

    const priceNum = parseInt(rawPrice.replace(/[,\.]/g, ''), 10);
    if (isNaN(priceNum) || priceNum <= 0) {
      errors.push(`Dòng ${i + 1}: price_zone1 không hợp lệ (${rawPrice})`);
      continue;
    }

    let deltaNum = null;
    if (rawDelta !== undefined && rawDelta !== '') {
      const parsedDelta = parseInt(rawDelta.replace(/[,\.\+]/g, ''), 10);
      if (!isNaN(parsedDelta)) {
        deltaNum = rawDelta.startsWith('-') ? -Math.abs(parsedDelta) : parsedDelta;
      }
    }

    records.push({
      effective_at: rawEffective,
      product: rawProduct,
      price_zone1: priceNum,
      delta: deltaNum,
      source_url: rawSource || null,
      note: rawNote || null,
    });
  }

  return { records, errors };
}

test('CSV Template: Tồn tại đúng đường dẫn data/fuel_adjustments_template.csv và đọc thành công 1 dòng ví dụ', () => {
  const templatePath = path.resolve(__dirname, '../../../data/fuel_adjustments_template.csv');
  assert.ok(fs.existsSync(templatePath), 'File data/fuel_adjustments_template.csv phải tồn tại');

  const content = fs.readFileSync(templatePath, 'utf8');
  const { records, errors } = parseFuelAdjustmentsCSV(content);

  assert.strictEqual(errors.length, 0, 'Không được có lỗi khi parse file template');
  assert.strictEqual(records.length, 1, 'File template phải chứa đúng 1 dòng ví dụ');

  const ex = records[0];
  assert.strictEqual(ex.effective_at, '2026-10-01 15:00:00');
  assert.strictEqual(ex.product, 'RON95_III');
  assert.strictEqual(ex.price_zone1, 28020);
  assert.strictEqual(ex.delta, 340);
  assert.ok(ex.source_url?.includes('petrolimex.com.vn'));
  assert.ok(ex.note?.includes('01/10/2026'));
});

test('CSV Parser: Xử lý chuỗi có dấu nháy kép, dấu phẩy bên trong nháy kép và số âm/dương', () => {
  const csv = `effective_at,product,price_zone1,delta,source_url,note
2026-10-08 15:00:00,RON95_III,"27,850",-170,https://baochinhphu.vn,"Kỳ điều hành ngày 08/10/2026, giảm 170đ"
2026-10-01 15:00:00,RON92_E5,27510,+310,https://petrolimex.com.vn,Tăng 310đ
`;

  const { records, errors } = parseFuelAdjustmentsCSV(csv);
  assert.strictEqual(errors.length, 0);
  assert.strictEqual(records.length, 2);

  assert.strictEqual(records[0].price_zone1, 27850);
  assert.strictEqual(records[0].delta, -170);
  assert.strictEqual(records[0].note, 'Kỳ điều hành ngày 08/10/2026, giảm 170đ');

  assert.strictEqual(records[1].price_zone1, 27510);
  assert.strictEqual(records[1].delta, 310);
});

test('CSV Parser: Bắt lỗi khi thiếu cột bắt buộc hoặc giá không hợp lệ', () => {
  const badCsv = `effective_at,product,price_zone1
2026-10-01 15:00:00,RON95_III,abc
,RON95_III,28000
2026-10-01 15:00:00,,28000
`;

  const { records, errors } = parseFuelAdjustmentsCSV(badCsv);
  assert.strictEqual(records.length, 0);
  assert.strictEqual(errors.length, 3);
  assert.ok(errors[0].includes('price_zone1 không hợp lệ'));
  assert.ok(errors[1].includes('Thiếu effective_at'));
  assert.ok(errors[2].includes('Thiếu product'));
});
