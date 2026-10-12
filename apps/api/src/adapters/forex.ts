// src/adapters/forex.ts
// Adapter tỷ giá ngoại tệ: USD/VND và các đồng tiền chính
// - Nguồn chính: Vietcombank XML (portal.vietcombank.com.vn)
// - Nguồn dự phòng: open.er-api.com (Open Exchange Rates free API)
// - BỎ Frankfurter vì không hỗ trợ VND.

import type { PriceRecord } from '../types.js';

const VCB_XML_URL = 'https://portal.vietcombank.com.vn/Usercontrols/TVPortal.TyGia/pXML.aspx';
const BACKUP_ER_URL = 'https://open.er-api.com/v6/latest/USD';

/**
 * Chuyển đổi số định dạng chuỗi của Vietcombank: "25,710.00" -> 25710.0
 */
export function parseVcbNumber(raw?: string | null): number | null {
  if (!raw || raw.trim() === '-' || raw.trim() === '') return null;
  const cleaned = raw.replace(/,/g, '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

/**
 * Chuyển đổi ngày trong XML Vietcombank dạng "MM/DD/YYYY H:MM:SS AM/PM" sang ISO string YYYY-MM-DD HH:mm:ss
 */
export function parseVcbDateTime(rawDate?: string | null): string {
  if (!rawDate) return new Date().toISOString().replace('T', ' ').slice(0, 19);

  // Ví dụ: "10/12/2026 9:02:57 PM"
  const m = rawDate.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(.*)$/);
  if (m && m[1] && m[2] && m[3] && m[4]) {
    const month = m[1];
    const day = m[2];
    const year = m[3];
    const timePart = m[4];
    // Chuẩn ISO Date parse được: "YYYY-MM-DD H:MM:SS AM/PM"
    const parsed = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')} ${timePart}`);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().replace('T', ' ').slice(0, 19);
    }
  }

  const fallback = new Date(rawDate);
  if (!isNaN(fallback.getTime())) {
    return fallback.toISOString().replace('T', ' ').slice(0, 19);
  }
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

/**
 * Parse XML tỷ giá của Vietcombank
 */
export function parseVietcombankXml(xmlText: string): PriceRecord[] {
  const records: PriceRecord[] = [];

  const dateMatch = xmlText.match(/<DateTime>(.*?)<\/DateTime>/i);
  const fetchedAt = parseVcbDateTime(dateMatch ? dateMatch[1] : null);

  // Danh sách các cặp tiền cần lấy theo thứ tự ưu tiên
  const targetCurrencies: Record<string, { name: string }> = {
    USD: { name: 'Đô la Mỹ USD/VND' },
    EUR: { name: 'Euro EUR/VND' },
    JPY: { name: 'Yên Nhật JPY/VND' },
    GBP: { name: 'Bảng Anh GBP/VND' },
    CNY: { name: 'Nhân dân tệ CNY/VND' },
    SGD: { name: 'Đô la Singapore SGD/VND' },
  };

  const exrateRegex = /<Exrate\s+([^>]+)\/>/gi;
  let match: RegExpExecArray | null;

  while ((match = exrateRegex.exec(xmlText)) !== null) {
    const attrs = match[1] ?? '';

    const codeMatch = attrs.match(/CurrencyCode="([^"]+)"/i);
    const buyMatch  = attrs.match(/Buy="([^"]+)"/i);
    const sellMatch = attrs.match(/Sell="([^"]+)"/i);

    const code = codeMatch?.[1] ? codeMatch[1].trim() : '';
    const config = targetCurrencies[code];
    if (!config) continue;

    const bid = parseVcbNumber(buyMatch?.[1] ? buyMatch[1] : null);
    const ask = parseVcbNumber(sellMatch?.[1] ? sellMatch[1] : null);

    if (ask != null && ask > 0) {
      records.push({
        symbol: `${code}_VND`,
        name: config.name,

        category: 'forex',
        bid: bid ?? ask,
        ask: ask,
        unit: 'VND',
        source: 'Vietcombank',
        fetched_at: fetchedAt,
      });
    }
  }

  return records;
}

/**
 * Nguồn chính: Fetch tỷ giá Vietcombank XML
 */
async function fetchVietcombankXml(): Promise<PriceRecord[]> {
  const res = await fetch(VCB_XML_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)',
      Accept: 'application/xml, text/xml, */*',
    },
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) {
    throw new Error(`Vietcombank XML trả về HTTP ${res.status}`);
  }

  const xmlText = await res.text();
  const records = parseVietcombankXml(xmlText);
  if (records.length === 0) {
    throw new Error('Không tìm thấy bản ghi tỷ giá nào trong XML Vietcombank');
  }
  return records;
}

/**
 * Nguồn dự phòng: open.er-api.com
 */
export async function fetchOpenErApi(): Promise<PriceRecord[]> {
  const res = await fetch(BACKUP_ER_URL, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) {
    throw new Error(`open.er-api.com trả về HTTP ${res.status}`);
  }

  const data = (await res.json()) as {
    result: string;
    rates?: Record<string, number>;
  };

  if (data.result !== 'success' || !data.rates) {
    throw new Error('open.er-api.com trả về dữ liệu không hợp lệ');
  }

  const vndPerUsd = data.rates['VND'];
  if (!vndPerUsd || vndPerUsd <= 0) {
    throw new Error('open.er-api.com không có tỷ giá VND');
  }

  const fetchedAt = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const records: PriceRecord[] = [];

  // USD/VND
  records.push({
    symbol: 'USD_VND',
    name: 'Đô la Mỹ USD/VND',
    category: 'forex',
    bid: Math.round(vndPerUsd * 0.998 * 10) / 10,
    ask: Math.round(vndPerUsd * 10) / 10,
    unit: 'VND',
    source: 'open.er-api.com',
    fetched_at: fetchedAt,
  });

  // Quy đổi các đồng tiền khác nếu có
  const targets = [
    { code: 'EUR', name: 'Euro EUR/VND' },
    { code: 'JPY', name: 'Yên Nhật JPY/VND' },
    { code: 'GBP', name: 'Bảng Anh GBP/VND' },
    { code: 'CNY', name: 'Nhân dân tệ CNY/VND' },
    { code: 'SGD', name: 'Đô la Singapore SGD/VND' },
  ];

  for (const t of targets) {
    const rateUsd = data.rates[t.code];
    if (rateUsd && rateUsd > 0) {
      const vndPerUnit = vndPerUsd / rateUsd;
      records.push({
        symbol: `${t.code}_VND`,
        name: t.name,
        category: 'forex',
        bid: Math.round(vndPerUnit * 0.998 * 10) / 10,
        ask: Math.round(vndPerUnit * 10) / 10,
        unit: 'VND',
        source: 'open.er-api.com',
        fetched_at: fetchedAt,
      });
    }
  }

  return records;
}

/**
 * Adapter thu thập tỷ giá ngoại tệ: thử Vietcombank XML trước, nếu lỗi chuyển sang open.er-api.com
 */
export async function fetchForexPrices(): Promise<{
  records: PriceRecord[];
  sourceUsed: string;
}> {
  try {
    const records = await fetchVietcombankXml();
    return { records, sourceUsed: 'Vietcombank' };
  } catch (primaryErr) {
    const backupRecords = await fetchOpenErApi();
    return { records: backupRecords, sourceUsed: 'open.er-api.com (backup)' };
  }
}
