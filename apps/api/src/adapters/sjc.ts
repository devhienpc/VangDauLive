// src/adapters/sjc.ts
// Adapter giá vàng SJC trong nước
// - Parse bảng HTML của webgia.com/gia-vang/sjc/ (dòng "Vàng SJC 1L, 10L, 1KG" khu vực Hồ Chí Minh)
// - Đơn vị gốc trên webgia là VND/chỉ, nhân 10 để ra VND/lượng và ghi unit='VND/lượng'.

import type { PriceRecord } from '../types.js';

const WEBGIA_SJC_URL = 'https://webgia.com/gia-vang/sjc/';

/**
 * Xử lý số tiền tiếng Việt trên bảng WebGia:
 * "14.130.000" -> bỏ dấu chấm -> 14130000
 */
export function parseVnCurrency(raw?: string | null): number | null {
  if (!raw || raw.trim() === '-' || raw.trim() === '') return null;
  // Bỏ toàn bộ dấu chấm ngăn cách nghìn và khoảng trắng
  const cleaned = raw.replace(/\./g, '').replace(/,/g, '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

/**
 * Quy đổi từ đơn vị chỉ sang đơn vị lượng (1 lượng = 10 chỉ):
 * priceInChi * 10 = priceInLuong
 */
export function convertChiToLuong(priceInChi: number): number {
  return priceInChi * 10;
}

/**
 * Parse bảng giá vàng SJC từ HTML của webgia.com/gia-vang/sjc/
 */
export function parseSjcHtml(html: string): PriceRecord[] {
  const records: PriceRecord[] = [];
  const fetchedAt = new Date().toISOString().replace('T', ' ').slice(0, 19);

  // Tìm các hàng <tr> trong bảng
  // Dòng mẫu: <td>Vàng SJC 1L, 10L, 1KG</td><td class="text-right">14.130.000</td><td class="text-right">14.430.000</td>
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch: RegExpExecArray | null;

  while ((rowMatch = rowRegex.exec(html)) !== null) {
    const rowContent = rowMatch[1] ?? '';
    if (!rowContent.includes('Vàng SJC 1L') && !rowContent.includes('Vàng SJC 1L, 10L, 1KG')) {
      continue;
    }

    // Trích xuất các ô <td>
    const tdMatches = [...rowContent.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) =>
      (m[1] ?? '').replace(/<[^>]+>/g, '').trim(),
    );

    // Thông thường tdMatches gồm: [Tên loại vàng, Giá mua, Giá bán]
    // Ví dụ: ["Vàng SJC 1L, 10L, 1KG", "14.130.000", "14.430.000"]
    if (tdMatches.length >= 3) {
      const buyInChi = parseVnCurrency(tdMatches[1]);
      const sellInChi = parseVnCurrency(tdMatches[2]);


      if (sellInChi != null && sellInChi > 0) {
        const sellPriceLuong = convertChiToLuong(sellInChi);
        const buyPriceLuong = buyInChi != null ? convertChiToLuong(buyInChi) : null;

        records.push({
          symbol: 'SJC-01',
          name: 'Vàng SJC 1 lượng',
          category: 'gold',
          bid: buyPriceLuong,
          ask: sellPriceLuong,
          unit: 'VND/lượng',
          source: 'WebGia (SJC)',
          fetched_at: fetchedAt,
        });

        // Bản ghi 0.5 lượng SJC
        records.push({
          symbol: 'SJC-05',
          name: 'Vàng SJC 0.5 lượng',
          category: 'gold',
          bid: buyPriceLuong != null ? Math.round(buyPriceLuong / 2) : null,
          ask: Math.round(sellPriceLuong / 2),
          unit: 'VND/lượng',
          source: 'WebGia (SJC)',
          fetched_at: fetchedAt,
        });
        break; // Đã tìm thấy dòng SJC 1L khu vực HCM
      }
    }
  }

  return records;
}

/**
 * Fetch và parse bảng giá vàng SJC từ webgia.com
 */
export async function fetchSjcPrices(): Promise<{
  records: PriceRecord[];
  sourceUsed: string;
}> {
  const res = await fetch(WEBGIA_SJC_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)',
      Accept: 'text/html,application/xhtml+xml',
    },
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) {
    throw new Error(`WebGia SJC trả về HTTP ${res.status}`);
  }

  const html = await res.text();
  const records = parseSjcHtml(html);

  if (records.length === 0) {
    throw new Error('Không tìm thấy dòng giá "Vàng SJC 1L, 10L, 1KG" trong HTML WebGia');
  }

  return { records, sourceUsed: 'WebGia (SJC)' };
}
